# ---------- Stage 1: build the frontend ----------
FROM node:22-bookworm-slim AS frontend

WORKDIR /build/web

# Copy lockfiles first so npm ci is cached unless deps change
COPY web/package*.json ./
RUN npm ci

COPY web/ ./
RUN npm run typecheck && npm run build


# ---------- Stage 2: Python runtime ----------
FROM python:3.13-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Non-root user: UDS / hardened clusters commonly reject root containers
RUN groupadd --gid 1000 app && useradd --uid 1000 --gid 1000 --create-home app

COPY requirements.txt requirements-demo.txt ./
RUN pip install -r requirements-demo.txt

COPY --chown=1000:1000 . .
COPY --chown=1000:1000 --from=frontend /build/web/dist ./web/dist

USER 1000

EXPOSE 8000

# launcher must bind 0.0.0.0, not 127.0.0.1
CMD ["python", "-m", "missiontwin.demo", "--no-build"]