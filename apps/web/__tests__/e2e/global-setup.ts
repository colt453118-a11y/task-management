/**
 * Playwright global setup — starts Docker services needed for E2E tests.
 *
 * Starts Postgres (and other services from docker-compose.yml) so the
 * Next.js dev server can connect to the database for auth/session checks.
 * Gracefully skips if Docker is not available or services are already running.
 */
import { execSync } from 'child_process';
import path from 'path';

const COMPOSE_DIR = path.resolve(__dirname, '../../../..');

async function globalSetup() {
  // ── 0. Skip Docker setup in CI ──────────────────────────────
  // CI already provides a Postgres service via GitHub Actions services.
  // Setting CI_SKIP_DOCKER_SETUP=true avoids noisy "Failed to start
  // Postgres" logs when port 5432 is taken by the CI service.
  if (process.env.CI_SKIP_DOCKER_SETUP === 'true') {
    console.log('✓ Skipping Docker setup (CI_SKIP_DOCKER_SETUP=true)');
    return;
  }

  // ── 1. Check if docker is available ──────────────────────────
  try {
    execSync('docker --version', { stdio: 'pipe', timeout: 5_000 });
  } catch {
    console.log('⚠️  Docker not available — E2E tests will run without a database.');
    console.log('   Auth middleware may log errors, but mocked API routes will still work.');
    return;
  }

  // ── 2. Check if Postgres is already running ──────────────────
  try {
    const running = execSync(
      'docker ps --filter name=wm-postgres --format "{{.Names}}"',
      { encoding: 'utf8', timeout: 5_000 },
    ).trim();

    if (running) {
      console.log('✓ Postgres already running');
      return;
    }
  } catch {
    // ps failed — container might not exist yet, continue
  }

  // ── 3. Start Postgres via docker compose ─────────────────────
  console.log('🐘 Starting Postgres...');
  try {
    execSync('docker compose up -d postgres', {
      cwd: COMPOSE_DIR,
      stdio: 'pipe',
      timeout: 60_000,
    });
  } catch (err) {
    console.log('⚠️  Failed to start Postgres:', (err as Error).message);
    console.log('   E2E tests will continue without a database.');
    return;
  }

  // ── 4. Wait for Postgres to accept connections ───────────────
  console.log('⏳ Waiting for Postgres to be healthy...');
  try {
    execSync(
      `bash -c '
        for i in $(seq 1 15); do
          docker compose exec -T postgres pg_isready -U dev -d workmanagement 2>/dev/null && exit 0
          sleep 1
        done
        exit 1
      '`,
      { cwd: COMPOSE_DIR, stdio: 'pipe', timeout: 30_000 },
    );
    console.log('✓ Postgres is ready');
  } catch {
    console.log('⚠️  Postgres health check timed out — continuing anyway');
  }
}

export default globalSetup;
