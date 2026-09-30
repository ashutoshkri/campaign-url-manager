import { Router } from 'express';

const page = (title, message) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:#f3f5f7;color:#17202e}
main{max-width:30rem;padding:2rem}h1{font-size:1.4rem;margin:0 0 .5rem}p{margin:0;color:#4a5566}</style>
</head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`;

/**
 * Copies the visitor's query string onto the destination (e.g. ?utm_source=fb&sub1=abc),
 * without overriding parameters the destination already defines.
 */
export function buildDestination(destinationUrl, originalUrl) {
  const dest = new URL(destinationUrl);
  const incoming = new URL(originalUrl, 'http://placeholder').searchParams;
  for (const [key, value] of incoming) {
    if (!dest.searchParams.has(key)) dest.searchParams.append(key, value);
  }
  return dest.toString();
}

export function redirectRoutes(repo) {
  const router = Router();

  router.get('/go/:campaignId', (req, res) => {
    // Never let browsers or proxies cache the redirect, or repeat clicks would go uncounted.
    res.set('Cache-Control', 'no-store, max-age=0');

    const campaign = repo.getByCampaignId(req.params.campaignId);
    if (!campaign) {
      return res
        .status(404)
        .type('html')
        .send(page('Link not found', 'This tracking link does not exist. Check the URL and try again.'));
    }
    if (campaign.status !== 'active') {
      return res
        .status(404)
        .type('html')
        .send(page('This link is not active', 'The campaign behind this link is paused right now.'));
    }

    // HEAD requests (link checkers, uptime monitors) are answered but not counted.
    if (req.method !== 'HEAD') {
      repo.recordClick(campaign, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        referrer: req.get('referer'),
      });
    }

    res.redirect(302, buildDestination(campaign.destination_url, req.originalUrl));
  });

  return router;
}
