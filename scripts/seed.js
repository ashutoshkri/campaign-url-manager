// Adds sample campaigns with a week of click history so the dashboard has something to show.
// Usage: npm run seed            (adds samples that don't exist yet)
//        npm run seed -- --reset (clears all campaigns first)
import { config } from '../server/config.js';
import { openDatabase } from '../server/db.js';

const db = openDatabase(config.dbPath);

if (process.argv.includes('--reset')) {
  db.exec('DELETE FROM clicks; DELETE FROM campaigns;');
  console.log('Cleared existing campaigns.');
}

const samples = [
  { name: 'Diwali Sale 2026', campaignId: 'DIWALI2026', url: 'https://example.com/diwali', status: 'active', clicks: 184 },
  { name: 'App Install – Android', campaignId: 'APP-ANDROID', url: 'https://example.com/app?platform=android', status: 'active', clicks: 96 },
  { name: 'Retargeting – Cart Abandoners', campaignId: 'RTG-CART', url: 'https://example.com/cart', status: 'active', clicks: 41 },
  { name: 'Monsoon Offer', campaignId: 'MONSOON26', url: 'https://example.com/monsoon', status: 'paused', clicks: 12 },
];

const agents = [
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36',
];
const referrers = ['https://www.facebook.com/', 'https://www.instagram.com/', 'https://www.google.com/', null];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const insertCampaign = db.prepare(`
  INSERT OR IGNORE INTO campaigns (name, campaign_id, destination_url, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)`);
const insertClick = db.prepare(`
  INSERT INTO clicks (campaign_pk, clicked_at, ip, user_agent, referrer, is_bot) VALUES (?, ?, ?, ?, ?, 0)`);
const refreshCounters = db.prepare(`
  UPDATE campaigns SET
    click_count     = (SELECT COUNT(*) FROM clicks WHERE campaign_pk = campaigns.id AND is_bot = 0),
    bot_click_count = (SELECT COUNT(*) FROM clicks WHERE campaign_pk = campaigns.id AND is_bot = 1),
    last_click_at   = (SELECT MAX(clicked_at) FROM clicks WHERE campaign_pk = campaigns.id AND is_bot = 0)
  WHERE id = ?`);

db.transaction(() => {
  for (const s of samples) {
    const created = new Date(Date.now() - 8 * 86400000).toISOString();
    const { changes, lastInsertRowid } = insertCampaign.run(s.name, s.campaignId, s.url, s.status, created, created);
    if (!changes) {
      console.log(`Skipped ${s.campaignId} (already exists)`);
      continue;
    }
    for (let i = 0; i < s.clicks; i++) {
      const at = new Date(Date.now() - Math.random() * 7 * 86400000).toISOString();
      insertClick.run(lastInsertRowid, at, `203.0.113.${1 + (i % 250)}`, pick(agents), pick(referrers));
    }
    refreshCounters.run(lastInsertRowid);
    console.log(`Added ${s.campaignId} with ${s.clicks} clicks`);
  }
})();

db.close();
