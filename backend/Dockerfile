# WAAEM backend — FastAPI + async SQLAlchemy
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1

WORKDIR /app

# System libs: document extraction (libgl/glib) + OCR (tesseract, Arabic+English).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libgl1 tesseract-ocr tesseract-ocr-ara tesseract-ocr-eng \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

EXPOSE 8000

# Run migrations, then serve.
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
