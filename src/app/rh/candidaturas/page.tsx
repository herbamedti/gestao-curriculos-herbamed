import Link from '@/ui/link';
import { requirePermission } from '@/modules/auth/session';
import { PageHeading, Empty, Badge, date, statusLabels } from '@/ui/common';
import { DeleteApplicationButton } from '@/modules/applications/delete-button';

export default async function Applications({ searchParams }: { searchParams: Promise<{ page?: string; excluida?: string }> }) {
  const { client } = await requirePermission('applications.read');
  const params = await searchParams;
  const page = Math.max(1, Math.min(1000, Number(params.page) || 1));
  const [{ data: apps, count, error }, primary] = await Promise.all([
    client.from('applications').select('id,candidate_id,job_id,stage_id,status,created_at,updated_at,unlinked_at', { count: 'exact' })
      .order('created_at', { ascending: false }).range((page - 1) * 20, page * 20 - 1),
    client.rpc('is_primary_administrator'),
  ]);
  const cids = apps?.map(a => a.candidate_id) || [], jids = apps?.map(a => a.job_id) || [], sids = apps?.map(a => a.stage_id) || [];
  const [people, jobs, stages] = await Promise.all([
    cids.length ? client.from('candidates').select('id,full_name,city').in('id', cids) : Promise.resolve({ data: [] }),
    jids.length ? client.from('jobs').select('id,title').in('id', jids) : Promise.resolve({ data: [] }),
    sids.length ? client.from('job_stages').select('id,name').in('id', sids) : Promise.resolve({ data: [] }),
  ]);
  return <>
    <PageHeading eyebrow="RECRUTAMENTO" title="Candidaturas" description="Acompanhe as pessoas e os processos em andamento." />
    {params.excluida === '1' && <p role="status" className="alert success">Candidatura excluída. O currículo e as demais candidaturas foram preservados.</p>}
    <div className="card">{error ? <p role="alert">Não foi possível carregar as candidaturas.</p> : apps?.length ?
      <div className="table-wrap"><table><thead><tr><th>Candidato</th><th>Vaga</th><th>Etapa</th><th>Status</th><th>Data</th><th className="job-actions-cell">Ações</th></tr></thead>
        <tbody>{apps.map(a => {
          const person = people.data?.find(c => c.id === a.candidate_id);
          return <tr key={a.id}>
            <td><strong>{person?.full_name || '—'}</strong><small>{person?.city || ''}</small></td>
            <td>{jobs.data?.find(j => j.id === a.job_id)?.title || '—'}</td>
            <td>{stages.data?.find(s => s.id === a.stage_id)?.name || '—'}</td>
            <td><Badge>{a.unlinked_at ? 'Desvinculada' : statusLabels[a.status] || a.status}</Badge></td>
            <td>{date(a.created_at)}</td>
            <td className="job-actions-cell"><div className="job-row-actions">
              <Link className="text-link" href={`/rh/candidaturas/${a.id}`}>Abrir</Link>
              {primary.data === true && <DeleteApplicationButton id={a.id} updatedAt={a.updated_at} name={person?.full_name || 'pessoa candidata'} iconOnly />}
            </div></td>
          </tr>;
        })}</tbody></table></div> : <Empty title="Nenhuma candidatura ainda" description="As candidaturas aparecerão quando as vagas receberem inscrições." icon="assignment" />}
    </div>
    <div className="pagination">{page > 1 && <Link href={`?page=${page - 1}`}>Anterior</Link>}<span>{count || 0} candidaturas · Página {page}</span>{page * 20 < (count || 0) && <Link href={`?page=${page + 1}`}>Próxima</Link>}</div>
  </>;
}
