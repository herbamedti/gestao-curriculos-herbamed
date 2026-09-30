import { describe,expect,it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { inspectPdf } from './inspect';
describe('inspeção estrutural de PDF',()=>{
  it('aceita PDF bem formado com página',async()=>{const pdf=await PDFDocument.create();pdf.addPage();await expect(inspectPdf(await pdf.save())).resolves.toBeUndefined();});
  it('rejeita assinatura falsa ou conteúdo ativo',async()=>{
    await expect(inspectPdf(Buffer.from('%PDF-1.4\n'+('x'.repeat(200))+'\n%%EOF'))).rejects.toThrow('invalid_pdf');
    const pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.concat([Buffer.from(await pdf.save()),Buffer.from('\n/JavaScript\n')]);
    await expect(inspectPdf(bytes)).rejects.toThrow('active_pdf');
  });
});
