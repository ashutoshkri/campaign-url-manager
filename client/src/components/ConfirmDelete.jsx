import { useState } from 'react';
import Modal from './Modal.jsx';
import { formatNumber } from '../format.js';

export default function ConfirmDelete({ campaign, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Delete campaign?" onClose={onClose} width={440}>
      <div className="confirm">
        <p>
          <strong>{campaign.name}</strong> and its {formatNumber(campaign.totalClicks)} recorded clicks will be removed.
          Its tracking URL will stop working. This can't be undone.
        </p>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Keep campaign</button>
          <button
            type="button"
            className="btn danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Deleting…' : 'Delete campaign'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
