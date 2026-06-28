from locust import HttpUser, task, between, StopUser
import random
import json

import os
TEST_EMAIL_TEMPLATE = os.getenv("LOCUST_TEST_EMAIL_TEMPLATE", "loadtest+{}@example.com")
TEST_PASSWORD       = os.getenv("LOCUST_TEST_PASSWORD", "changeme")
TEST_TOKEN    = ""  # filled after login

import itertools
_user_counter = itertools.count(1)

class ClarixUser(HttpUser):
    def on_start(self):
        uid = next(_user_counter)
        email = TEST_EMAIL_TEMPLATE.format(uid)
        # Try login first, register if not found
        r = self.client.post("/auth/login", data={"email": email, "password": TEST_PASSWORD})
        if r.status_code != 200:
            self.client.post("/auth/register", data={"email": email, "name": f"LoadUser{uid}", "password": TEST_PASSWORD})
            r = self.client.post("/auth/login", data={"email": email, "password": TEST_PASSWORD})
        if r.status_code == 200:
            d = r.json()
            self.token   = d.get("token")
            self.user_id = d.get("user_id")
        else:
            self.token   = None
            self.user_id = None
            # Stop this user entirely — no point running tasks without auth
            raise StopUser()

    def auth_headers(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task(3)
    def health_check(self):
        self.client.get("/health")

    @task(5)
    def get_profile(self):
        if self.user_id:
            self.client.get(f"/profile/{self.user_id}", headers=self.auth_headers())

    @task(5)
    def get_xp(self):
        if self.user_id:
            self.client.get(f"/xp/{self.user_id}", headers=self.auth_headers())

    @task(3)
    def get_weaknesses(self):
        if self.user_id:
            self.client.get(f"/weaknesses/{self.user_id}", headers=self.auth_headers())

    @task(3)
    def get_planner(self):
        if self.user_id:
            self.client.get(f"/planner/{self.user_id}", headers=self.auth_headers())

    @task(2)
    def get_notifications(self):
        if self.user_id:
            self.client.get(f"/notifications/{self.user_id}", headers=self.auth_headers())

    @task(1)
    def get_sessions(self):
        self.client.get("/chat/sessions", headers=self.auth_headers())

    @task(2)
    def chat_message(self):
        if not self.user_id:
            return
        session_id = f"loadtest_{self.user_id}"
        with self.client.post(
            "/chat",
            data={
                "message": "Explain Newton's second law of motion briefly.",
                "session_id": session_id,
                "mode": "LEARN",
            },
            headers=self.auth_headers(),
            catch_response=True,
            stream=True,
        ) as r:
            if r.status_code != 200:
                r.failure(f"chat failed: {r.status_code}")

    @task(1)
    def quiz_generate(self):
        if not self.user_id:
            return
        subjects = ["Physics", "Mathematics", "Biology", "Chemistry"]
        session_id = f"loadtest_{self.user_id}_{random.randint(1,99999)}"
        with self.client.post(
            "/quiz",
            data={
                "message": random.choice(subjects),
                "session_id": session_id,
                "mode": "QUIZ",
                "quiz_type": "single",
                "question_number": 1,
                "is_starting": "true",
                "last_was_wrong": "false",
                "user_id": self.user_id,
            },
            headers=self.auth_headers(),
            catch_response=True,
        ) as r:
            if r.status_code != 200:
                r.failure(f"quiz failed: {r.status_code}")

    @task(1)
    def study_session_retry_weak(self):
        if not self.user_id:
            return
        with self.client.post(
            "/study-session/retry-weak",
            data={
                "subject": "Physics",
                "weak_topic_questions": json.dumps(["Newtons laws", "Momentum"]),
                "num_questions": 3,
            },
            headers=self.auth_headers(),
            catch_response=True,
        ) as r:
            if r.status_code != 200:
                r.failure(f"retry_weak failed: {r.status_code}")