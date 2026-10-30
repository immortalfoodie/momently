# Deploying Momently

Momently is a stateless Next.js server. Plans live in the browser, so the server needs no database. Any host that runs a Node 20+ server or a container works. These steps use Google Cloud Run.

## 1. One-time setup

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
```

## 2. Store the Gemini key in Secret Manager

The key is never put in the image, the repository, or a plain environment variable.

```bash
printf '%s' 'YOUR_GEMINI_API_KEY' | gcloud secrets create gemini-api-key --data-file=-
```

Give the Cloud Run runtime service account access:

```bash
PROJECT_NUMBER=$(gcloud projects describe "$(gcloud config get-value project)" --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 3. Build and deploy

From the repository root. Cloud Build uses the `Dockerfile`:

```bash
gcloud run deploy momently \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars LLM_PROVIDER=gemini,GEMINI_MODEL=gemini-2.5-flash,RATE_LIMIT_PER_MINUTE=20 \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --max-instances 2 \
  --memory 512Mi
```

- `--max-instances 2` caps cost if the public URL gets heavy traffic.
- `RATE_LIMIT_PER_MINUTE` applies per IP address, per instance.
- Pick a Gemini model that is currently available to your key and set it in `GEMINI_MODEL`.

## 4. Verify

```bash
URL=$(gcloud run services describe momently --region asia-south1 --format='value(status.url)')
curl -s "$URL/api/health"          # expect {"mode":"live","model":"..."}
curl -sI "$URL/" | grep -i content-security-policy
```

The header badge in the app should read **Live AI**. If the key is missing or invalid, the app keeps working in demo mode and the badge says **Demo mode**.

## Demo mode deployment (no key)

Omit `--set-secrets` and set `LLM_PROVIDER=mock`. Every feature works with the built-in offline engine.

## Running the container locally

```bash
docker build -t momently .
docker run --rm -p 8080:8080 -e LLM_PROVIDER=mock momently
```

Then open http://localhost:8080.

## How the image is built

| Stage | What it does |
|---|---|
| `deps` | `npm ci` from the lockfile only |
| `build` | `next build` with `NEXT_OUTPUT=standalone`, which enables Next.js standalone output |
| `runtime` | Copies only the traced server files and static assets, runs as a non-root user on port 8080 |

Standalone output is opt-in through `NEXT_OUTPUT` so that local builds on Windows do not need symlink permissions.
