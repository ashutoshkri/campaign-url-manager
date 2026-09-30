import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api.js';
import { describeAgent, formatNumber, fullDate, hostOf, timeAgo } from '../format.js';

const weekday = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });

export default function ClicksPanel({ campaign, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.clicks(campaign.id).then(setData, (err) => setError(err.message));
  }, [campaign.id]);

  const max = Math.max(1, ...(data?.daily.map((d) => d.count) ?? [1]));
  const week = data?.daily.reduce((sum, d) => sum + d.count, 0) ?? 0;

  return (
    <Modal title={campaign.name} onClose={onClose} width={640}>
      <div className="clicks">
        {error && <p className="error">{error}</p>}
        {!data && !error && <p className="muted">Loading click history…</p>}
        {data && (
          <>
            <dl className="mini-stats">
              <div><dt>All-time clicks</dt><dd>{formatNumber(data.campaign.totalClicks)}</dd></div>
              <div><dt>Last 7 days</dt><dd>{formatNumber(week)}</dd></div>
              <div><dt>Filtered previews</dt><dd>{formatNumber(data.campaign.botClicks)}</dd></div>
            </dl>

            <div className="bars" role="img" aria-label={`Clicks per day for the last 7 days: ${data.daily.map((d) => d.count).join(', ')}`}>
              {data.daily.map((d) => (
                <div className="bar" key={d.day} title={`${d.day}: ${d.count} clicks`}>
                  <span className="bar-count">{d.count}</span>
                  <span className="bar-fill" style={{ height: `${(d.count / max) * 100}%` }} />
                  <span className="bar-day">{weekday(d.day)}</span>
                </div>
              ))}
            </div>

            <h3 className="sub">Recent clicks</h3>
            {data.recent.length === 0 ? (
              <p className="muted">No clicks yet. Open the tracking URL to record the first one.</p>
            ) : (
              <div className="table-wrap">
                <table className="table compact">
                  <thead>
                    <tr><th>When</th><th>Source</th><th>Device</th></tr>
                  </thead>
                  <tbody>
                    {data.recent.map((c) => (
                      <tr key={c.id} className={c.isBot ? 'is-bot' : ''}>
                        <td title={fullDate(c.clickedAt)}>{timeAgo(c.clickedAt)}</td>
                        <td>{c.referrer ? hostOf(c.referrer) : 'Direct'}</td>
                        <td>
                          {c.isBot ? <span className="tag">Link preview, not counted</span> : describeAgent(c.userAgent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
