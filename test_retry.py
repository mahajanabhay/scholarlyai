import requests
r = requests.post(
    "http://localhost:8000/study-session/retry-weak",
    headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidXNlcl8wMTE0ODAyY2RiYjciLCJlbWFpbCI6ImFiaGF5bWFoYWphMDk3QGdtYWlsLmNvbSIsImV4cCI6MTc4MjQ2MDAzNn0.A5Mt4vyQV9lmsgM-x-TjvkkZCGuf-eTv8_ZW4OFpvA8"},
    data={
        "subject": "Physics",
        "weak_topic_questions": '["Newtons laws"]',
        "num_questions": 3,
    },
)
print(r.status_code)
print(r.text)
