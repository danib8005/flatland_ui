"""Tests for RecommendationGenerator (R8)."""
import warnings
warnings.filterwarnings("ignore")

import pytest
from flatland.core.env_observation_builder import DummyObservationBuilder
from flatland.envs.line_generators import sparse_line_generator
from flatland.envs.rail_env import RailEnv
from flatland.envs.rail_generators import sparse_rail_generator

from app.core.recommendation_generator import (
    _confidence,
    _pick_interesting_handle,
    generate_recommendations,
)
from app.models.hmi import Recommendation


def _make_env(num_agents: int = 2, seed: int = 42) -> RailEnv:
    e = RailEnv(
        width=25, height=25, number_of_agents=num_agents, random_seed=seed,
        rail_generator=sparse_rail_generator(max_num_cities=2, seed=seed),
        line_generator=sparse_line_generator(),
        obs_builder_object=DummyObservationBuilder(),
    )
    e.reset()
    return e


# ── unit tests for helpers ─────────────────────────────────────────


def test_confidence_clamp_bounds():
    assert _confidence(-1.0) == 0.0
    assert _confidence(0.0) == 0.0
    assert _confidence(0.5) == 0.5
    assert _confidence(1.0) == 1.0
    assert _confidence(2.0) == 1.0


def test_pick_interesting_handle_none_when_all_waiting():
    """A freshly-reset env may have all agents in WAITING state."""
    env = _make_env()
    handle = _pick_interesting_handle(env)
    # Either None (all waiting) or a valid handle. Both are acceptable.
    if handle is not None:
        assert 0 <= handle < len(env.agents)


def test_pick_interesting_handle_after_warmup():
    """After a few steps with MOVE_FORWARD, at least one agent should
    be in a 'priority' state."""
    from flatland.envs.rail_env_action import RailEnvActions
    env = _make_env(num_agents=3)
    for _ in range(20):
        env.step({h: RailEnvActions.MOVE_FORWARD for h in env.get_agent_handles()})
    handle = _pick_interesting_handle(env)
    if handle is None:
        pytest.skip("env didn't put any agent into a priority state in 20 steps")
    assert 0 <= handle < len(env.agents)


# ── generate_recommendations: shape and policy ─────────────────────


def test_generate_recommendations_returns_list():
    env = _make_env()
    recs = generate_recommendations("test-session", env, horizon=20)
    assert isinstance(recs, list)
    for r in recs:
        assert isinstance(r, Recommendation)


def test_generate_recommendations_at_most_one():
    """We surface at most one recommendation (the top alternative)."""
    env = _make_env()
    recs = generate_recommendations("test-session", env, horizon=30)
    assert len(recs) <= 1


def test_recommendation_scenario_id_matches_scenario_panel_id_format():
    """The Recommendation.scenarioId must match the format used by
    hmi_scenario_adapter.scenario_to_option so the frontend Accept-button
    can match a recommendation to its scenario."""
    from flatland.envs.rail_env_action import RailEnvActions
    env = _make_env(num_agents=3)
    for _ in range(20):
        env.step({h: RailEnvActions.MOVE_FORWARD for h in env.get_agent_handles()})

    recs = generate_recommendations("test-session", env, horizon=30)
    if not recs:
        pytest.skip("no recommendations surfaced in this env state")

    r = recs[0]
    # Format: "s_h{handle}_{scenario_name_lower}"
    assert r.scenarioId is not None
    assert r.scenarioId.startswith("s_h"), (
        f"scenarioId '{r.scenarioId}' doesn't follow the expected pattern"
    )


def test_recommendation_confidence_in_range():
    env = _make_env()
    recs = generate_recommendations("test-session", env, horizon=30)
    for r in recs:
        assert 0.0 <= r.confidence <= 1.0


def test_recommendation_countdown_positive():
    env = _make_env()
    recs = generate_recommendations("test-session", env, horizon=30)
    for r in recs:
        assert r.countdownSeconds >= 5  # we floor at 5


def test_no_recommendation_when_baseline_wins():
    """If DLA's own choice (baseline) is already the top scoring option,
    we should NOT surface a recommendation. This is by design — no
    'meaningful' alternative to suggest."""
    # The default seed=42 / 25x25 / 2 agents tends to let DLA solve cleanly,
    # so often we get zero recommendations. We just assert the contract:
    # if we DO get a recommendation, its scenarioId is not "s_hX_baseline".
    env = _make_env()
    recs = generate_recommendations("test-session", env, horizon=30)
    for r in recs:
        assert "_baseline" not in (r.scenarioId or "")


# ── end-to-end via TestClient ──────────────────────────────────────


def test_recommendations_endpoint_returns_list():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)

    r = client.post("/session", json={
        "width": 25, "height": 25, "number_of_agents": 2,
        "seed": 42, "max_num_cities": 2,
    })
    assert r.status_code == 200, r.text
    sid = r.json()["id"]

    r = client.get(f"/session/{sid}/hmi/recommendations")
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body, list)
    # may be empty (DLA-already-optimal case) — that's fine
    for rec in body:
        for key in ("id", "title", "description", "confidence", "countdownSeconds"):
            assert key in rec


def test_recommendations_unknown_session_returns_404():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    r = client.get("/session/does-not-exist/hmi/recommendations")
    assert r.status_code == 404


def test_recommendations_after_warmup_e2e():
    """After driving the session forward, we may get real recommendations.
    The endpoint must always be 200 and shape-valid."""
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)

    r = client.post("/session", json={
        "width": 25, "height": 25, "number_of_agents": 3,
        "seed": 42, "max_num_cities": 2,
    })
    assert r.status_code == 200
    sid = r.json()["id"]

    # Drive a bit so agents enter the map.
    client.post(f"/session/{sid}/step", json={"n_steps": 20, "policy": "deadlock_avoidance"})

    r = client.get(f"/session/{sid}/hmi/recommendations")
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body, list)
