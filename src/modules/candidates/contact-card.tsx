import { Icon } from '@/ui/icon';
import { formatLocation, formatPhone, phoneHref } from '@/ui/contact-format';
import { candidateDetails } from './details';
import type { CurriculumPerson } from './curriculum-document';

function ContactItem({ icon, label, value, href, external = false }: {
  icon: string; label: string; value: string; href?: string; external?: boolean;
}) {
  return <div className="candidate-contact-row">
    <dt><Icon name={icon} />{label}</dt>
    <dd>{href ? <a className="candidate-contact-link" href={href}
      target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
      <span>{value}</span>{external && <Icon name="open_in_new" />}
    </a> : value}</dd>
  </div>;
}

function professionalHref(value: string) {
  try { return new URL(value).protocol === 'https:' ? value : undefined; }
  catch { return undefined; }
}

export function CandidateContactCard({ person }: { person: CurriculumPerson }) {
  const details = candidateDetails(person.additional_info);
  return <section className="card candidate-contact-card" aria-label="Contato da pessoa candidata">
    <h2>Contato</h2>
    <dl className="candidate-contact-list">
      <ContactItem icon="mail" label="E-mail" value={person.email || 'Não informado'}
        href={person.email ? `mailto:${encodeURIComponent(person.email.trim()).replace(/%40/g, '@')}` : undefined} />
      <ContactItem icon="call" label="Telefone" value={formatPhone(person.phone) || 'Não informado'} href={phoneHref(person.phone)} />
      {details.secondary_phone && <ContactItem icon="phone_in_talk" label="Telefone alternativo"
        value={formatPhone(details.secondary_phone)} href={phoneHref(details.secondary_phone)} />}
      <ContactItem icon="location_on" label="Localização" value={formatLocation(person.city, person.state) || 'Não informada'} />
      {details.neighborhood && <ContactItem icon="home_pin" label="Bairro" value={details.neighborhood} />}
      {person.professional_url && <ContactItem icon="work" label="Perfil profissional"
        value={person.professional_url} href={professionalHref(person.professional_url)} external />}
      {details.portfolio_url && <ContactItem icon="language" label="Portfólio ou site"
        value={details.portfolio_url} href={professionalHref(details.portfolio_url)} external />}
    </dl>
  </section>;
}
