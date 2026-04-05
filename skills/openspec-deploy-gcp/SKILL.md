---
name: openspec-deploy-gcp
description: Deploy a verified change to GCP. Requires QA signoff (Ready for deployment: YES) in handoff.md before proceeding. Covers Cloud Run, Terraform, and post-deploy monitoring.
metadata: { "openclaw": { "emoji": "🚀" } }
---

# openspec-deploy-gcp

Deploy a QA-verified change to GCP safely. Always stages first, monitors health, then promotes to production.

## Prerequisites

```bash
npm list -g @fission-ai/openspec || npm install -g @fission-ai/openspec
```

`handoff.md` must contain: `Ready for deployment: YES`

## When to use

- QA signoff confirmed in `handoff.md`
- Deploying a new service, feature, or infrastructure change to GCP

## Do not use when

- Verification status in `handoff.md` is not `passed` — get QA signoff first

## Steps

### 1. Confirm prerequisites

```bash
cd <project-root>
openspec status --change "<change-id>" --json
```

Read `handoff.md` and confirm:

- `Verification status: passed`
- `Ready for deployment: YES`

**STOP** if either condition is not met.

### 2. Infrastructure changes (if any)

If `design.md` includes Terraform changes:

```bash
cd infra/
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

Review the plan for unexpected deletions, IAM changes, or cost impacts before applying.

### 3. Trigger CI/CD

```bash
git push origin main     # or merge the PR
```

Monitor: build → test → deploy-staging stages.

### 4. Staging verification

```bash
gcloud run services describe <service> --region=<region> \
  --format="value(status.conditions)"
gcloud logs read "resource.type=cloud_run_revision AND severity>=ERROR" --limit=20
curl -f https://<staging-url>/health
```

If staging shows errors — stop. Do not deploy to production. Fix and re-verify.

### 5. Production deployment

```bash
gcloud run services update-traffic <service> --to-latest --region=<region>
```

### 6. Post-deploy monitoring (15 minutes)

Watch error rate, latency (p50/p95/p99), and request volume:

```bash
gcloud logs read "resource.type=cloud_run_revision AND severity>=ERROR" \
  --freshness=15m --limit=50
```

### 7. Archive the change

After a successful deployment:

```bash
/opsx:archive
```

The CLI moves `openspec/changes/<change-id>/` to `openspec/changes/archive/`.

Then update `.ai/shared-memory/current-focus.md` — remove from active changes.

### Rollback (if something goes wrong)

```bash
# Cloud Run: instant traffic revert
gcloud run services update-traffic <service> \
  --to-revisions=<previous-revision>=100 --region=<region>

# Database: run down migration
npm run migrate:down
```

## Done when

- [ ] QA signoff confirmed before starting
- [ ] Terraform applied (if any)
- [ ] Staging healthy
- [ ] Production deployed and healthy
- [ ] 15-minute monitoring window passed clean
- [ ] `/opsx:archive` run
- [ ] `current-focus.md` updated

## Rules

| Rule                              | Why                                |
| --------------------------------- | ---------------------------------- |
| No deploy without QA signoff      | Prod is not a test environment     |
| Staging always before production  | Catch issues before users see them |
| Archive after successful deploy   | Keeps the changes list clean       |
| Document rollback plan in handoff | Every deploy must be reversible    |
