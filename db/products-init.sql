-- Seed data for products-db. Postgres runs any *.sql in
-- /docker-entrypoint-initdb.d/ automatically on first startup.

CREATE TABLE IF NOT EXISTS products (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL
);

INSERT INTO products (name, price) VALUES
  ('Keyboard', 29.99),
  ('Mouse', 15.50),
  ('Monitor', 199.00),
  ('Webcam', 45.00)
ON CONFLICT DO NOTHING;
