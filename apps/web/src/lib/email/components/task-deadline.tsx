import { EmailLayout, EmailHeaderSection, EmailIconCircle } from './layout';
import type { BaseEmailProps } from './layout';

export interface TaskDeadlineEmailProps extends BaseEmailProps {
  deadlineType: 'due_soon' | 'overdue' | 'escalated';
  dueDate?: string;
}

export function TaskDeadlineEmail(props: TaskDeadlineEmailProps) {
  const isOverdue = props.deadlineType === 'overdue' || props.deadlineType === 'escalated';
  const icon = isOverdue ? '⚠' : '⏰';
  const iconBg = isOverdue ? '#fef2f2' : '#fffbeb';
  const iconColor = isOverdue ? '#dc2626' : '#d97706';
  const actionLabel = isOverdue ? 'View Overdue Task' : 'View Task';

  return (
    <EmailLayout unsubscribeUrl={props.unsubscribeUrl}>
      <EmailIconCircle backgroundColor={iconBg} color={iconColor}>
        {icon}
      </EmailIconCircle>
      <EmailHeaderSection
        title={props.title}
        message={props.message}
        actionLabel={actionLabel}
        link={props.link}
      />
    </EmailLayout>
  );
}
