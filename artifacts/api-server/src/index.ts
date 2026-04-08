import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

// Ensure the sessions table exists — idempotent, survives API restarts.
// This eliminates the in-memory token store problem: sessions now live in
// PostgreSQL and persist across process restarts.
await pool.query(`
  CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT        PRIMARY KEY,
    user_id     TEXT        NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
