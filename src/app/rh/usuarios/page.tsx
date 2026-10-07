import { requirePermission } from '@/modules/auth/session';
import { PageHeading, Empty, Badge } from '@/ui/common';
import { ActionForm, Field, Hidden, Select } from '@/ui/form';
import { manageStaffUsers } from '@/modules/auth/staff-users';
function PasswordFields() {
  return <><Field name="password" label="Senha" type="password" required minLength={12} maxLength={128} autoComplete="new-password" />
    <Field name="confirm_password" label="Confirmar senha" type="password" required minLength={12} maxLength={128} autoComplete="new-password" />
    <p className="muted">Use maiúsculas, minúsculas, números e símbolos, com pelo menos 12 caracteres.</p></>;
}
export default async function Users() {
  const { client } = await requirePermission('users.manage');
  const [{ data: staff, error }, { data: roles }] = await Promise.all([
    client.rpc('list_managed_staff'), client.from('roles').select('id,name').eq('active', true).order('name'),
  ]);
  return <><PageHeading eyebrow="ADMINISTRAÇÃO" title="Usuários internos" description="O administrador principal cria contas, define perfis e gerencia o acesso da equipe." />
    <div className="split items-start"><section className="card"><h2>Equipe com acesso</h2>
      {error ? <p role="alert" className="alert danger">Não foi possível carregar os usuários. Confira as migrações do banco.</p> : staff?.length ? staff.map(member => <div className="managed-user" key={member.user_id}>
        <div><strong>{member.display_name}</strong><p className="muted">{member.email}</p><Badge tone={member.active ? 'green' : 'pending'}>{member.active ? 'Ativo' : 'Inativo'}</Badge>
          <p>{roles?.find(role => role.id === member.role_id)?.name || 'Perfil indisponível'} · {member.mfa_enabled ? 'Duas etapas exigidas' : 'Duas etapas opcionais'}</p></div>
        {member.is_primary ? <p className="muted">Administrador principal. Para alterar sua própria conta, use Configurações → Conta.</p> : <>
          <details><summary>Editar acesso e duas etapas</summary><ActionForm action={manageStaffUsers} submit="Salvar acesso">
            <Hidden name="op" value="access" /><Hidden name="user_id" value={member.user_id} />
            <Field name="name" label="Nome" value={member.display_name} required minLength={2} maxLength={160} />
            <Select name="role_id" label="Perfil de acesso" value={member.role_id || ''} required><option value="">Selecione</option>{roles?.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</Select>
            <label className="check"><input name="active" type="checkbox" defaultChecked={member.active} />Acesso ativo</label>
            <label className="check"><input name="mfa" type="checkbox" defaultChecked={member.mfa_enabled} />Exigir verificação em duas etapas</label>
            <p className="muted">Desativar a exigência libera o acesso por senha. O autenticador já cadastrado é preservado.</p>
          </ActionForm></details>
          {member.password_login_enabled && <details><summary>Alterar senha</summary><ActionForm action={manageStaffUsers} submit="Alterar senha" confirm="Alterar a senha e bloquear o acesso das sessões anteriores deste usuário?">
            <Hidden name="op" value="password" /><Hidden name="user_id" value={member.user_id} /><PasswordFields />
          </ActionForm></details>}
        </>}
      </div>) : <Empty title="Equipe não cadastrada" description="Crie uma conta autorizada ao lado." icon="admin_panel_settings" />}
    </section><section className="card"><h2>Criar usuário interno</h2><p className="muted">Conta de acesso da equipe, sem necessidade de cadastro prévio. Compartilhe as credenciais por um canal seguro.</p>
      <ActionForm action={manageStaffUsers} submit="Criar usuário"><Hidden name="op" value="create" />
        <Field name="name" label="Nome" required minLength={2} maxLength={160} /><Field name="email" label="E-mail de login" type="email" required maxLength={254} autoComplete="off" />
        <Select name="role_id" label="Perfil de acesso" required><option value="">Selecione</option>{roles?.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</Select>
        <PasswordFields /><label className="check"><input name="active" type="checkbox" defaultChecked />Acesso ativo</label>
        <label className="check"><input name="mfa" type="checkbox" defaultChecked />Exigir verificação em duas etapas</label>
      </ActionForm>
    </section></div></>;
}
