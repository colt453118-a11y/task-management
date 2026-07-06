# Deployment Architecture — Enterprise Work Management Platform

## Deployment Philosophy

- **Container-first** — Docker for reproducible environments everywhere
- **Environment parity** — Dev, staging, and production as similar as possible
- **Immutable deployments** — No SSH into servers. Build → Tag → Deploy
- **Automated CI/CD** — Every commit goes through quality gates before reaching production

---

## Local Development Environment

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: workmanagement
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpassword
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  minio:
    image: minio/minio
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    command: server /data --console-address ":9001"
    volumes:
      - miniodata:/data

  meilisearch:
    image: getmeili/meilisearch:v1.12
    environment:
      MEILI_MASTER_KEY: dev-master-key
    ports:
      - "7700:7700"

  mailpit:                          # Email testing (catches all outgoing emails)
    image: axllent/mailpit
    ports:
      - "1025:1025"
      - "8025:8025"                 # Web UI

volumes:
  pgdata:
  miniodata:
```

### Development Workflow
```bash
# Start infrastructure
docker compose up -d

# Install dependencies
pnpm install

# Run migrations
pnpm db:migrate

# Seed development data
pnpm db:seed

# Start dev server
pnpm dev              # → http://localhost:3000

# Start queue workers (separate terminal)
pnpm dev:workers      # → BullMQ workers

# View queues
pnpm dev:queues       # → http://localhost:3000/queues (Bull Board)
```

---

## CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      
      - run: pnpm install --frozen-lockfile
      
      # Quality Gates (parallel)
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm format:check
      - run: pnpm audit --audit-level=high
      
      # Unit & Integration Tests
      - run: pnpm test -- --coverage
      
      # Build
      - run: pnpm build

  e2e:
    needs: quality
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_DB: testdb
          POSTGRES_PASSWORD: testpass
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:migrate
      - run: pnpm db:seed
      - run: pnpm test:e2e
      
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/web/playwright-report/

  deploy:
    needs: e2e
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build & Push Docker Image
        run: |
          docker build -t ${{ secrets.REGISTRY }}/workmanagement:${{ github.sha }} .
          docker push ${{ secrets.REGISTRY }}/workmanagement:${{ github.sha }}
      
      - name: Deploy to Production
        run: |
          # Trigger deployment via webhook or SSH command
          curl -X POST ${{ secrets.DEPLOY_WEBHOOK }} \
            -H "Authorization: Bearer ${{ secrets.DEPLOY_TOKEN }}" \
            -d '{"image": "workmanagement:${{ github.sha }}"}'
```

---

## Production Dockerfile

```dockerfile
# Dockerfile — Multi-stage build
FROM node:22-alpine AS dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/*/package.json ./packages/
RUN pnpm install --frozen-lockfile --prod

FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:22-alpine AS production
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Create non-root user
RUN addgroup --system app && adduser --system --ingroup app app

COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/next.config.ts ./apps/web/
COPY --from=build /app/apps/web/package.json ./apps/web/
COPY --from=build /app/packages ./packages
COPY --from=dependencies /app/node_modules ./node_modules

USER app
EXPOSE 3000

CMD ["pnpm", "--filter", "web", "start"]
```

---

## Production Infrastructure (AWS)

```hcl
# Terraform-style infrastructure (conceptual)
resource "aws_ecs_cluster" "workmanagement" {
  name = "workmanagement-production"
}

resource "aws_ecs_service" "app" {
  name    = "app"
  cluster = aws_ecs_cluster.workmanagement.id
  
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 3                    # Minimum 3 for HA
  launch_type     = "FARGATE"
  
  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.app.id]
  }
  
  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_port   = 3000
  }
}

# Auto-scaling based on CPU/memory
resource "aws_appautoscaling_target" "app" {
  service_namespace  = "ecs"
  resource_id        = "service/workmanagement-production/app"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = 3
  max_capacity       = 20
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.app.resource_id
  
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70
  }
}
```

---

## Environment Configuration

```bash
# .env.production
NODE_ENV=production

# Database
DATABASE_URL="postgres://user:pass@prod-db.internal:5432/workmanagement?sslmode=require"
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20
DATABASE_POOL_IDLE_TIMEOUT=30000

# Redis
REDIS_URL="redis://:password@prod-redis.internal:6379"
REDIS_PREFIX="wm:prod:"

# Auth
AUTH_SECRET="${AUTH_SECRET}"           # Managed in Secrets Manager
AUTH_URL="https://app.workmanagement.com"

# Storage
STORAGE_PROVIDER="s3"
S3_ENDPOINT="https://s3.us-east-1.amazonaws.com"
S3_REGION="us-east-1"
S3_BUCKET="workmanagement-prod-files"

# Queue
QUEUE_CONFIG='{"concurrency": 10, "maxRetries": 3}'

# Search
MEILISEARCH_HOST="http://meilisearch.internal:7700"
MEILISEARCH_API_KEY="${MEILISEARCH_API_KEY}"

# Monitoring
SENTRY_DSN="${SENTRY_DSN}"
SENTRY_ENVIRONMENT="production"
OTEL_EXPORTER_OTLP_ENDPOINT="http://otel-collector.internal:4318"

# AI
OPENAI_API_KEY="${OPENAI_API_KEY}"

# Email
EMAIL_PROVIDER="resend"
RESEND_API_KEY="${RESEND_API_KEY}"
```

---

## Monitoring & Observability Stack

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Application  │────▶│ OpenTelemetry│────▶│ Grafana     │
│ (Pino logs)  │     │ Collector    │     │ Dashboards  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Sentry      │
                    │ (Errors,    │
                    │ Performance)│
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ PagerDuty   │
                    │ (Alerts)    │
                    └─────────────┘
```

### Health Checks
```typescript
// /api/health endpoint
{
  "status": "healthy",
  "version": "1.0.0",
  "checks": {
    "database": { "status": "healthy", "latency": "2ms", "pool": "12/20" },
    "redis": { "status": "healthy", "latency": "1ms" },
    "queue": { "status": "healthy", "waiting": 15, "active": 3 },
    "search": { "status": "healthy" },
    "storage": { "status": "healthy" },
    "disk": { "status": "healthy", "usedPercent": 45 }
  },
  "uptime": "72h15m32s"
}
```

---

## Scaling Strategy

| Stage | Users | Tasks | Infrastructure |
|-------|-------|-------|---------------|
| **Phase 1** | 1,000 | 100K | Single Fargate task + RDS db.r6g.large + ElastiCache |
| **Phase 2** | 10,000 | 1M | 3-5 Fargate tasks + RDS db.r6g.xlarge + read replicas + ElastiCache cluster |
| **Phase 3** | 100,000 | 10M+ | ECS with auto-scaling + RDS Aurora + multiple read replicas + ElastiCache + OpenSearch |

---

## Disaster Recovery

```yaml
# Recovery Plan
database:
  backup_frequency: Every 6 hours
  retention: 30 days
  pitr: Point-in-time recovery (up to last 5 minutes)
  rpo: 5 minutes
  rto: 1 hour

application:
  strategy: Blue-green deployment
  rollback_time: < 5 minutes
  zero_downtime_deployments: true

files:
  strategy: S3 cross-region replication
  rpo: 15 minutes
  rto: 30 minutes

playbook:
  - Detect failure (Sentry alert / health check failure)
  - Assess severity (single instance vs. regional)
  - If single instance: ECS auto-restart
  - If database: Promote read replica / restore from backup
  - If regional: Route traffic to secondary region
  - Post-mortem within 24 hours
```
