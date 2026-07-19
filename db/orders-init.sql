-- Seed data for orders-db. Postgres runs any *.sql in
-- /docker-entrypoint-initdb.d/ automatically on first startup.

CREATE TABLE IF NOT EXISTS orders (
  id         SERIAL PRIMARY KEY,
  product_id INT NOT NULL,
  quantity   INT NOT NULL
);

INSERT INTO orders (product_id, quantity) VALUES
  (1, 2),
  (3, 1),
  (4, 3)
ON CONFLICT DO NOTHING;
