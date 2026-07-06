import { NextRequest, NextResponse } from 'next/server';
import { db, schema, apiError } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { createAuditEntry } from '@/lib/audit';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { AttachmentCreateSchema, validationError, ALLOWED_MIME_TYPES, BLOCKED_EXTENSIONS, MAX_FILE_SIZE } from '@/lib/api/validation';

export const runtime = 'nodejs';

function getIdsFromPath(request: NextRequest): { taskId: string } {
  const segments = request.nextUrl.pathname.split('/');
  const idIndex = segments.indexOf('tasks');
  return { taskId: segments[idIndex + 1]! };
}

// GET /api/tasks/[id]/attachments - List attachments for a task
export const GET = withAuth(async (request: NextRequest, { orgId }) => {
  try {
    const { taskId } = getIdsFromPath(request);

    const attachments = await db()
      .select({
        id: schema.taskAttachments.id,
        taskId: schema.taskAttachments.taskId,
        userId: schema.taskAttachments.userId,
        fileName: schema.taskAttachments.fileName,
        fileSize: schema.taskAttachments.fileSize,
        mimeType: schema.taskAttachments.mimeType,
        isFinal: schema.taskAttachments.isFinal,
        createdAt: schema.taskAttachments.createdAt,
        user: {
          id: schema.users.id,
          name: schema.users.name,
        },
      })
      .from(schema.taskAttachments)
      .innerJoin(schema.tasks, eq(schema.taskAttachments.taskId, schema.tasks.id))
      .leftJoin(schema.users, eq(schema.taskAttachments.userId, schema.users.id))
      .where(
        and(
          eq(schema.taskAttachments.taskId, taskId),
          isNull(schema.taskAttachments.deletedAt),
          eq(schema.tasks.organizationId, orgId!),
        ),
      )
      .orderBy(desc(schema.taskAttachments.createdAt));

    return NextResponse.json({ attachments });
  } catch (error) {
    console.error('Failed to fetch attachments:', error);
    const { error: err, status } = apiError('Failed to fetch attachments');
    return NextResponse.json(err, { status });
  }
});

// POST /api/tasks/[id]/attachments - Add an attachment reference
export const POST = withAuth(async (request: NextRequest, { user, orgId }) => {
  try {
    const { taskId } = getIdsFromPath(request);
    await requirePermission(user.id, 'task:edit');

    const body = await request.json();
    const parsed = AttachmentCreateSchema.safeParse(body);
    if (!parsed.success) {
      const { error: err, status } = validationError(parsed.error);
      return NextResponse.json(err, { status });
    }

    const { fileName, fileSize, mimeType, storageKey } = parsed.data;

    // ── File type validation ──
    const ext = '.' + (fileName.split('.').pop()?.toLowerCase() ?? '');
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: `File type '${ext}' is not allowed` } },
        { status: 400 },
      );
    }

    if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
      // Non-blocking warning: log for audit but allow (MIME can be spoofed)
      console.warn(`Unusual MIME type for upload: ${mimeType} (file: ${fileName})`);
    }

    // ── File size validation ──
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` } },
        { status: 400 },
      );
    }

    // ── Filename sanitization ──
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 500);

    // Verify task exists, belongs to org, and is not read-only
    const [task] = await db()
      .select({
        id: schema.tasks.id,
        organizationId: schema.tasks.organizationId,
        status: schema.tasks.status,
      })
      .from(schema.tasks)
      .where(and(eq(schema.tasks.id, taskId), isNull(schema.tasks.deletedAt)))
      .limit(1);

    if (!task) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 },
      );
    }

    if (task.organizationId !== orgId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 },
      );
    }

    // Block attachments on archived tasks
    if (task.status === 'archived') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATE', message: 'Cannot add attachments to archived tasks' } },
        { status: 422 },
      );
    }

    const [attachment] = await db()
      .insert(schema.taskAttachments)
      .values({
        taskId,
        userId: user.id,
        fileName: sanitizedFileName,
        fileSize: fileSize ?? null,
        mimeType: mimeType ?? null,
        storageKey,
        isFinal: false,
      })
      .returning();

    if (!attachment) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to create attachment' } },
        { status: 500 },
      );
    }

    await createAuditEntry({
      organizationId: orgId,
      userId: user.id,
      action: 'task.attachment_added',
      entityType: 'task',
      entityId: taskId,
      newValues: { attachmentId: attachment.id, fileName: sanitizedFileName },
    });

    // Fetch with user info
    const [attachmentWithUser] = await db()
      .select({
        id: schema.taskAttachments.id,
        taskId: schema.taskAttachments.taskId,
        userId: schema.taskAttachments.userId,
        fileName: schema.taskAttachments.fileName,
        fileSize: schema.taskAttachments.fileSize,
        mimeType: schema.taskAttachments.mimeType,
        isFinal: schema.taskAttachments.isFinal,
        createdAt: schema.taskAttachments.createdAt,
        user: {
          id: schema.users.id,
          name: schema.users.name,
        },
      })
      .from(schema.taskAttachments)
      .leftJoin(schema.users, eq(schema.taskAttachments.userId, schema.users.id))
      .where(eq(schema.taskAttachments.id, attachment.id))
      .limit(1);

    return NextResponse.json({ attachment: attachmentWithUser }, { status: 201 });
  } catch (error) {
    console.error('Failed to create attachment:', error);
    const { error: err, status } = apiError('Failed to create attachment');
    return NextResponse.json(err, { status });
  }
});

// DELETE /api/tasks/[id]/attachments - Delete an attachment
export const DELETE = withAuth(async (request: NextRequest, { user }) => {
  try {
    const { taskId } = getIdsFromPath(request);
    const attachmentId = request.nextUrl.searchParams.get('attachmentId');

    if (!attachmentId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'attachmentId is required' } },
        { status: 400 },
      );
    }

    const [existing] = await db()
      .select()
      .from(schema.taskAttachments)
      .where(
        and(
          eq(schema.taskAttachments.id, attachmentId),
          eq(schema.taskAttachments.taskId, taskId),
          isNull(schema.taskAttachments.deletedAt),
        ),
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Attachment not found' } },
        { status: 404 },
      );
    }

    if (existing.userId !== user.id) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'You can only delete your own attachments' } },
        { status: 403 },
      );
    }

    await db()
      .update(schema.taskAttachments)
      .set({ deletedAt: new Date() })
      .where(eq(schema.taskAttachments.id, attachmentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete attachment:', error);
    const { error: err, status } = apiError('Failed to delete attachment');
    return NextResponse.json(err, { status });
  }
});
