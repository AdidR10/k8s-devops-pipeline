const express = require('express');
const client = require('prom-client');
const { pool, checkDb } = require('./db');

const PORT = process.env.PORT || 8080;
// Where to reach products-api for service-to-service calls. In compose and in
// Kubernetes this is a Service DNS name, e.g. http://products-api:8080.
const PRODUCTS_API_URL = process.env.PRODUCTS_API_URL || 'http://products-api:8080';

// --- Fail fast on missing configuration -----------------------------------
const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
  console.error('orders-api cannot start without its database configuration. Exiting.');
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
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/ready', async (req, res) => {
  const ok = await checkDb();
  if (ok) return res.json({ status: 'ready' });
  res.status(503).json({ status: 'not ready', reason: 'database unreachable' });
});

// List orders, enriched with product names fetched from products-api. The
// cross-service call demonstrates pod-to-service communication and is a
// natural place for a "misconfigured networking" incident in Lab 6.
app.get('/orders', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, product_id, quantity FROM orders ORDER BY id'
    );

    let products = [];
    try {
      const r = await fetch(`${PRODUCTS_API_URL}/products`);
      if (r.ok) {
        const data = await r.json();
        products = data.products || [];
      }
    } catch (err) {
      // products-api being unreachable degrades the response but does not
      // fail it — orders are still returned, just without product names.
      console.error('[WARN] could not reach products-api:', err.message);
    }

    const nameById = Object.fromEntries(products.map((p) => [p.id, p.name]));
    const orders = rows.map((o) => ({
      id: o.id,
      product_id: o.product_id,
      product_name: nameById[o.product_id] || 'unknown',
      quantity: o.quantity,
    }));
    res.json({ orders });
  } catch (err) {
    console.error('[ERROR] orders query failed:', err.message);
    res.status(500).json({ error: 'failed to fetch orders' });
  }
});

app.get('/debug/error', (req, res) => {
  res.status(500).json({ error: 'deliberate error for alert testing' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(PORT, () => console.log(`orders-api listening on :${PORT}`));
