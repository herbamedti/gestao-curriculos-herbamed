'use client';
import { useState } from 'react';
import { validBirthDate, validCpf } from './registration-schema';

export function SignupFields() {
  const [cpfError, setCpfError] = useState('');
  const [dateError, setDateError] = useState('');
  return <>
    <label className="field"><span>CPF *</span><input name="cpf" required inputMode="numeric" autoComplete="off" maxLength={14} placeholder="000.000.000-00" aria-describedby="cpf-help" onChange={event => { event.target.setCustomValidity(''); setCpfError(''); }} onBlur={event => {
      const message = event.target.value && !validCpf(event.target.value.trim()) ? 'Informe um CPF válido.' : '';
      event.target.setCustomValidity(message); setCpfError(message);
    }} /><small id="cpf-help">{cpfError || 'Aceita apenas números ou o formato 000.000.000-00.'}</small></label>
    <label className="field"><span>Data de nascimento *</span><input name="birth_date" type="date" autoComplete="bday" required min="1900-01-01" aria-describedby="birth-help" onChange={event => { event.target.setCustomValidity(''); setDateError(''); }} onBlur={event => {
      const message = event.target.value && !validBirthDate(event.target.value) ? 'Informe uma data válida, que não esteja no futuro.' : '';
      event.target.setCustomValidity(message); setDateError(message);
    }} />{dateError && <small id="birth-help">{dateError}</small>}</label>
  </>;
}
