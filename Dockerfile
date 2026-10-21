FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py ./
COPY static/ ./static/
RUN mkdir -p /app/data
ENV PORT=8000 DATA_DIR=/app/data PYTHONDONTWRITEBYTECODE=1
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
