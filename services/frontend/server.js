const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 3000;
const app = express();

// Liveness/readiness for the frontend (it has no database of its own).
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve the static UI. The page's JavaScript calls the backends using
// RELATIVE URLs (/api/products, /api/orders), so every request goes back
// through the same gateway origin — no CORS, no hardcoded backend address.
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`frontend listening on :${PORT}`));
