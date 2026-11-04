# One container (R6): node builds web/, python serves API + built UI on :8000.
FROM node:22-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 MISSIONTWIN_DEMO_MODE=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY missiontwin/ missiontwin/
COPY data/ data/
COPY data_sources/ data_sources/
COPY cache/ cache/
COPY --from=web /web/dist web/dist
RUN useradd -r -u 10001 app && mkdir -p logs && chown -R app /app/logs
USER 10001
EXPOSE 8000
CMD ["uvicorn", "missiontwin.api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
