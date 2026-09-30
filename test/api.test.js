import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { openDatabase } from '../server/db.js';
import { createApp } from '../server/app.js';

const baseConfig = {
  publicBaseUrl: '',
  adminUser: 'admin',
  adminPassword: '',
  trustProxy: false,
  logRequests: false,
};

let app;
beforeEach(() => {
  app = createApp({ db: openDatabase(':memory:'), config: baseConfig });
});

const sample = {
  name: 'Diwali Sale',
  campaignId: 'diwali2026',
  destinationUrl: 'https://shop.example.com/diwali?ref=ads',
  status: 'active',
};

const create = (body = sample) => request(app).post('/api/campaigns').send(body);

test('creates a campaign with an uppercase ID and a tracking URL', async () => {
  const res = await create();
  assert.equal(res.status, 201);
  assert.equal(res.body.campaignId, 'DIWALI2026');
  assert.equal(res.body.totalClicks, 0);
  assert.equal(res.body.lastClickAt, null);
  assert.match(res.body.trackingUrl, /\/go\/DIWALI2026$/);
});

test('rejects invalid input with per-field messages', async () => {
  const res = await create({ name: '', campaignId: 'bad id!', destinationUrl: 'ftp://x', status: 'live' });
  assert.equal(res.status, 400);
  assert.ok(res.body.fields.name);
  assert.ok(res.body.fields.campaignId);
  assert.ok(res.body.fields.destinationUrl);
  assert.ok(res.body.fields.status);
});

test('rejects a duplicate campaign ID regardless of case', async () => {
  await create();
  const res = await create({ ...sample, name: 'Copy', campaignId: 'Diwali2026' });
  assert.equal(res.status, 409);
  assert.ok(res.body.fields.campaignId);
});

test('rejects a destination that points back to a tracking URL', async () => {
  const res = await request(app)
    .post('/api/campaigns')
    .set('Host', 'track.local')
    .send({ ...sample, destinationUrl: 'http://track.local/go/OTHER' });
  assert.equal(res.status, 400);
  assert.ok(res.body.fields.destinationUrl);
});

test('tracking URL records the click and redirects with 302', async () => {
  await create();
  const res = await request(app).get('/go/diwali2026?utm_source=fb').set('User-Agent', 'Mozilla/5.0 Chrome/129');
  assert.equal(res.status, 302);
  assert.equal(res.headers['cache-control'], 'no-store, max-age=0');
  const location = new URL(res.headers.location);
  assert.equal(location.host, 'shop.example.com');
  assert.equal(location.searchParams.get('ref'), 'ads');
  assert.equal(location.searchParams.get('utm_source'), 'fb');

  const [campaign] = (await request(app).get('/api/campaigns')).body;
  assert.equal(campaign.totalClicks, 1);
  assert.ok(campaign.lastClickAt);
});

test('link-preview bots are logged but not counted as clicks', async () => {
  await create();
  await request(app).get('/go/DIWALI2026').set('User-Agent', 'WhatsApp/2.23.20');
  const [campaign] = (await request(app).get('/api/campaigns')).body;
  assert.equal(campaign.totalClicks, 0);
  assert.equal(campaign.botClicks, 1);
});

test('paused campaigns do not redirect or count clicks', async () => {
  const { body } = await create();
  await request(app).patch(`/api/campaigns/${body.id}/status`).send({ status: 'paused' }).expect(200);
  const res = await request(app).get('/go/DIWALI2026');
  assert.equal(res.status, 404);
  assert.equal(res.headers.location, undefined);
  const campaign = (await request(app).get(`/api/campaigns/${body.id}`)).body;
  assert.equal(campaign.totalClicks, 0);
});

test('unknown tracking IDs return 404', async () => {
  await request(app).get('/go/NOPE').expect(404);
});

test('edits a campaign', async () => {
  const { body } = await create();
  const res = await request(app)
    .put(`/api/campaigns/${body.id}`)
    .send({ ...sample, name: 'Diwali Mega Sale', destinationUrl: 'https://shop.example.com/mega' });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Diwali Mega Sale');
  assert.equal(res.body.destinationUrl, 'https://shop.example.com/mega');
});

test('deletes a campaign and its click history', async () => {
  const { body } = await create();
  await request(app).get('/go/DIWALI2026');
  await request(app).delete(`/api/campaigns/${body.id}`).expect(204);
  await request(app).get(`/api/campaigns/${body.id}`).expect(404);
  await request(app).get('/go/DIWALI2026').expect(404);
});

test('click details return 7 days of history and recent clicks', async () => {
  const { body } = await create();
  await request(app).get('/go/DIWALI2026').set('Referer', 'https://facebook.com/');
  const res = await request(app).get(`/api/campaigns/${body.id}/clicks`);
  assert.equal(res.status, 200);
  assert.equal(res.body.daily.length, 7);
  assert.equal(res.body.daily.at(-1).count, 1);
  assert.equal(res.body.recent[0].referrer, 'https://facebook.com/');
});

test('stats summarise campaigns and clicks', async () => {
  const { body } = await create();
  await create({ ...sample, campaignId: 'SECOND', status: 'paused' });
  await request(app).get('/go/DIWALI2026');
  const res = await request(app).get('/api/stats');
  assert.deepEqual(res.body, { total: 2, active: 1, paused: 1, clicks: 1, clicksLast24h: 1 });
  assert.ok(body.id);
});

test('admin API requires credentials when a password is set, tracking URLs stay public', async () => {
  const secured = createApp({
    db: openDatabase(':memory:'),
    config: { ...baseConfig, adminPassword: 's3cret' },
  });
  await request(secured).get('/api/campaigns').expect(401);
  await request(secured).post('/api/campaigns').auth('admin', 's3cret').send(sample).expect(201);
  await request(secured).get('/go/DIWALI2026').expect(302);
});
