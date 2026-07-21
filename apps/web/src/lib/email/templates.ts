// ─── Email Template Builders ───────────────────────────────────
//
// Each template returns an HTML string for a specific notification type.
// All templates follow a consistent brand style with responsive design.
// IMPORTANT: User-provided content (title, message) MUST be HTML-escaped
// before being passed to these template functions.

interface BaseTemplateData {
  userName: string;
  title: string;
  message: string;
  link: string;
  actionLabel?: string;
  unsubscribeUrl: string;
}

function wrapLayout(bodyHtml: string, unsubscribeUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WorkManager</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" style="max-width:560px;background-color:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding:32px 32px 0 32px;">
              <table role="presentation" width="100%">
                <tr>
                  <td style="font-size:20px;font-weight:700;color:#0c0a09;">
                    <span style="color:#6366f1;">&#9670;</span> WorkManager
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${bodyHtml}
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <table role="presentation" width="100%">
                <tr>
                  <td style="border-top:1px solid #e7e5e4;padding-top:16px;font-size:12px;color:#a8a29e;text-align:center;">
                    <p style="margin:0 0 4px 0;">WorkManager &mdash; Enterprise Task Management</p>
                    <p style="margin:0;">
                      <a href="${unsubscribeUrl}" style="color:#a8a29e;text-decoration:underline;">Unsubscribe from notifications</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildButton(link: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
    <tr>
      <td align="center" style="background-color:#6366f1;border-radius:10px;padding:0;">
        <a href="${link}" target="_blank" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-top:8px;">
        <a href="${link}" target="_blank" style="font-size:12px;color:#6366f1;text-decoration:underline;">Or open in browser &rarr;</a>
      </td>
    </tr>
  </table>`;
}

function buildHeaderSection(data: BaseTemplateData): string {
  return `<tr>
    <td style="padding:24px 32px 16px 32px;">
      <h2 style="margin:0 0 8px 0;font-size:18px;font-weight:600;color:#0c0a09;">${data.title}</h2>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#57534e;">${data.message}</p>
      ${data.actionLabel ? buildButton(data.link, data.actionLabel) : ''}
    </td>
  </tr>`;
}

// ─── Specific Templates ────────────────────────────────────────

export function taskAssignedTemplate(data: BaseTemplateData): string {
  return wrapLayout(
    buildHeaderSection({ ...data, actionLabel: 'View Task' }),
    data.unsubscribeUrl,
  );
}

export function taskCommentTemplate(data: BaseTemplateData): string {
  return wrapLayout(
    buildHeaderSection({ ...data, actionLabel: 'View Comment' }),
    data.unsubscribeUrl,
  );
}

export function taskStatusChangedTemplate(data: BaseTemplateData): string {
  return wrapLayout(
    buildHeaderSection({ ...data, actionLabel: 'View Task' }),
    data.unsubscribeUrl,
  );
}

export function taskCompletedTemplate(data: BaseTemplateData): string {
  return wrapLayout(
    `<tr>
      <td style="padding:24px 32px 0 32px;text-align:center;">
        <span style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:50%;background-color:#dcfce7;color:#16a34a;font-size:24px;">&#10003;</span>
      </td>
    </tr>
    ${buildHeaderSection({ ...data, actionLabel: 'View Task' })}`,
    data.unsubscribeUrl,
  );
}

export function taskDeletedTemplate(data: BaseTemplateData): string {
  return wrapLayout(
    `<tr>
      <td style="padding:24px 32px 0 32px;text-align:center;">
        <span style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:50%;background-color:#fef2f2;color:#dc2626;font-size:24px;">&#128465;</span>
      </td>
    </tr>
    ${buildHeaderSection(data)}`,
    data.unsubscribeUrl,
  );
}

export function welcomeTemplate(data: { userName: string; unsubscribeUrl: string }): string {
  return wrapLayout(
    `<tr>
      <td style="padding:24px 32px 16px 32px;text-align:center;">
        <span style="display:inline-block;width:64px;height:64px;line-height:64px;border-radius:50%;background-color:#eef2ff;color:#6366f1;font-size:32px;">&#128075;</span>
        <h2 style="margin:16px 0 8px 0;font-size:20px;font-weight:600;color:#0c0a09;">Welcome to WorkManager, ${data.userName}!</h2>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#57534e;">
          You've been added to your organization's workspace. Start managing tasks, collaborating with your team, and tracking projects.
        </p>
        ${buildButton(process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.workmanager.com', 'Get Started')}
      </td>
    </tr>`,
    data.unsubscribeUrl,
  );
}
