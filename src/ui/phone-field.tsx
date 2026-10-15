'use client';

import { formatPhone } from './contact-format';

export function PhoneField({ label, name, value, required }: {
  label: string; name: string; value?: string | null; required?: boolean;
}) {
  return <label className="field">
    <span>{label}{required ? ' *' : ''}</span>
    <input name={name} type="tel" autoComplete="tel" maxLength={30}
      defaultValue={formatPhone(value)} required={required} placeholder="(47) 99999-9999"
      onBlur={event => { event.currentTarget.value = formatPhone(event.currentTarget.value); }} />
  </label>;
}
