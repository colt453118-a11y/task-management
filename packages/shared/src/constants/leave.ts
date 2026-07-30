import type { LeaveStatus } from '../types';

// ─── Leave Status ────────────────────────────────────────────

export const LEAVE_STATUSES: LeaveStatus[] = ['pending', 'approved', 'rejected', 'cancelled'];

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const LEAVE_STATUS_COLORS: Record<LeaveStatus, string> = {
  pending: '#f59e0b',
  approved: '#22c55e',
  rejected: '#ef4444',
  cancelled: '#9ca3af',
};

// ─── Default Leave Types ─────────────────────────────────────

export const DEFAULT_LEAVE_TYPES = [
  {
    name: 'Vacation',
    slug: 'vacation',
    color: '#6366f1',
    icon: 'Umbrella',
    description: 'Annual leave and vacation time',
    sortOrder: 0,
  },
  {
    name: 'Sick Leave',
    slug: 'sick',
    color: '#f59e0b',
    icon: 'Thermometer',
    description: 'Medical and health-related absences',
    sortOrder: 1,
  },
  {
    name: 'Personal Leave',
    slug: 'personal',
    color: '#10b981',
    icon: 'User',
    description: 'Personal errands and family matters',
    sortOrder: 2,
  },
] as const;

// ─── Leave Navigation ────────────────────────────────────────

export const LEAVE_NAV_ITEMS = {
  overview: '/leave',
  new: '/leave/new',
  balances: '/leave/balances',
} as const;
