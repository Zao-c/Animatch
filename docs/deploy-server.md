# Server Deployment

This guide deploys AniMatch on one rented Linux server with Docker Compose. The Compose stack runs the Next.js app and a private PostgreSQL container.

## 1. Install Docker and Git

On Ubuntu:

```bash
sudo apt update
sudo apt install -y git ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Log out and back in after adding your user to the `docker` group.

## 2. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPO_URL> animatch
cd animatch
```

## 3. Create Production Environment File

```bash
cp .env.production.example .env.production
```

Edit `.env.production`:

```bash
nano .env.production
```

Change:

- `POSTGRES_PASSWORD`
- `DATABASE_URL` password segment
- `FRIEND_INVITE_CODE` for the friend invite code
- `AUTH_SECRET` for signing Friend Auth cookies
- `AUTH_COOKIE_SECURE=false` for the current bare HTTP deployment. Set it to `true` when the site is served over HTTPS.

`DATABASE_URL` must use host `postgres`, not `localhost`, because the app connects to the Compose service name inside Docker.

Generate a production `AUTH_SECRET` with:

```bash
openssl rand -base64 32
```

### Optional: Tencent COS cover cache

COS is optional. When it is configured, AniMatch copies covers for works that
actually enter a pool to COS in the background. Browsers then request the COS
or CDN URL directly; the application server is not used as an image relay.

Add these values to `.env.production` and keep the two secret values on the
server only:

```dotenv
COS_SECRET_ID=
COS_SECRET_KEY=
COS_BUCKET=example-1234567890
COS_REGION=ap-shanghai
COS_PUBLIC_BASE_URL=https://example-1234567890.cos.ap-shanghai.myqcloud.com
NEXT_PUBLIC_COS_PUBLIC_BASE_URL=https://img.example.com
NEXT_PUBLIC_DIRECT_IMAGE_HOSTS=img.example.com,example-1234567890.cos.ap-shanghai.myqcloud.com
COS_COVER_PREFIX=animatch/covers
COS_OBJECT_ACL=public-read
```

Use `NEXT_PUBLIC_COS_PUBLIC_BASE_URL` only after it is publicly reachable from
the browser. It may be the standard COS public URL or a custom CDN domain. If
you use a custom domain, include both the custom domain and the COS origin in
`NEXT_PUBLIC_DIRECT_IMAGE_HOSTS` while migrating existing covers.

Configure the COS bucket or CDN as follows:

- Allow anonymous `GET` and `HEAD` for the cached cover prefix, or configure
  equivalent public CDN delivery. Do not expose write credentials in the
  browser.
- Add a CORS rule for the AniMatch site origin. Allow `GET` and `HEAD`; allow
  the `Content-Type` request header; expose no sensitive headers. For a bare
  IP deployment, the origin must include the port, for example
  `http://182.61.136.105:3000`.
- Restrict direct image hosts to domains you own through
  `NEXT_PUBLIC_DIRECT_IMAGE_HOSTS`. Other remote cover hosts continue through
  `/api/image-proxy` and its allow-list.

After deployment, open a pool in a fresh browser profile. A cached cover URL
should load from the configured COS/CDN host in the network panel. A missing or
blocked COS configuration falls back to the remote cover path and is retried on
a later pool visit; it must not block the page or the match queue.

`NEXT_PUBLIC_COS_PUBLIC_BASE_URL` and `NEXT_PUBLIC_DIRECT_IMAGE_HOSTS` are
embedded while the Next.js image is built. Changing either value requires an
`up -d --build` deployment, not only a container restart. To backfill covers
already referenced by pools, run this in the app container after the COS
configuration is live:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec app pnpm covers:cache-cos
```

Run the command again until its first JSON summary reports
`usedPendingAnimeCount: 0` and `usedStaleAnimeCount: 0`. If it reports upload
failures or a full queue, keep serving the existing fallback URLs and inspect
the app logs before retrying:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --since=30m app | grep "COS cover cache"
```

## 4. First Deployment

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

The app container runs:

```bash
pnpm prisma migrate deploy
pnpm start
```

PostgreSQL is not exposed to the public internet. Only the app maps port `3000`.

The app health check calls `/api/health`, which also verifies a lightweight
database query. Check both container health and the endpoint after every
deployment:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:3000/api/health
```

`healthy` means the app process and database query are both available. Docker
does not automatically restart an `unhealthy` container, so use an external
uptime check or server monitor to alert on a failed health endpoint.

## 5. View Logs

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f postgres
```

## 6. Update Deployment

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## 7. Domain and HTTPS

The initial IP-only deployment may use HTTP with `AUTH_COOKIE_SECURE=false`.
Before inviting public users through a domain, put Caddy or Nginx in front of
the app, issue a TLS certificate, set `AUTH_COOKIE_SECURE=true`, and rebuild:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Use the HTTPS site origin in the COS/CDN CORS rule. Once the reverse proxy is
ready, bind the app port only to the local host and let the proxy expose ports
80 and 443. This keeps the application port out of the public network.

## 8. Database Backup

Create a backup directory:

```bash
mkdir -p backups
```

Backup:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres pg_dump -U animatch -d animatch > backups/animatch-$(date +%Y%m%d-%H%M%S).sql
```

## 9. Database Restore

Stop the app before restore:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml stop app
```

Restore:

```bash
cat backups/animatch.sql | docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres psql -U animatch -d animatch
```

Start the app:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d app
```

## 10. Important Warning

Do not run this command unless you are intentionally deleting the production database:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down -v
```

The `-v` flag removes the named PostgreSQL volume and deletes database data.
