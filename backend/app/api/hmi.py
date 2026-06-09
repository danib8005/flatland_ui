"""HMI API: Notifications, Scenarios, Recommendations.

* Notifications still come from the mock (will follow in a separate step).
* Scenarios are real what-if branches via ScenarioBuilder, with mock
  fallback when no agent is on the map yet.
* Recommendations are derived from the top-scoring scenario, with mock
  fallback if DLA is already optimal or generation fails.
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.core.session_manager import session_manager
from app.core.hmi_mock import (
    generate_bundle,
    generate_notifications,
    generate_recommendations as mock_generate_recommendations,
    generate_scenarios as mock_generate_scenarios,
)
from app.core.hmi_scenario_adapter import scenarios_to_options
from app.core.recommendation_generator import (
    generate_recommendations as real_recommendations,
)
from app.core.scenario_builder import ScenarioBuilder
from app.models.hmi import (
    AppNotification,
    HmiBundle,
    Recommendation,
    ScenarioOption,
)
from app.policies.deadlock_avoidance_policy import DeadLockAvoidancePolicy

router = APIRouter()


# ── helpers ────────────────────────────────────────────────────────


def _step_for(session_id: str) -> int:
    sess = session_manager.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    env = getattr(sess, "env", None)
    if env is None:
        return 0
    return int(getattr(env, "_elapsed_steps", 0) or 0)


def _pick_default_handle(env) -> Optional[int]:
    """Pick the most interesting agent for what-if analysis:
       1) any MOVING / STOPPED / MALFUNCTION
       2) any READY_TO_DEPART
       3) None  → caller falls back to mock."""
    priority_states = ("MOVING", "STOPPED", "MALFUNCTION", "READY_TO_DEPART")
    for state_name in priority_states:
        for h, ag in enumerate(env.agents):
            s = ag.state.name if hasattr(ag.state, "name") else str(ag.state)
            if s == state_name:
                return h
    return None


# ── notifications (mock for now) ───────────────────────────────────


@router.get("/{session_id}/hmi/notifications", response_model=list[AppNotification])
def get_notifications(session_id: str):
    return generate_notifications(session_id, _step_for(session_id))


# ── scenarios (real, with mock fallback) ───────────────────────────


@router.get("/{session_id}/hmi/scenarios", response_model=list[ScenarioOption])
def get_scenarios(
    session_id: str,
    handle: Optional[int] = Query(None, description="Agent handle to branch on; auto-pick if omitted"),
    horizon: int = Query(30, ge=1, le=300, description="Branch lookahead in steps"),
):
    """Real what-if scenarios for the given agent (or auto-pick).
    Falls back to the mock when no suitable agent is on the map yet."""
    sess = session_manager.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    env = getattr(sess, "env", None)
    if env is None:
        return mock_generate_scenarios(session_id, _step_for(session_id))

    target_handle = handle if handle is not None else _pick_default_handle(env)
    if target_handle is None:
        return mock_generate_scenarios(session_id, _step_for(session_id))

    try:
        builder = ScenarioBuilder(env, DeadLockAvoidancePolicy)
        scenarios = builder.generate_scenarios(handle=target_handle, horizon=horizon)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(
            "ScenarioBuilder failed for session %s, handle %s: %r",
            session_id, target_handle, e,
        )
        return mock_generate_scenarios(session_id, _step_for(session_id))

    return scenarios_to_options(scenarios, target_handle)


# ── recommendations (real, with mock fallback) ─────────────────────


@router.get("/{session_id}/hmi/recommendations", response_model=list[Recommendation])
def get_recommendations(session_id: str):
    """Recommendations from the top-scoring ScenarioBuilder option.
    Returns [] when DLA is already optimal — that's a feature, not a bug:
    the UI hides the panel when there's nothing to act on."""
    sess = session_manager.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    env = getattr(sess, "env", None)
    if env is None:
        return mock_generate_recommendations(session_id, _step_for(session_id))

    try:
        recs = real_recommendations(session_id, env)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(
            "Recommendation generator failed for %s: %r", session_id, e,
        )
        return mock_generate_recommendations(session_id, _step_for(session_id))

    return recs


# ── bundle (still mock, used by some UI panels) ────────────────────


@router.get("/{session_id}/hmi", response_model=HmiBundle)
def get_bundle(session_id: str):
    return generate_bundle(session_id, _step_for(session_id))
