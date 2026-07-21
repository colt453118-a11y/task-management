import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError, recalcTaskHours } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { createNotification } from '@/lib/notifications';
import { eq, desc, and, isNull, sql } from 'drizzle-orm';
import {
  TimeCorrectionCreateSchema,
  TimeCorrectionReviewSchema,
  validationError,
} from '@/lib/api/validation';

export const runtime = 'nodejs';

// ─── GET /api/time-corrections — List correction requests ──
// Regular users see their own requests.
// Users with manage-time permission see all pending requests for the org.

export const GET = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const { searchParams } = request.nextUrl;
      const status = searchParams.get('status'); // optional: pending | approved | rejected
      const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
      const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

      // Check if user has permission to view all correction requests
      let canViewAll = false;
      try {
        await requirePermission(user.id, 'time:manage');
        canViewAll = true;
      } catch {
        canViewAll = false;
      }

      const conditions = [
        eq(schema.timeCorrectionRequests.organizationId, orgId!),
      ];

      // If not a manager, only show own requests
      if (!canViewAll) {
        conditions.push(eq(schema.timeCorrectionRequests.userId, user.id));
      }

      // Optional status filter
      if (status && ['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
        conditions.push(eq(schema.timeCorrectionRequests.status, status));
      }

      const requests = await db()
        .select({
          id: schema.timeCorrectionRequests.id,
          timeEntryId: schema.timeCorrectionRequests.timeEntryId,
          userId: schema.timeCorrectionRequests.userId,
          taskId: schema.timeCorrectionRequests.taskId,
          originalMinutes: schema.timeCorrectionRequests.originalMinutes,
          requestedMinutes: schema.timeCorrectionRequests.requestedMinutes,
          reason: schema.timeCorrectionRequests.reason,
          status: schema.timeCorrectionRequests.status,
          reviewedBy: schema.timeCorrectionRequests.reviewedBy,
          reviewedAt: schema.timeCorrectionRequests.reviewedAt,
          reviewNote: schema.timeCorrectionRequests.reviewNote,
          createdAt: schema.timeCorrectionRequests.createdAt,
          user: {
            id: schema.users.id,
            name: schema.users.name,
            email: schema.users.email,
          },
          task: {
            id: schema.tasks.id,
            title: schema.tasks.title,
            taskIdDisplay: schema.tasks.taskIdDisplay,
          },
        })
        .from(schema.timeCorrectionRequests)
        .innerJoin(schema.users, eq(schema.timeCorrectionRequests.userId, schema.users.id))
        .innerJoin(schema.tasks, eq(schema.timeCorrectionRequests.taskId, schema.tasks.id))
        .where(and(...conditions))
        .orderBy(desc(schema.timeCorrectionRequests.createdAt))
        .limit(limit)
        .offset(offset);

      // Count pending
      const [pendingResult] = await db()
        .select({ count: sql<number>`count(*)` })
        .from(schema.timeCorrectionRequests)
        .where(
          and(
            eq(schema.timeCorrectionRequests.organizationId, orgId!),
            ...(canViewAll
              ? [eq(schema.timeCorrectionRequests.status, 'pending')]
              : [
                  eq(schema.timeCorrectionRequests.userId, user.id),
                  eq(schema.timeCorrectionRequests.status, 'pending'),
                ]),
          ),
        );

      return NextResponse.json({
        requests: requests.map((r) => ({
          ...r,
          originalMinutes: Number(r.originalMinutes),
          requestedMinutes: Number(r.requestedMinutes),
        })),
        pendingCount: Number(pendingResult?.count ?? 0),
        total: requests.length,
      });
    } catch (error) {
      const { error: err, status } = handleApiError(
        error,
        'Failed to fetch correction requests',
      );
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 60, namespace: 'time-corrections:list' },
);

// ─── POST /api/time-corrections — Create a correction request ──

export const POST = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const body = await request.json();
      const parsed = TimeCorrectionCreateSchema.safeParse(body);
      if (!parsed.success) {
        const { error: err, status } = validationError(parsed.error);
        return NextResponse.json(err, { status });
      }

      const { timeEntryId, requestedMinutes, reason } = parsed.data;

      // Find the time entry and verify ownership
      const [entry] = await db()
        .select({
          id: schema.timeEntries.id,
          userId: schema.timeEntries.userId,
          taskId: schema.timeEntries.taskId,
          durationMinutes: schema.timeEntries.durationMinutes,
          endTime: schema.timeEntries.endTime,
          taskOrgId: schema.tasks.organizationId,
        })
        .from(schema.timeEntries)
        .innerJoin(schema.tasks, eq(schema.timeEntries.taskId, schema.tasks.id))
        .where(
          and(
            eq(schema.timeEntries.id, timeEntryId),
            isNull(schema.tasks.deletedAt),
          ),
        )
        .limit(1);

      if (!entry) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Time entry not found' } },
          { status: 404 },
        );
      }

      if (entry.taskOrgId !== orgId) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Access denied' } },
          { status: 403 },
        );
      }

      // Only the owner can request a correction
      if (entry.userId !== user.id) {
        return NextResponse.json(
          {
            error: {
              code: 'FORBIDDEN',
              message: 'You can only request corrections for your own time entries',
            },
          },
          { status: 403 },
        );
      }

      // Entry must be stopped (have an endTime and duration)
      if (!entry.endTime || !entry.durationMinutes) {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_STATE',
              message: 'Cannot request a correction for a running timer',
            },
          },
          { status: 422 },
        );
      }

      // Check if there's already a pending request for this entry
      const [existingPending] = await db()
        .select({ id: schema.timeCorrectionRequests.id })
        .from(schema.timeCorrectionRequests)
        .where(
          and(
            eq(schema.timeCorrectionRequests.timeEntryId, timeEntryId),
            eq(schema.timeCorrectionRequests.status, 'pending'),
          ),
        )
        .limit(1);

      if (existingPending) {
        return NextResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'A pending correction request already exists for this entry',
            },
          },
          { status: 409 },
        );
      }

      // Create the correction request
      const [newRequest] = await db()
        .insert(schema.timeCorrectionRequests)
        .values({
          organizationId: orgId!,
          timeEntryId,
          userId: user.id,
          taskId: entry.taskId,
          originalMinutes: entry.durationMinutes,
          requestedMinutes,
          reason,
        })
        .returning();

      if (!newRequest) {
        return NextResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Failed to create correction request' } },
          { status: 500 },
        );
      }

      // Find the user's reporting manager to notify them
      const [userRecord] = await db()
        .select({ reportingManagerId: schema.users.reportingManagerId })
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);

      if (userRecord?.reportingManagerId) {
        await createNotification({
          userId: userRecord.reportingManagerId,
          organizationId: orgId!,
          type: 'time_correction_requested',
          title: 'Time correction request',
          message: `${user.name || 'A user'} requested a time correction (${entry.durationMinutes}m → ${requestedMinutes}m)`,
          link: '/timer',
          actorId: user.id,
          entityType: 'time_correction',
          entityId: newRequest.id,
        });
      }

      return NextResponse.json({ request: newRequest }, { status: 201 });
    } catch (error) {
      const { error: err, status } = handleApiError(
        error,
        'Failed to create correction request',
      );
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'time-corrections:create' },
);

// ─── PATCH /api/time-corrections — Approve or reject a correction request ──

export const PATCH = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const requestId = request.nextUrl.searchParams.get('id');
      if (!requestId) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Request ID is required' } },
          { status: 400 },
        );
      }

      const body = await request.json();
      const parsed = TimeCorrectionReviewSchema.safeParse(body);
      if (!parsed.success) {
        const { error: err, status } = validationError(parsed.error);
        return NextResponse.json(err, { status });
      }

      const { status: newStatus, reviewNote } = parsed.data;

      // Find the correction request
      const [correctionReq] = await db()
        .select({
          id: schema.timeCorrectionRequests.id,
          organizationId: schema.timeCorrectionRequests.organizationId,
          userId: schema.timeCorrectionRequests.userId,
          timeEntryId: schema.timeCorrectionRequests.timeEntryId,
          taskId: schema.timeCorrectionRequests.taskId,
          originalMinutes: schema.timeCorrectionRequests.originalMinutes,
          requestedMinutes: schema.timeCorrectionRequests.requestedMinutes,
          status: schema.timeCorrectionRequests.status,
        })
        .from(schema.timeCorrectionRequests)
        .where(eq(schema.timeCorrectionRequests.id, requestId))
        .limit(1);

      if (!correctionReq) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Correction request not found' } },
          { status: 404 },
        );
      }

      if (correctionReq.organizationId !== orgId) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Access denied' } },
          { status: 403 },
        );
      }

      if (correctionReq.status !== 'pending') {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_STATE',
              message: 'This request has already been reviewed',
            },
          },
          { status: 422 },
        );
      }

      // Verify reviewer has permission
      await requirePermission(user.id, 'time:manage');

      const now = new Date();

      // For approvals: update the time entry + recalc hours FIRST,
      // then mark the correction as reviewed (data consistency)
      if (newStatus === 'approved') {
        await db()
          .update(schema.timeEntries)
          .set({
            durationMinutes: correctionReq.requestedMinutes,
            isCorrection: true,
            correctionReason: correctionReq.requestedMinutes > correctionReq.originalMinutes
              ? `Corrected: increased from ${correctionReq.originalMinutes}m to ${correctionReq.requestedMinutes}m`
              : `Corrected: decreased from ${correctionReq.originalMinutes}m to ${correctionReq.requestedMinutes}m`,
            updatedAt: now,
          })
          .where(eq(schema.timeEntries.id, correctionReq.timeEntryId));

        // Recalculate task hours
        await recalcTaskHours(correctionReq.taskId);
      }

      // Update the correction request status (after time entry update on approval)
      await db()
        .update(schema.timeCorrectionRequests)
        .set({
          status: newStatus,
          reviewedBy: user.id,
          reviewedAt: now,
          reviewNote: reviewNote ?? null,
          updatedAt: now,
        })
        .where(eq(schema.timeCorrectionRequests.id, requestId));

      // Notify the requester
      await createNotification({
        userId: correctionReq.userId,
        organizationId: orgId!,
        type: newStatus === 'approved' ? 'time_correction_approved' : 'time_correction_rejected',
        title: newStatus === 'approved' ? 'Correction approved' : 'Correction rejected',
        message:
          newStatus === 'approved'
            ? `Your time correction request was approved (${correctionReq.originalMinutes}m → ${correctionReq.requestedMinutes}m)`
            : `Your time correction request was rejected${reviewNote ? `: ${reviewNote}` : ''}`,
        link: '/timer',
        actorId: user.id,
        entityType: 'time_correction',
        entityId: correctionReq.id,
      });

      return NextResponse.json({
        success: true,
        status: newStatus,
      });
    } catch (error) {
      const { error: err, status } = handleApiError(
        error,
        'Failed to review correction request',
      );
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'time-corrections:review' },
);

// ─── DELETE /api/time-corrections — Cancel own pending correction request ──

export const DELETE = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const requestId = request.nextUrl.searchParams.get('id');
      if (!requestId) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Request ID is required' } },
          { status: 400 },
        );
      }

      // Find the correction request
      const [correctionReq] = await db()
        .select({
          id: schema.timeCorrectionRequests.id,
          organizationId: schema.timeCorrectionRequests.organizationId,
          userId: schema.timeCorrectionRequests.userId,
          timeEntryId: schema.timeCorrectionRequests.timeEntryId,
          taskId: schema.timeCorrectionRequests.taskId,
          originalMinutes: schema.timeCorrectionRequests.originalMinutes,
          requestedMinutes: schema.timeCorrectionRequests.requestedMinutes,
          status: schema.timeCorrectionRequests.status,
        })
        .from(schema.timeCorrectionRequests)
        .where(eq(schema.timeCorrectionRequests.id, requestId))
        .limit(1);

      if (!correctionReq) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Correction request not found' } },
          { status: 404 },
        );
      }

      if (correctionReq.organizationId !== orgId) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Access denied' } },
          { status: 403 },
        );
      }

      // Only the requester can cancel their own request
      if (correctionReq.userId !== user.id) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'You can only cancel your own correction requests' } },
          { status: 403 },
        );
      }

      // Only pending requests can be cancelled
      if (correctionReq.status !== 'pending') {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_STATE',
              message: 'This request has already been reviewed and cannot be cancelled',
            },
          },
          { status: 422 },
        );
      }

      // Update the correction request status to cancelled
      await db()
        .update(schema.timeCorrectionRequests)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(eq(schema.timeCorrectionRequests.id, requestId));

      // Notify the user's manager that the request was cancelled
      const [userRecord] = await db()
        .select({ reportingManagerId: schema.users.reportingManagerId })
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);

      if (userRecord?.reportingManagerId) {
        await createNotification({
          userId: userRecord.reportingManagerId,
          organizationId: orgId!,
          type: 'time_correction_cancelled',
          title: 'Correction cancelled',
          message: `${user.name || 'A user'} cancelled their time correction request (${correctionReq.originalMinutes}m → ${correctionReq.requestedMinutes}m)`,
          link: '/timer',
          actorId: user.id,
          entityType: 'time_correction',
          entityId: correctionReq.id,
        });
      }

      return NextResponse.json({
        success: true,
        status: 'cancelled',
      });
    } catch (error) {
      const { error: err, status } = handleApiError(
        error,
        'Failed to cancel correction request',
      );
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'time-corrections:cancel' },
);

