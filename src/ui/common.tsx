import Link from 'next/link';
import { Icon } from './icon';
export function PageHeading({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: React.ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{children && <div className="actions">{children}</div>}</div>;
}
export function Empty({ title, description, icon = 'search', href, action }: { title: string; description: string; icon?: string; href?: string; action?: string }) {
  return <div className="empty"><div className="empty-icon"><Icon name={icon} /></div><h3>{title}</h3><p className="muted">{description}</p>{href && <Link className="button outlined" href={href}>{action}</Link>}</div>;
}
export function Badge({ children, tone = '' }: { children: React.ReactNode; tone?: string }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function Avatar({ name }: { name: string }) { return <span className="avatar" aria-hidden="true">{name.split(' ').filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase()}</span>; }
export function date(value: string | null, time = false) { return value ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',...(time ? {timeStyle:'short' as const}:{}),timeZone:'America/Sao_Paulo'}).format(new Date(value)) : '—'; }
export const statusLabels: Record<string,string> = { draft:'Rascunho',pending:'Em análise',published:'Publicada',paused:'Pausada',closed:'Encerrada',cancelled:'Cancelada',archived:'Arquivada',active:'Em andamento',withdrawn:'Retirada',clean:'Verificado',scanning:'Em verificação',rejected:'Rejeitado',error:'Verificação pendente',open:'Aberta',reviewing:'Em análise',completed:'Concluída',denied:'Indeferida',scheduled:'Agendada' };
