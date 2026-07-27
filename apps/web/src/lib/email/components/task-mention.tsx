import { EmailLayout, EmailHeaderSection, EmailIconCircle } from './layout';
import type { BaseEmailProps } from './layout';

export function TaskMentionEmail(props: BaseEmailProps) {
  return (
    <EmailLayout unsubscribeUrl={props.unsubscribeUrl}>
      <EmailIconCircle backgroundColor="#f3e8ff" color="#9333ea">
        @
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
