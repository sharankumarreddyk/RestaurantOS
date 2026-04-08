import db from '../config/database.js';

async function migrate() {
  try {
    console.log('Running migrations...');
    await db.migrate.latest();
    console.log('Migrations complete');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
