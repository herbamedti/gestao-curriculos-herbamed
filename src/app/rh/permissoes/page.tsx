import { requirePermission } from '@/modules/auth/session';
import { PageHeading, Badge } from '@/ui/common';
import { ActionForm, Field, Hidden, Select } from '@/ui/form';
import { mutate } from '@/modules/actions';
export default async function Permissions() {
  const {client}=await requirePermission('roles.manage');
  const [{data:roles},{data:permissions},{data:links}]=await Promise.all([client.from('roles').select('*').order('name'),client.from('permissions').select('*').order('code'),client.from('role_permissions').select('*')]);
  return <><PageHeading eyebrow="ADMINISTRAÇÃO" title="Perfis de acesso" description="Cada perfil combina permissões, escopo e exigência de MFA."/><div className="split"><div className="card"><h2>Perfis atuais</h2>{roles?.map(role=><div className="file-row" key={role.id}><div><strong>{role.name}</strong><br/><small>{role.scope==='all'?'Todos os processos':'Somente vagas atribuídas'} · {links?.filter(l=>l.role_id===role.id).length||0} permissões</small></div><Badge>{role.require_mfa?'MFA obrigatório':'MFA não exigido'}</Badge></div>)}</div><div className="card"><h2>Novo perfil</h2><ActionForm action={mutate} submit="Criar perfil"><Hidden name="op" value="role"/><Field name="name" label="Nome" required/><Select name="scope" label="Escopo"><option value="assigned">Vagas atribuídas</option><option value="all">Todos os processos</option></Select><label className="check"><input type="checkbox" name="mfa" defaultChecked/>Exigir MFA</label><fieldset><legend>Permissões</legend>{permissions?.map(p=><label className="check" key={p.code}><input type="checkbox" name="permissions" value={p.code}/>{p.label}</label>)}</fieldset></ActionForm></div></div></>;
}
