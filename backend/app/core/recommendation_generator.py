"""RecommendationGenerator — turns the top-scoring ScenarioBuilder option
into an actionable Recommendation for the operator.

Logic
-----
1. Pick an "interesting" agent (same heuristic as scenarios endpoint).
2. Run ScenarioBuilder.generate_scenarios for that agent.
3. If the top-scoring scenario is the *baseline* (default policy), do not
   surface a recommendation — DLA is already doing the right thing.
4. If the top scenario has tag == "recommended", emit a Recommendation
   whose `scenarioId` matches the corresponding `ScenarioOption.id` so
   the frontend's Accept-button can wire it through to the override.

Confidence
----------
Confidence is the score, clamped to [0, 1]. Scores typically fall in
[-0.5, 1.0]; we map negatives to 0.
"""
from __future__ import annotations

from typing import List, Optional

from flatland.envs.rail_env import RailEnv

from app.core.scenario_builder import Scenario, ScenarioBuilder
from app.policies.deadlock_avoidance_policy import DeadLockAvoidancePolicy
from app.models.hmi import Recommendation


def _pick_interesting_handle(env: RailEnv) -> Optional[int]:
    """Same heuristic as hmi.py's _pick_default_handle."""
    priority_states = ("MOVING", "STOPPED", "MALFUNCTION", "READY_TO_DEPART")
    for state_name in priority_states:
        for h, ag in enumerate(env.agents):
            s = ag.state.name if hasattr(ag.state, "name") else str(ag.state)
            if s == state_name:
                return h
    return None


def _steps_to_decision(env: RailEnv, handle: int) -> int:
    """Approximate steps until the agent reaches its next decision cell.
    Returns a small default if we can't determine it (e.g. no decision
    ahead within a reasonable horizon)."""
    try:
        from app.core.cell_classifier import lookahead_to_decision
        ag = env.agents[handle]
        nd = lookahead_to_decision(env, ag)
        if nd and "steps_ahead" in nd:
            return max(1, int(nd["steps_ahead"]))
    except Exception:
        pass
    return 10  # generic fallback


def _confidence(score: float) -> float:
    """Map a score (~[-0.5, 1.0]) to a confidence in [0, 1]."""
    return max(0.0, min(1.0, float(score)))


def _describe_recommendation(top: Scenario, baseline_score: float) -> str:
    res = top.result
    delay = int(res.kpis.get("total_delay", 0))
    n_dl = int(res.kpis.get("num_deadlock_cycles", 0))
    pieces = []
    score_gain = top.score - baseline_score
    if score_gain > 0.05:
        pieces.append(f"improves outcome by {score_gain:+.2f} pts")
    if n_dl > 0:
        pieces.append(f"⚠ would still cause {n_dl} deadlock(s)")
    if delay > 0:
        pieces.append(f"{delay}-step delay")
    if not pieces:
        pieces.append(f"{res.success_count}/{res.total_agents} trains arrive")
    return "; ".join(pieces)


def generate_recommendations(
    session_id: str,
    env: RailEnv,
    horizon: int = 30,
) -> List[Recommendation]:
    """Generate live recommendations for a session.

    Returns at most one Recommendation (the top alternative for the
    most interesting agent). Empty list if DLA already does the
    right thing or no agent is on the map yet.
    """
    handle = _pick_interesting_handle(env)
    if handle is None:
        return []

    builder = ScenarioBuilder(env, DeadLockAvoidancePolicy)
    try:
        scenarios = builder.generate_scenarios(handle=handle, horizon=horizon)
    except Exception:
        return []

    if not scenarios:
        return []

    # Find baseline score for delta computation.
    baseline = next((s for s in scenarios if s.name == "baseline"), None)
    baseline_score = baseline.score if baseline else 0.0

    top = scenarios[0]  # already sorted descending

    # If DLA's own choice (baseline) is the winner, no need to recommend
    # an alternative — the policy is already doing the right thing.
    if top.name == "baseline":
        return []

    # Only surface recommendations that the builder itself flagged.
    if top.tag != "recommended":
        return []

    # Score must be a clear improvement over baseline (avoid ties / noise).
    if (top.score - baseline_score) < 0.1:
        return []

    elapsed = int(getattr(env, "_elapsed_steps", 0))
    confidence = _confidence(top.score)
    countdown = max(5, _steps_to_decision(env, handle) * 2)  # ~2s per step

    return [Recommendation(
        id=f"rec_h{handle}_{top.name.lower()}_step{elapsed}",
        title=f"Train {handle}: take {top.name} at next switch",
        description=_describe_recommendation(top, baseline_score),
        confidence=round(confidence, 2),
        countdownSeconds=int(countdown),
        # Match the scenario id format from hmi_scenario_adapter.scenario_to_option:
        scenarioId=f"s_h{handle}_{top.name.lower()}",
    )]
