# Deploying RateMyTown.sg (Fly.io)

This app runs as one small Express container plus three managed backing
services, all in Singapore (`sin`):

| Component      | Managed service        | Connection var       |
| -------------- | ---------------------- | -------------------- |
| Web (this app) | Fly Machines           | —                    |
| Database       | Fly Postgres           | `DATABASE_URL`       |
| Sessions/cache | Fly Redis (Upstash)    | `REDIS_URL`          |
| Photo storage  | Fly Tigris (S3-compat) | `AWS_*`/`BUCKET_NAME`|

Infra is code: [`fly.toml`](fly.toml) + [`Dockerfile`](Dockerfile) live in the
repo, so every change is a reviewable diff and deploys with one command.

---

## Who does what

**You (needs your identity / payment / registrar):**
1. Create a Fly account and add a card at <https://fly.io>.
2. Authenticate the CLI once: `fly auth login` (opens a browser).
   - Alternatively, create a deploy token (`fly tokens create deploy`) and export
     it as `FLY_API_TOKEN` — then Claude can run every step below unattended.
3. Add the two DNS records at your `ratemytown.sg` registrar (step 7).

**Claude can run everything else** once the CLI is authed in this environment:
provisioning, secrets, deploys, the DB bootstrap, logs, and rollbacks.

---

## First-time setup

Run these in order. Steps marked **(you)** need your account; the rest Claude
can run.

### 1. Install + auth the CLI
```bash
curl -L https://fly.io/install.sh | sh      # Claude can run this
fly auth login                              # (you) browser login
```

### 2. Create the app
```bash
fly apps create ratemytown                  # name must match fly.toml
```

### 3. Provision the database (Fly Postgres)
```bash
fly postgres create --name ratemytown-db --region sin \
  --vm-size shared-cpu-1x --volume-size 1 --initial-cluster-size 1
fly postgres attach ratemytown-db --app ratemytown   # sets DATABASE_URL secret
```

### 4. Provision Redis
```bash
fly redis create --name ratemytown-cache --region sin   # prints a rediss:// URL
fly secrets set --app ratemytown REDIS_URL="<the rediss:// URL from above>"
```

### 5. Provision object storage (Tigris)
```bash
fly storage create --app ratemytown         # sets AWS_* + BUCKET_NAME secrets
```
The app reads those standard names automatically (see [`src/config.js`](src/config.js)),
so nothing to map by hand.

### 6. Set app secrets
```bash
fly secrets set --app ratemytown \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  NRIC_HASH_SALT="$(openssl rand -hex 32)"
```
> `NRIC_HASH_SALT` is what makes stored NRIC hashes unlinkable (PRD §10). Set it
> **once and never change it** — rotating it detaches every existing resident
> from their reviews.

### 7. Deploy
```bash
fly deploy --app ratemytown
```
`/healthz` (no DB dependency) lets this first deploy pass before the schema
exists.

### 8. Bootstrap the database — **run once**
`src/db/init.js` applies `schema.sql`, which **DROPs and recreates every table**.
It is a one-time bootstrap, *never* a per-deploy step (that's why `fly.toml` has
no `release_command`).
```bash
fly ssh console --app ratemytown -C "node src/db/init.js"   # creates schema (destructive)
fly ssh console --app ratemytown -C "node src/db/seed.js"   # 19 town councils + demo reviews
```
> `seed.js` inserts the 19 town councils **and** demo reviews. For a real launch
> you probably want the councils without the fake reviews — ask Claude to add a
> councils-only seed before running this.

### 9. Custom domain (you + Claude)
```bash
fly certs add ratemytown.sg     --app ratemytown
fly certs add www.ratemytown.sg --app ratemytown
fly certs show ratemytown.sg    --app ratemytown   # prints the exact DNS records
```
**(you)** At your registrar, add the records `fly certs show` lists — typically:
- `A` / `AAAA` on the apex `ratemytown.sg` → the Fly IPs (`fly ips list`)
- `CNAME` on `www` → `ratemytown.fly.dev`

TLS certs issue automatically once DNS resolves (usually minutes).

---

## Day-to-day (Claude runs these)

```bash
fly deploy --app ratemytown            # ship the current branch
fly logs --app ratemytown              # tail logs
fly status --app ratemytown            # machines + health
fly releases --app ratemytown          # deploy history
fly deploy --image <previous-image>    # roll back to a prior release
fly secrets set --app ratemytown KEY=value   # add/rotate config
```

Cost knob: `min_machines_running` in `fly.toml` is `1` (always warm). Set it to
`0` to scale-to-zero between visitors and pay less, at the cost of a cold start
on the first request.
