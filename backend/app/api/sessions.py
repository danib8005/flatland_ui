from fastapi import APIRouter, HTTPException
from typing import List

from app.core.session_manager import session_manager
from app.core.serializer import serialize_env
from app.models.session import (
    SessionCreateRequest,
    SessionInfo,
    StepRequest,
    StepResult,
)
from app.models.agent import ActionRequest
from app.policies.random_policy import RandomPolicy
from app.policies.shortest_path_policy import ShortestPathPolicy

router = APIRouter()


def _to_plain(value):
    """Konvertiert numpy types zu plain Python types."""
    if value is None:
        return None
    if isinstance(value, dict):
        return {str(k): _to_plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_to_plain(v) for v in value]
    if hasattr(value, "item"):  # numpy scalar
        try:
            return value.item()
        except Exception:
            return float(value)
    if isinstance(value, bool):
        return bool(value)
    if isinstance(value, (int, float, str)):
        return value
    try:
        return float(value)
    except Exception:
        return str(value)


@router.post("", response_model=SessionInfo)
def create_session(req: SessionCreateRequest):
    session = session_manager.create(
        width=req.width,
        height=req.height,
        number_of_agents=req.number_of_agents,
        seed=req.seed,
        max_num_cities=req.max_num_cities,
        max_rails_between_cities=req.max_rails_between_cities,
        max_rail_pairs_in_city=req.max_rail_pairs_in_city,
    )
    return SessionInfo(
        id=session.id,
        width=session.env.width,
        height=session.env.height,
        num_agents=len(session.env.agents),
    )


@router.get("")
def list_sessions() -> List[str]:
    return session_manager.list_ids()


@router.get("/{session_id}/state")
def get_state(session_id: str):
    session = session_manager.get(session_id)
    if not session:
        raise HTTPException(404, f"Session {session_id} not found")
    return serialize_env(session.env)


@router.post("/{session_id}/step")
def step(session_id: str, req: StepRequest):
    session = session_manager.get(session_id)
    if not session:
        raise HTTPException(404, f"Session {session_id} not found")

    env = session.env

    if req.policy == "random":
        try:
            action_size = int(env.action_space[0])
        except Exception:
            action_size = 5
        policy = RandomPolicy(action_size=action_size)
    elif req.policy == "shortest_path":
        policy = ShortestPathPolicy(env)
    else:
        raise HTTPException(400, f"Unknown policy: {req.policy}")

    rewards = {}
    dones = {}
    all_done = False

    for _ in range(req.n_steps):
        handles = env.get_agent_handles()
        observations = session.last_observations or {}
        actions = policy.act_many(handles, observations)
        next_obs, rewards, dones, info = env.step(actions)
        session.last_observations = next_obs
        session.last_info = info
        if dones.get("__all__", False):
            all_done = True
            break

    return {
        "session_id": session_id,
        "elapsed_steps": int(env._elapsed_steps),
        "rewards": _to_plain(rewards),
        "dones": _to_plain(dones),
        "all_done": bool(all_done),
    }


@router.post("/{session_id}/action")
def manual_action(session_id: str, req: ActionRequest):
    session = session_manager.get(session_id)
    if not session:
        raise HTTPException(404, f"Session {session_id} not found")
    env = session.env
    next_obs, rewards, dones, info = env.step({req.handle: req.action})
    session.last_observations = next_obs
    session.last_info = info
    return {
        "session_id": session_id,
        "handle": req.handle,
        "action": req.action,
        "elapsed_steps": int(env._elapsed_steps),
        "all_done": bool(dones.get("__all__", False)),
    }


@router.delete("/{session_id}")
def delete_session(session_id: str):
    if not session_manager.delete(session_id):
        raise HTTPException(404, f"Session {session_id} not found")
    return {"deleted": session_id}
