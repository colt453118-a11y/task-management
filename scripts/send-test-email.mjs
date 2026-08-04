#!/usr/bin/env node
/**
 * send-test-email.mjs
 *
 * Live verification that WorkManager's production email path (Resend) works
 * — i.e. that notification emails leave Mailpit and are delivered for real.
 *
 * Uses the same configuration the app reads in `apps/web/src/lib/email/send.tsx`:
 *   RESEND_API_KEY, EMAIL_FROM, EMAIL_FROM_NAME
 * and makes the same `POST /emails` call the `resend` SDK performs under the hood.
 *
 * Usage:
 *   node scripts/send-test-email.mjs --to you@example.com [--subject "..."]
 *
 * Exit codes:
 *   0  sent + delivered/queued by Resend (real delivery, not Mailpit)
 *   1  Resend accepted the send but final status could not be confirmed
 *   2  usage / configuration error (no key, bad --to)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RESEND_API = 'https://api.resend.com/emails';

// ─── Minimal .env loader (handles quoted values, skips comments) ───────────
function loadEnv(file) {
  const env = {};
  let raw = '';
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return env;
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[m[1]] = value;
  }
  return env;
}

function argValue(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : undefined;
}

// ─── Config (env var wins over root .env) ──────────────────────────────────
const env = loadEnv(resolve(process.cwd(), '.env'));
const API_KEY = process.env.RESEND_API_KEY || env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || env.EMAIL_FROM || 'noreply@workmanager.com';
const FROM_NAME = process.env.EMAIL_FROM_NAME || env.EMAIL_FROM_NAME || 'WorkManager';
// Link target: same var the app uses to build notification links.
// Override with NEXT_PUBLIC_APP_URL=... for the deployed app URL.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_APP_URL || 'https://app.workmanager.com';

const args = process.argv.slice(2);
const to = argValue(args, '--to') || argValue(args, '-t');
const subject = argValue(args, '--subject') || '[WorkManager] ✅ Live test — production email is working';

if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
  console.error('Usage: node scripts/send-test-email.mjs --to you@example.com [--subject "..."]');
  process.exit(2);
}
if (!API_KEY) {
  console.error(
    'RESEND_API_KEY is not set.\n' +
      'Add it to .env (gitignored) or export it, then re-run:\n' +
      '  RESEND_API_KEY=re_... node scripts/send-test-email.mjs --to you@example.com',
  );
  process.exit(2);
}

// ─── Build a notification-style email (mirrors the app's task.assigned) ────
const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#18181b">
    <h2 style="margin:0 0 16px;color:#18181b">You've been assigned: 🚀 Verify production email</h2>
    <p style="line-height:1.6;color:#3f3f46">
      This is a live delivery test from <strong>${FROM_NAME}</strong> (${FROM}).
      If you can read this, notification emails are flowing through Resend — not Mailpit.
    </p>
    <p style="line-height:1.6;color:#3f3f46">Timestamp: ${new Date().toISOString()}</p>
    <a href="${APP_URL}" style="display:inline-block;margin-top:16px;padding:10px 18px;border-radius:8px;background:#6366f1;color:#ffffff;text-decoration:none;font-weight:600">Open WorkManager</a>
    <p style="margin-top:32px;font-size:12px;color:#a1a1aa">
      <a href="${APP_URL}/settings/notifications" style="color:#a1a1aa">Unsubscribe</a> · Sent via Resend
    </p>
  </div>
`;

async function main() {
  console.log(`→ Sending via Resend  from: ${FROM_NAME} <${FROM}>  to: ${to}`);
  console.log(`  link target: ${APP_URL}`);

  const sendRes = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: `${FROM_NAME} <${FROM}>`, to: [to], subject, html }),
  });
  const sendBody = await sendRes.json().catch(() => ({}));

  if (!sendRes.ok) {
    console.error(`✗ Resend rejected the request (HTTP ${sendRes.status}):`);
    console.error(JSON.stringify(sendBody, null, 2));
    process.exit(2);
  }

  const emailId = sendBody.id;
  if (!emailId) {
    console.error('✗ Resend returned no email id:', JSON.stringify(sendBody));
    process.exit(2);
  }

  console.log(`✓ Accepted by Resend API — email id: ${emailId}`);
  console.log('  (this id exists only in Resend; Mailpit never sees it)');

  // ─── Poll delivery status (Resend activity endpoint) ────────────────────
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let lastEvent = 'unknown';
  for (let attempt = 1; attempt <= 10; attempt++) {
    await sleep(1500);
    const statusRes = await fetch(`${RESEND_API}/${emailId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (statusRes.ok) {
      const statusBody = await statusRes.json().catch(() => ({}));
      lastEvent = statusBody.last_event || statusBody.status || 'queued';
      if (lastEvent === 'delivered') break;
    }
  }

  console.log(`→ Resend delivery status: ${lastEvent}`);

  if (lastEvent === 'delivered') {
    console.log('\n✅ SUCCESS — real email delivered outside Mailpit via Resend.');
    process.exit(0);
  } else if (lastEvent === 'sent' || lastEvent === 'queued') {
    console.log('\n⚠ Sent — delivery confirmation pending (check the inbox / Resend dashboard).');
    process.exit(0);
  } else {
    console.log('\n⚠ Send accepted, but delivery status is unavailable. Check the Resend dashboard.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('✗ Unexpected error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
