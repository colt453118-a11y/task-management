import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db, schema, handleApiError, recalcTaskHours } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { createNotification } from '@/lib/notifications';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'nodejs';

const BulkReviewSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one ID is required').max(50, 'Too many IDs'),
  status: z.enum(['approved', 'rejected']),
  reviewNote: z.string().max(1000).optional().nullable(),
});

// ─── POST /api/time-corrections/bulk — Bulk approve/reject ──

export const POST = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      const body = await request.json();
      const parsed = BulkReviewSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: parsed.error.errors.map((e) => e.message).join(', '),
            },
          },
          { status: 400 },
        );
      }

      const { ids, status: newStatus, reviewNote } = parsed.data;

      // Verify reviewer has permission
      await requirePermission(user.id, 'time:manage');

      // Find all the correction requests that belong to this org and are pending
      const pendingRequests = await db()
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
        .where(
          and(
            inArray(schema.timeCorrectionRequests.id, ids),
            eq(schema.timeCorrectionRequests.organizationId, orgId!),
            eq(schema.timeCorrectionRequests.status, 'pending'),
          ),
        );

      if (pendingRequests.length === 0) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'No pending requests found for the given IDs' } },
          { status: 404 },
        );
      }

      const now = new Date();

      // For approvals: update time entries + recalc hours FIRST,
      // then mark correction requests as reviewed (data consistency)
      if (newStatus === 'approved') {
        for (const req of pendingRequests) {
          await db()
            .update(schema.timeEntries)
            .set({
              durationMinutes: req.requestedMinutes,
              isCorrection: true,
              correctionReason:
                req.requestedMinutes > req.originalMinutes
                  ? `Corrected: increased from ${req.originalMinutes}m to ${req.requestedMinutes}m`
                  : `Corrected: decreased from ${req.originalMinutes}m to ${req.requestedMinutes}m`,
              updatedAt: now,
            })
            .where(eq(schema.timeEntries.id, req.timeEntryId));

          // Recalculate task hours
          await recalcTaskHours(req.taskId);
        }
      }

      // Update all requests (after time entry updates on approval)
      await db()
        .update(schema.timeCorrectionRequests)
        .set({
          status: newStatus,
          reviewedBy: user.id,
          reviewedAt: now,
          reviewNote: reviewNote ?? null,
          updatedAt: now,
        })
        .where(
          and(
            inArray(schema.timeCorrectionRequests.id, pendingRequests.map((r) => r.id)),
          ),
        );

      // Notify all requesters
      for (const req of pendingRequests) {
        await createNotification({
          userId: req.userId,
          organizationId: orgId!,
          type: newStatus === 'approved' ? 'time_correction_approved' : 'time_correction_rejected',
          title: newStatus === 'approved' ? 'Correction approved' : 'Correction rejected',
          message:
            newStatus === 'approved'
              ? `Your time correction request was approved (${req.originalMinutes}m → ${req.requestedMinutes}m)`
              : `Your time correction request was rejected${reviewNote ? `: ${reviewNote}` : ''}`,
          link: '/timer',
          actorId: user.id,
          entityType: 'time_correction',
          entityId: req.id,
        });
      }

      return NextResponse.json({
        success: true,
        reviewedCount: pendingRequests.length,
        status: newStatus,
      });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to perform bulk action');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 20, namespace: 'time-corrections:bulk' },
);
