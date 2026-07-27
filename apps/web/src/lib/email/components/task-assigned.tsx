import { EmailLayout, EmailHeaderSection } from './layout';
import type { BaseEmailProps } from './layout';

export function TaskAssignedEmail(props: BaseEmailProps) {
  return (
    <EmailLayout unsubscribeUrl={props.unsubscribeUrl}>
      <EmailHeaderSection
        title={props.title}
        message={props.message}
        actionLabel="View Task"
        link={props.link}
      />
    </EmailLayout>
  );
}
