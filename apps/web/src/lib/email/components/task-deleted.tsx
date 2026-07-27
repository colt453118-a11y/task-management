import { EmailLayout, EmailHeaderSection, EmailIconCircle } from './layout';
import type { BaseEmailProps } from './layout';

export function TaskDeletedEmail(props: BaseEmailProps) {
  return (
    <EmailLayout unsubscribeUrl={props.unsubscribeUrl}>
      <EmailIconCircle backgroundColor="#fef2f2" color="#dc2626">
        🗑
      </EmailIconCircle>
      <EmailHeaderSection
        title={props.title}
        message={props.message}
        link={props.link}
      />
    </EmailLayout>
  );
}
