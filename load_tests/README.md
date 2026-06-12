# Load Testing

## Setup
pip install locust

## Run (requires backend running)
locust -f load_tests/locustfile.py --host=http://localhost:8000

## Then open http://localhost:8089
## Recommended test: 50 users, 5 spawn rate, 2 minutes

## Pre-launch targets
- p95 response time < 500ms
- Error rate < 1%
- 50 concurrent users stable