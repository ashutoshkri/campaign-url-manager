import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { formatNumber } from './format.js';
import CampaignTable from './components/CampaignTable.jsx';
import CampaignForm from './components/CampaignForm.jsx';
import ConfirmDelete from './components/ConfirmDelete.jsx';
import ClicksPanel from './components/ClicksPanel.jsx';

const REFRESH_MS = 10000;

export default function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(null);
  const [trackingBaseUrl, setTrackingBaseUrl] = useState(`${location.origin}/go/`);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // null | 'new' | campaign
  const [deleting, setDeleting] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(Date.now());

  const notify = useCallback((message, tone = 'ok') => {
    setToast({ message, tone, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const refresh = useCallback(async () => {
    try {
      const [list, summary] = await Promise.all([api.list(), api.stats()]);
      setCampaigns(list);
      setStats(summary);
      setLoadError('');
      setNow(Date.now());
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.config().then((c) => setTrackingBaseUrl(c.trackingBaseUrl), () => {});
    refresh();
    // Clicks arrive from outside the dashboard, so poll while the tab is visible.
    const timer = setInterval(() => document.visibilityState === 'visible' && refresh(), REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return campaigns.filter(
      (c) =>
        (filter === 'all' || c.status === filter) &&
        (!term || c.name.toLowerCase().includes(term) || c.campaignId.toLowerCase().includes(term))
    );
  }, [campaigns, search, filter]);

  async function save(values) {
    if (editing === 'new') {
      const created = await api.create(values);
      notify(`Created ${created.name}`);
    } else {
      const updated = await api.update(editing.id, values);
      notify(`Saved ${updated.name}`);
    }
    setEditing(null);
    refresh();
  }

  async function toggle(campaign) {
    const next = campaign.status === 'active' ? 'paused' : 'active';
    setCampaigns((list) => list.map((c) => (c.id === campaign.id ? { ...c, status: next } : c)));
    try {
      await api.setStatus(campaign.id, next);
      notify(`${campaign.name} ${next === 'active' ? 'activated' : 'paused'}`);
      refresh();
    } catch (err) {
      setCampaigns((list) => list.map((c) => (c.id === campaign.id ? campaign : c)));
      notify(err.message, 'error');
    }
  }

  async function remove() {
    try {
      await api.remove(deleting.id);
      notify(`Deleted ${deleting.name}`);
      setDeleting(null);
      refresh();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  return (
    <div className="page">
      <header className="top">
        <div>
          <h1>Campaign URL Manager</h1>
          <p className="lede">Create tracking links, watch clicks come in, and pause campaigns without changing the link.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setEditing('new')}>New campaign</button>
      </header>

      {stats && (
        <dl className="summary">
          <div><dt>Campaigns</dt><dd>{formatNumber(stats.total)}</dd></div>
          <div><dt>Active</dt><dd>{formatNumber(stats.active)}</dd></div>
          <div><dt>Paused</dt><dd>{formatNumber(stats.paused)}</dd></div>
          <div><dt>Total clicks</dt><dd>{formatNumber(stats.clicks)}</dd></div>
          <div><dt>Clicks in last 24 hours</dt><dd>{formatNumber(stats.clicksLast24h)}</dd></div>
        </dl>
      )}

      <section className="panel" aria-label="Campaigns">
        <div className="toolbar">
          <input
            type="search"
            className="search"
            placeholder="Search by name or ID"
            aria-label="Search campaigns"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="segmented" role="group" aria-label="Filter by status">
            {[
              ['all', 'All'],
              ['active', 'Active'],
              ['paused', 'Paused'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? 'on' : ''}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="live" aria-live="polite">Refreshes every 10 seconds</span>
        </div>

        {loadError && (
          <div className="banner error-banner">
            {loadError}{' '}
            <button type="button" className="link-btn" onClick={refresh}>Try again</button>
          </div>
        )}

        {loading ? (
          <p className="empty muted">Loading campaigns…</p>
        ) : campaigns.length === 0 ? (
          <div className="empty">
            <h2>No campaigns yet</h2>
            <p>Create a campaign to get a tracking URL you can put in your ads.</p>
            <button type="button" className="btn primary" onClick={() => setEditing('new')}>Create your first campaign</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <p>No campaigns match your search or filter.</p>
            <button type="button" className="link-btn" onClick={() => { setSearch(''); setFilter('all'); }}>
              Clear search and filter
            </button>
          </div>
        ) : (
          <CampaignTable
            campaigns={visible}
            now={now}
            onEdit={setEditing}
            onDelete={setDeleting}
            onToggle={toggle}
            onViewClicks={setViewing}
            onCopied={() => notify('Tracking URL copied')}
          />
        )}
      </section>

      {editing && (
        <CampaignForm
          campaign={editing === 'new' ? null : editing}
          trackingBaseUrl={trackingBaseUrl}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && <ConfirmDelete campaign={deleting} onConfirm={remove} onClose={() => setDeleting(null)} />}
      {viewing && <ClicksPanel campaign={viewing} onClose={() => setViewing(null)} />}

      {toast && (
        <div key={toast.key} className={`toast ${toast.tone}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
}
