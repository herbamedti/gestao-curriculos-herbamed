import { requirePermission } from '@/modules/auth/session';
import { PageHeading } from '@/ui/common';
import { StaffUsersPanel } from '@/modules/auth/staff-users-panel';
import { staffDetailsSchema } from '@/modules/auth/staff-schema';
import { emailConfigured } from '@/modules/email/sender';
export default async function Users() {
  const { client } = await requirePermission('users.manage');
  const [staff, details, roles, permissions, links] = await Promise.all([
    client.rpc('list_managed_staff'), client.rpc('staff_administration_details'),
    client.from('roles').select('id,name,scope').eq('active', true).order('name'),
    client.from('permissions').select('code,label').order('code'),
    client.from('role_permissions').select('role_id,permission'),
  ]);
  const parsed = staffDetailsSchema.safeParse(details.data);
  const failed = staff.error || details.error || roles.error || permissions.error || links.error || !parsed.success;
  return <><PageHeading eyebrow="ADMINISTRAÇÃO" title="Usuários internos" description="Convide a equipe, defina permissões por tela e gerencie os acessos com segurança." />
    {failed ? <p role="alert" className="alert danger">Não foi possível carregar a administração de usuários. Confira as migrações do banco.</p>
      : <StaffUsersPanel members={(staff.data || []).flatMap(member => { const extra = parsed.data.find(item => item.user_id === member.user_id); return extra ? [{ ...member, ...extra }] : []; })}
        roles={(roles.data || []).map(role => ({ ...role, permissions: (links.data || []).filter(link => link.role_id === role.id).map(link => link.permission) }))}
        permissions={permissions.data || []} mailReady={emailConfigured()} />}
  </>;
}
