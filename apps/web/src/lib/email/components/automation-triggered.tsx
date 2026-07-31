import { EmailLayout, EmailHeaderSection } from './layout';
import type { BaseEmailProps } from './layout';

export function AutomationTriggeredEmail(props: BaseEmailProps) {
  return (
    <EmailLayout unsubscribeUrl={props.unsubscribeUrl}>
      <EmailHeaderSection
        title={props.title}
        message={props.message}
        actionLabel="View Details"
        link={props.link}
      />
    </EmailLayout>
  );
}
