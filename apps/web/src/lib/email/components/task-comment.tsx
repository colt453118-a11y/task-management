import { EmailLayout, EmailHeaderSection } from './layout';
import type { BaseEmailProps } from './layout';

export function TaskCommentEmail(props: BaseEmailProps) {
  return (
    <EmailLayout unsubscribeUrl={props.unsubscribeUrl}>
      <EmailHeaderSection
        title={props.title}
        message={props.message}
        actionLabel="View Comment"
        link={props.link}
      />
    </EmailLayout>
  );
}
