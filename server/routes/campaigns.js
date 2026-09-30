import { Router } from 'express';
import { toDto } from '../repository.js';
import { campaignSchema, statusSchema, parse } from '../validation.js';
import { httpError } from '../middleware/errorHandler.js';

export function campaignRoutes(repo, baseUrlFor) {
  const router = Router();

  const findOr404 = (id) => {
    const row = repo.get(Number(id));
    if (!row) throw httpError(404, 'Campaign not found');
    return row;
  };

  // A destination that points back at our own /go/ path would loop forever.
  const rejectSelfRedirect = (req, destinationUrl) => {
    const dest = new URL(destinationUrl);
    const own = new URL(baseUrlFor(req));
    if (dest.host === own.host && dest.pathname.startsWith('/go/')) {
      const err = httpError(400, 'Please fix the highlighted fields');
      err.fields = { destinationUrl: 'Destination cannot be another tracking URL from this app' };
      throw err;
    }
  };

  router.get('/config', (req, res) => {
    res.json({ trackingBaseUrl: `${baseUrlFor(req)}/go/` });
  });

  router.get('/stats', (_req, res) => {
    res.json(repo.stats());
  });

  router.get('/campaigns', (req, res) => {
    const rows = repo.list({ search: req.query.search?.trim(), status: req.query.status });
    const base = baseUrlFor(req);
    res.json(rows.map((r) => toDto(r, base)));
  });

  router.get('/campaigns/:id', (req, res) => {
    res.json(toDto(findOr404(req.params.id), baseUrlFor(req)));
  });

  router.post('/campaigns', (req, res) => {
    const data = parse(campaignSchema, req.body);
    rejectSelfRedirect(req, data.destinationUrl);
    res.status(201).json(toDto(repo.create(data), baseUrlFor(req)));
  });

  router.put('/campaigns/:id', (req, res) => {
    findOr404(req.params.id);
    const data = parse(campaignSchema, req.body);
    rejectSelfRedirect(req, data.destinationUrl);
    res.json(toDto(repo.update(Number(req.params.id), data), baseUrlFor(req)));
  });

  router.patch('/campaigns/:id/status', (req, res) => {
    findOr404(req.params.id);
    const { status } = parse(statusSchema, req.body);
    res.json(toDto(repo.setStatus(Number(req.params.id), status), baseUrlFor(req)));
  });

  router.delete('/campaigns/:id', (req, res) => {
    findOr404(req.params.id);
    repo.remove(Number(req.params.id));
    res.status(204).end();
  });

  router.get('/campaigns/:id/clicks', (req, res) => {
    const row = findOr404(req.params.id);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    res.json({
      campaign: toDto(row, baseUrlFor(req)),
      daily: repo.dailyClicks(row.id, 7),
      recent: repo.recentClicks(row.id, limit).map((c) => ({
        id: c.id,
        clickedAt: c.clicked_at,
        ip: c.ip,
        userAgent: c.user_agent,
        referrer: c.referrer,
        isBot: Boolean(c.is_bot),
      })),
    });
  });

  return router;
}
