import { Fragment } from 'react';

// Only these Markdown markers are interpreted. HTML, URLs and scripts remain text.
function inline(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}

export function PolicyBody({ body }: { body: string }) {
  const blocks = body.replace(/\r\n?/g, '\n').split(/\n\s*\n/);
  return (
    <div className="policy-body">
      {blocks.map((block, index) => {
        const lines = block.split('\n');
        // Render each run independently so a heading/list needs no blank separator.
        const runs: {
          kind: 'paragraph' | 'list' | 'ordered' | 'heading' | 'rule';
          lines: string[];
        }[] = [];
        for (const line of lines) {
          if (!line.trim()) continue;
          const kind = /^#{1,6}\s+/.test(line)
            ? 'heading'
            : /^\s*[-*]\s+/.test(line)
              ? 'list'
              : /^\s*\d+[.)]\s+/.test(line)
                ? 'ordered'
                : /^\s*(?:---+|___+)\s*$/.test(line)
                  ? 'rule'
                  : 'paragraph';
          const last = runs.at(-1);
          if (last && last.kind === kind && !['heading', 'rule'].includes(kind))
            last.lines.push(line);
          else runs.push({ kind, lines: [line] });
        }
        return (
          <Fragment key={index}>
            {runs.map((run, i) => {
              if (run.kind === 'rule') return <hr key={i} />;
              if (run.kind === 'heading') {
                const level = run.lines[0].match(/^#+/)![0].length;
                const Heading = level <= 2 ? 'h3' : 'h4';
                return <Heading key={i}>{inline(run.lines[0].replace(/^#+\s+/, ''))}</Heading>;
              }
              if (run.kind === 'list' || run.kind === 'ordered') {
                const List = run.kind === 'list' ? 'ul' : 'ol';
                return (
                  <List key={i}>
                    {run.lines.map((line, j) => (
                      <li key={j}>{inline(line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, ''))}</li>
                    ))}
                  </List>
                );
              }
              return <p key={i}>{inline(run.lines.join('\n'))}</p>;
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
