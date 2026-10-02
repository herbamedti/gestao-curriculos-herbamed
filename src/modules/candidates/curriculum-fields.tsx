import type { Database } from '@/lib/database.types';
import { Field, Select } from '@/ui/form';
import { EditableList } from '@/ui/editable-list';
import { candidateDetails } from './details';

type Candidate = Database['public']['Tables']['candidates']['Row'];
export function CurriculumFields({ candidate }: { candidate?: Candidate | null }) {
  const details = candidateDetails(candidate?.additional_info);
  return <>
    <Field name="secondary_phone" label="Telefone alternativo (opcional)" value={details.secondary_phone} maxLength={30} />
    <Field name="neighborhood" label="Bairro (opcional)" value={details.neighborhood} maxLength={100} />
    <Field name="professional_url" label="LinkedIn (HTTPS, opcional)" value={candidate?.professional_url} type="url" maxLength={500} />
    <Field name="portfolio_url" label="GitHub, portfólio ou site profissional (HTTPS, opcional)" value={details.portfolio_url} type="url" maxLength={500} />
    <Select name="driver_license" label="Habilitação (opcional)" value={details.driver_license}><option value="">Não informado</option>{['A', 'B', 'AB', 'C', 'AC', 'D', 'AD', 'E', 'AE'].map(category => <option key={category}>{category}</option>)}</Select>
    <div className="availability-checks"><label className="check"><input name="travel_available" type="checkbox" defaultChecked={details.travel_available} />Disponibilidade para viagens</label><label className="check"><input name="relocation_available" type="checkbox" defaultChecked={details.relocation_available} />Disponibilidade para mudança de cidade</label></div>
    <div className="full"><EditableList name="skills" label="Habilidades" initial={candidate?.skills || []} chips maxItems={30} maxLength={100} /></div>
  </>;
}

export function InterestFields({ areas, interests = [], error = false }: { areas: { id: string; name: string }[]; interests?: string[]; error?: boolean }) {
  return <fieldset className="interest-fields"><legend>Áreas de interesse</legend>{error ? <p role="alert" className="alert danger">Não foi possível carregar as áreas de interesse. Recarregue a página ou contate o RH.</p> : areas.length ? <div className="checkbox-grid">{areas.map(area => <label className="check" key={area.id}><input type="checkbox" name="interests" value={area.id} defaultChecked={interests.includes(area.id)} />{area.name}</label>)}</div> : <p className="muted">Nenhuma área de interesse ativa cadastrada. O RH pode adicioná-las em Configurações. Você pode continuar preenchendo o currículo.</p>}</fieldset>;
}

export function CurriculumExtraSummary({ candidate }: { candidate: Candidate }) {
  const details = candidateDetails(candidate.additional_info);
  const information = [details.secondary_phone && `Telefone alternativo: ${details.secondary_phone}`, details.neighborhood && `Bairro: ${details.neighborhood}`, details.driver_license && `Habilitação: ${details.driver_license}`, details.travel_available && 'Disponível para viagens', details.relocation_available && 'Disponível para mudança de cidade'];
  return <>{information.filter(Boolean).length > 0 && <p>{information.filter(Boolean).join(' · ')}</p>}{candidate.professional_url && <p><a className="text-link" href={candidate.professional_url} target="_blank" rel="noreferrer">LinkedIn / link profissional</a></p>}{details.portfolio_url && <p><a className="text-link" href={details.portfolio_url} target="_blank" rel="noreferrer">GitHub / portfólio</a></p>}</>;
}
