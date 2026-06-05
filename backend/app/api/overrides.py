"""
Override API: User can set/clear per-agent action overrides.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.session_manager import session_manager
from app.core.override_manager import override_manager

router = APIRouter()


class OverrideRequest(BaseModel):
    action: int  # 0=DO_NOTHING, 1=LEFT, 2=FORWARD, 3=RIGHT, 4=STOP


@router.post("/{session_id}/agent/{handle}/override")
def set_override(session_id: str, handle: int, req: OverrideRequest):
    session = session_manager.get(session_id)
    if not session:
        raise HTTPException(404, f"Session {session_id} not found")

    if handle < 0 or handle >= len(session.env.agents):
        raise HTTPException(404, f"Agent {handle} not found")

    if req.action not in (0, 1, 2, 3, 4):
        raise HTTPException(400, f"Invalid action {req.action}")

    override_manager.set(session_id, handle, req.action)
    return {
        "session_id": session_id,
        "handle": handle,
        "action": req.action,
    }


@router.delete("/{session_id}/agent/{handle}/override")
def clear_override(session_id: str, handle: int):
    session = session_manager.get(session_id)
    if not session:
        raise HTTPException(404, f"Session {session_id} not found")

    override_manager.clear(session_id, handle)
    return {"session_id": session_id, "handle": handle, "cleared": True}


@router.get("/{session_id}/overrides")
def get_overrides(session_id: str):
    session = session_manager.get(session_id)
    if not session:
        raise HTTPException(404, f"Session {session_id} not found")

    return {
        "session_id": session_id,
        "overrides": override_manager.get_all(session_id),
    }
