const { Pool } = require('pg');

// Connection details come entirely from environment variables so the same
// image runs unchanged in docker-compose and in Kubernetes (values differ,
// code does not).
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 5,
});

pool.on('error', (err) => {
  console.error('[DB] unexpected pool error:', err.message);
});

// Used by the /ready readiness probe. Returns true only if the database
// answers a trivial query. When the DB is down this returns false, which
// makes the pod report NotReady instead of serving broken responses.
async function checkDb() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    console.error('[DB] readiness check failed:', err.message);
    return false;
  }
}

module.exports = { pool, checkDb };
