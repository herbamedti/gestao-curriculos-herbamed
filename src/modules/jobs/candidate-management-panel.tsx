'use client';
import { useActionState, useState } from 'react';
import Link from '@/ui/link';
import { Modal } from '@/ui/modal';
import { Icon } from '@/ui/icon';
import { Badge, date } from '@/ui/common';
import { ActionForm, Hidden, Select } from '@/ui/form';
import { SubmitButton } from '@/ui/submit-button';
import { manageJobCandidate, searchJobCandidate } from './candidate-management-actions';
import type { JobCandidateRow } from './candidate-management-schema';
import { DeleteApplicationButton } from '@/modules/applications/delete-button';
import { formatPhone, phoneHref } from '@/ui/contact-format';

type Stage={id:string;name:string;terminal:boolean};
export function JobCandidatePanel({jobId,rows,stages,canLink,canMove,canUnlink,canDelete=false,linkAvailable}:{jobId:string;rows:JobCandidateRow[];stages:Stage[];canLink:boolean;canMove:boolean;canUnlink:boolean;canDelete?:boolean;linkAvailable:boolean}) {
  const [modal,setModal]=useState<{type:'edit'|'unlink';row:JobCandidateRow}|'link'|null>(null);
  const [notice,setNotice]=useState('');
  function done(result:{message:string}){setNotice(result.message);setModal(null);}
  function open(value:typeof modal){setNotice('');setModal(value);}
  return <>
    <div className="register-toolbar job-candidate-toolbar"><p className="muted">Abra o processo para consultar respostas, avaliações e histórico.</p>
      {canLink&&<button type="button" className="button primary" disabled={!linkAvailable} onClick={()=>open('link')}><Icon name="person_add"/>Vincular candidato</button>}
    </div>
    {canLink&&!linkAvailable&&<p className="alert info">Novos vínculos exigem uma vaga publicada, pública, dentro do prazo e com etapas configuradas.</p>}
    {notice&&<p className="alert success" role="status">{notice}</p>}
    {rows.length?<div className="table-wrap"><table className="register-table"><caption className="sr-only">Candidatos desta vaga</caption><thead><tr><th>Candidato</th><th>Etapa</th><th>Situação</th><th>Inscrição</th><th>Ações</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}>
      <td><Link href={`/rh/candidaturas/${row.id}`} className="text-link"><strong>{row.full_name}</strong></Link><small>{row.headline||'Área não informada'}{row.city?` · ${row.city}`:''}</small>
        <div className="candidate-table-contacts">
          <a className="candidate-table-contact" href={`mailto:${encodeURIComponent(row.email).replace(/%40/g,'@')}`} aria-label={`E-mail: ${row.email}`}><Icon name="mail"/><span>{row.email}</span></a>
          {row.phone&&<CandidatePhone value={row.phone}/>}
        </div>
      </td>
      <td>{row.stage_name}{row.terminal&&<small>Etapa final</small>}</td>
      <td><Badge tone={row.unlinked_at?'pending':row.status==='active'?'green':''}>{row.unlinked_at?'Desvinculada':row.status==='active'?'Em andamento':row.status==='withdrawn'?'Retirada pelo candidato':'Encerrada'}</Badge>{row.unlinked_at&&<small>Em {date(row.unlinked_at)}</small>}</td>
      <td>{date(row.created_at)}</td><td><div className="row-actions">
        <Link className="icon-button" href={`/rh/candidaturas/${row.id}`} title="Ver processo" aria-label={`Ver processo de ${row.full_name}`}><Icon name="visibility"/></Link>
        <Link className="icon-button" href={`/rh/candidatos/${row.candidate_id}`} title={row.can_edit?'Consultar e editar currículo':'Consultar currículo'} aria-label={`${row.can_edit?'Editar':'Ver'} currículo de ${row.full_name}`}><Icon name={row.can_edit?'edit_document':'description'}/></Link>
        {canMove&&!row.unlinked_at&&<button type="button" className="icon-button" title="Editar candidatura" aria-label={`Editar candidatura de ${row.full_name}`} onClick={()=>open({type:'edit',row})}><Icon name="edit"/></button>}
        {canUnlink&&!row.unlinked_at&&<button type="button" className="icon-button danger-action" title="Desvincular da vaga" aria-label={`Desvincular ${row.full_name}`} onClick={()=>open({type:'unlink',row})}><Icon name="person_remove"/></button>}
        {canLink&&row.unlinked_at&&<button type="button" className="icon-button" title="Vincular novamente" aria-label={`Vincular novamente ${row.full_name}`} disabled={!linkAvailable} onClick={()=>open('link')}><Icon name="person_add"/></button>}
        {canDelete&&<DeleteApplicationButton id={row.id} updatedAt={row.updated_at} name={row.full_name} iconOnly/>}
      </div></td>
    </tr>)}</tbody></table></div>:<div className="empty"><Icon name="group"/><h3>Nenhum candidato neste filtro</h3><p className="muted">Revise os filtros ou vincule um currículo existente à vaga.</p></div>}
    {modal==='link'&&<Modal title="Vincular candidato à vaga" description="Busque um currículo existente por nome ou e-mail. A pessoa receberá uma atualização no portal." onClose={()=>setModal(null)}><LinkCandidate jobId={jobId} onSuccess={done}/></Modal>}
    {modal&&modal!=='link'&&<Modal title={modal.type==='edit'?'Editar candidatura':'Desvincular da vaga'} description={modal.row.full_name} onClose={()=>setModal(null)}>
      {modal.type==='unlink'&&<p className="alert warning">Esta ação remove a pessoa do processo desta vaga. O currículo, as outras candidaturas e o histórico serão preservados. Entrevistas ainda agendadas para esta candidatura serão canceladas.</p>}
      <ActionForm action={manageJobCandidate} submit={modal.type==='edit'?'Salvar candidatura':'Confirmar desvinculação'} onSuccess={done}>
        <Hidden name="op" value={modal.type}/><Hidden name="job_id" value={jobId}/><Hidden name="application_id" value={modal.row.id}/><Hidden name="expected_updated_at" value={modal.row.updated_at}/>
        {modal.type==='edit'&&<><Select name="stage_id" label="Etapa do processo" required value={modal.row.stage_id}>{stages.map(stage=><option key={stage.id} value={stage.id}>{stage.name}{stage.terminal?' · Final':''}</option>)}</Select>
          <Select name="status" label="Situação da candidatura" required value={modal.row.status==='withdrawn'?'':modal.row.status}><option value="" disabled>Selecione</option><option value="active">Em andamento</option><option value="closed">Encerrada</option></Select>
          <p className="muted">Alterações ficam no histórico e geram uma atualização no portal. Encerrar cancela as entrevistas ainda agendadas.</p></>}
        <Reason label={modal.type==='edit'?'Motivo da alteração':'Motivo da desvinculação'}/>
      </ActionForm>
    </Modal>}
  </>;
}
function CandidatePhone({value}:{value:string}) {
  const href=phoneHref(value);
  const content=<><Icon name="call"/><span>{formatPhone(value)}</span></>;
  return href?<a className="candidate-table-contact" href={href} aria-label={`Telefone: ${formatPhone(value)}`}>{content}</a>:<span className="candidate-table-contact">{content}</span>;
}
function Reason({label}:{label:string}){return <label className="field"><span>{label} *</span><textarea name="note" required minLength={3} maxLength={2000} rows={3}/></label>;}
function LinkCandidate({jobId,onSuccess}:{jobId:string;onSuccess:(result:{message:string})=>void}) {
  const [state,search,pending]=useActionState(searchJobCandidate,{rows:[],message:'',searched:false});
  const [selected,setSelected]=useState('');
  return <div className="stack">
    <form action={search} className="form" aria-busy={pending} onSubmit={()=>setSelected('')}><Hidden name="job_id" value={jobId}/>
      <label className="field"><span>Buscar candidato *</span><input name="search" type="search" required minLength={2} maxLength={100} placeholder="Nome ou e-mail"/></label>
      <SubmitButton className="button outlined" busy={pending} pendingLabel="Buscando…">Buscar currículos</SubmitButton>
      {state.message&&<p role="status" className="alert info">{state.message}</p>}
    </form>
    {state.searched&&state.rows.length>0&&<ActionForm action={manageJobCandidate} submit="Confirmar vínculo" onSuccess={onSuccess} disabled={!selected||pending}>
      <Hidden name="op" value="link"/><Hidden name="job_id" value={jobId}/>
      <fieldset className="candidate-link-results"><legend>Selecione um candidato</legend>{state.rows.map(person=><label className={`candidate-link-option ${person.already_linked?'muted':''}`} key={person.id}>
        <input type="radio" name="candidate_id" value={person.id} required disabled={person.already_linked||pending} checked={selected===person.id} onChange={()=>setSelected(person.id)}/>
        <span><strong>{person.full_name}</strong><small>{person.email} · {person.city||'Local não informado'}</small><small>{person.already_linked?'Já vinculado':person.headline||'Currículo disponível'}</small></span>
      </label>)}</fieldset>
      <p className="muted">Mostramos até 20 resultados por busca. Refine o nome se necessário. O vínculo exige os dados essenciais do currículo completos.</p><Reason label="Motivo da vinculação"/>
    </ActionForm>}
  </div>;
}
