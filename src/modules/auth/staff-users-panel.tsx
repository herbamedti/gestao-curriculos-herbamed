'use client';
import { useId, useState } from 'react';
import { ActionForm, Field, Hidden } from '@/ui/form';
import { Badge, date } from '@/ui/common';
import { Icon } from '@/ui/icon';
import { Modal } from '@/ui/modal';
import { manageStaffUsers } from './staff-users';
import type { StaffDetails } from './staff-schema';
import type { Database } from '@/lib/database.types';
type Member = Database['public']['Functions']['list_managed_staff']['Returns'][number] & StaffDetails;
type Role = { id: string; name: string; scope: string; permissions: string[] };
type Permission = { code: string; label: string };
const screens: Record<string, string> = { dashboard: 'Visão geral · Dashboard', jobs: 'Recrutamento · Vagas', applications: 'Recrutamento · Candidaturas', interviews: 'Recrutamento · Entrevistas', evaluations: 'Recrutamento · Avaliações', candidates: 'Talentos · Candidatos', talents: 'Talentos · Banco de talentos', messages: 'Comunicação · Mensagens', reports: 'Relatórios · Indicadores', settings: 'Administração · Configurações', privacy: 'Privacidade · Avisos e solicitações', audit: 'Segurança · Auditoria', documents: 'Talentos · Documentos' };

export function StaffUsersPanel({ members, roles, permissions, mailReady }: { members: Member[]; roles: Role[]; permissions: Permission[]; mailReady: boolean }) {
  const [filter, setFilter] = useState(''); const [status, setStatus] = useState('all'); const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Member | 'new' | null>(null); const [tab, setTab] = useState('data');
  const [notice, setNotice] = useState('');
  const filtered = members.filter(member => `${member.display_name} ${member.email}`.toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR')) && (status === 'all' || (status === 'active' ? member.active : !member.active)));
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / 20)));
  function open(member: Member | 'new', selected = 'data') { setEditing(member); setTab(selected); setNotice(''); }
  return <section className="card admin-register"><div className="register-toolbar"><div><h2>Equipe com acesso</h2><p className="muted">{members.length} usuários cadastrados</p></div>
    <button className="button primary" type="button" onClick={() => open('new')}><Icon name="person_add" />Convidar usuário</button></div>
    {!mailReady && <p className="alert warning">O envio de e-mail está indisponível. Configure o provedor para enviar novos convites.</p>}
    {notice && <p className="alert success" role="status">{notice}</p>}
    <div className="register-filters"><label className="field"><span>Buscar usuário</span><input type="search" value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }} placeholder="Nome ou e-mail" /></label>
      <label className="field"><span>Situação do acesso</span><select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></label></div>
    <div className="table-wrap"><table className="register-table"><caption className="sr-only">Usuários internos da Herbamed</caption><thead><tr><th>Usuário</th><th>Perfil</th><th>Acesso</th><th>Convite</th><th>Duas etapas</th><th>Ações</th></tr></thead><tbody>
      {filtered.slice((current - 1) * 20, current * 20).map(member => <tr key={member.user_id}><td><strong>{member.display_name}</strong><small>{member.email}</small>{member.is_primary && <small>Administrador principal</small>}</td>
        <td>{roles.find(role => role.id === member.role_id)?.name || 'Perfil indisponível'}{Object.keys(member.permissions).length > 0 && <small>Permissões personalizadas</small>}</td>
        <td><Badge tone={member.active ? 'green' : 'pending'}>{member.active ? 'Ativo' : 'Inativo'}</Badge></td>
        <td>{member.pending ? member.delivery === 'failed' ? <Badge tone="danger">Falha no envio</Badge> : <Badge tone="pending">Aguardando primeiro acesso</Badge> : member.confirmed ? 'Confirmado' : 'Não confirmado'}{member.sent_at && <small>Enviado em {date(member.sent_at)}</small>}</td>
        <td>{member.mfa_enabled ? 'Exigida' : 'Opcional'}</td><td><div className="row-actions">
          {member.is_primary ? <span className="muted" title="Gerencie sua própria conta em Configurações → Conta"><Icon name="lock" /></span> : <>
            <button type="button" className="icon-button" title="Editar usuário" aria-label={`Editar ${member.display_name}`} onClick={() => open(member)}><Icon name="edit" /></button>
            <button type="button" className="icon-button" title="Editar permissões" aria-label={`Permissões de ${member.display_name}`} onClick={() => open(member, 'permissions')}><Icon name="admin_panel_settings" /></button>
            <button type="button" className="icon-button" title="Acesso e segurança" aria-label={`Segurança de ${member.display_name}`} onClick={() => open(member, 'security')}><Icon name="shield" /></button></>}
        </div></td></tr>)}
      {!filtered.length && <tr><td colSpan={6} className="table-empty">Nenhum usuário encontrado para os filtros.</td></tr>}
    </tbody></table></div>
    <div className="pagination"><button type="button" className="button text" disabled={current === 1} onClick={() => setPage(current - 1)}>Anterior</button><span>{filtered.length} registros · Página {current}</span><button type="button" className="button text" disabled={current * 20 >= filtered.length} onClick={() => setPage(current + 1)}>Próxima</button></div>
    {editing && <StaffUserEditor key={typeof editing === 'string' ? editing : editing.user_id} member={editing === 'new' ? undefined : editing} roles={roles} permissions={permissions} initialTab={tab} mailReady={mailReady}
      onClose={() => setEditing(null)} onSaved={message => { setNotice(message); setEditing(null); }} />}
  </section>;
}
function StaffUserEditor({ member, roles, permissions, initialTab, mailReady, onClose, onSaved }: { member?: Member; roles: Role[]; permissions: Permission[]; initialTab: string; mailReady: boolean; onClose: () => void; onSaved: (message: string) => void }) {
  const [tab, setTab] = useState(initialTab); const [roleId, setRoleId] = useState(member?.role_id || ''); const [overrides, setOverrides] = useState<Record<string, boolean>>(member?.permissions || {});
  const id = useId(); const base = roles.find(role => role.id === roleId); const tabs = [['data', 'Dados'], ['permissions', 'Permissões'], ['security', 'Segurança']] as const;
  const available = [...new Set(permissions.filter(p => !['users.manage', 'roles.manage'].includes(p.code)).map(p => p.code.split('.')[0]))];
  const groups = [...Object.keys(screens).filter(group => available.includes(group)), ...available.filter(group => !(group in screens))];
  function choose(code: string, value: string) { setOverrides(previous => { const next = { ...previous }; if (value === 'inherit') delete next[code]; else next[code] = value === 'allow'; return next; }); }
  return <Modal wide title={member ? `Editar usuário · ${member.display_name}` : 'Convidar usuário do RH'} description={member ? 'Altere os dados, permissões e a segurança deste acesso.' : 'O destinatário receberá um link para confirmar o e-mail e criar sua própria senha.'} onClose={onClose}>
    <div className="modal-tabs" role="tablist" aria-label="Cadastro de usuário">{tabs.map(([key, label], index) => <button key={key} type="button" role="tab" id={`${id}-${key}`} aria-selected={tab === key} aria-controls={`${id}-${key}-panel`} tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)} onKeyDown={event => {
      const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + delta + tabs.length) % tabs.length;
      if (delta || event.key === 'Home' || event.key === 'End') { event.preventDefault(); setTab(tabs[next][0]); document.getElementById(`${id}-${tabs[next][0]}`)?.focus(); }
    }}>{label}</button>)}</div>
    <div onInvalidCapture={() => setTab('data')}><ActionForm action={manageStaffUsers} submit={member ? 'Salvar acesso' : 'Criar e enviar convite'} pendingLabel={member ? 'Salvando acesso…' : 'Enviando convite…'} onSuccess={result => onSaved(result.message)}>
      <Hidden name="op" value={member ? 'access' : 'create'} />{member && <Hidden name="user_id" value={member.user_id} />}<Hidden name="permissions" value={JSON.stringify(overrides)} />
      <div role="tabpanel" id={`${id}-data-panel`} aria-labelledby={`${id}-data`} hidden={tab !== 'data'} className="modal-panel">
        <Field name="name" label="Nome" value={member?.display_name} required minLength={2} maxLength={160} />
        <Field name="email" label="E-mail de login" type="email" value={member?.email} readOnly={!!member} required maxLength={254} autoComplete="off" />
        {member && <p className="muted">O usuário altera o e-mail na própria Conta, com verificação de identidade e confirmação do endereço.</p>}
        <label className="field"><span>Perfil de acesso *</span><select name="role_id" value={roleId} required onChange={event => setRoleId(event.target.value)}><option value="">Selecione</option>{roles.map(role => <option key={role.id} value={role.id}>{role.name}{role.scope === 'assigned' ? ' · Vagas atribuídas' : ''}</option>)}</select></label>
        {member && <p className="muted">Cadastro criado em {date(member.created_at)}.</p>}
      </div>
      <div role="tabpanel" id={`${id}-permissions-panel`} aria-labelledby={`${id}-permissions`} hidden={tab !== 'permissions'} className="modal-panel">
        <p className="muted">Herdar mantém a regra do perfil selecionado. Permitir ou Bloquear cria uma exceção apenas para este usuário. Alterações exigem também permissão de visualização da seção. O escopo de vagas do perfil é preservado.</p>
        <p className="alert">Criação de acessos e edição dos perfis são exclusivas do administrador principal, mesmo que o perfil escolhido seja Superadministrador.</p>
        <button type="button" className="button outlined" onClick={() => setOverrides({})}>Restaurar regras do perfil</button>
        {groups.map(group => <section className="permission-group" key={group}><h3>{screens[group] || group}</h3><div className="table-wrap"><table className="permission-table"><thead><tr><th>Função / tela</th><th>Regra do usuário</th><th>Regra resultante</th></tr></thead><tbody>{permissions.filter(p => p.code.startsWith(`${group}.`)).sort((a,b) => a.code.endsWith('.read') ? -1 : b.code.endsWith('.read') ? 1 : a.label.localeCompare(b.label,'pt-BR')).map(permission => {
          const allowed = overrides[permission.code] ?? base?.permissions.includes(permission.code) ?? false;
          const readCode = permission.code === 'talents.read' ? 'candidates.read' : `${group}.read`; const blockedByView = permission.code !== readCode && permissions.some(p => p.code === readCode) && !(overrides[readCode] ?? base?.permissions.includes(readCode) ?? false);
          return <tr key={permission.code}><td>{permission.code.endsWith('.read') ? 'Visualizar' : permission.label}</td><td><select aria-label={`${permission.label}: regra`} value={permission.code in overrides ? overrides[permission.code] ? 'allow' : 'deny' : 'inherit'} onChange={event => choose(permission.code, event.target.value)}><option value="inherit">Herdar do perfil</option><option value="allow">Permitir</option><option value="deny">Bloquear</option></select></td><td><Badge tone={allowed && !blockedByView ? 'green' : 'pending'}>{allowed && !blockedByView ? 'Permitido' : 'Bloqueado'}</Badge>{blockedByView && <small>Visualização bloqueada</small>}</td></tr>;
        })}</tbody></table></div></section>)}
      </div>
      <div role="tabpanel" id={`${id}-security-panel`} aria-labelledby={`${id}-security`} hidden={tab !== 'security'} className="modal-panel">
        <label className="check"><input type="checkbox" name="active" defaultChecked={member?.active ?? true} />Acesso ativo</label>
        <p className="muted">Desativar bloqueia o acesso e as sessões anteriores. Ao reativar, o usuário deve entrar novamente.</p>
        <label className="check"><input type="checkbox" name="mfa" defaultChecked={member?.mfa_enabled ?? true} />Exigir verificação em duas etapas</label>
        <p className="muted">Quando exigida, o usuário configura um aplicativo autenticador no primeiro login. Desativar a exigência preserva o autenticador já cadastrado.</p>
        {member?.pending && <p className="alert">Acesso pendente: o destinatário ainda precisa confirmar o e-mail e criar uma senha.</p>}
        {!member && !mailReady && <p className="alert danger">Ative e configure o envio de e-mail antes de enviar o convite.</p>}
      </div>
    </ActionForm></div>
    {member && tab === 'security' && (member.pending ? <section className="modal-extra"><h3>Convite por e-mail</h3><p className="muted">Use o reenvio se o link expirou ou a entrega falhou. Aguarde ao menos um minuto entre envios.</p><ActionForm action={manageStaffUsers} submit="Reenviar convite" pendingLabel="Reenviando…"><Hidden name="op" value="resend" /><Hidden name="user_id" value={member.user_id} /></ActionForm></section>
      : member.password_login_enabled && <section className="modal-extra"><h3>Redefinir senha</h3><p className="muted">A alteração encerra o acesso das sessões anteriores. O usuário também pode recuperar sua senha pela tela de login.</p><ActionForm action={manageStaffUsers} submit="Redefinir senha" confirm="Redefinir a senha e bloquear o acesso das sessões anteriores deste usuário?"><Hidden name="op" value="password" /><Hidden name="user_id" value={member.user_id} /><Field name="password" label="Nova senha" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /><Field name="confirm_password" label="Confirmar senha" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></ActionForm></section>)}
  </Modal>;
}
