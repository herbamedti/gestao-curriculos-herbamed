'use client';
import { ActionForm, Field, Hidden, Select } from './form';
import { MfaSetup } from './mfa';
import { sendAccountEmailCode, updateAccount } from '@/modules/auth/account';

function Verification({ hasAuthenticator }: { hasAuthenticator: boolean }) {
  return <div className="form-grid">
    <Select name="method" label="Confirmar identidade" required>
      <option value="email">Código enviado ao e-mail atual</option>
      {hasAuthenticator && <option value="authenticator">Aplicativo autenticador</option>}
    </Select>
    <Field name="code" label="Código de confirmação" required autoComplete="one-time-code" maxLength={10} placeholder="Código do e-mail ou 6 dígitos do aplicativo" />
  </div>;
}

export function AccountSettings({ name, email, staff, mfaEnabled, factorId, azure }: {
  name: string; email: string; staff: boolean; mfaEnabled: boolean; factorId?: string; azure: boolean;
}) {
  return <div className="stack">
    <div className="split">
      <section className="card">
        <h2>Dados da conta</h2>
        <p className="muted">O nome exibido aqui também é usado no seu perfil {staff ? 'da equipe' : 'de candidato'}.</p>
        <ActionForm action={updateAccount} submit="Salvar nome">
          <Hidden name="op" value="name" />
          <Field name="name" label="Nome completo" value={name} required minLength={2} maxLength={160} autoComplete="name" />
        </ActionForm>
        <p className="muted">E-mail de acesso atual: <strong>{email}</strong></p>
      </section>
      <section className="card">
        <h2>Confirmação por e-mail</h2>
        <p className="muted">Solicite um código no e-mail atual antes de alterar o e-mail, a senha ou desativar a verificação em duas etapas. O código vale por 10 minutos e só pode ser usado uma vez.</p>
        <ActionForm action={sendAccountEmailCode} submit="Enviar código por e-mail">{null}</ActionForm>
      </section>
    </div>
    {azure ? <section className="card"><h2>Credenciais Microsoft</h2><p className="muted">O e-mail de login e a senha desta conta são gerenciados pela Microsoft da sua organização. Altere-os com a equipe responsável pelo acesso corporativo.</p></section> : <div className="split">
      <section className="card">
        <h2>Alterar e-mail de login</h2>
        <p className="muted">Após confirmar sua identidade, você deverá aprovar a mudança nos e-mails atual e novo.</p>
        <ActionForm action={updateAccount} submit="Solicitar alteração do e-mail">
          <Hidden name="op" value="email" />
          <Field name="email" type="email" label="Novo e-mail" required maxLength={254} autoComplete="email" />
          <Verification hasAuthenticator={Boolean(factorId)} />
        </ActionForm>
      </section>
      <section className="card">
        <h2>Alterar senha</h2>
        <p className="muted">A troca da senha encerra as sessões abertas. Use pelo menos 12 caracteres.</p>
        <ActionForm action={updateAccount} submit="Alterar senha">
          <Hidden name="op" value="password" />
          <Field name="password" type="password" label="Nova senha" required minLength={12} maxLength={128} autoComplete="new-password" />
          <Field name="confirm_password" type="password" label="Confirme a nova senha" required minLength={12} maxLength={128} autoComplete="new-password" />
          <Verification hasAuthenticator={Boolean(factorId)} />
        </ActionForm>
      </section>
    </div>}
    <section className="card">
      <h2>Verificação em duas etapas</h2>
      {staff && <><p className="muted">Exigência para acessar as funções de gestão: <strong>{mfaEnabled ? 'ativa' : 'desativada'}</strong>. A configuração inicial da equipe vem ativa.</p>
        {mfaEnabled ? <ActionForm action={updateAccount} submit="Desativar exigência" confirm="Desativar a verificação em duas etapas para sua conta?">
          <Hidden name="op" value="mfa" /><Hidden name="enabled" value="false" /><Verification hasAuthenticator={Boolean(factorId)} />
        </ActionForm> : <ActionForm action={updateAccount} submit="Ativar exigência">
          <Hidden name="op" value="mfa" /><Hidden name="enabled" value="true" />
        </ActionForm>}
      </>}
      {!staff && <p className="muted">Você pode configurar um aplicativo autenticador para confirmar mudanças importantes na conta.</p>}
    </section>
    <MfaSetup existing={factorId} returnTo={staff ? '/rh/conta' : '/candidato/conta'} />
  </div>;
}
