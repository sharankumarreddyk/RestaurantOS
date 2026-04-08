import knex from 'knex';
import config from './index.js';

const db = knex({
  client: 'pg',
  connection: config.db.connectionString,
  pool: config.db.pool,
  migrations: {
    directory: './src/db/migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './src/db/seeds',
  },
});

export default db;
