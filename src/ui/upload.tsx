'use client';
import { useState } from 'react';
import { browserDb } from '@/lib/browser';
type Kind='resume'|'photo';
export function Upload({candidateId,kind}:{candidateId:string;kind:Kind}) {
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  async function upload(file:File|undefined) {
    if(!file)return;
    const max=kind==='resume'?5*1024*1024:2*1024*1024;
    const valid=kind==='resume'?file.name.toLowerCase().endsWith('.pdf')&&file.type==='application/pdf':file.type==='image/jpeg'||file.type==='image/png';
    if(!valid||file.size>max||file.size===0) {setMessage(kind==='resume'?'Escolha um PDF de até 5 MB.':'Escolha JPG ou PNG de até 2 MB.');return;}
    setBusy(true);setMessage('Enviando arquivo…');
    try {
      const response=await fetch('/api/uploads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({candidateId,name:file.name,size:file.size,kind})});
      if(!response.ok) throw new Error('registration');
      const ticket=await response.json() as {path:string;token:string};
      const client=browserDb();
      const {error:storageError}=await client.storage.from('quarantine').uploadToSignedUrl(ticket.path,ticket.token,file,{contentType:kind==='resume'?'application/pdf':file.type});
      if(storageError) throw new Error('upload');
      setMessage(kind==='resume'?'Currículo recebido. Você já pode se candidatar; a equipe poderá abrir o arquivo após a análise automática de segurança.':'Arquivo recebido. Ele ficará disponível após a análise automática de segurança.');
      window.location.reload();
    } catch {setMessage('Não foi possível enviar. Tente novamente.');}
    finally {setBusy(false);}
  }
  return <div className="form"><label className="field"><span>{kind==='resume'?'Selecionar currículo (PDF até 5 MB)':'Selecionar foto (JPG ou PNG até 2 MB)'}</span><input type="file" accept={kind==='resume'?'.pdf,application/pdf':'image/jpeg,image/png'} disabled={busy} onChange={event=>void upload(event.target.files?.[0])}/></label><div aria-live="polite" className="muted">{message}</div></div>;
}
