/**
 * Playwright global teardown — stops Docker services after E2E tests.
 *
 * Only stops services that were started by global-setup. Safe to
 * run even if Docker is not available or no containers are running.
 */
import { execSync } from 'child_process';
import path from 'path';

const COMPOSE_DIR = path.resolve(__dirname, '../../../..');

async function globalTeardown() {
  try {
    execSync('docker --version', { stdio: 'pipe', timeout: 5_000 });
  } catch {
    return; // Docker not available, nothing to clean up
  }

  // Check if any wm-* containers are running
  try {
    const running = execSync(
      'docker ps --filter name=wm- --format "{{.Names}}"',
      { encoding: 'utf8', timeout: 5_000 },
    ).trim();

    if (!running) return; // No containers to stop
  } catch {
    return;
  }

  console.log('🧹 Stopping Docker services...');
  try {
    execSync('docker compose stop', {
      cwd: COMPOSE_DIR,
      stdio: 'pipe',
      timeout: 30_000,
    });
    console.log('Docker services stopped');
    console.log('✓ Docker services stopped');
  } catch {
    // Best-effort cleanup
  }
}

export default globalTeardown;
