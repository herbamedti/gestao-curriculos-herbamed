'use client';

import { useState } from 'react';
import { mutate } from '@/modules/actions';
import { ActionForm, Hidden } from '@/ui/form';
import { POLICY_BODY_LIMIT } from './policy-schema';

export function PolicyEditor({
  title = '',
  body = '',
  sourceVersion,
}: {
  title?: string;
  body?: string;
  sourceVersion?: string;
}) {
  const [draft, setDraft] = useState({ version: '', title, body });
  return (
    <ActionForm
      action={mutate}
      submit="Publicar nova versão"
      className="policy-editor"
      confirm="Publicar este aviso de privacidade para as próximas candidaturas? A versão anterior será preservada no histórico."
    >
      <Hidden name="op" value="privacy-policy" />
      {sourceVersion && (
        <p className="alert info">
          Texto da versão {sourceVersion} carregado como base. Revise o conteúdo e informe um novo
          identificador de versão para publicar.
        </p>
      )}
      <div className="form-grid">
        <label className="field">
          <span>Nova versão *</span>
          <input
            name="version"
            required
            minLength={2}
            maxLength={40}
            placeholder="Ex.: 2026-02"
            value={draft.version}
            onChange={(e) => setDraft({ ...draft, version: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Título do aviso *</span>
          <input
            name="title"
            required
            minLength={5}
            maxLength={160}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
      </div>
      <label className="field">
        <span>Texto integral aprovado *</span>
        <textarea
          name="body"
          required
          minLength={100}
          rows={18}
          aria-describedby="policy-body-help policy-body-count"
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
      </label>
      <div className="policy-editor-help">
        <p id="policy-body-help" className="muted">
          Cole o aviso completo. Aceita texto simples, títulos com #, listas e destaques com **. O
          conteúdo permanece no formulário se a publicação falhar.
        </p>
        <p
          id="policy-body-count"
          className={draft.body.length > POLICY_BODY_LIMIT ? 'policy-limit-error' : 'muted'}
          aria-live="polite"
        >
          {draft.body.length.toLocaleString('pt-BR')} / {POLICY_BODY_LIMIT.toLocaleString('pt-BR')}{' '}
          caracteres
          {draft.body.length > POLICY_BODY_LIMIT ? ' — reduza o texto antes de publicar.' : ''}
        </p>
      </div>
      <label className="check">
        <input type="checkbox" name="approved" required />
        Confirmo que este texto foi aprovado pela equipe responsável.
      </label>
    </ActionForm>
  );
}
