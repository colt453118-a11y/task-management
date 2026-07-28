import { Text, Section } from '@react-email/components';
import { EmailLayout, EmailButton, COLORS } from './layout';

export interface WelcomeEmailProps {
  userName: string;
  unsubscribeUrl: string;
}

export function WelcomeEmail(props: WelcomeEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.workmanager.com';

  return (
    <EmailLayout unsubscribeUrl={props.unsubscribeUrl}>
      <Section style={{ padding: '24px 32px 16px 32px', textAlign: 'center' }}>
        <span
          style={{
            display: 'inline-block',
            width: 64,
            height: 64,
            lineHeight: '64px',
            borderRadius: '50%',
            backgroundColor: '#eef2ff',
            color: COLORS.brand,
            fontSize: 32,
            textAlign: 'center',
          }}
        >
          👋
        </span>
        <Text
          className="email-h2 email-title"
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: COLORS.text,
            margin: '16px 0 8px 0',
          }}
        >
          Welcome to WorkManager, {props.userName}!
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
          You&apos;ve been added to your organization&apos;s workspace. Start managing tasks, collaborating
          with your team, and tracking projects.
        </Text>
        <div style={{ marginTop: 24 }}>
          <EmailButton href={appUrl}>Get Started</EmailButton>
        </div>
      </Section>
    </EmailLayout>
  );
}
