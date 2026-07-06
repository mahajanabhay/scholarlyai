FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

# Install torch CPU-only first to avoid 2GB CUDA download
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x start.sh

EXPOSE 8000

CMD ["./start.sh"]