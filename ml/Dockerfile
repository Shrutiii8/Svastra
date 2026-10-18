FROM python:3.10-slim

WORKDIR /app

COPY ml/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY ml ./ml

ENV PORT=8001
EXPOSE 8001

CMD ["sh", "-c", "uvicorn ml.serve.api:app --host 0.0.0.0 --port ${PORT:-8001}"]
