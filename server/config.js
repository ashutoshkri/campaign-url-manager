import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 4000,
  dbPath: process.env.DB_PATH || 'data/campaigns.db',
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, ''),
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  trustProxy: process.env.TRUST_PROXY === 'true',
  logRequests: process.env.NODE_ENV !== 'test',
};
