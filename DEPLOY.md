# Deployment Guide

## Prerequisites

- Node.js 18+
- Playwright Chromium browser installed

## Local Production

```bash
npm run build
npm start
```

App runs at `http://localhost:3000`.

## Docker

```dockerfile
FROM node:20-slim

RUN npx playwright install --with-deps chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t explainit .
docker run -p 3000:3000 -v $(pwd)/exports:/app/exports explainit
```

## Cloud Deployment

### Vercel
Not recommended — Playwright requires server-side execution with Chromium.

### Railway / Render / Fly.io
Recommended. These support custom Docker images with Chromium.

```bash
# Railway
railway init
railway up

# Fly.io
fly launch
fly deploy
```

### AWS / GCP
Use a container-based deployment (ECS, Cloud Run) with the Docker image above.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| NODE_ENV | production | Environment |

## Output Directory

All exports are written to `./exports/`. Mount this as a volume in Docker to persist outputs.
