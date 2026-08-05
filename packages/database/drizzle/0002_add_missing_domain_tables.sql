CREATE TABLE IF NOT EXISTS "automation_logs" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    rule_id uuid NOT NULL,
    rule_name character varying(200) NOT NULL,
    trigger character varying(100) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id character varying(255) NOT NULL,
    conditions_met boolean DEFAULT true,
    actions_executed jsonb DEFAULT '[]'::jsonb,
    success boolean DEFAULT true,
    error_message text,
    duration_ms integer,
    triggered_by_user_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "automation_rules" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    trigger character varying(100) NOT NULL,
    conditions jsonb DEFAULT '[]'::jsonb,
    actions jsonb DEFAULT '[]'::jsonb NOT NULL,
    enabled boolean DEFAULT true,
    cooldown_minutes integer DEFAULT 0,
    last_triggered_at timestamp without time zone,
    execution_count integer DEFAULT 0,
    created_by text NOT NULL,
    updated_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);
CREATE TABLE IF NOT EXISTS "leave_balances" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id text NOT NULL,
    leave_type_id uuid NOT NULL,
    year integer NOT NULL,
    allocated_days integer DEFAULT 0 NOT NULL,
    used_days integer DEFAULT 0 NOT NULL,
    pending_days integer DEFAULT 0 NOT NULL,
    notes text,
    created_by text,
    updated_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "leave_requests" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id text NOT NULL,
    leave_type_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_half_day boolean DEFAULT false,
    days_count integer NOT NULL,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reviewed_by text,
    reviewed_at timestamp without time zone,
    review_note text,
    cancelled_by text,
    cancelled_at timestamp without time zone,
    attachment_url text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "leave_types" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(50) NOT NULL,
    description text,
    color character varying(7) DEFAULT '#6366f1'::character varying NOT NULL,
    icon character varying(50) DEFAULT 'CalendarDays'::character varying,
    requires_attachment boolean DEFAULT false,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "notifications" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id text NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(500) NOT NULL,
    message text,
    link character varying(500),
    actor_id text,
    entity_type character varying(50),
    entity_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false,
    is_dismissed boolean DEFAULT false,
    read_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "saved_searches" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id text NOT NULL,
    name character varying(200) NOT NULL,
    query character varying(500) DEFAULT ''::character varying NOT NULL,
    type character varying(50) DEFAULT 'all'::character varying NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb,
    is_default boolean DEFAULT false,
    sort_order text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "task_templates" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    task_title character varying(500),
    task_description text,
    priority character varying(20) DEFAULT 'medium'::character varying,
    category character varying(100),
    labels text[],
    tags text[],
    estimated_hours numeric(8,2),
    is_default boolean DEFAULT false,
    created_by text NOT NULL,
    updated_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);
CREATE TABLE IF NOT EXISTS "time_correction_requests" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    time_entry_id uuid NOT NULL,
    user_id text NOT NULL,
    task_id uuid NOT NULL,
    original_minutes integer NOT NULL,
    requested_minutes integer NOT NULL,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reviewed_by text,
    reviewed_at timestamp without time zone,
    review_note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "webhook_delivery_logs" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid NOT NULL,
    event_type character varying(100) NOT NULL,
    payload jsonb NOT NULL,
    request_headers jsonb,
    response_status_code integer,
    response_headers jsonb,
    response_body text,
    duration_ms integer,
    success boolean NOT NULL,
    error_message text,
    attempt integer DEFAULT 1,
    next_retry_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "webhook_subscriptions" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    url text NOT NULL,
    secret text NOT NULL,
    events text[] NOT NULL,
    headers jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    retry_count integer DEFAULT 3,
    retry_interval_ms integer DEFAULT 5000,
    timeout_ms integer DEFAULT 10000,
    last_success_at timestamp without time zone,
    last_failure_at timestamp without time zone,
    last_failure_reason text,
    created_by text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);
ALTER TABLE ONLY "automation_logs"
    ADD CONSTRAINT automation_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY "automation_rules"
    ADD CONSTRAINT automation_rules_pkey PRIMARY KEY (id);
ALTER TABLE ONLY "leave_balances"
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);
ALTER TABLE ONLY "leave_requests"
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY "leave_types"
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);
ALTER TABLE ONLY "notifications"
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY "saved_searches"
    ADD CONSTRAINT saved_searches_pkey PRIMARY KEY (id);
ALTER TABLE ONLY "task_templates"
    ADD CONSTRAINT task_templates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY "time_correction_requests"
    ADD CONSTRAINT time_correction_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY "webhook_delivery_logs"
    ADD CONSTRAINT webhook_delivery_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY "webhook_subscriptions"
    ADD CONSTRAINT webhook_subscriptions_pkey PRIMARY KEY (id);
CREATE INDEX IF NOT EXISTS idx_auto_logs_entity ON "automation_logs" USING btree (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_auto_logs_org ON "automation_logs" USING btree (organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_auto_logs_rule ON "automation_logs" USING btree (rule_id, created_at);
CREATE INDEX IF NOT EXISTS idx_auto_logs_trigger ON "automation_logs" USING btree (trigger);
CREATE INDEX IF NOT EXISTS idx_auto_rules_enabled_org ON "automation_rules" USING btree (enabled, organization_id);
CREATE INDEX IF NOT EXISTS idx_auto_rules_org ON "automation_rules" USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_auto_rules_trigger_org ON "automation_rules" USING btree (trigger, organization_id);
CREATE INDEX IF NOT EXISTS idx_correction_reqs_entry ON "time_correction_requests" USING btree (time_entry_id);
CREATE INDEX IF NOT EXISTS idx_correction_reqs_org ON "time_correction_requests" USING btree (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_correction_reqs_reviewer ON "time_correction_requests" USING btree (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_correction_reqs_status ON "time_correction_requests" USING btree (status);
CREATE INDEX IF NOT EXISTS idx_correction_reqs_user ON "time_correction_requests" USING btree (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_leave_balances_org ON "leave_balances" USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_type ON "leave_balances" USING btree (leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_user ON "leave_balances" USING btree (user_id);
CREATE UNIQUE INDEX idx_leave_balances_user_year_type ON "leave_balances" USING btree (user_id, year, leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_reqs_dates ON "leave_requests" USING btree (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_reqs_org ON "leave_requests" USING btree (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_reqs_reviewer ON "leave_requests" USING btree (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_leave_reqs_status ON "leave_requests" USING btree (status);
CREATE INDEX IF NOT EXISTS idx_leave_reqs_user ON "leave_requests" USING btree (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_leave_types_org ON "leave_types" USING btree (organization_id);
CREATE UNIQUE INDEX idx_leave_types_org_slug ON "leave_types" USING btree (organization_id, slug);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON "notifications" USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON "notifications" USING btree (type);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON "notifications" USING btree (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON "notifications" USING btree (user_id, is_read, created_at);
CREATE UNIQUE INDEX idx_saved_searches_name_user ON "saved_searches" USING btree (name, user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON "saved_searches" USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_org ON "saved_searches" USING btree (user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_name ON "task_templates" USING btree (organization_id, name);
CREATE INDEX IF NOT EXISTS idx_task_templates_org ON "task_templates" USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event ON "webhook_delivery_logs" USING btree (event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_retry ON "webhook_delivery_logs" USING btree (next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_subscription ON "webhook_delivery_logs" USING btree (subscription_id, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_success ON "webhook_delivery_logs" USING btree (success);
CREATE INDEX IF NOT EXISTS idx_webhook_subs_active_org ON "webhook_subscriptions" USING btree (organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_subs_events ON "webhook_subscriptions" USING btree (events);
CREATE INDEX IF NOT EXISTS idx_webhook_subs_org ON "webhook_subscriptions" USING btree (organization_id);
ALTER TABLE ONLY "automation_logs"
    ADD CONSTRAINT automation_logs_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES "organizations"(id) ON DELETE CASCADE;
ALTER TABLE ONLY "automation_logs"
    ADD CONSTRAINT automation_logs_rule_id_automation_rules_id_fk FOREIGN KEY (rule_id) REFERENCES "automation_rules"(id) ON DELETE CASCADE;
ALTER TABLE ONLY "automation_logs"
    ADD CONSTRAINT automation_logs_triggered_by_user_id_users_id_fk FOREIGN KEY (triggered_by_user_id) REFERENCES "users"(id);
ALTER TABLE ONLY "automation_rules"
    ADD CONSTRAINT automation_rules_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES "users"(id);
ALTER TABLE ONLY "automation_rules"
    ADD CONSTRAINT automation_rules_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES "organizations"(id) ON DELETE CASCADE;
ALTER TABLE ONLY "automation_rules"
    ADD CONSTRAINT automation_rules_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES "users"(id);
ALTER TABLE ONLY "leave_balances"
    ADD CONSTRAINT leave_balances_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES "users"(id);
ALTER TABLE ONLY "leave_balances"
    ADD CONSTRAINT leave_balances_leave_type_id_leave_types_id_fk FOREIGN KEY (leave_type_id) REFERENCES "leave_types"(id) ON DELETE CASCADE;
ALTER TABLE ONLY "leave_balances"
    ADD CONSTRAINT leave_balances_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES "organizations"(id) ON DELETE CASCADE;
ALTER TABLE ONLY "leave_balances"
    ADD CONSTRAINT leave_balances_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES "users"(id);
ALTER TABLE ONLY "leave_balances"
    ADD CONSTRAINT leave_balances_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES "users"(id) ON DELETE CASCADE;
ALTER TABLE ONLY "leave_requests"
    ADD CONSTRAINT leave_requests_cancelled_by_users_id_fk FOREIGN KEY (cancelled_by) REFERENCES "users"(id);
ALTER TABLE ONLY "leave_requests"
    ADD CONSTRAINT leave_requests_leave_type_id_leave_types_id_fk FOREIGN KEY (leave_type_id) REFERENCES "leave_types"(id);
ALTER TABLE ONLY "leave_requests"
    ADD CONSTRAINT leave_requests_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES "organizations"(id) ON DELETE CASCADE;
ALTER TABLE ONLY "leave_requests"
    ADD CONSTRAINT leave_requests_reviewed_by_users_id_fk FOREIGN KEY (reviewed_by) REFERENCES "users"(id);
ALTER TABLE ONLY "leave_requests"
    ADD CONSTRAINT leave_requests_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES "users"(id) ON DELETE CASCADE;
ALTER TABLE ONLY "leave_types"
    ADD CONSTRAINT leave_types_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES "users"(id);
ALTER TABLE ONLY "leave_types"
    ADD CONSTRAINT leave_types_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES "organizations"(id) ON DELETE CASCADE;
ALTER TABLE ONLY "notifications"
    ADD CONSTRAINT notifications_actor_id_users_id_fk FOREIGN KEY (actor_id) REFERENCES "users"(id);
ALTER TABLE ONLY "notifications"
    ADD CONSTRAINT notifications_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES "organizations"(id);
ALTER TABLE ONLY "notifications"
    ADD CONSTRAINT notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES "users"(id) ON DELETE CASCADE;
ALTER TABLE ONLY "saved_searches"
    ADD CONSTRAINT saved_searches_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES "organizations"(id);
ALTER TABLE ONLY "saved_searches"
    ADD CONSTRAINT saved_searches_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES "users"(id) ON DELETE CASCADE;
ALTER TABLE ONLY "task_templates"
    ADD CONSTRAINT task_templates_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES "users"(id);
ALTER TABLE ONLY "task_templates"
    ADD CONSTRAINT task_templates_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES "organizations"(id);
ALTER TABLE ONLY "task_templates"
    ADD CONSTRAINT task_templates_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES "users"(id);
ALTER TABLE ONLY "time_correction_requests"
    ADD CONSTRAINT time_correction_requests_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES "organizations"(id);
ALTER TABLE ONLY "time_correction_requests"
    ADD CONSTRAINT time_correction_requests_reviewed_by_users_id_fk FOREIGN KEY (reviewed_by) REFERENCES "users"(id);
ALTER TABLE ONLY "time_correction_requests"
    ADD CONSTRAINT time_correction_requests_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES "tasks"(id) ON DELETE CASCADE;
ALTER TABLE ONLY "time_correction_requests"
    ADD CONSTRAINT time_correction_requests_time_entry_id_time_entries_id_fk FOREIGN KEY (time_entry_id) REFERENCES "time_entries"(id) ON DELETE CASCADE;
ALTER TABLE ONLY "time_correction_requests"
    ADD CONSTRAINT time_correction_requests_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES "users"(id);
ALTER TABLE ONLY "webhook_delivery_logs"
    ADD CONSTRAINT webhook_delivery_logs_subscription_id_webhook_subscriptions_id_ FOREIGN KEY (subscription_id) REFERENCES "webhook_subscriptions"(id) ON DELETE CASCADE;
ALTER TABLE ONLY "webhook_subscriptions"
    ADD CONSTRAINT webhook_subscriptions_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES "users"(id);
ALTER TABLE ONLY "webhook_subscriptions"
    ADD CONSTRAINT webhook_subscriptions_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES "organizations"(id) ON DELETE CASCADE;
