import { PDFDocument } from 'pdf-lib';

export async function inspectPdf(data:Uint8Array) {
  const bytes=Buffer.from(data);
  if(bytes.length<100||bytes.length>5*1024*1024||bytes.subarray(0,5).toString('ascii')!=='%PDF-')throw new Error('invalid_pdf');
  if(!bytes.subarray(-1024).toString('latin1').includes('%%EOF'))throw new Error('invalid_pdf');
  const text=bytes.toString('latin1');
  if(/\/(JavaScript|JS|OpenAction|Launch|AA|EmbeddedFiles)\b/i.test(text))throw new Error('active_pdf');
  try {
    const document=await PDFDocument.load(bytes,{updateMetadata:false});
    if(document.getPageCount()<1||document.getPageCount()>100)throw new Error('invalid_pdf');
  }catch {throw new Error('invalid_pdf');}
}
