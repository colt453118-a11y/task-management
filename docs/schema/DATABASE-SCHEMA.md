# Database Schema — Enterprise Work Management Platform

## Overview

**Database**: PostgreSQL 17  
**ORMs**: Drizzle ORM (type-safe, SQL-like)  
**Extensions**: `pgcrypto` (UUIDs), `citext` (case-insensitive email), `ltree` (hierarchy paths), `pg_partman` (partitioning)

**Design Principles:**
- Normalized to 3NF — minimize redundancy
- UUID v7 primary keys — sortable, distributed-friendly
- Created/updated timestamps on every table
- Soft delete (`deleted_at`) on critical tables
- Row-Level Security (RLS) for multi-tenant readiness
- Composite indexes on all foreign key + status query patterns

---

## Entity Relationship Diagram (Text)

```
organizations ──1:N── departments ──1:N── teams ──1:N── team_members ──N:1── users
       │                                                                    │
       │                                                          ┌─────────┴──────────┐
       │                                                          │                    │
  roles ──M:N── users (via user_roles)                     user_profiles      user_settings
       │                                                          │
  permission ──M:N── roles (via role_permissions)           reporting_manager (self-ref FK)
       
projects ──1:N── milestones ──1:N── tasks ──1:N── subtasks
   │                                 │
   │                          task_assignees
   │                                 │
   │                          time_entries
   │                                 │
   │                          task_comments
   │                                 │
   │                          task_attachments
   │                                 │
   │                          task_checklist_items
   │                                 │
   │                          task_watchers
   │                                 │
   │                          task_dependencies
   │                                 │
   │                          task_history
   │                                 │
   │                          task_custom_fields
   │                                 │
   │                          task_labels (M:N)
   │
   └── task_templates

workflows ──1:N── workflow_states
     │
automation_rules

notifications
     │
notification_preferences

audit_logs (partitioned by month)
     │
activity_logs

reports ── report_definitions
     │
report_schedules

calendars ── calendar_events

approval_records
sla_records
```

---

## Complete Table Definitions

### 1. Organizations
```sql
CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,
    logo_url        TEXT,
    domain          VARCHAR(255),
    settings        JSONB DEFAULT '{}',       -- org-level settings
    max_users       INTEGER,
    is_active       BOOLEAN DEFAULT true,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_domain ON organizations(domain);
```

### 2. Users
```sql
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               CITEXT UNIQUE NOT NULL,
    password_hash       VARCHAR(255),
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    display_name        VARCHAR(200),
    avatar_url          TEXT,
    phone               VARCHAR(50),
    
    -- Organization relationship
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    
    -- Employee info
    designation         VARCHAR(200),
    employee_id         VARCHAR(50),
    employment_status   VARCHAR(50) DEFAULT 'active',  -- active, suspended, archived, terminated
    department_id       UUID REFERENCES departments(id),
    team_id             UUID REFERENCES teams(id),
    reporting_manager_id UUID REFERENCES users(id),
    location            VARCHAR(255),
    timezone            VARCHAR(50) DEFAULT 'UTC',
    date_joined         DATE,
    
    -- Auth
    email_verified      BOOLEAN DEFAULT false,
    two_factor_enabled  BOOLEAN DEFAULT false,
    two_factor_secret   TEXT,
    last_login_at       TIMESTAMPTZ,
    last_login_ip       INET,
    
    -- Status
    is_active           BOOLEAN DEFAULT true,
    is_suspended        BOOLEAN DEFAULT false,
    is_archived         BOOLEAN DEFAULT false,
    suspension_reason   TEXT,
    archived_at         TIMESTAMPTZ,
    
    -- Metadata
    preferences         JSONB DEFAULT '{}',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_team ON users(team_id);
CREATE INDEX idx_users_manager ON users(reporting_manager_id);
CREATE INDEX idx_users_status ON users(employment_status);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;
```

### 3. Departments
```sql
CREATE TABLE departments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    name              VARCHAR(200) NOT NULL,
    code              VARCHAR(50),                    -- e.g., "ENG", "MKT"
    description       TEXT,
    head_user_id      UUID REFERENCES users(id),      -- department head
    parent_id         UUID REFERENCES departments(id), -- sub-department support
    is_active         BOOLEAN DEFAULT true,
    sort_order        INTEGER DEFAULT 0,
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ,
    
    UNIQUE(organization_id, name),
    UNIQUE(organization_id, code)
);

CREATE INDEX idx_departments_org ON departments(organization_id);
CREATE INDEX idx_departments_parent ON departments(parent_id);
```

### 4. Teams
```sql
CREATE TABLE teams (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    department_id     UUID REFERENCES departments(id),
    name              VARCHAR(200) NOT NULL,
    code              VARCHAR(50),
    description       TEXT,
    lead_user_id      UUID REFERENCES users(id),  -- team lead
    is_active         BOOLEAN DEFAULT true,
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ,
    
    UNIQUE(organization_id, name)
);

CREATE INDEX idx_teams_org ON teams(organization_id);
CREATE INDEX idx_teams_department ON teams(department_id);
```

### 5. Team Members
```sql
CREATE TABLE team_members (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id           UUID NOT NULL REFERENCES teams(id),
    user_id           UUID NOT NULL REFERENCES users(id),
    role              VARCHAR(50) DEFAULT 'member', -- lead, member
    joined_at         TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
```

### 6. Roles
```sql
CREATE TABLE roles (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    name              VARCHAR(100) NOT NULL,
    slug              VARCHAR(100) NOT NULL,
    description       TEXT,
    is_system         BOOLEAN DEFAULT false,  -- system roles cannot be deleted
    is_active         BOOLEAN DEFAULT true,
    priority          INTEGER DEFAULT 0,      -- for role hierarchy
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ,
    
    UNIQUE(organization_id, slug)
);

CREATE INDEX idx_roles_org ON roles(organization_id);
```

### 7. Permissions
```sql
CREATE TABLE permissions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code              VARCHAR(100) UNIQUE NOT NULL,  -- e.g., "task:create", "user:manage"
    name              VARCHAR(200) NOT NULL,
    description       TEXT,
    module            VARCHAR(100) NOT NULL,         -- auth, user, project, task, report, settings
    is_system         BOOLEAN DEFAULT true,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_permissions_module ON permissions(module);
CREATE INDEX idx_permissions_code ON permissions(code);
```

### 8. Role Permissions (Many-to-Many)
```sql
CREATE TABLE role_permissions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id           UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id     UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    allow             BOOLEAN DEFAULT true,          -- can be used for deny overrides
    
    UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);
```

### 9. User Roles
```sql
CREATE TABLE user_roles (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id           UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by       UUID REFERENCES users(id),
    assigned_at       TIMESTAMPTZ DEFAULT NOW(),
    expires_at        TIMESTAMPTZ,                  -- temporary role assignment
    
    UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
```

### 10. Projects
```sql
CREATE TABLE projects (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    name              VARCHAR(300) NOT NULL,
    code              VARCHAR(20),                    -- e.g., "PROJ-001"
    description       TEXT,
    
    -- Ownership
    owner_id          UUID NOT NULL REFERENCES users(id),
    department_id     UUID REFERENCES departments(id),
    team_id           UUID REFERENCES teams(id),
    
    -- Status & Progress
    status            VARCHAR(50) DEFAULT 'active',  -- draft, active, on_hold, completed, archived
    priority          VARCHAR(20) DEFAULT 'medium',  -- low, medium, high, critical
    progress          INTEGER DEFAULT 0,             -- 0-100
    completion_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- Timeline
    start_date        DATE,
    end_date          DATE,
    actual_end_date   DATE,
    
    -- Budget (optional)
    budget_amount     DECIMAL(15,2),
    budget_currency   VARCHAR(3) DEFAULT 'USD',
    
    -- Metadata
    tags              TEXT[],
    is_active         BOOLEAN DEFAULT true,
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ,
    
    UNIQUE(organization_id, code)
);

CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_department ON projects(department_id);
CREATE INDEX idx_projects_team ON projects(team_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_code ON projects(code);
```

### 11. Milestones
```sql
CREATE TABLE milestones (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name              VARCHAR(300) NOT NULL,
    description       TEXT,
    status            VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, delayed
    due_date          DATE,
    completed_date    DATE,
    sort_order        INTEGER DEFAULT 0,
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_milestones_project ON milestones(project_id);
```

### 12. Tasks
```sql
CREATE TABLE tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    
    -- Core
    title               VARCHAR(500) NOT NULL,
    description         TEXT,                          -- HTML from TipTap
    task_id_display     VARCHAR(30) NOT NULL,          -- e.g., "TASK-1042"
    task_type           VARCHAR(50) DEFAULT 'task',    -- task, bug, story, epic, sub_task
    
    -- Relationships
    project_id          UUID REFERENCES projects(id),
    milestone_id        UUID REFERENCES milestones(id),
    parent_task_id      UUID REFERENCES tasks(id),     -- for subtasks
    department_id       UUID REFERENCES departments(id),
    team_id             UUID REFERENCES teams(id),
    
    -- Assignment
    created_by          UUID NOT NULL REFERENCES users(id),
    assigned_by         UUID REFERENCES users(id),
    assigned_to         UUID REFERENCES users(id),
    reviewers           UUID[],                        -- array of user IDs for review
    
    -- Workflow
    status              VARCHAR(50) NOT NULL DEFAULT 'draft',
    workflow_id         UUID REFERENCES workflows(id),
    priority            VARCHAR(20) DEFAULT 'medium',  -- none, low, medium, high, urgent, critical
    category            VARCHAR(100),
    
    -- Labels & Tags
    labels              TEXT[],                        -- array of label names/slugs
    tags                TEXT[],
    
    -- Dates
    start_date          TIMESTAMPTZ,
    due_date            TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    closed_at           TIMESTAMPTZ,
    
    -- Time
    estimated_hours     DECIMAL(8,2),
    actual_hours        DECIMAL(8,2) DEFAULT 0,
    billable            BOOLEAN DEFAULT false,
    billable_hours      DECIMAL(8,2) DEFAULT 0,
    
    -- Approval
    approval_status     VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, not_required
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    
    -- SLA
    sla_due_at          TIMESTAMPTZ,
    sla_breached        BOOLEAN DEFAULT false,
    
    -- Closure
    completion_summary  TEXT,
    closure_notes       TEXT,
    closed_by           UUID REFERENCES users(id),
    
    -- Recurrence
    is_recurring        BOOLEAN DEFAULT false,
    recurrence_rule     TEXT,                          -- RRULE format
    
    -- Custom fields stored as JSONB
    custom_fields       JSONB DEFAULT '{}',
    
    -- Metadata
    is_readonly         BOOLEAN DEFAULT false,         -- closed tasks become readonly
    sort_order          DECIMAL(12,4),                 -- for Kanban ordering
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

-- Performance indexes
CREATE INDEX idx_tasks_org ON tasks(organization_id);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_milestone ON tasks(milestone_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_display_id ON tasks(task_id_display);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_department ON tasks(department_id);
CREATE INDEX idx_tasks_team ON tasks(team_id);
CREATE INDEX idx_tasks_workflow ON tasks(workflow_id);
CREATE INDEX idx_tasks_sla ON tasks(sla_due_at) WHERE sla_due_at IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX idx_tasks_assigned_status ON tasks(assigned_to, status);
CREATE INDEX idx_tasks_org_status ON tasks(organization_id, status, created_at DESC);
CREATE INDEX idx_tasks_due_uncompleted ON tasks(organization_id, due_date) WHERE status NOT IN ('completed', 'closed', 'archived');
CREATE INDEX idx_tasks_overdue ON tasks(organization_id) WHERE due_date < NOW() AND status NOT IN ('completed', 'closed', 'archived');
```

### 13. Task Assignees (for multi-assignee support)
```sql
CREATE TABLE task_assignees (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by       UUID REFERENCES users(id),
    assigned_at       TIMESTAMPTZ DEFAULT NOW(),
    is_primary        BOOLEAN DEFAULT false,
    
    UNIQUE(task_id, user_id)
);

CREATE INDEX idx_task_assignees_task ON task_assignees(task_id);
CREATE INDEX idx_task_assignees_user ON task_assignees(user_id);
```

### 14. Task History (Complete Version History)
```sql
CREATE TABLE task_history (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id),
    field             VARCHAR(100) NOT NULL,           -- e.g., "status", "title", "assigned_to"
    old_value         TEXT,
    new_value         TEXT,
    change_type       VARCHAR(50) NOT NULL,            -- update, create, delete, comment, attachment, assign
    description       TEXT,                            -- human-readable change description
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_history_task ON task_history(task_id, created_at DESC);
CREATE INDEX idx_task_history_user ON task_history(user_id);
CREATE INDEX idx_task_history_type ON task_history(change_type);
CREATE INDEX idx_task_history_created ON task_history(created_at);
```

### 15. Task Comments
```sql
CREATE TABLE task_comments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id),
    content           TEXT NOT NULL,                   -- HTML from TipTap
    content_plain     TEXT,                            -- plain text version for search
    is_internal_note  BOOLEAN DEFAULT false,           -- internal notes (not visible to everyone)
    parent_id         UUID REFERENCES task_comments(id), -- threaded replies
    edited_at         TIMESTAMPTZ,
    is_edited         BOOLEAN DEFAULT false,
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_task_comments_task ON task_comments(task_id, created_at ASC);
CREATE INDEX idx_task_comments_user ON task_comments(user_id);
CREATE INDEX idx_task_comments_parent ON task_comments(parent_id);
```

### 16. Task Attachments
```sql
CREATE TABLE task_attachments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id),
    file_name         VARCHAR(500) NOT NULL,
    file_size         BIGINT,
    mime_type         VARCHAR(100),
    storage_key       TEXT NOT NULL,                   -- S3 key
    storage_url       TEXT,                            -- CDN URL
    is_final          BOOLEAN DEFAULT false,           -- for closure attachments
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_task_attachments_task ON task_attachments(task_id);
```

### 17. Task Checklist Items
```sql
CREATE TABLE task_checklist_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    content           TEXT NOT NULL,
    is_checked        BOOLEAN DEFAULT false,
    checked_by        UUID REFERENCES users(id),
    checked_at        TIMESTAMPTZ,
    sort_order        INTEGER DEFAULT 0,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_checklist_task ON task_checklist_items(task_id);
```

### 18. Task Dependencies
```sql
CREATE TABLE task_dependencies (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type   VARCHAR(50) DEFAULT 'blocks',   -- blocks, blocked_by, relates_to
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(task_id, depends_on_task_id)
);

CREATE INDEX idx_task_dependencies_task ON task_dependencies(task_id);
CREATE INDEX idx_task_dependencies_depends ON task_dependencies(depends_on_task_id);
```

### 19. Task Watchers / Followers
```sql
CREATE TABLE task_watchers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    watch_type        VARCHAR(50) DEFAULT 'watching',  -- watching, following
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(task_id, user_id)
);

CREATE INDEX idx_task_watchers_task ON task_watchers(task_id);
CREATE INDEX idx_task_watchers_user ON task_watchers(user_id);
```

### 20. Task Labels (Global label management)
```sql
CREATE TABLE labels (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    name              VARCHAR(100) NOT NULL,
    color             VARCHAR(7) DEFAULT '#6366f1',    -- hex color
    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, name)
);

CREATE TABLE task_labels (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    label_id          UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    
    UNIQUE(task_id, label_id)
);

CREATE INDEX idx_task_labels_task ON task_labels(task_id);
CREATE INDEX idx_task_labels_label ON task_labels(label_id);
```

### 21. Time Entries
```sql
CREATE TABLE time_entries (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id),
    
    -- Time
    start_time        TIMESTAMPTZ NOT NULL,
    end_time          TIMESTAMPTZ,
    duration_minutes  INTEGER,                        -- calculated duration
    billable_minutes  INTEGER,
    
    -- Entry type
    entry_type        VARCHAR(50) DEFAULT 'manual',   -- manual, timer, automatic
    description       TEXT,
    
    -- Approval
    is_approved       BOOLEAN DEFAULT false,
    approved_by       UUID REFERENCES users(id),
    approved_at       TIMESTAMPTZ,
    
    -- Correction
    is_correction     BOOLEAN DEFAULT false,
    corrected_entry_id UUID REFERENCES time_entries(id),
    correction_reason TEXT,
    
    -- Metadata
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_time_entries_task ON time_entries(task_id);
CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_date ON time_entries(start_time);
CREATE INDEX idx_time_entries_user_date ON time_entries(user_id, start_time);
```

### 22. Custom Fields
```sql
CREATE TABLE custom_field_definitions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    name              VARCHAR(200) NOT NULL,
    slug              VARCHAR(200) NOT NULL,
    field_type        VARCHAR(50) NOT NULL,            -- text, number, date, select, multi_select, user, boolean
    description       TEXT,
    is_required       BOOLEAN DEFAULT false,
    options           JSONB,                           -- for select types: [{label: "Option", value: "opt"}]
    default_value     TEXT,
    applies_to        VARCHAR(50) DEFAULT 'task',      -- task, project, user
    sort_order        INTEGER DEFAULT 0,
    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, slug)
);

CREATE TABLE task_custom_field_values (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    field_id          UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    value             TEXT,
    value_json        JSONB,
    
    UNIQUE(task_id, field_id)
);

CREATE INDEX idx_custom_field_values_task ON task_custom_field_values(task_id);
CREATE INDEX idx_custom_field_values_field ON task_custom_field_values(field_id);
```

### 23. Workflows
```sql
CREATE TABLE workflows (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    name              VARCHAR(200) NOT NULL,
    description       TEXT,
    is_default        BOOLEAN DEFAULT false,
    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, name)
);

CREATE TABLE workflow_states (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id       UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    name              VARCHAR(100) NOT NULL,           -- e.g., "In Progress", "Blocked"
    slug              VARCHAR(100) NOT NULL,
    color             VARCHAR(7) DEFAULT '#6366f1',
    sort_order        INTEGER DEFAULT 0,
    is_start_state    BOOLEAN DEFAULT false,
    is_end_state      BOOLEAN DEFAULT false,           -- completed, closed, archived
    requires_approval BOOLEAN DEFAULT false,
    metadata          JSONB DEFAULT '{}',
    
    UNIQUE(workflow_id, slug)
);

CREATE TABLE workflow_transitions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id       UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    from_state_id     UUID NOT NULL REFERENCES workflow_states(id) ON DELETE CASCADE,
    to_state_id       UUID NOT NULL REFERENCES workflow_states(id) ON DELETE CASCADE,
    name              VARCHAR(200),
    required_permission VARCHAR(100),                  -- permission code needed for this transition
    requires_approval BOOLEAN DEFAULT false,
    conditions        JSONB,                           -- conditions for transition
    
    UNIQUE(workflow_id, from_state_id, to_state_id)
);

CREATE INDEX idx_workflow_states_workflow ON workflow_states(workflow_id);
CREATE INDEX idx_workflow_transitions_workflow ON workflow_transitions(workflow_id);
```

### 24. Automation Rules
```sql
CREATE TABLE automation_rules (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    name              VARCHAR(200) NOT NULL,
    description       TEXT,
    is_active         BOOLEAN DEFAULT true,
    trigger_event     VARCHAR(100) NOT NULL,           -- task.created, task.overdue, task.status_changed
    trigger_conditions JSONB,                          -- conditions for trigger
    actions           JSONB NOT NULL,                  -- [{ type: "notify", config: {...} }, { type: "change_status", config: {...} }]
    priority          INTEGER DEFAULT 0,
    cooldown_minutes  INTEGER,                         -- prevent repeated execution
    last_triggered_at TIMESTAMPTZ,
    created_by        UUID REFERENCES users(id),
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automation_rules_org ON automation_rules(organization_id);
CREATE INDEX idx_automation_rules_event ON automation_rules(trigger_event);
```

### 25. Notifications
```sql
CREATE TABLE notifications (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    user_id           UUID NOT NULL REFERENCES users(id),
    type              VARCHAR(100) NOT NULL,           -- task.assigned, task.comment, task.overdue, etc.
    title             VARCHAR(300) NOT NULL,
    body              TEXT,
    
    -- Links
    action_url        TEXT,                            -- deep link to the resource
    reference_type    VARCHAR(50),                     -- task, project, comment, etc.
    reference_id      UUID,
    
    -- Channels
    channels          TEXT[],                          -- ['in_app', 'email', 'push', 'slack']
    
    -- Status
    is_read           BOOLEAN DEFAULT false,
    read_at           TIMESTAMPTZ,
    is_seen           BOOLEAN DEFAULT false,
    delivered_at      TIMESTAMPTZ,
    
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_reference ON notifications(reference_type, reference_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = false;

CREATE TABLE notification_preferences (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel           VARCHAR(50) NOT NULL,            -- in_app, email, push, slack
    notification_type VARCHAR(100) NOT NULL,           -- task.assigned, task.comment, etc.
    enabled           BOOLEAN DEFAULT true,
    
    UNIQUE(user_id, channel, notification_type)
);
```

### 26. Approval Records
```sql
CREATE TABLE approval_records (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    
    -- Polymorphic reference
    reference_type    VARCHAR(50) NOT NULL,            -- task, project, time_entry
    reference_id      UUID NOT NULL,
    
    -- Approval flow
    status            VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, approved, rejected
    requested_by      UUID NOT NULL REFERENCES users(id),
    approved_by       UUID REFERENCES users(id),
    comments          TEXT,
    approved_at       TIMESTAMPTZ,
    rejected_at       TIMESTAMPTZ,
    rejection_reason  TEXT,
    
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approval_records_reference ON approval_records(reference_type, reference_id);
CREATE INDEX idx_approval_records_status ON approval_records(status);
```

### 27. SLA Records
```sql
CREATE TABLE sla_records (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id           UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    sla_policy        VARCHAR(200),                    -- e.g., "Critical - 2 hours", "High - 8 hours"
    response_due_at   TIMESTAMPTZ,
    resolution_due_at TIMESTAMPTZ,
    responded_at      TIMESTAMPTZ,
    resolved_at       TIMESTAMPTZ,
    response_breached BOOLEAN DEFAULT false,
    resolution_breached BOOLEAN DEFAULT false,
    escalated_at      TIMESTAMPTZ,
    escalated_to      UUID REFERENCES users(id),
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sla_records_task ON sla_records(task_id);
CREATE INDEX idx_sla_records_breached ON sla_records(response_breached, resolution_breached);
```

### 28. Audit Logs (Partitioned by Month)
```sql
CREATE TABLE audit_logs (
    id                UUID NOT NULL DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL,
    user_id           UUID,
    
    -- Action details
    action            VARCHAR(100) NOT NULL,           -- user.created, task.status_changed, project.deleted
    entity_type       VARCHAR(50) NOT NULL,            -- user, task, project, role, etc.
    entity_id         UUID,
    changes           JSONB,                           -- { field: { old: "x", new: "y" } }
    
    -- Context
    ip_address        INET,
    user_agent        TEXT,
    session_id        VARCHAR(255),
    request_id        VARCHAR(100),
    
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ... etc

CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

### 29. Activity Feed
```sql
CREATE TABLE activity_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    user_id           UUID REFERENCES users(id),
    
    -- Activity
    activity_type     VARCHAR(100) NOT NULL,           -- task_completed, project_created, user_joined
    description       TEXT NOT NULL,
    
    -- Context
    reference_type    VARCHAR(50),                     -- task, project, user, team
    reference_id      UUID,
    metadata          JSONB DEFAULT '{}',
    
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_org ON activity_logs(organization_id, created_at DESC);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_type ON activity_logs(activity_type);
CREATE INDEX idx_activity_logs_reference ON activity_logs(reference_type, reference_id);
```

### 30. Calendar Events
```sql
CREATE TABLE calendar_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    user_id           UUID REFERENCES users(id),       -- NULL for org-wide events
    
    -- Event details
    title             VARCHAR(500) NOT NULL,
    description       TEXT,
    event_type        VARCHAR(50) NOT NULL,            -- task_due, milestone, leave, holiday, custom
    color             VARCHAR(7) DEFAULT '#6366f1',
    
    -- Dates
    start_date        TIMESTAMPTZ NOT NULL,
    end_date          TIMESTAMPTZ,
    is_all_day        BOOLEAN DEFAULT false,
    
    -- Links
    reference_type    VARCHAR(50),                     -- task, project, milestone
    reference_id      UUID,
    
    -- Recurrence
    is_recurring      BOOLEAN DEFAULT false,
    recurrence_rule   TEXT,
    
    -- Visibility
    visibility        VARCHAR(50) DEFAULT 'public',    -- public, private, team_only
    
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_user ON calendar_events(user_id, start_date);
CREATE INDEX idx_calendar_events_org ON calendar_events(organization_id, start_date);
CREATE INDEX idx_calendar_events_type ON calendar_events(event_type);
CREATE INDEX idx_calendar_events_reference ON calendar_events(reference_type, reference_id);
```

### 31. Reports
```sql
CREATE TABLE report_definitions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    name              VARCHAR(300) NOT NULL,
    description       TEXT,
    type              VARCHAR(50) NOT NULL,            -- daily, weekly, monthly, custom
    config            JSONB NOT NULL,                  -- report configuration
    created_by        UUID NOT NULL REFERENCES users(id),
    is_auto           BOOLEAN DEFAULT false,           -- automatically generated
    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE report_schedules (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id         UUID NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
    frequency         VARCHAR(50) NOT NULL,            -- daily, weekly, monthly, quarterly, yearly
    cron_expression   VARCHAR(100),
    recipients        JSONB,                           -- { email: [...], slack: [...], users: [...] }
    format            VARCHAR(50) DEFAULT 'pdf',       -- pdf, csv, xlsx, email
    is_active         BOOLEAN DEFAULT true,
    last_generated_at TIMESTAMPTZ,
    next_run_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE report_generations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id         UUID REFERENCES report_definitions(id),
    schedule_id       UUID REFERENCES report_schedules(id),
    status            VARCHAR(50) DEFAULT 'pending',   -- pending, generating, completed, failed
    format            VARCHAR(50),
    file_url          TEXT,
    generated_at      TIMESTAMPTZ,
    error_message     TEXT,
    row_count         INTEGER,
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_org ON report_definitions(organization_id);
CREATE INDEX idx_report_schedules_active ON report_schedules(is_active, next_run_at);
CREATE INDEX idx_report_generations_status ON report_generations(status);
```

### 32. File Management
```sql
CREATE TABLE files (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    user_id           UUID NOT NULL REFERENCES users(id),
    
    -- File info
    file_name         VARCHAR(500) NOT NULL,
    file_size         BIGINT NOT NULL,
    mime_type         VARCHAR(100) NOT NULL,
    storage_key       TEXT NOT NULL,
    storage_provider  VARCHAR(50) DEFAULT 's3',       -- s3, minio, r2
    storage_url       TEXT,
    
    -- Relationships
    reference_type    VARCHAR(50),                     -- task, project, comment, user
    reference_id      UUID,
    
    -- Metadata
    is_public         BOOLEAN DEFAULT false,
    checksum          VARCHAR(64),                     -- SHA-256 for integrity
    virus_scan_status VARCHAR(50) DEFAULT 'pending',   -- pending, clean, infected
    thumbnail_url     TEXT,
    
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_files_org ON files(organization_id);
CREATE INDEX idx_files_user ON files(user_id);
CREATE INDEX idx_files_reference ON files(reference_type, reference_id);
CREATE INDEX idx_files_virus ON files(virus_scan_status);
```

### 33. Sessions & Devices
```sql
CREATE TABLE user_sessions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token     VARCHAR(500) UNIQUE NOT NULL,
    refresh_token     VARCHAR(500),
    ip_address        INET,
    user_agent        TEXT,
    device_info       JSONB,                           -- device name, type, OS, browser
    location          JSONB,
    is_active         BOOLEAN DEFAULT true,
    last_activity_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_active ON user_sessions(user_id, is_active);

CREATE TABLE login_history (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id),
    ip_address        INET NOT NULL,
    user_agent        TEXT,
    login_method      VARCHAR(50),                     -- email, google, microsoft, magic_link, sso
    success           BOOLEAN DEFAULT true,
    failure_reason    TEXT,
    location          JSONB,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_login_history_user ON login_history(user_id, created_at DESC);
CREATE INDEX idx_login_history_ip ON login_history(ip_address);
```

### 34. System Settings
```sql
CREATE TABLE system_settings (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    category          VARCHAR(100) NOT NULL,           -- general, security, notifications, integrations
    key               VARCHAR(200) NOT NULL,
    value             JSONB NOT NULL,
    description       TEXT,
    is_encrypted      BOOLEAN DEFAULT false,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, category, key)
);

CREATE TABLE integration_credentials (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    provider          VARCHAR(100) NOT NULL,           -- slack, teams, google, microsoft
    credentials       JSONB NOT NULL,                  -- encrypted
    is_active         BOOLEAN DEFAULT true,
    last_test_at      TIMESTAMPTZ,
    test_status       VARCHAR(50),
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, provider)
);
```

---

## Database Migration Strategy

```bash
# Drizzle Kit commands
pnpm db:generate    # Generate migrations from schema
pnpm db:migrate     # Run migrations
pnpm db:push        # Push schema to dev DB (fast iteration)
pnpm db:seed        # Seed development data
pnpm db:studio      # Launch Drizzle Studio GUI
```

- Each migration is a reversible SQL file
- All migrations run in transactions
- Production migrations run via CI/CD with automatic rollback on failure
- Seed scripts for: admin user, system roles, default permissions, sample data

---

## Row-Level Security (RLS)

For multi-tenant isolation at the database level:

```sql
-- Enable RLS on all tenant tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create policy ensuring users only see their org's data
CREATE POLICY tasks_org_isolation ON tasks
    USING (organization_id = current_setting('app.current_org_id')::UUID);
```

This ensures that even in the event of a direct database connection, users cannot access data from other organizations.

---

## Database Indexing Summary

| Query Pattern | Index | Type |
|--------------|-------|------|
| Tasks by project + status | `(project_id, status)` | Composite BTREE |
| Tasks assigned to user | `(assigned_to, status)` | Composite BTREE |
| Unread notifications | `(user_id) WHERE is_read = false` | Partial BTREE |
| Auth lookup by email | `(email)` | Unique BTREE |
| Overdue tasks | `(organization_id) WHERE due_date < NOW() AND status NOT IN (...)` | Partial BTREE |
| Time entries by user + date | `(user_id, start_time)` | Composite BTREE |
| Audit logs by time range | `(created_at DESC)` | BTREE (partitioned) |
| Full-text search (tasks) | `to_tsvector('english', title || ' ' || description)` | GIN |
