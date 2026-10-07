import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { CurriculumDocument } from './curriculum-document';

function printable(value: string, font: PDFFont) {
  return [...value.replace(/[–—−]/g, '-')]
    .map((char) => {
      try {
        font.encodeText(char);
        return char;
      } catch {
        return '?';
      }
    })
    .join('');
}

function wrap(value: string, font: PDFFont, size: number, width: number) {
  const result: string[] = [];
  for (const paragraph of printable(value, font).split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) {
        line = next;
        continue;
      }
      if (line) result.push(line);
      line = '';
      for (const char of word) {
        if (line && font.widthOfTextAtSize(line + char, size) > width) {
          result.push(line);
          line = '';
        }
        line += char;
      }
    }
    result.push(line);
  }
  return result;
}

export async function curriculumPdf(document: CurriculumDocument) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Currículo - ${document.name}`);
  pdf.setAuthor(document.name);
  pdf.setLanguage('pt-BR');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.063, 0.125, 0.2);
  const muted = rgb(0.345, 0.404, 0.482);
  const green = rgb(0, 0.478, 0.22);
  const border = rgb(0.843, 0.871, 0.918);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const width = pageWidth - margin * 2;
  const bottom = 58;
  let page: PDFPage = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 58;
  let activeSection = '';
  let activeEntry = '';

  const fitted = (value: string, font: PDFFont, size: number, maxWidth: number) => {
    let clean = printable(value, font);
    if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
    while (clean && font.widthOfTextAtSize(`${clean}...`, size) > maxWidth)
      clean = clean.slice(0, -1);
    return `${clean}...`;
  };
  const heading = (title: string) => {
    page.drawText(printable(title.toLocaleUpperCase('pt-BR'), bold), {
      x: margin,
      y,
      font: bold,
      size: 10.5,
      color: green,
    });
    page.drawLine({
      start: { x: margin, y: y - 8 },
      end: { x: pageWidth - margin, y: y - 8 },
      thickness: 0.65,
      color: border,
    });
    y -= 27;
  };
  const nextPage = (repeatSection = true, repeatEntry = true) => {
    page = pdf.addPage([pageWidth, pageHeight]);
    page.drawText(fitted(document.name, bold, 9, width - 90), {
      x: margin,
      y: pageHeight - 37,
      size: 9,
      font: bold,
      color: muted,
    });
    page.drawText('CURRÍCULO', {
      x: pageWidth - margin - 54,
      y: pageHeight - 37,
      size: 8,
      font: regular,
      color: muted,
    });
    page.drawLine({
      start: { x: margin, y: pageHeight - 48 },
      end: { x: pageWidth - margin, y: pageHeight - 48 },
      thickness: 0.6,
      color: border,
    });
    y = pageHeight - 74;
    if (repeatSection && activeSection) heading(`${activeSection} - continuação`);
    if (repeatEntry && activeEntry) {
      for (const line of wrap(`${activeEntry} (continuação)`, bold, 10.5, width)) {
        page.drawText(line, { x: margin, y, font: bold, size: 10.5, color: ink });
        y -= 15;
      }
      y -= 5;
    }
  };
  const ensure = (height: number, repeatSection = true, repeatEntry = true) => {
    if (y - height < bottom) nextPage(repeatSection, repeatEntry);
  };
  const text = (
    value: string,
    size = 10.5,
    heavy = false,
    color = ink,
    leading = 16,
    maxWidth = width,
    x = margin,
  ) => {
    const font = heavy ? bold : regular;
    for (const line of wrap(value, font, size, maxWidth)) {
      ensure(leading);
      if (line) page.drawText(line, { x, y, size, font, color });
      y -= leading;
    }
  };
  const section = (title: string, firstHeight = 32) => {
    activeEntry = '';
    ensure(45 + firstHeight, false, false);
    y -= 18;
    activeSection = title;
    heading(title);
  };
  const bullet = (value: string) => {
    const lines = wrap(value, regular, 10.5, width - 14);
    ensure(Math.min(lines.length * 16 + 4, 48));
    lines.forEach((line, index) => {
      ensure(16);
      if (index === 0)
        page.drawText('•', { x: margin + 2, y, size: 10, font: regular, color: green });
      if (line) page.drawText(line, { x: margin + 14, y, size: 10.5, font: regular, color: ink });
      y -= 16;
    });
    y -= 4;
  };

  text(document.name, 25, true, ink, 31);
  if (document.headline) text(document.headline, 12, false, green, 20);
  if (document.location) text(document.location, 9.5, false, muted, 15);
  text(document.contacts.join('  |  '), 9.5, false, muted, 15);
  document.links.forEach((link) => text(`${link.label}: ${link.url}`, 9, false, muted, 14));
  y -= 5;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1.5,
    color: green,
  });
  y -= 3;

  if (document.summary) {
    section('Resumo profissional');
    text(document.summary);
  }
  for (const group of document.sections) {
    const recordLayout = (entry: (typeof group.entries)[number]) => {
      const period = printable(entry.period, regular);
      const periodWidth = regular.widthOfTextAtSize(period, 9);
      const inline = Boolean(period) && periodWidth <= 190;
      const titleWidth = inline ? width - periodWidth - 20 : width;
      const titleHeight = wrap(entry.title, bold, 11, titleWidth).length * 17;
      const height =
        titleHeight +
        (entry.organization ? wrap(entry.organization, regular, 10, width).length * 15 : 0) +
        (entry.metadata ? wrap(entry.metadata, regular, 9, width).length * 14 : 0) +
        (!inline && period ? wrap(period, regular, 9, width).length * 14 : 0) +
        (entry.bullets.length
          ? 6 + Math.min(wrap(entry.bullets[0], regular, 10.5, width - 14).length * 16 + 4, 48)
          : 5);
      return { period, periodWidth, inline, titleWidth, height };
    };
    section(group.label, recordLayout(group.entries[0]).height);
    for (const entry of group.entries) {
      const layout = recordLayout(entry);
      ensure(layout.height, true, false);
      activeEntry = entry.title;
      if (layout.inline)
        page.drawText(layout.period, {
          x: pageWidth - margin - layout.periodWidth,
          y: y + 1,
          size: 9,
          font: regular,
          color: muted,
        });
      text(entry.title, 11, true, ink, 17, layout.titleWidth);
      if (entry.organization) text(entry.organization, 10, false, ink, 15);
      if (!layout.inline && layout.period) text(layout.period, 9, false, muted, 14);
      if (entry.metadata) text(entry.metadata, 9, false, muted, 14);
      if (entry.bullets.length) y -= 6;
      entry.bullets.forEach(bullet);
      activeEntry = '';
      y -= 10;
    }
  }
  if (document.skills.length) {
    section('Habilidades');
    text(document.skills.join('  ·  '));
  }
  if (document.competencies.length) {
    section('Competências pessoais');
    text(document.competencies.join('  ·  '));
  }
  if (document.information.length) {
    section('Informações complementares');
    document.information.forEach((value) => text(value, 9.5, false, muted, 15));
  }

  pdf.getPages().forEach((item, index) => {
    item.drawLine({
      start: { x: margin, y: 40 },
      end: { x: pageWidth - margin, y: 40 },
      thickness: 0.6,
      color: border,
    });
    item.drawText(fitted(document.name, regular, 8, width - 90), {
      x: margin,
      y: 26,
      size: 8,
      font: regular,
      color: muted,
    });
    const counter = `${index + 1} / ${pdf.getPageCount()}`;
    item.drawText(counter, {
      x: pageWidth - margin - regular.widthOfTextAtSize(counter, 8),
      y: 26,
      size: 8,
      font: regular,
      color: muted,
    });
  });
  return pdf.save();
}
