import { useState } from 'react';
import Modal from './Modal.jsx';
import { toCampaignId } from '../format.js';

export default function CampaignForm({ campaign, trackingBaseUrl, onSave, onClose }) {
  const editing = Boolean(campaign);
  const [values, setValues] = useState({
    name: campaign?.name ?? '',
    campaignId: campaign?.campaignId ?? '',
    destinationUrl: campaign?.destinationUrl ?? '',
    status: campaign?.status ?? 'active',
  });
  // While creating, the ID follows the name until the admin types their own.
  const [idTouched, setIdTouched] = useState(editing);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => {
    const value = e.target.value;
    setValues((v) => ({
      ...v,
      [field]: value,
      ...(field === 'name' && !idTouched && { campaignId: toCampaignId(value) }),
    }));
    setErrors((er) => ({ ...er, [field]: undefined, ...(field === 'name' && { campaignId: undefined }) }));
  };

  const idChanged = editing && values.campaignId.toUpperCase() !== campaign.campaignId;
  const previewId = values.campaignId.trim().toUpperCase() || 'CAMPAIGN-ID';

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await onSave(values);
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(Object.keys(err.fields || {}).length ? '' : err.message);
      setSaving(false);
    }
  }

  const field = (name) => ({
    id: `f-${name}`,
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `e-${name}` : undefined,
  });

  return (
    <Modal title={editing ? 'Edit campaign' : 'New campaign'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="f-name">Campaign name</label>
          <input {...field('name')} value={values.name} onChange={set('name')} placeholder="Diwali Sale 2026" maxLength={120} />
          {errors.name && <p className="error" id="e-name">{errors.name}</p>}
        </div>

        <div className="field">
          <label htmlFor="f-campaignId">Campaign ID</label>
          <input
            {...field('campaignId')}
            value={values.campaignId}
            onChange={(e) => {
              setIdTouched(true);
              set('campaignId')(e);
            }}
            placeholder="DIWALI2026"
            maxLength={50}
            className="mono-ish"
            autoCapitalize="characters"
            spellCheck={false}
          />
          {errors.campaignId ? (
            <p className="error" id="e-campaignId">{errors.campaignId}</p>
          ) : (
            <p className="hint">
              Tracking URL: <span className="preview">{trackingBaseUrl}{previewId}</span>
            </p>
          )}
          {idChanged && (
            <p className="warning">Changing the ID changes the tracking URL. Links you already shared will stop working.</p>
          )}
        </div>

        <div className="field">
          <label htmlFor="f-destinationUrl">Destination URL</label>
          <input
            {...field('destinationUrl')}
            type="url"
            inputMode="url"
            value={values.destinationUrl}
            onChange={set('destinationUrl')}
            placeholder="https://yourstore.com/landing-page"
            spellCheck={false}
          />
          {errors.destinationUrl ? (
            <p className="error" id="e-destinationUrl">{errors.destinationUrl}</p>
          ) : (
            <p className="hint">Query parameters on the tracking URL, like ?utm_source=fb, are passed through.</p>
          )}
        </div>

        <fieldset className="field">
          <legend>Status</legend>
          <div className="segmented" role="radiogroup">
            {['active', 'paused'].map((s) => (
              <label key={s} className={values.status === s ? 'on' : ''}>
                <input type="radio" name="status" value={s} checked={values.status === s} onChange={set('status')} />
                {s === 'active' ? 'Active' : 'Paused'}
              </label>
            ))}
          </div>
          <p className="hint">Paused campaigns show a "not active" page instead of redirecting.</p>
        </fieldset>

        {formError && <p className="error form-error">{formError}</p>}

        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create campaign'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
