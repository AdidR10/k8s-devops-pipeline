# Shop Application — Source & Local Test

The pre-built microservice application that the Project-1 labs deploy and operate. **The labs never build this app — they deploy it.** This directory is where authors build and verify it before writing Lab 2.

## Services

| Service | Folder | Tech | Port | Purpose |
|---|---|---|---|---|
| `frontend` | `services/frontend/` | Node/Express | 3000 | Web UI; calls the backends via relative `/api/...` URLs |
| `products-api` | `services/products-api/` | Node/Express + Postgres | 8080 | Serves `/products`; reads `products-db` |
| `orders-api` | `services/orders-api/` | Node/Express + Postgres | 8080 | Serves `/orders`; reads `orders-db`; calls `products-api` |
| `products-db` | (stock image) | Postgres 16 | 5432 | Products database, seeded from `db/products-init.sql` |
| `orders-db` | (stock image) | Postgres 16 | 5432 | Orders database, seeded from `db/orders-init.sql` |
| `gateway` | `gateway/` | nginx | 80 | Single entry point; routes `/`, `/api/products`, `/api/orders` |

## Request flow

```
browser -> gateway :80
             |-- /              -> frontend:3000
             |-- /api/products  -> products-api:8080 /products -> products-db
             |-- /api/orders    -> orders-api:8080 /orders   -> orders-db
                                                    |-> products-api (for product names)
```

## Run it locally (authors only)

Requires Docker with Compose. Not run on Poridhi VMs.

```bash
docker compose up --build
```

Then open **http://localhost:8080** — you should see the Products and Orders tables populated.

Stop and wipe the databases:

```bash
docker compose down -v
```

## Endpoints for quick checks

```bash
curl http://localhost:8080/api/products        # products list (via gateway)
curl http://localhost:8080/api/orders          # orders list (via gateway)

# Backends are not exposed to the host by default. To probe them directly,
# temporarily add a port mapping in docker-compose.yml, or exec into a service:
docker compose exec products-api wget -qO- http://localhost:8080/health
docker compose exec products-api wget -qO- http://localhost:8080/metrics
```

## Behaviors baked in for later labs

These are intentional and must stay, because later labs depend on them:

- **`/metrics`** on both backends (Prometheus format: `http_requests_total`, `http_request_duration_seconds`) — for Lab 5 monitoring.
- **`/health`** (liveness) and **`/ready`** (readiness, checks the DB) — for Kubernetes probes.
- **Fail-fast on missing DB env vars** (`process.exit(1)` with a clear message) — for the Lab 6 CrashLoopBackOff / misconfiguration incident.
- **`/ready` returns 503 when the DB is unreachable** — for the Lab 6 database-connectivity incident.
- **`/debug/error`** returns HTTP 500 — for the Lab 5 error-rate alert demo.
- **Frontend uses relative URLs** — same-origin through the gateway, so there is no CORS and no hardcoded backend address.
- **Gateway uses a `resolver` + variable `proxy_pass`** — so nginx re-resolves backend IPs at runtime instead of caching a stale one.

## Environment variables

Both backends read:

| Variable | Example | Notes |
|---|---|---|
| `DB_HOST` | `products-db` | Database hostname (Service name in k8s) |
| `DB_PORT` | `5432` | Defaults to 5432 |
| `DB_USER` | `shop` | |
| `DB_PASSWORD` | `shoppass` | Comes from a Kubernetes Secret in Lab 2 |
| `DB_NAME` | `products` | |
| `PORT` | `8080` | Defaults to 8080 |

`orders-api` additionally reads:

| Variable | Example | Notes |
|---|---|---|
| `PRODUCTS_API_URL` | `http://products-api:8080` | Where to reach products-api |
