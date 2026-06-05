from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["name"] == "Flatland Dispatcher API"


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_create_session():
    r = client.post("/session", json={"width": 30, "height": 30, "number_of_agents": 2})
    assert r.status_code == 200
    data = r.json()
    assert "id" in data
    assert data["num_agents"] == 2


def test_step_session():
    r = client.post("/session", json={"width": 30, "height": 30, "number_of_agents": 2})
    sid = r.json()["id"]
    r2 = client.post(f"/session/{sid}/step", json={"policy": "random", "n_steps": 5})
    assert r2.status_code == 200
    assert r2.json()["elapsed_steps"] >= 1
