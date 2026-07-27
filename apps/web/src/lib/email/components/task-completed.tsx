import { EmailLayout, EmailHeaderSection, EmailIconCircle } from './layout';
import type { BaseEmailProps } from './layout';

export function TaskCompletedEmail(props: BaseEmailProps) {
  return (
    <EmailLayout unsubscribeUrl={props.unsubscribeUrl}>
      <EmailIconCircle backgroundColor="#dcfce7" color="#16a34a">
        ✓
      </EmailIconCircle>
      <EmailHeaderSection
        title={props.title}
        message={props.message}
        actionLabel="View Task"
        link={props.link}
      />
    </EmailLayout>
  );
}
