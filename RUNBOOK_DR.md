# Disaster Recovery Runbook — WorkManager

> **Version:** 1.0  
> **Date:** July 30, 2026  
> **Applies to:** Production deployment on Render.com / Docker

---

## Contact Information

| Role | Contact |
|------|---------|
| **On-call engineer** | PagerDuty / Slack #ops |
| **Database admin** | Via Render dashboard |
| **Security incident** | security@workmanager.com |

---

## Severity Definitions

| Severity | Response Time | Examples |
|----------|--------------|---------|
| **SEV1 — Critical** | Immediate (≤15 min) | Site down, data breach, data corruption |
| **SEV2 — High** | ≤1 hour | Feature degradation, slow responses, partial outage |
| **SEV3 — Medium** | ≤4 hours | Non-critical bug, cosmetic issue |
| **SEV4 — Low** | Next business day | Minor enhancement, documentation |

---

## Incident Response Steps (All Incidents)

1. **Identify** — Confirm the issue and severity
2. **Contain** — Stop the bleeding (rollback, disable feature, block IP)
3. **Diagnose** — Find root cause
4. **Fix** — Apply fix or workaround
5. **Verify** — Confirm service恢复正常
6. **Learn** — Post-mortem within 48 hours

---

## Scenario DR-1: Application Server Down

**Severity:** SEV1  
**Symptoms:** `GET /api/health` returns non-200, users see error page

### Diagnosis
```bash
# Check if container is running
docker ps | grep wm-web

# Check logs
docker logs wm-web --tail 100

# Check health endpoint
curl -f http://localhost:3000/api/health
```

### Recovery
1. **Restart the container:**
   ```bash
   docker compose -f docker-compose.prod.yml restart web
   ```
2. **If restart fails, check resources:**
   ```bash
   docker stats wm-web  # Memory/CPU limits
   docker logs wm-web --tail 200 | grep -i error
   ```
3. **Rollback to previous image:**
   ```bash
   docker compose -f docker-compose.prod.yml down web
   # Revert to previous image tag
   docker compose -f docker-compose.prod.yml up -d web
   ```
4. **On Render:** Trigger manual deploy from last known-good commit via Dashboard

### Prevention
- Health check with auto-restart (`restart: unless-stopped`)
- Sentry alerts on 5xx errors
- Monitor memory usage trends

---

## Scenario DR-2: Database Down / Corrupted

**Severity:** SEV1  
**Symptoms:** Health check returns 503 DB error, all data-dependent endpoints fail

### Diagnosis
```bash
# Check PostgreSQL container
docker logs wm-postgres --tail 50

# Direct database check
docker exec wm-postgres pg_isready -U wmuser -d workmanagement

# Check disk space
docker exec wm-postgres df -h /var/lib/postgresql/data
```

### Recovery
1. **Restart PostgreSQL:**
   ```bash
   docker compose -f docker-compose.prod.yml restart postgres
   ```
2. **If data corruption, restore from backup:**
   ```bash
   # Download latest backup
   aws s3 cp s3://workmanager-backups/prod/db/latest.sql.gz /tmp/
   gunzip /tmp/latest.sql.gz

   # Restore
   cat /tmp/latest.sql | docker exec -i wm-postgres psql -U wmuser -d workmanagement
   ```
3. **Point-in-time recovery (if WAL archiving enabled):**
   ```bash
   # Restore to specific timestamp
   # Requires WAL archive configured in postgresql.conf
   ```
4. **If no backup available:** Stand up new empty database and re-run migrations:
   ```bash
   docker compose -f docker-compose.prod.yml --profile migrate run migrate
   ```
   > ⚠️ Data loss is unavoidable without backups

### Prevention
- Automated daily backups (pg_dump to S3)
- WAL archiving for point-in-time recovery
- Database health checks every 10s

---

## Scenario DR-3: Redis Down

**Severity:** SEV3 (graceful degradation)  
**Symptoms:** Rate limiting disabled, health endpoint shows Redis as degraded

### Impact
- ✅ Application continues running
- ❌ Rate limiting fails open (all requests allowed)
- ✅ No data loss (Redis is ephemeral cache)

### Recovery
```bash
docker compose -f docker-compose.prod.yml restart redis
```

### Prevention
- Redis auto-restarts via `restart: unless-stopped`
- Monitor Redis memory with `docker stats wm-redis`

---

## Scenario DR-4: Security Breach / Compromised Credentials

**Severity:** SEV1  
**Symptoms:** Suspicious activity in audit logs, unauthorized access detected

### Immediate Response
1. **Identify the compromised account:**
   ```sql
   -- Check recent audit logs for suspicious actions
   SELECT * FROM audit_logs
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   ```
2. **Revoke all sessions for compromised user:**
   ```sql
   DELETE FROM sessions WHERE user_id = '<compromised-user-id>';
   ```
3. **Suspend the account:**
   ```bash
   # Via API
   curl -X PATCH https://app.workmanager.com/api/users/<id>/status \
     -H "Authorization: Bearer <admin-token>" \
     -H "Content-Type: application/json" \
     -d '{"action": "suspend"}'
   ```
4. **Rotate credentials:**
   - If `AUTH_SECRET` was leaked: Rotate immediately (invalidates all sessions)
   - If `ENCRYPTION_KEY` was leaked: Re-encrypt all webhook secrets
   - If `RESEND_API_KEY` was leaked: Rotate in Resend dashboard

### Forensics
1. **Review Sentry logs** for unusual error patterns
2. **Review audit logs** for the compromised timeframe
3. **Check webhook logs** for unexpected deliveries
4. **Check rate limit logs** for brute force patterns

### Recovery
- Force password reset for all users (admin API)
- Review all webhook URLs and secrets
- Enable additional logging if needed

---

## Scenario DR-5: Failed Deployment / Bad Code

**Severity:** SEV2  
**Symptoms:** New deployment causes errors, failed health checks, performance regression

### Immediate
1. **Revert to previous deployment:**
   - Render: Dashboard → Deploy → "Revert to previous deploy"
   - Docker: `docker compose -f docker-compose.prod.yml down web && docker compose -f docker-compose.prod.yml up -d web` (uses previous image)
2. **Or rollback in git:**
   ```bash
   git revert HEAD
   git push origin main
   ```

### Post-Recovery
- Identify the failing commit
- Add test coverage to prevent recurrence
- Verify CI pipeline caught the issue

---

## Scenario DR-6: Rate Limit Abuse / DDoS

**Severity:** SEV2  
**Symptoms:** High CPU/memory, slow responses, legitimate users rate-limited

### Diagnosis
```bash
# Check resource usage
docker stats

# Check logs for many 429 responses
docker logs wm-web --tail 100 | grep "429"
```

### Response
1. **Identify source IPs:**
   ```bash
   docker logs wm-web --tail 1000 | grep "429" | awk '{print $NF}' | sort | uniq -c | sort -nr
   ```
2. **Block offending IPs at load balancer/CDN level:**
   - Render: Use Web Application Firewall
   - Cloudflare: Create rate limit rule
3. **If Redis is overloaded:**
   - Increase Redis memory limit
   - Or temporarily disable rate limiting (already fail-open)
4. **Scale up if legitimate traffic:**
   - Render: Increase instance count in dashboard

### Prevention
- WAF/Cloudflare DDoS protection
- Monitoring alerts for traffic spikes

---

## Scenario DR-7: Data Exposure via Misconfigured S3/MinIO

**Severity:** SEV1  
**Symptoms:** Unauthorized file access, publicly accessible S3 buckets

### Immediate
1. **Lock down bucket:**
   ```bash
   # Block all public access
   aws s3api put-public-access-block \
     --bucket workmanagement-files \
     --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
   ```
2. **Rotate S3 credentials** (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`)
3. **Generate new presigned URLs** for all active attachments
4. **Audit bucket:**
   ```bash
   aws s3api get-bucket-acl --bucket workmanagement-files
   aws s3api get-bucket-policy --bucket workmanagement-files
   ```

### Prevention
- Bucket policy restricting to VPC/private network only
- Presigned URLs with short expiry (15 min default)
- Regular security audits of S3 bucket configurations

---

## Key Recovery Commands Cheat Sheet

```bash
# Restart a service
docker compose -f docker-compose.prod.yml restart <service>

# View logs
docker logs <container-name> --tail 100 [-f]

# Check health
curl http://localhost:3000/api/health

# Run migrations
docker compose -f docker-compose.prod.yml --profile migrate run migrate

# Re-seed database
docker compose exec web pnpm db:seed

# Rollback deployment (Render)
# Dashboard → Deploy → "Revert to previous deploy"

# Force restart (Render)
# Dashboard → Manual Deploy → "Clear build cache & deploy"
```
