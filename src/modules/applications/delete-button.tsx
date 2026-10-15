'use client';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Modal } from '@/ui/modal';
import { Icon } from '@/ui/icon';
import { ActionForm, Hidden } from '@/ui/form';
import { deleteApplication } from './delete-action';

export function DeleteApplicationButton({ id, updatedAt, name, iconOnly = false }: {
  id: string; updatedAt: string; name: string; iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  function close() { setOpen(false); setConfirmation(''); }
  return <>
    <button type="button" className={iconOnly ? 'icon-button danger-action' : 'button destructive'}
      title="Excluir candidatura definitivamente" aria-label={`Excluir candidatura de ${name}`} onClick={() => setOpen(true)}>
      <Icon name="delete" />{!iconOnly && 'Excluir candidatura'}
    </button>
    {open && <Modal title="Excluir candidatura definitivamente" description={name} onClose={close}>
      <p className="alert warning">Esta exclusão é permanente e não pode ser desfeita.</p>
      <p>Serão excluídos esta candidatura e seus registros de etapas, respostas, avaliações e entrevistas. O currículo, a conta do candidato e as outras candidaturas serão preservados. A exclusão ficará registrada na auditoria.</p>
      <ActionForm action={deleteApplication} submit={<><Icon name="delete" />Excluir definitivamente</>} pendingLabel="Excluindo candidatura…"
        className="application-delete-form" disabled={confirmation !== 'EXCLUIR'}>
        <Hidden name="application_id" value={id} /><Hidden name="expected_updated_at" value={updatedAt} />
        <label className="field"><span>Digite EXCLUIR para confirmar *</span>
          <input name="confirmation" required autoComplete="off" spellCheck={false} value={confirmation} maxLength={7} onChange={event => setConfirmation(event.target.value)} />
        </label>
        <CancelDeletion onClick={close} />
      </ActionForm>
    </Modal>}
  </>;
}

function CancelDeletion({ onClick }: { onClick: () => void }) {
  const { pending } = useFormStatus();
  return <button type="button" className="button outlined" onClick={onClick} disabled={pending}>Cancelar</button>;
}
