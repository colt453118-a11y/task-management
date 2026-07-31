// ─── Leave Status ────────────────────────────────────────────

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

// ─── Leave Type ──────────────────────────────────────────────

export interface LeaveType {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  icon: string | null;
  requiresAttachment: boolean;
  isActive: boolean;
  sortOrder: number;
}

// ─── Leave Balance ───────────────────────────────────────────

export interface LeaveBalance {
  id: string;
  organizationId: string;
  userId: string;
  leaveTypeId: string;
  year: number;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  notes: string | null;
  leaveType?: LeaveType;
}

export interface LeaveBalanceSummary {
  leaveType: LeaveType;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  availableDays: number;
}

// ─── Leave Request ───────────────────────────────────────────

export interface LeaveRequest {
  id: string;
  organizationId: string;
  userId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  daysCount: number;
  reason: string;
  status: LeaveStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined relations
  user?: { id: string; name: string | null; avatarUrl: string | null };
  leaveType?: LeaveType;
  reviewer?: { id: string; name: string | null };
}
