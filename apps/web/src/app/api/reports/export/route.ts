import { NextRequest, NextResponse } from 'next/server';
import { db, schema, handleApiError } from '@/lib/api/db';
import { withAuth, requirePermission } from '@/lib/auth/api-auth';
import { createAuditEntry } from '@/lib/audit';
import { buildCsv } from '@/lib/export/csv';
import { eq, desc, and, isNull, like, or } from 'drizzle-orm';

export const runtime = 'nodejs';

// GET /api/reports/export - Export report data as CSV with formula injection prevention
//
// Query params:
//   type  - 'tasks' | 'projects' | 'users' (default: 'tasks')
//   status - optional status filter
//   projectId - optional project filter
//   search - optional search term
//
// Response: CSV file download with Content-Disposition header
export const GET = withAuth(
  async (request: NextRequest, { user, orgId }) => {
    try {
      await requirePermission(user.id, 'report:export');

      const { searchParams } = new URL(request.url);
      const type = searchParams.get('type') || 'tasks';
      const status = searchParams.get('status');
      const projectId = searchParams.get('projectId');
      const searchTerm = searchParams.get('search');

      let csvContent = '';
      let filename = `report-${type}-${new Date().toISOString().split('T')[0]}.csv`;

      if (type === 'tasks') {
        const conditions = [
          isNull(schema.tasks.deletedAt),
          eq(schema.tasks.organizationId, orgId!),
        ];

        if (status) conditions.push(eq(schema.tasks.status, status));
        if (projectId) conditions.push(eq(schema.tasks.projectId, projectId));
        if (searchTerm) {
          const clause = or(
            like(schema.tasks.title, `%${searchTerm}%`),
            like(schema.tasks.taskIdDisplay, `%${searchTerm}%`),
          );
          if (clause) conditions.push(clause);
        }

        const tasks = await db()
          .select({
            taskId: schema.tasks.taskIdDisplay,
            title: schema.tasks.title,
            status: schema.tasks.status,
            priority: schema.tasks.priority,
            assignedTo: schema.tasks.assignedTo,
            dueDate: schema.tasks.dueDate,
            completedAt: schema.tasks.completedAt,
            createdAt: schema.tasks.createdAt,
            updatedAt: schema.tasks.updatedAt,
          })
          .from(schema.tasks)
          .where(and(...conditions))
          .orderBy(desc(schema.tasks.createdAt))
          .limit(10000);

        const headers = ['Task ID', 'Title', 'Status', 'Priority', 'Assigned To', 'Due Date', 'Completed At', 'Created At', 'Updated At'];

        const rows = tasks.map((t) => [
          t.taskId,
          t.title,
          t.status,
          t.priority ?? '',
          t.assignedTo ?? '',
          t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '',
          t.completedAt ? new Date(t.completedAt).toLocaleDateString() : '',
          new Date(t.createdAt).toLocaleDateString(),
          new Date(t.updatedAt).toLocaleDateString(),
        ]);

        csvContent = buildCsv(headers, rows);
      } else if (type === 'projects') {
        const projects = await db()
          .select({
            name: schema.projects.name,
            code: schema.projects.code,
            status: schema.projects.status,
            priority: schema.projects.priority,
            progress: schema.projects.progress,
            startDate: schema.projects.startDate,
            endDate: schema.projects.endDate,
            createdAt: schema.projects.createdAt,
          })
          .from(schema.projects)
          .where(
            and(
              isNull(schema.projects.deletedAt),
              eq(schema.projects.organizationId, orgId!),
            ),
          )
          .orderBy(desc(schema.projects.createdAt))
          .limit(10000);

        const headers = ['Name', 'Code', 'Status', 'Priority', 'Progress (%)', 'Start Date', 'End Date', 'Created At'];
        const rows = projects.map((p) => [
          p.name,
          p.code ?? '',
          p.status,
          p.priority ?? '',
          String(p.progress ?? 0),
          p.startDate ?? '',
          p.endDate ?? '',
          new Date(p.createdAt).toLocaleDateString(),
        ]);

        csvContent = buildCsv(headers, rows);
      } else if (type === 'users') {
        const users = await db()
          .select({
            name: schema.users.name,
            email: schema.users.email,
            firstName: schema.users.firstName,
            lastName: schema.users.lastName,
            designation: schema.users.designation,
            employmentStatus: schema.users.employmentStatus,
            isActive: schema.users.isActive,
            createdAt: schema.users.createdAt,
          })
          .from(schema.users)
          .where(
            and(
              isNull(schema.users.deletedAt),
              eq(schema.users.organizationId, orgId!),
            ),
          )
          .orderBy(desc(schema.users.createdAt))
          .limit(10000);

        const headers = ['Name', 'Email', 'First Name', 'Last Name', 'Designation', 'Status', 'Active', 'Created At'];
        const rows = users.map((u) => [
          u.name ?? '',
          u.email,
          u.firstName ?? '',
          u.lastName ?? '',
          u.designation ?? '',
          u.employmentStatus ?? '',
          u.isActive ? 'Yes' : 'No',
          new Date(u.createdAt).toLocaleDateString(),
        ]);

        csvContent = buildCsv(headers, rows);
      } else {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: `Unsupported export type: '${type}'. Supported: tasks, projects, users` } },
          { status: 400 },
        );
      }

      // Audit the export
      await createAuditEntry({
        organizationId: orgId,
        userId: user.id,
        action: 'report.exported',
        entityType: 'report_export',
        newValues: { type, rowCount: csvContent.split('\n').length - 2 }, // minus header and trailing newline
      });

      // Return CSV as download
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(Buffer.byteLength(csvContent, 'utf-8')),
        },
      });
    } catch (error) {
      const { error: err, status } = handleApiError(error, 'Failed to export report');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 20, namespace: 'reports:export' },
);
