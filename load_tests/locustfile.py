from locust import HttpUser, task, between
import random

TEST_EMAIL    = "abhaymahaja097@gmail.com"
TEST_PASSWORD = "abhi2004"
TEST_TOKEN    = ""  # filled after login


class ClarixUser(HttpUser):
    wait_time = between(1, 3)
    token     = None
    user_id   = None

    def on_start(self):
        """Login once per simulated user."""
        r = self.client.post("/auth/login", data={
            "email":    TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        if r.status_code == 200:
            d = r.json()
            self.token   = d.get("token")
            self.user_id = d.get("user_id")
        else:
            self.token   = None
            self.user_id = None

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