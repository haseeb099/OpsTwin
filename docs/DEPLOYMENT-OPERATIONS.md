# Deployment & Operations
# OpsTwin — Runbook

| Version | 1.0 · 2026-05-27 |

---

## 1. Local development

```bash
git clone https://github.com/haseeb099/OpsTwin.git
cd OpsTwin
npm install
cp .env.example .env.local
npm run db:push
npm run dev
```

Open: `http://localhost:3000`

### Environment variables (local)

| Variable | Example | Required |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | Yes |

---

## 2. Database operations

| Command | Purpose |
|---|---|
| `npm run db:push` | Sync schema to database |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:seed` | Seed sample data |
| `npm run db:studio` | Open Prisma Studio GUI |

### SQLite → Postgres migration

1. Change `provider = "postgresql"` in `prisma/schema.prisma`
2. Set `DATABASE_URL` to Postgres connection string
3. Run `npm run db:push`

---

## 3. Vercel deployment

```bash
npm i -g vercel
vercel
```

### Production environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection (e.g. [Neon](https://neon.tech)) |
| `NEXTAUTH_SECRET` | Random secret for session signing |

### Build command

Default: `npm run build` (runs `prisma generate && next build`)

---

## 4. Docker deployment

```bash
docker-compose up --build
```

See `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`.

---

## 5. Target repo setup (CLI)

```bash
# From OpsTwin project
node opstwin-init.js /path/to/target-repo

# In target repo
cd /path/to/target-repo
export OPSTWIN_URL=http://localhost:3000
export OPSTWIN_TASK_ID=<task-id-from-dashboard>
node opstwin-cli.js watch
```

**Windows PowerShell:**

```powershell
$env:OPSTWIN_URL="http://localhost:3000"
$env:OPSTWIN_TASK_ID="<task-id>"
node opstwin-cli.js watch
```

---

## 6. Monitoring

### Phase 0 (manual)

| Check | How |
|---|---|
| Server running | `curl http://localhost:3000` |
| API health | GET `/api/tasks` returns 200 |
| CLI connected | Watch logs show upload success |
| DB accessible | `npm run db:studio` |

### Phase 1 (planned)

- GET `/api/health`
- Structured error logging
- Vercel analytics

---

## 7. Backup & recovery

| Asset | Backup method |
|---|---|
| SQLite dev.db | Copy file |
| Postgres production | Neon automatic backups |
| Audit JSON in repo | Git commit `.ops/runs/` on feature branches |

### Recovery

1. Restore database from backup
2. Re-run `npm run db:push` if schema changed
3. Re-deploy application

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Upload fails 404 | Wrong taskId | Create task in dashboard; set OPSTWIN_TASK_ID |
| Run stuck `running` | Agent didn't write audit JSON | Manual upload or re-run agent |
| Prisma error on start | Schema out of sync | `npm run db:push` |
| CLI watch silent | Wrong directory | Run from repo with `.ops/runs/` |
| Build fails on Vercel | Missing DATABASE_URL | Set env in Vercel dashboard |

---

## 9. Release checklist

- [ ] `npm run typecheck` passes
- [ ] `node test-opstwin.js` passes
- [ ] Environment variables documented
- [ ] Security checklist ([SECURITY.md](./SECURITY.md))
- [ ] Acceptance criteria ([ACCEPTANCE-CRITERIA.md](./ACCEPTANCE-CRITERIA.md))
- [ ] README and docs updated

---

## 10. References

- [README.md](../README.md)
- [SECURITY.md](./SECURITY.md)
- [API-SPECIFICATION.md](./API-SPECIFICATION.md)
