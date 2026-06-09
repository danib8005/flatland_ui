"""HMI-Mock-API: Notifications, Scenarios, Recommendations."""
from fastapi import APIRouter, HTTPException

from app.core.session_manager import session_manager
from app.core.hmi_mock import (
    generate_bundle,
    generate_notifications,
    generate_recommendations,
    generate_scenarios,
)
from app.models.hmi import (
    AppNotification,
    HmiBundle,
    Recommendation,
    ScenarioOption,
)

router = APIRouter()


def _step_for(session_id: str) -> int:
    sess = session_manager.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    env = getattr(sess, "env", None)
    if env is None:
        return 0
    # RailEnv stores elapsed steps in _elapsed_steps
    return int(getattr(env, "_elapsed_steps", 0) or 0)


@router.get("/{session_id}/hmi/notifications", response_model=list[AppNotification])
def get_notifications(session_id: str):
    return generate_notifications(session_id, _step_for(session_id))


@router.get("/{session_id}/hmi/scenarios", response_model=list[ScenarioOption])
def get_scenarios(session_id: str):
    return generate_scenarios(session_id, _step_for(session_id))


@router.get("/{session_id}/hmi/recommendations", response_model=list[Recommendation])
def get_recommendations(session_id: str):
    return generate_recommendations(session_id, _step_for(session_id))


@router.get("/{session_id}/hmi", response_model=HmiBundle)
def get_bundle(session_id: str):
    return generate_bundle(session_id, _step_for(session_id))
