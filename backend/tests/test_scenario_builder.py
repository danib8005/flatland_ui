"""Tests for ScenarioBuilder (R7)."""
import warnings
warnings.filterwarnings("ignore")

import pytest
from flatland.core.env_observation_builder import DummyObservationBuilder
from flatland.envs.line_generators import sparse_line_generator
from flatland.envs.rail_env import RailEnv
from flatland.envs.rail_env_action import RailEnvActions
from flatland.envs.rail_generators import sparse_rail_generator

from app.core.scenario_builder import (
    Scenario, ScenarioBuilder, ScoringWeights,
    score_branch, tag_for_score,
)
from app.core.scenario_runner import BranchResult
from app.policies.deadlock_avoidance_policy import DeadLockAvoidancePolicy


def _make_env(num_agents: int = 2, seed: int = 42) -> RailEnv:
    e = RailEnv(
        width=25, height=25, number_of_agents=num_agents, random_seed=seed,
        rail_generator=sparse_rail_generator(max_num_cities=2, seed=seed),
        line_generator=sparse_line_generator(),
        obs_builder_object=DummyObservationBuilder(),
    )
    e.reset()
    return e


# ── scoring tests (no env needed) ─────────────────────────────────


def test_score_perfect_run():
    perfect = BranchResult(
        total_agents=3, success_count=3,
        kpis={"total_delay": 0, "num_blocked_events": 0,
              "num_swap_attempts": 0, "num_deadlock_cycles": 0},
    )
    assert score_branch(perfect) >= 0.7


def test_score_terrible_run():
    bad = BranchResult(
        total_agents=3, success_count=0,
        kpis={"total_delay": 200, "num_blocked_events": 10,
              "num_swap_attempts": 5, "num_deadlock_cycles": 1},
    )
    assert score_branch(bad) < 0.3


def test_score_partial_run_in_middle():
    partial = BranchResult(
        total_agents=2, success_count=1,
        kpis={"total_delay": 10, "num_blocked_events": 1,
              "num_swap_attempts": 0, "num_deadlock_cycles": 0},
    )
    s = score_branch(partial)
    assert -0.5 < s < 0.7


def test_tag_avoid_for_deadlocks():
    bad = BranchResult(
        total_agents=2, success_count=2,  # high success...
        kpis={"num_deadlock_cycles": 1},  # ...but deadlock present
    )
    tag = tag_for_score(0.9, bad)
    assert tag == "avoid", "deadlock should override high score"


def test_tag_recommended_only_at_high_score():
    good = BranchResult(total_agents=2, success_count=2, kpis={})
    assert tag_for_score(0.85, good) == "recommended"
    assert tag_for_score(0.50, good) is None
    assert tag_for_score(0.10, good) == "avoid"


# ── ScenarioBuilder smoke ─────────────────────────────────────────


def test_builder_generate_scenarios_shape():
    env = _make_env()
    builder = ScenarioBuilder(env, DeadLockAvoidancePolicy)
    scenarios = builder.generate_scenarios(handle=0, horizon=20)

    # baseline + 4 candidates
    assert len(scenarios) == 5
    names = {s.name for s in scenarios}
    assert "baseline" in names
    assert {"LEFT", "FORWARD", "RIGHT", "STOP"} <= names


def test_builder_returns_sorted_descending():
    env = _make_env()
    builder = ScenarioBuilder(env, DeadLockAvoidancePolicy)
    scenarios = builder.generate_scenarios(handle=0, horizon=300)
    scores = [s.score for s in scenarios]
    assert scores == sorted(scores, reverse=True)


def test_builder_at_most_one_recommended():
    env = _make_env()
    builder = ScenarioBuilder(env, DeadLockAvoidancePolicy)
    scenarios = builder.generate_scenarios(handle=0, horizon=300)
    n_rec = sum(1 for s in scenarios if s.tag == "recommended")
    assert n_rec <= 1


def test_builder_baseline_has_no_override():
    env = _make_env()
    builder = ScenarioBuilder(env, DeadLockAvoidancePolicy)
    scenarios = builder.generate_scenarios(handle=0, horizon=20)
    baseline = next(s for s in scenarios if s.name == "baseline")
    assert baseline.override_action is None


def test_builder_action_branches_have_int_override():
    env = _make_env()
    builder = ScenarioBuilder(env, DeadLockAvoidancePolicy)
    scenarios = builder.generate_scenarios(handle=0, horizon=20)
    for s in scenarios:
        if s.name == "baseline":
            continue
        assert isinstance(s.override_action, int), (
            f"{s.name}: override_action must be int, got {type(s.override_action)}"
        )


def test_builder_invalid_handle_raises():
    env = _make_env(num_agents=2)
    builder = ScenarioBuilder(env, DeadLockAvoidancePolicy)
    with pytest.raises(ValueError):
        builder.generate_scenarios(handle=99, horizon=10)


def test_builder_custom_candidates():
    env = _make_env()
    builder = ScenarioBuilder(env, DeadLockAvoidancePolicy)
    scenarios = builder.generate_scenarios(
        handle=0, horizon=15,
        candidate_actions=[RailEnvActions.MOVE_LEFT, RailEnvActions.MOVE_RIGHT],
    )
    # baseline + 2 = 3
    assert len(scenarios) == 3
    names = {s.name for s in scenarios}
    assert names == {"baseline", "LEFT", "RIGHT"}


def test_builder_custom_candidates_dedupe():
    """Duplicate candidates must be deduplicated."""
    env = _make_env()
    builder = ScenarioBuilder(env, DeadLockAvoidancePolicy)
    scenarios = builder.generate_scenarios(
        handle=0, horizon=15,
        candidate_actions=[RailEnvActions.MOVE_LEFT, 1, RailEnvActions.MOVE_LEFT],
    )
    # baseline + 1 (LEFT only, deduped)
    assert len(scenarios) == 2


def test_builder_does_not_modify_base_env():
    env = _make_env()
    elapsed_before = env._elapsed_steps
    pos_before = [a.position for a in env.agents]

    builder = ScenarioBuilder(env, DeadLockAvoidancePolicy)
    builder.generate_scenarios(handle=0, horizon=15)

    assert env._elapsed_steps == elapsed_before
    assert [a.position for a in env.agents] == pos_before


def test_builder_scenarios_serialise():
    """Each scenario must be JSON-friendly via to_dict."""
    env = _make_env()
    builder = ScenarioBuilder(env, DeadLockAvoidancePolicy)
    scenarios = builder.generate_scenarios(handle=0, horizon=15)
    for s in scenarios:
        d = s.to_dict()
        assert {"name", "override_action", "score", "tag", "result"} <= d.keys()
        # nested result must also be serialised
        assert "success_rate" in d["result"]
        assert "kpis" in d["result"]


def test_builder_with_diverse_outcomes():
    """The horizon=300 case is known to produce >=2 distinct scores."""
    env = _make_env()
    builder = ScenarioBuilder(env, DeadLockAvoidancePolicy)
    scenarios = builder.generate_scenarios(handle=0, horizon=300)
    distinct_scores = {round(s.score, 3) for s in scenarios}
    assert len(distinct_scores) >= 2, (
        f"expected diverse outcomes at horizon=300, got scores "
        f"{[round(s.score, 3) for s in scenarios]}"
    )
