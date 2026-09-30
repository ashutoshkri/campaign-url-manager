import { useState } from 'react';
import { copyText, formatNumber, fullDate, hostOf, timeAgo } from '../format.js';

function CopyButton({ text, onCopied }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="link-btn"
      onClick={async () => {
        await copyText(text);
        setDone(true);
        onCopied?.();
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function StatusSwitch({ campaign, onToggle }) {
  const active = campaign.status === 'active';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={`${campaign.name} is ${active ? 'active' : 'paused'}. ${active ? 'Pause' : 'Activate'} campaign`}
      className={`switch ${active ? 'on' : ''}`}
      onClick={() => onToggle(campaign)}
    >
      <span className="switch-track"><span className="switch-thumb" /></span>
      <span className="switch-label">{active ? 'Active' : 'Paused'}</span>
    </button>
  );
}

export default function CampaignTable({ campaigns, now, onEdit, onDelete, onToggle, onViewClicks, onCopied }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Campaign</th>
            <th scope="col">Campaign ID</th>
            <th scope="col">Tracking URL</th>
            <th scope="col">Status</th>
            <th scope="col" className="num">Total clicks</th>
            <th scope="col">Last click</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id} className={c.status === 'paused' ? 'is-paused' : ''}>
              <td>
                <div className="name">{c.name}</div>
                <a className="dest" href={c.destinationUrl} target="_blank" rel="noreferrer" title={c.destinationUrl}>
                  {hostOf(c.destinationUrl)}
                </a>
              </td>
              <td><code className="cid">{c.campaignId}</code></td>
              <td>
                <div className="tracking">
                  <span className="tracking-url" title={c.trackingUrl}>
                    <span className="tracking-base">{c.trackingUrl.slice(0, c.trackingUrl.lastIndexOf('/') + 1)}</span>
                    <span className="tracking-id">{c.trackingUrl.slice(c.trackingUrl.lastIndexOf('/') + 1)}</span>
                  </span>
                  <CopyButton text={c.trackingUrl} onCopied={onCopied} />
                  <a className="link-btn" href={c.trackingUrl} target="_blank" rel="noreferrer">Open</a>
                </div>
              </td>
              <td><StatusSwitch campaign={c} onToggle={onToggle} /></td>
              <td className="num">
                <button type="button" className="clicks-btn" onClick={() => onViewClicks(c)} title="View click history">
                  {formatNumber(c.totalClicks)}
                </button>
              </td>
              <td>
                {c.lastClickAt ? (
                  <time dateTime={c.lastClickAt} title={fullDate(c.lastClickAt)}>{timeAgo(c.lastClickAt, now)}</time>
                ) : (
                  <span className="muted">No clicks yet</span>
                )}
              </td>
              <td className="actions">
                <button type="button" className="btn small ghost" onClick={() => onEdit(c)}>Edit</button>
                <button type="button" className="btn small ghost danger-text" onClick={() => onDelete(c)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
