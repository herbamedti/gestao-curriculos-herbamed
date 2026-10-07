'use client';
import { useState } from 'react';
import type { Database } from '@/lib/database.types';
import { mutate } from '@/modules/actions';
import { ActionForm, Field, Hidden } from '@/ui/form';
import { EditableList } from '@/ui/editable-list';

type Stage = Pick<Database['public']['Tables']['job_stages']['Row'], 'id' | 'name' | 'terminal'>;
type Question = Database['public']['Tables']['job_questions']['Row'];

function StageFields({ stages }: { stages: Stage[] }) {
  const [items, setItems] = useState(stages);
  function move(index: number, delta: number) {
    const next = [...items];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setItems(next);
  }
  return <><Hidden name="expected_stages" value={JSON.stringify(stages)}/><Hidden name="stages" value={JSON.stringify(items)}/>
      <ol className="process-editor-list">{items.map((item, index) => <li className="process-editor-item" key={item.id}>
        <label className="field"><span>Etapa {index + 1} · Nome</span><input required minLength={2} maxLength={100} value={item.name} onChange={event => setItems(items.map(stage => stage.id === item.id ? { ...stage, name: event.target.value } : stage))}/></label>
        <label className="check"><input type="checkbox" checked={item.terminal} onChange={event => setItems(items.map(stage => stage.id === item.id ? { ...stage, terminal: event.target.checked } : stage))}/>Etapa final do processo</label>
        <div className="actions"><button type="button" className="button outlined" disabled={index === 0} aria-label={`Subir etapa ${index + 1}`} onClick={() => move(index, -1)}>↑ Subir</button><button type="button" className="button outlined" disabled={index === items.length - 1} aria-label={`Descer etapa ${index + 1}`} onClick={() => move(index, 1)}>↓ Descer</button><button type="button" className="button destructive" disabled={items.length === 1} aria-label={`Remover etapa ${index + 1}`} onClick={() => setItems(items.filter(stage => stage.id !== item.id))}>Remover</button></div>
      </li>)}</ol>
      <button type="button" className="button tonal" disabled={items.length >= 50} onClick={() => setItems([...items, { id: crypto.randomUUID(), name: '', terminal: false }])}>Adicionar etapa</button>
  </>;
}

export function StageEditor({ jobId, stages }: { jobId: string; stages: Stage[] }) {
  return <section className="card"><h2>Etapas do processo</h2><p className="muted">Edite as etapas, remova ou use Subir e Descer para alterar a ordem. A primeira etapa recebe novas candidaturas e deve ser aberta. Etapas vinculadas a candidaturas ou ao histórico precisam ser mantidas.</p>
    <ActionForm action={mutate} submit="Salvar etapas"><Hidden name="op" value="job-stages"/><Hidden name="job_id" value={jobId}/><StageFields stages={stages} key={JSON.stringify(stages)}/></ActionForm>
  </section>;
}

function QuestionFields({ question }: { question?: Question }) {
  const [kind, setKind] = useState(question?.kind || 'text');
  return <><Field name="label" label="Pergunta" value={question?.label} required minLength={2} maxLength={500}/>
    <label className="field"><span>Tipo de pergunta</span><select name="kind" value={kind} onChange={event => setKind(event.target.value)}><option value="text">Texto</option><option value="choice">Opção (uma resposta)</option></select></label>
    {kind === 'choice' ? <EditableList name="options" label="Opções de resposta" inputLabel="Nova opção" chips={false} bulk initial={question?.options || []} maxItems={30} maxLength={200} resetOnFormReset={!question}/> : <Hidden name="options" value=""/>}
    <label className="check"><input type="checkbox" name="required" defaultChecked={question?.required}/>Resposta obrigatória</label>
  </>;
}

export function QuestionEditor({ jobId, questions }: { jobId: string; questions: Question[] }) {
  return <section className="card"><h2>Perguntas para candidatura</h2><p className="muted">Escolha uma resposta em texto livre ou uma única opção cadastrada. Perguntas com respostas recebidas mantêm seu conteúdo e suas opções para preservar o histórico.</p>
    {questions.length ? questions.map(question => <div className="process-editor-item" key={question.id}><strong>{question.label}</strong><p className="muted">{question.kind === 'choice' ? 'Opção' : 'Texto'}{question.required ? ' · Obrigatória' : ' · Opcional'}</p>{question.kind === 'choice' && <ul>{question.options.map(option => <li key={option}>{option}</li>)}</ul>}
      <details><summary>Editar pergunta</summary><ActionForm action={mutate} submit="Salvar pergunta"><Hidden name="op" value="job-question"/><Hidden name="job_id" value={jobId}/><Hidden name="question_id" value={question.id}/><QuestionFields question={question} key={JSON.stringify(question)}/></ActionForm></details>
      <ActionForm action={mutate} submit="Remover pergunta" confirm="Remover esta pergunta? A exclusão será impedida se já houver respostas recebidas."><Hidden name="op" value="delete-job-question"/><Hidden name="job_id" value={jobId}/><Hidden name="question_id" value={question.id}/></ActionForm>
    </div>) : <p className="muted">Nenhuma pergunta adicional.</p>}
    <details><summary>Adicionar pergunta</summary><ActionForm action={mutate} submit="Adicionar pergunta"><Hidden name="op" value="job-question"/><Hidden name="job_id" value={jobId}/><QuestionFields/></ActionForm></details>
  </section>;
}
