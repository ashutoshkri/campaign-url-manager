const BOT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|slack|discord|skype|preview|embedly|headless|lighthouse/i;

export function isBot(userAgent = '') {
  return BOT_PATTERN.test(userAgent);
}

const now = () => new Date().toISOString();

export function toDto(row, baseUrl) {
  return {
    id: row.id,
    name: row.name,
    campaignId: row.campaign_id,
    destinationUrl: row.destination_url,
    status: row.status,
    totalClicks: row.click_count,
    botClicks: row.bot_click_count,
    lastClickAt: row.last_click_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    trackingUrl: `${baseUrl}/go/${encodeURIComponent(row.campaign_id)}`,
  };
}

export function createRepository(db) {
  const q = {
    byId: db.prepare('SELECT * FROM campaigns WHERE id = ?'),
    byCampaignId: db.prepare('SELECT * FROM campaigns WHERE campaign_id = ?'),
    insert: db.prepare(`
      INSERT INTO campaigns (name, campaign_id, destination_url, status, created_at, updated_at)
      VALUES (@name, @campaignId, @destinationUrl, @status, @now, @now)`),
    update: db.prepare(`
      UPDATE campaigns
         SET name = @name, campaign_id = @campaignId, destination_url = @destinationUrl,
             status = @status, updated_at = @now
       WHERE id = @id`),
    setStatus: db.prepare('UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?'),
    remove: db.prepare('DELETE FROM campaigns WHERE id = ?'),
    insertClick: db.prepare(`
      INSERT INTO clicks (campaign_pk, clicked_at, ip, user_agent, referrer, is_bot)
      VALUES (@campaignPk, @clickedAt, @ip, @userAgent, @referrer, @isBot)`),
    countHuman: db.prepare(
      'UPDATE campaigns SET click_count = click_count + 1, last_click_at = ? WHERE id = ?'
    ),
    countBot: db.prepare('UPDATE campaigns SET bot_click_count = bot_click_count + 1 WHERE id = ?'),
    recentClicks: db.prepare(`
      SELECT id, clicked_at, ip, user_agent, referrer, is_bot
        FROM clicks WHERE campaign_pk = ? ORDER BY clicked_at DESC, id DESC LIMIT ?`),
    dailyClicks: db.prepare(`
      SELECT substr(clicked_at, 1, 10) AS day, COUNT(*) AS count
        FROM clicks WHERE campaign_pk = ? AND is_bot = 0 AND clicked_at >= ?
       GROUP BY day`),
    stats: db.prepare(`
      SELECT COUNT(*) AS total,
             COALESCE(SUM(status = 'active'), 0) AS active,
             COALESCE(SUM(status = 'paused'), 0) AS paused,
             COALESCE(SUM(click_count), 0) AS clicks
        FROM campaigns`),
    clicksSince: db.prepare('SELECT COUNT(*) AS n FROM clicks WHERE is_bot = 0 AND clicked_at >= ?'),
  };

  // Click row + counters are written together so the dashboard never shows a half-recorded click.
  const recordClickTx = db.transaction((campaign, meta) => {
    const clickedAt = now();
    const bot = isBot(meta.userAgent);
    q.insertClick.run({
      campaignPk: campaign.id,
      clickedAt,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
      referrer: meta.referrer?.slice(0, 1024) ?? null,
      isBot: bot ? 1 : 0,
    });
    if (bot) q.countBot.run(campaign.id);
    else q.countHuman.run(clickedAt, campaign.id);
    return { clickedAt, bot };
  });

  return {
    list({ search, status } = {}) {
      const where = [];
      const params = {};
      if (search) {
        where.push('(name LIKE @search OR campaign_id LIKE @search)');
        params.search = `%${search}%`;
      }
      if (status === 'active' || status === 'paused') {
        where.push('status = @status');
        params.status = status;
      }
      const sql = `SELECT * FROM campaigns ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                   ORDER BY created_at DESC, id DESC`;
      return db.prepare(sql).all(params);
    },
    get: (id) => q.byId.get(id),
    getByCampaignId: (campaignId) => q.byCampaignId.get(campaignId),
    create(data) {
      const { lastInsertRowid } = q.insert.run({ ...data, now: now() });
      return q.byId.get(lastInsertRowid);
    },
    update(id, data) {
      const { changes } = q.update.run({ ...data, id, now: now() });
      return changes ? q.byId.get(id) : undefined;
    },
    setStatus(id, status) {
      const { changes } = q.setStatus.run(status, now(), id);
      return changes ? q.byId.get(id) : undefined;
    },
    remove: (id) => q.remove.run(id).changes > 0,
    recordClick: (campaign, meta) => recordClickTx(campaign, meta),
    recentClicks: (id, limit = 50) => q.recentClicks.all(id, limit),
    dailyClicks(id, days = 7) {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      start.setUTCDate(start.getUTCDate() - (days - 1));
      const counts = new Map(q.dailyClicks.all(id, start.toISOString()).map((r) => [r.day, r.count]));
      return Array.from({ length: days }, (_, i) => {
        const d = new Date(start);
        d.setUTCDate(start.getUTCDate() + i);
        const day = d.toISOString().slice(0, 10);
        return { day, count: counts.get(day) ?? 0 };
      });
    },
    stats() {
      const s = q.stats.get();
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      return { ...s, clicksLast24h: q.clicksSince.get(since).n };
    },
  };
}
