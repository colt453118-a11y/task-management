/**
 * Test script: Send a welcome email via Mailpit SMTP.
 *
 * Renders the WelcomeEmail React Email component and sends it through
 * Mailpit's local SMTP server (port 1025). The email will appear in
 * Mailpit's web UI at http://localhost:8025.
 *
 * Usage:
 *   npx tsx scripts/test-welcome-email.tsx <recipient-email> [user-name]
 *
 * Examples:
 *   npx tsx scripts/test-welcome-email.tsx user@example.com
 *   npx tsx scripts/test-welcome-email.tsx user@example.com "John Doe"
 */

import { render } from '@react-email/components';
import { createTransport } from 'nodemailer';
import { WelcomeEmail } from '../src/lib/email/components/welcome';

const SMTP_HOST = process.env.EMAIL_SMTP_HOST || 'localhost';
const SMTP_PORT = Number(process.env.EMAIL_SMTP_PORT) || 1025;
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@workmanager.com';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'WorkManager';
const MAILPIT_API = 'http://localhost:8025/api/v1/messages';

async function main(): Promise<void> {
  const toEmail = process.argv[2];
  if (!toEmail) {
    console.warn('Usage: npx tsx scripts/test-welcome-email.tsx <recipient-email> [user-name]');
    console.warn('Example: npx tsx scripts/test-welcome-email.tsx user@example.com');
    process.exit(1);
  }

  const userName = process.argv[3] || 'Jane Cooper';

  console.warn('\n📧 Sending welcome email');
  console.warn(`   To:       ${toEmail}`);
  console.warn(`   Name:     ${userName}`);
  console.warn(`   SMTP:     ${SMTP_HOST}:${SMTP_PORT}`);
  console.warn('   Mailpit:  http://localhost:8025\n');

  // Step 1: Render the WelcomeEmail component to HTML
  console.warn('⏳ Rendering WelcomeEmail component...');
  const html = await render(
    <WelcomeEmail
      userName={userName}
      unsubscribeUrl="http://localhost:3000/settings/notifications"
    />,
  );
  console.warn(`   ✅ Rendered: ${html.length.toLocaleString()} bytes\n`);

  // Step 2: Create SMTP transport to Mailpit
  console.warn('⏳ Connecting to Mailpit SMTP...');
  const transporter = createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    ignoreTLS: true,
  });

  await transporter.verify();
  console.warn('   ✅ SMTP connection verified\n');

  // Step 3: Send the email
  console.warn('⏳ Sending email...');
  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: toEmail,
    subject: `Welcome to WorkManager, ${userName}!`,
    html,
    headers: {
      'List-Unsubscribe': '<http://localhost:3000/settings/notifications>',
      'X-Mailer': 'WorkManager Dev',
    },
  });

  console.warn('   ✅ Email sent!');
  console.warn(`   Message ID: ${info.messageId}`);
  console.warn('\n📬 Checking Mailpit for delivery...');

  // Brief wait for mail to be processed
  await new Promise((r) => setTimeout(r, 1000));

  // Step 4: Verify via Mailpit REST API
  const apiRes = await fetch(MAILPIT_API);
  if (apiRes.ok) {
    const data = (await apiRes.json()) as {
      messages_count: number;
      messages: Array<{ Subject: string; To: Array<{ Address: string; Name: string }> }>;
    };
    console.warn(`   📬 Mailpit has ${data.messages_count} message(s)`);
    if (data.messages?.length && data.messages[0]) {
      const latest = data.messages[0];
      const recipient = latest.To?.[0]?.Address ?? 'unknown';
      console.warn(`   📨 Latest: "${latest.Subject}" → ${recipient}`);
    }
  } else {
    console.warn(`   ⚠️  Mailpit API: HTTP ${apiRes.status}`);
  }

  console.warn('\n✅ Done! View at http://localhost:8025\n');
}

main().catch((err) => {
  console.warn('\n❌ Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
