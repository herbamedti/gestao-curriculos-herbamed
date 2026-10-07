import {
  curriculumDocument,
  type CurriculumPerson,
  type CurriculumEntry,
} from './curriculum-document';

export function CurriculumPreview({
  person,
  entries,
}: {
  person: CurriculumPerson;
  entries: CurriculumEntry[];
}) {
  const document = curriculumDocument(person, entries);
  return (
    <article className="cv-paper" aria-label="Currículo profissional">
      <header className="cv-header">
        <h2 className="cv-name">{document.name}</h2>
        {document.headline && <p className="cv-headline">{document.headline}</p>}
        {document.location && <p className="cv-location">{document.location}</p>}
        <ul className="cv-contacts">
          {document.contacts.map((contact) => (
            <li key={contact}>{contact}</li>
          ))}
        </ul>
        {document.links.length > 0 && (
          <ul className="cv-links">
            {document.links.map((link) => (
              <li key={link.label}>
                <span>{link.label}: </span>
                {link.url.startsWith('https://') ? (
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.url.replace(/^https:\/\//, '')}
                  </a>
                ) : (
                  link.url
                )}
              </li>
            ))}
          </ul>
        )}
      </header>
      {document.summary && (
        <section className="cv-section">
          <h3>Resumo profissional</h3>
          <p className="cv-summary">{document.summary}</p>
        </section>
      )}
      {document.sections.map((section) => (
        <section className="cv-section" key={section.kind}>
          <h3>{section.label}</h3>
          <div className="cv-entries">
            {section.entries.map((entry, index) => (
              <div className="cv-entry" key={index}>
                <div className="cv-entry-heading">
                  <h4>{entry.title}</h4>
                  {entry.period && <p className="cv-period">{entry.period}</p>}
                </div>
                {entry.organization && <p className="cv-organization">{entry.organization}</p>}
                {entry.metadata && <p className="cv-metadata">{entry.metadata}</p>}
                {entry.bullets.length > 0 && (
                  <ul className="cv-bullets">
                    {entry.bullets.map((item, itemIndex) => (
                      <li key={itemIndex}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
      {document.skills.length > 0 && (
        <section className="cv-section">
          <h3>Habilidades</h3>
          <ul className="cv-skills">
            {document.skills.map((skill, index) => (
              <li key={index}>{skill}</li>
            ))}
          </ul>
        </section>
      )}
      {document.competencies.length > 0 && (
        <section className="cv-section">
          <h3>Competências pessoais</h3>
          <ul className="cv-skills">
            {document.competencies.map((skill, index) => (
              <li key={index}>{skill}</li>
            ))}
          </ul>
        </section>
      )}
      {document.information.length > 0 && (
        <section className="cv-section">
          <h3>Informações complementares</h3>
          <ul className="cv-information">
            {document.information.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
