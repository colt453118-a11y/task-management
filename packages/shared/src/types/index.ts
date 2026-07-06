// ─── Common Types ───────────────────────────────────────────

export type Timestamp = string; // ISO 8601
export type UUID = string;

export interface BaseEntity {
  id: UUID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

// ─── Organization ────────────────────────────────────────────

export type EmploymentStatus = 'active' | 'suspended' | 'archived' | 'terminated';

// ─── Task Status ─────────────────────────────────────────────

export type TaskStatus =
  | 'draft'
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'blocked'
  | 'on_hold'
  | 'under_review'
  | 'approved'
  | 'completed'
  | 'closed'
  | 'archived'
  | 'rejected'
  | 'cancelled'
  | 'reopened';

// ─── Task Priority ───────────────────────────────────────────

export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent' | 'critical';

// ─── Project Status ──────────────────────────────────────────

export type ProjectStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'archived';

// ─── Role ────────────────────────────────────────────────────

export interface Permission {
  code: string;
  name: string;
  module: string;
}

export interface Role {
  id: UUID;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  permissions: Permission[];
}

// ─── Pagination ──────────────────────────────────────────────

export interface PaginationParams {
  cursor?: string;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ─── API Response ────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
  requestId?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

// ─── Notification ────────────────────────────────────────────

export type NotificationChannel = 'in_app' | 'email' | 'push' | 'slack';

export type NotificationType =
  | 'task.assigned'
  | 'task.comment'
  | 'task.mention'
  | 'task.due_soon'
  | 'task.overdue'
  | 'task.approval_needed'
  | 'task.completed'
  | 'task.closed'
  | 'task.reopened'
  | 'task.escalated';
