import { config } from './config.js';
import { openDatabase } from './db.js';
import { createApp } from './app.js';

const db = openDatabase(config.dbPath);
const app = createApp({ db, config });

const server = app.listen(config.port, () => {
  console.log(`Campaign URL Manager running at http://localhost:${config.port}`);
  console.log(`Database: ${config.dbPath}`);
  if (!config.adminPassword) {
    console.log('Admin login is off. Set ADMIN_PASSWORD in .env to protect the dashboard.');
  }
});

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
