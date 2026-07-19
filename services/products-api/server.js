const express = require('express');
const client = require('prom-client');
const { pool, checkDb } = require('./db');

const PORT = process.env.PORT || 8080;

// --- Fail fast on missing configuration -----------------------------------
// If the database environment variables are absent, the service cannot work.
// Exiting with a clear message here produces a CrashLoopBackOff in Kubernetes
// that is easy to diagnose (Lab 6 uses this as a deliberate incident).
const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
  console.error('products-api cannot start without its database configuration. Exiting.');
  process.exit(1);
}

const app = express();
app.use(express.json());

// --- Prometheus metrics ----------------------------------------------------
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});
const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

app.use((req, res, next) => {
  const stop = httpDuration.startTimer();
  res.on('finish', () => {
    const route = req.route ? req.route.path : req.path;
    const labels = { method: req.method, route, status_code: res.statusCode };
    httpRequests.inc(labels);
    stop(labels);
  });
  next();
});

// --- Routes ----------------------------------------------------------------

// Liveness: is the process up? Independent of the database on purpose, so a
// DB outage does not cause Kubernetes to kill and restart the pod.
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Readiness: should this pod receive traffic? Only if the DB is reachable.
app.get('/ready', async (req, res) => {
  const ok = await checkDb();
  if (ok) return res.json({ status: 'ready' });
  res.status(503).json({ status: 'not ready', reason: 'database unreachable' });
});

// Public product listing, consumed by the frontend (through the gateway) and
// by orders-api (service-to-service).
app.get('/products', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, price FROM products ORDER BY id');
    res.json({ products: rows });
  } catch (err) {
    console.error('[ERROR] products query failed:', err.message);
    res.status(500).json({ error: 'failed to fetch products' });
  }
});

// Deliberate 5xx endpoint used to demonstrate error-rate alerting in Lab 5.
app.get('/debug/error', (req, res) => {
  res.status(500).json({ error: 'deliberate error for alert testing' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(PORT, () => console.log(`products-api listening on :${PORT}`));
