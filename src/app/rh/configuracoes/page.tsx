import { requirePermission } from '@/modules/auth/session';
import { PageHeading } from '@/ui/common';
import { ActionForm, Field, Hidden } from '@/ui/form';
import { mutate } from '@/modules/actions';
import { CatalogPanel } from '@/modules/catalogs/catalog-panel';
export default async function Settings() {
  const { client } = await requirePermission('settings.read');
  const [settings, departments, areas, tags, pools, levels, types, permission] = await Promise.all([
    client.from('settings').select('*'), client.from('departments').select('*').order('name'),
    client.from('interest_areas').select('*').order('name'), client.from('tags').select('*').order('name'),
    client.from('talent_pools').select('*').order('name'), client.from('experience_levels').select('*').order('name'),
    client.from('employment_types').select('*').order('name'), client.rpc('has_permission', { p_permission: 'settings.manage' }),
  ]);
  const get = (key: string) => settings.data?.find(setting => setting.key === key)?.value;
  const catalogs = [['departments', 'Departamentos', departments], ['interest_areas', 'Áreas de interesse', areas], ['tags', 'Tags', tags], ['talent_pools', 'Pools de talentos', pools], ['experience_levels', 'Níveis de experiência', levels], ['employment_types', 'Tipos de emprego', types]] as const;
  const canEdit = permission.data === true;
  return <><PageHeading eyebrow="ADMINISTRAÇÃO" title="Configurações" description="Organize os cadastros de apoio e as preferências da plataforma." />
    <div className="settings-register-layout"><CatalogPanel catalogs={catalogs.map(([key, label, result]) => ({ key, label, items: result.data || [], error: !!result.error }))} canEdit={canEdit} />
      <aside className="card settings-preferences"><h2>Preferências</h2>
        {settings.error ? <p className="alert danger" role="alert">Não foi possível carregar as preferências.</p> : canEdit ? <>
          <ActionForm action={mutate} submit="Salvar nome"><Hidden name="op" value="setting" /><Hidden name="key" value="app_name" /><Field name="value" label="Nome da aplicação" value={typeof get('app_name') === 'string' ? String(get('app_name')) : 'Herbamed Carreiras'} required /></ActionForm>
          <ActionForm action={mutate} submit="Salvar limite"><Hidden name="op" value="setting" /><Hidden name="key" value="max_interest_areas" /><Field name="value" label="Máximo de áreas de interesse" type="number" value={typeof get('max_interest_areas') === 'number' ? Number(get('max_interest_areas')) : 3} min={1} max={10} required /></ActionForm>
        </> : <dl className="settings-summary"><dt>Nome da aplicação</dt><dd>{String(get('app_name') || 'Herbamed Carreiras')}</dd><dt>Máximo de áreas de interesse</dt><dd>{String(get('max_interest_areas') || 3)}</dd></dl>}
      </aside>
    </div>
  </>;
}
