import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Button,
  Hr,
} from '@react-email/components';
import type { ReactNode } from 'react';

// ─── Shared CSS ──────────────────────────────────────────────

export const EMAIL_CSS = `
  /* ── Responsive: mobile-first breakpoints ─────────────────── */
  @media only screen and (max-width: 480px) {
    .email-card   { width: 100% !important; min-width: 100% !important; border-radius: 12px !important; }
    .email-pad    { padding-left: 20px !important; padding-right: 20px !important; }
    .email-pad-v  { padding-top: 20px !important; padding-bottom: 20px !important; }
    .email-title  { font-size: 16px !important; }
    .email-body   { font-size: 13px !important; }
    .email-logo   { font-size: 17px !important; }
    .email-btn    { display: block !important; width: 100% !important; padding: 14px 16px !important; }
    .email-footer { font-size: 11px !important; }
  }

  /* ── Dark mode (Apple Mail, Outlook iOS/macOS, Thunderbird) ─ */
  @media (prefers-color-scheme: dark) {
    .email-bg    { background-color: #1c1917 !important; }
    .email-card  { background-color: #292524 !important; }
    .email-h2    { color: #e7e5e4 !important; }
    .email-body  { color: #a8a29e !important; }
    .email-muted { color: #78716c !important; }
    .email-div   { border-top-color: #44403c !important; }
    .email-link  { color: #a78bfa !important; }
  }

  /* ── Gmail dark mode override — uses injected .dark class ─── */
  .dark .email-bg    { background-color: #1c1917 !important; }
  .dark .email-card  { background-color: #292524 !important; }
  .dark .email-h2    { color: #e7e5e4 !important; }
  .dark .email-body  { color: #a8a29e !important; }
  .dark .email-muted { color: #78716c !important; }
  .dark .email-div   { border-top-color: #44403c !important; }
  .dark .email-link  { color: #a78bfa !important; }

  /* ── Outlook.com / Windows Mail dark mode ─────────────────── */
  [data-ogsc] .email-bg    { background-color: #1c1917 !important; }
  [data-ogsc] .email-card  { background-color: #292524 !important; }
  [data-ogsc] .email-h2    { color: #e7e5e4 !important; }
  [data-ogsc] .email-body  { color: #a8a29e !important; }
  [data-ogsc] .email-muted { color: #78716c !important; }
  [data-ogsc] .email-div   { border-top-color: #44403c !important; }
  [data-ogsc] .email-link  { color: #a78bfa !important; }
`;

// ─── Shared Types ─────────────────────────────────────────────

export interface BaseEmailProps {
  title: string;
  message: string;
  link: string;
  actionLabel?: string;
  unsubscribeUrl: string;
}

export interface LayoutProps {
  children: ReactNode;
  unsubscribeUrl: string;
}

// ─── Color constants ─────────────────────────────────────────

export const COLORS = {
  brand: '#6366f1',
  brandDark: '#a78bfa',
  text: '#0c0a09',
  textDark: '#e7e5e4',
  body: '#57534e',
  bodyDark: '#a8a29e',
  muted: '#a8a29e',
  mutedDark: '#78716c',
  bg: '#f5f5f4',
  bgDark: '#1c1917',
  card: '#ffffff',
  cardDark: '#292524',
  divider: '#e7e5e4',
  dividerDark: '#44403c',
} as const;

// ─── EmailLayout ─────────────────────────────────────────────

export function EmailLayout({ children, unsubscribeUrl }: LayoutProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{EMAIL_CSS}</style>
      </Head>
      <Body
        className="email-bg"
        style={{
          backgroundColor: COLORS.bg,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          className="email-card"
          style={{
            maxWidth: 560,
            margin: '0 auto',
            padding: '32px 16px',
          }}
        >
          {/* Card */}
          <Section
            className="email-card"
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 16,
            }}
          >
            {/* Header */}
            <Section className="email-pad email-pad-v" style={{ padding: '32px 32px 0 32px' }}>
              <Text
                className="email-logo"
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: COLORS.text,
                  margin: 0,
                }}
              >
                <span style={{ color: COLORS.brand }}>◆</span> WorkManager
              </Text>
            </Section>

            {/* Body (injected per template) */}
            {children}

            {/* Footer */}
            <Section className="email-pad" style={{ padding: '0 32px 32px 32px' }}>
              <Hr
                className="email-div"
                style={{
                  borderColor: COLORS.divider,
                  borderTop: `1px solid ${COLORS.divider}`,
                  margin: '16px 0',
                }}
              />
              <Text
                className="email-muted email-footer"
                style={{
                  fontSize: 12,
                  color: COLORS.muted,
                  textAlign: 'center',
                  margin: '0 0 4px 0',
                }}
              >
                WorkManager &mdash; Enterprise Task Management
                <br />
                <Link
                  href={unsubscribeUrl}
                  className="email-link"
                  style={{ color: COLORS.muted, textDecoration: 'underline' }}
                >
                  Unsubscribe from notifications
                </Link>
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ─── EmailButton ─────────────────────────────────────────────

export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      className="email-btn"
      href={href}
      style={{
        display: 'inline-block',
        padding: '12px 24px',
        fontSize: 14,
        fontWeight: 600,
        color: '#ffffff',
        backgroundColor: COLORS.brand,
        borderRadius: 10,
        textDecoration: 'none',
        textAlign: 'center',
      }}
    >
      {children}
    </Button>
  );
}

// ─── Header Section Builder (reusable across templates) ─────

export function EmailHeaderSection({
  title,
  message,
  actionLabel,
  link,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  link: string;
}) {
  return (
    <Section className="email-pad email-pad-v" style={{ padding: '24px 32px 16px 32px' }}>
      <Text
        className="email-h2 email-title"
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: COLORS.text,
          margin: '0 0 8px 0',
        }}
      >
        {title}
      </Text>
      <Text
        className="email-body"
        style={{
          fontSize: 14,
          lineHeight: '1.6',
          color: COLORS.body,
          margin: 0,
        }}
      >
        {message}
      </Text>
      {actionLabel && (
        <>
          <EmailButton href={link}>{actionLabel}</EmailButton>
          <Text style={{ margin: '8px 0 0 0', textAlign: 'center' }}>
            <Link
              href={link}
              className="email-link"
              style={{ fontSize: 12, color: COLORS.brand, textDecoration: 'underline' }}
            >
              Or open in browser &rarr;
            </Link>
          </Text>
        </>
      )}
    </Section>
  );
}

// ─── Icon Circle (for status-specific templates) ────────────

export function EmailIconCircle({
  children,
  backgroundColor,
  color,
}: {
  children: ReactNode;
  backgroundColor: string;
  color: string;
}) {
  return (
    <Section style={{ padding: '24px 32px 0 32px', textAlign: 'center' as const }}>
      <span
        style={{
          display: 'inline-block',
          width: 48,
          height: 48,
          lineHeight: '48px',
          borderRadius: '50%',
          backgroundColor,
          color,
          fontSize: 24,
          textAlign: 'center',
        }}
      >
        {children}
      </span>
    </Section>
  );
}
