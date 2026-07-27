/**
 * TaskStatusChangedEmail is identical to TaskAssignedEmail.
 * Both render EmailLayout + EmailHeaderSection with actionLabel="View Task".
 * Kept as a named export for semantic clarity in send.tsx dispatch.
 */
export { TaskAssignedEmail as TaskStatusChangedEmail } from './task-assigned';
