import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { createRepository } from './repository.js';
import { campaignRoutes } from './routes/campaigns.js';
import { redirectRoutes } from './routes/redirect.js';
import { basicAuth } from './middleware/basicAuth.js';
import { errorHandler, notFoundApi } from './middleware/errorHandler.js';

const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');

export function createApp({ db, config }) {
  const repo = createRepository(db);
  const app = express();

  if (config.trustProxy) app.set('trust proxy', true);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // Keeps plain-http local and LAN testing working.
          upgradeInsecureRequests: null,
        },
      },
    })
  );
  if (config.logRequests) app.use(morgan('dev'));
  app.use(express.json({ limit: '20kb' }));

  const baseUrlFor = (req) => config.publicBaseUrl || `${req.protocol}://${req.get('host')}`;

  // Public: health check and tracking redirects.
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use(redirectRoutes(repo));

  // Everything below is the admin area.
  app.use(basicAuth({ user: config.adminUser, password: config.adminPassword }));
  app.use('/api', campaignRoutes(repo, baseUrlFor));
  app.use('/api', notFoundApi);

  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist, { index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  } else {
    app.get('/', (_req, res) =>
      res
        .type('text')
        .send('Dashboard is not built yet. Run "npm run build" then "npm start", or use "npm run dev".')
    );
  }

  app.use(errorHandler);
  return app;
}
