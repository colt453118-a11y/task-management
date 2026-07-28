import { render } from '@react-email/components';
import { Resend } from 'resend';
import logger from '@/lib/logger';
import {
  TaskAssignedEmail,
  TaskCommentEmail,
  TaskStatusChangedEmail,
  TaskCompletedEmail,
  TaskDeletedEmail,
  TaskMentionEmail,
  TaskDeadlineEmail,
  WelcomeEmail,
} from './components';
import { escapeHtml } from './utils';
import type { BaseEmailProps } from './components';

// ─── Resend Client (lazy singleton) ────────────────────────────

let resendClient: Resend | null = null;

function getClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured. Email sending is disabled.');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// ─── Config ────────────────────────────────────────────────────

const FROM_EMAIL = process.env.EMAIL_FROM ?? 'noreply@workmanager.com';
const FROM_NAME = process.env.EMAIL_FROM_NAME ?? 'WorkManager';
const UNSUBSCRIBE_URL =
  process.env.EMAIL_UNSUBSCRIBE_URL ?? 'https://app.workmanager.com/settings/notifications';

// ─── HTML Escaping ─────────────────────────────────────────────

// escapeHtml imported from ./utils

// ─── React Email render helper ─────────────────────────────────

/** Render a React Email component to an HTML string. */
async function renderEmail(component: React.ReactElement): Promise<string> {
  return render(component);
}

// ─── Send Email ────────────────────────────────────────────────

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ id: string } | null> {
  try {
    if (!process.env.RESEND_API_KEY) {
      logger.warn({ to: params.to.slice(0, 3) }, 'RESEND_API_KEY not configured. Skipping email');
      return null;
    }

    const client = getClient();
    const result = await client.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (result.error) {
      logger.error({ error: result.error }, 'Failed to send email');
      return null;
    }

    logger.info({ subject: params.subject, id: result.data?.id }, 'Email sent');
    return result.data ?? null;
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : error }, 'Error sending email');
    return null;
  }
}

// ─── Build base props ─────────────────────────────────────────

function buildBaseProps(
  title: string,
  message: string,
  link: string,
): BaseEmailProps {
  return {
    title: escapeHtml(title),
    message: escapeHtml(message),
    link,
    unsubscribeUrl: UNSUBSCRIBE_URL,
  };
}

// ─── Notification-Type Dispatch ────────────────────────────────

interface NotificationEmail {
  to: string;
  userName: string;
  type: string;
  title: string;
  message: string;
  link: string;
}

export async function sendNotificationEmail(notif: NotificationEmail): Promise<void> {
  const baseProps = buildBaseProps(notif.title, notif.message, notif.link);

  let subject: string;
  let html: string;

  switch (notif.type) {
    case 'task.assigned':
      subject = `[WorkManager] You've been assigned: ${notif.title}`;
      html = await renderEmail(<TaskAssignedEmail {...baseProps} />);
      break;

    case 'task.comment':
      subject = `[WorkManager] New comment on: ${notif.title}`;
      html = await renderEmail(<TaskCommentEmail {...baseProps} />);
      break;

    case 'task.completed':
      subject = `[WorkManager] ✓ Task completed: ${notif.title}`;
      html = await renderEmail(<TaskCompletedEmail {...baseProps} />);
      break;

    case 'task.status_changed':
      subject = `[WorkManager] Task status changed: ${notif.title}`;
      html = await renderEmail(<TaskStatusChangedEmail {...baseProps} />);
      break;

    case 'task.closed':
      subject = `[WorkManager] Task closed: ${notif.title}`;
      html = await renderEmail(<TaskDeletedEmail {...baseProps} />);
      break;

    case 'task.reopened':
      subject = `[WorkManager] Task reopened: ${notif.title}`;
      html = await renderEmail(<TaskStatusChangedEmail {...baseProps} />);
      break;

    case 'task.mention':
      subject = `[WorkManager] You were mentioned in: ${notif.title}`;
      html = await renderEmail(<TaskMentionEmail {...baseProps} />);
      break;

    case 'task.due_soon':
      subject = `[WorkManager] ⏰ Due soon: ${notif.title}`;
      html = await renderEmail(<TaskDeadlineEmail {...baseProps} deadlineType="due_soon" />);
      break;

    case 'task.overdue':
      subject = `[WorkManager] ⚠ Overdue: ${notif.title}`;
      html = await renderEmail(<TaskDeadlineEmail {...baseProps} deadlineType="overdue" />);
      break;

    case 'task.escalated':
      subject = `[WorkManager] 🚨 Escalated: ${notif.title}`;
      html = await renderEmail(<TaskDeadlineEmail {...baseProps} deadlineType="escalated" />);
      break;

    default:
      subject = `[WorkManager] ${notif.title}`;
      html = await renderEmail(<TaskAssignedEmail {...baseProps} />);
  }

  await sendEmail({ to: notif.to, subject, html });
}

// ─── Welcome Email ─────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, userName: string): Promise<void> {
  const html = await renderEmail(
    <WelcomeEmail userName={escapeHtml(userName)} unsubscribeUrl={UNSUBSCRIBE_URL} />,
  );

  await sendEmail({
    to,
    subject: `Welcome to WorkManager, ${userName}!`,
    html,
  });
}
