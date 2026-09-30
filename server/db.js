import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS campaigns (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL,
  campaign_id      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  destination_url  TEXT    NOT NULL,
  status           TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  click_count      INTEGER NOT NULL DEFAULT 0,  -- human clicks only
  bot_click_count  INTEGER NOT NULL DEFAULT 0,  -- link previews / crawlers
  last_click_at    TEXT,
  created_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS clicks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_pk  INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  clicked_at   TEXT    NOT NULL,
  ip           TEXT,
  user_agent   TEXT,
  referrer     TEXT,
  is_bot       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_clicks_campaign_time ON clicks (campaign_pk, clicked_at);
`;

export function openDatabase(file) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
