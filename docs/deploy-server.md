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
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

`DATABASE_URL` must use host `postgres`, not `localhost`, because the app connects to the Compose service name inside Docker.

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

## 7. Database Backup

Create a backup directory:

```bash
mkdir -p backups
```

Backup:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres pg_dump -U animatch -d animatch > backups/animatch-$(date +%Y%m%d-%H%M%S).sql
```

## 8. Database Restore

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

## 9. Important Warning

Do not run this command unless you are intentionally deleting the production database:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down -v
```

The `-v` flag removes the named PostgreSQL volume and deletes database data.
