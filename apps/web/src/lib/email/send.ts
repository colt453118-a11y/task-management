import { Resend } from 'resend';
import logger from '@/lib/logger';
import {
  taskAssignedTemplate,
  taskCommentTemplate,
  taskStatusChangedTemplate,
  taskCompletedTemplate,
  taskDeletedTemplate,
  welcomeTemplate,
} from './templates';

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

/**
 * Escape HTML special characters to prevent XSS/injection in email content.
 * User-provided titles and messages must be escaped before interpolation.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
  const safeTitle = escapeHtml(notif.title);
  const safeMessage = escapeHtml(notif.message);

  let subject: string;
  let html: string;

  switch (notif.type) {
    case 'task.assigned':
      subject = `[WorkManager] You've been assigned: ${notif.title}`;
      html = taskAssignedTemplate({
        userName: notif.userName,
        title: safeTitle,
        message: safeMessage,
        link: notif.link,
        unsubscribeUrl: UNSUBSCRIBE_URL,
      });
      break;

    case 'task.comment':
      subject = `[WorkManager] New comment on: ${notif.title}`;
      html = taskCommentTemplate({
        userName: notif.userName,
        title: safeTitle,
        message: safeMessage,
        link: notif.link,
        unsubscribeUrl: UNSUBSCRIBE_URL,
      });
      break;

    case 'task.completed':
      subject = `[WorkManager] ✓ Task completed: ${notif.title}`;
      html = taskCompletedTemplate({
        userName: notif.userName,
        title: safeTitle,
        message: safeMessage,
        link: notif.link,
        unsubscribeUrl: UNSUBSCRIBE_URL,
      });
      break;

    case 'task.status_changed':
      subject = `[WorkManager] Task status changed: ${notif.title}`;
      html = taskStatusChangedTemplate({
        userName: notif.userName,
        title: safeTitle,
        message: safeMessage,
        link: notif.link,
        unsubscribeUrl: UNSUBSCRIBE_URL,
      });
      break;

    case 'task.closed':
      subject = `[WorkManager] Task closed: ${notif.title}`;
      html = taskDeletedTemplate({
        userName: notif.userName,
        title: safeTitle,
        message: safeMessage,
        link: notif.link,
        unsubscribeUrl: UNSUBSCRIBE_URL,
      });
      break;

    case 'task.reopened':
      subject = `[WorkManager] Task reopened: ${notif.title}`;
      html = taskStatusChangedTemplate({
        userName: notif.userName,
        title: safeTitle,
        message: safeMessage,
        link: notif.link,
        unsubscribeUrl: UNSUBSCRIBE_URL,
      });
      break;

    default:
      subject = `[WorkManager] ${notif.title}`;
      html = taskAssignedTemplate({
        userName: notif.userName,
        title: safeTitle,
        message: safeMessage,
        link: notif.link,
        unsubscribeUrl: UNSUBSCRIBE_URL,
      });
  }

  await sendEmail({ to: notif.to, subject, html });
}

// ─── Welcome Email ─────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, userName: string): Promise<void> {
  await sendEmail({
    to,
    subject: `Welcome to WorkManager, ${userName}!`,
    html: welcomeTemplate({
      userName: escapeHtml(userName),
      unsubscribeUrl: UNSUBSCRIBE_URL,
    }),
  });
}
