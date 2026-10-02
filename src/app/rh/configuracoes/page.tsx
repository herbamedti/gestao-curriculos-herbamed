import { requirePermission } from '@/modules/auth/session';
import { PageHeading } from '@/ui/common';
import { ActionForm, Field, Hidden } from '@/ui/form';
import { mutate } from '@/modules/actions';
export default async function Settings() {
  const { client } = await requirePermission('settings.manage');
  const [settings, departments, areas, tags, pools, levels, types] = await Promise.all([
    client.from('settings').select('*'), client.from('departments').select('*').order('name'),
    client.from('interest_areas').select('*').order('name'), client.from('tags').select('*').order('name'),
    client.from('talent_pools').select('*').order('name'), client.from('experience_levels').select('*').order('name'),
    client.from('employment_types').select('*').order('name'),
  ]);
  const get = (key: string) => settings.data?.find(setting => setting.key === key)?.value;
  const catalogs = [['departments', 'Departamentos', departments], ['interest_areas', 'Áreas de interesse', areas], ['tags', 'Tags', tags], ['talent_pools', 'Pools de talentos', pools], ['experience_levels', 'Níveis de experiência', levels], ['employment_types', 'Tipos de emprego', types]] as const;
  return <><PageHeading eyebrow="ADMINISTRAÇÃO" title="Configurações" description="Adicione, edite, desative ou exclua os cadastros de apoio da plataforma." />
    <div className="split"><div>{catalogs.map(([key, label, result]) => <div className="card" key={key}><h2>{label}</h2>
      {result.error ? <p role="alert" className="alert danger">Não foi possível carregar este cadastro. Confira se as migrações estão atualizadas.</p> : result.data?.length ? result.data.map(item => <div className="catalog-item" key={item.id}>
        <div className="file-row"><strong>{item.name}</strong><span className="muted">{item.active ? 'Ativo' : 'Inativo'}</span></div>
        <details><summary>Editar cadastro</summary><ActionForm action={mutate} submit="Salvar cadastro" className="inline-form"><Hidden name="op" value="catalog" /><Hidden name="catalog" value={key} /><Hidden name="id" value={item.id} /><Field name="name" label="Nome" value={item.name} required minLength={2} maxLength={100} /><label className="check"><input name="active" type="checkbox" defaultChecked={item.active} />Ativo</label></ActionForm></details>
        <ActionForm action={mutate} submit="Excluir cadastro" confirm={`Excluir ${item.name}? Se estiver em uso, a exclusão será impedida.`} className="catalog-delete"><Hidden name="op" value="delete-catalog" /><Hidden name="catalog" value={key} /><Hidden name="id" value={item.id} /></ActionForm>
      </div>) : <p className="muted">Nenhum cadastro. Adicione uma opção abaixo.</p>}
      <ActionForm action={mutate} submit="Adicionar" className="inline-form"><Hidden name="op" value="catalog" /><Hidden name="catalog" value={key} /><Hidden name="active" value="true" /><Field name="name" label="Novo cadastro" required minLength={2} maxLength={100} /></ActionForm>
    </div>)}</div><aside className="card"><h2>Preferências</h2>
      <ActionForm action={mutate} submit="Salvar nome"><Hidden name="op" value="setting" /><Hidden name="key" value="app_name" /><Field name="value" label="Nome da aplicação" value={typeof get('app_name') === 'string' ? String(get('app_name')) : 'Herbamed Carreiras'} required /></ActionForm>
      <ActionForm action={mutate} submit="Salvar limite"><Hidden name="op" value="setting" /><Hidden name="key" value="max_interest_areas" /><Field name="value" label="Máximo de áreas de interesse" type="number" value={typeof get('max_interest_areas') === 'number' ? Number(get('max_interest_areas')) : 3} min={1} max={10} required /></ActionForm>
      <p className="muted">Cadastros em uso devem ser desativados. Eles continuam disponíveis nos registros existentes, mas deixam de aparecer em novas seleções.</p>
    </aside></div>
  </>;
}
