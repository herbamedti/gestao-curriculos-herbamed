'use client';
import { useState } from 'react';
import { ActionForm, Field, Hidden } from '@/ui/form';
import { Modal } from '@/ui/modal';
import { Badge } from '@/ui/common';
import { Icon } from '@/ui/icon';
import { mutate } from '@/modules/actions';
type Item = { id: string; name: string; active: boolean };
export type Catalog = { key: string; label: string; items: Item[]; error: boolean };

export function CatalogPanel({ catalogs, canEdit }: { catalogs: Catalog[]; canEdit: boolean }) {
  const [key, setKey] = useState(catalogs[0]?.key || 'departments'); const [filter, setFilter] = useState(''); const [status, setStatus] = useState('all'); const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{ catalog: string; item?: Item; deleting?: boolean } | null>(null); const [notice, setNotice] = useState('');
  const catalog = catalogs.find(item => item.key === key)!;
  const filtered = catalog.items.filter(item => item.name.toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR')) && (status === 'all' || (status === 'active' ? item.active : !item.active)));
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / 20)));
  return <section className="card admin-register catalog-register"><nav className="catalog-switcher" aria-label="Cadastros de apoio">{catalogs.map(item => <button className="catalog-choice" key={item.key} type="button" aria-pressed={key === item.key} onClick={() => { setKey(item.key); setFilter(''); setPage(1); setNotice(''); }}><span>{item.label}</span><span className="catalog-count">{item.error ? '—' : item.items.length}</span></button>)}</nav>
    <div className="register-toolbar"><div><h2>{catalog.label}</h2><p className="muted">Gerencie as opções usadas nos cadastros da plataforma.</p></div>{canEdit && <button type="button" className="button primary" onClick={() => setEditing({ catalog: key })}><Icon name="add" />Novo registro</button>}</div>
    {notice && <p role="status" className="alert success">{notice}</p>}
    {!canEdit && <p className="alert">Seu acesso permite apenas visualizar os cadastros.</p>}
    <div className="register-filters"><label className="field"><span>Buscar registro</span><input type="search" value={filter} placeholder="Nome do registro" onChange={event => { setFilter(event.target.value); setPage(1); }} /></label><label className="field"><span>Situação</span><select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></label></div>
    {catalog.error ? <p className="alert danger" role="alert">Não foi possível carregar este cadastro. Confira as migrações e tente novamente.</p> : <div className="table-wrap"><table className="register-table"><caption className="sr-only">Registros de {catalog.label}</caption><thead><tr><th>Nome</th><th>Situação</th>{canEdit && <th>Ações</th>}</tr></thead><tbody>{filtered.slice((current - 1) * 20, current * 20).map(item => <tr key={item.id}><td><strong>{item.name}</strong></td><td><Badge tone={item.active ? 'green' : 'pending'}>{item.active ? 'Ativo' : 'Inativo'}</Badge></td>{canEdit && <td><div className="row-actions"><button type="button" className="icon-button" title="Editar registro" aria-label={`Editar ${item.name}`} onClick={() => setEditing({ catalog: key, item })}><Icon name="edit" /></button><button type="button" className="icon-button danger-text" title="Excluir registro" aria-label={`Excluir ${item.name}`} onClick={() => setEditing({ catalog: key, item, deleting: true })}><Icon name="delete_outline" /></button></div></td>}</tr>)}{!filtered.length && <tr><td className="table-empty" colSpan={canEdit ? 3 : 2}>Nenhum registro encontrado.</td></tr>}</tbody></table></div>}
    <div className="pagination"><button className="button text" type="button" disabled={current === 1} onClick={() => setPage(current - 1)}>Anterior</button><span>{filtered.length} registros · Página {current}</span><button className="button text" type="button" disabled={current * 20 >= filtered.length} onClick={() => setPage(current + 1)}>Próxima</button></div>
    <p className="muted">Registros em uso podem ser desativados para novas seleções. A exclusão de um cadastro vinculado a outros registros é impedida.</p>
    {editing && <Modal title={editing.deleting ? 'Excluir registro' : editing.item ? 'Editar registro' : 'Novo registro'} description={catalogs.find(item => item.key === editing.catalog)?.label} onClose={() => setEditing(null)}>
      <ActionForm action={mutate} submit={editing.deleting ? 'Confirmar exclusão' : 'Salvar cadastro'} pendingLabel={editing.deleting ? 'Excluindo…' : 'Salvando cadastro…'} onSuccess={result => { setNotice(result.message); setEditing(null); }}>
        <Hidden name="op" value={editing.deleting ? 'delete-catalog' : 'catalog'} /><Hidden name="catalog" value={editing.catalog} />{editing.item && <Hidden name="id" value={editing.item.id} />}
        {editing.deleting ? <><p>Excluir <strong>{editing.item?.name}</strong>?</p><p className="muted">Esta ação remove o registro. Se ele estiver em uso, a exclusão será bloqueada; use a edição para desativá-lo.</p></> : <><Field name="name" label="Nome" value={editing.item?.name} required minLength={2} maxLength={100} /><label className="check"><input name="active" type="checkbox" defaultChecked={editing.item?.active ?? true} />Registro ativo</label><p className="muted">Registros inativos permanecem nos vínculos existentes e deixam de aparecer em novas seleções.</p></>}
      </ActionForm>
    </Modal>}
  </section>;
}
