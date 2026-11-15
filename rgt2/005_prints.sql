CREATE TABLE IF NOT EXISTS prints (id text PRIMARY KEY, html text NOT NULL, em timestamptz NOT NULL DEFAULT now())
