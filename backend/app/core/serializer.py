from typing import Any, Dict, List
from flatland.envs.rail_env import RailEnv

from app.core.tile_resolver import build_rail_tiles


def _safe_int(v):
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _safe_pos(v):
    if v is None:
        return None
    try:
        return [int(v[0]), int(v[1])]
    except (TypeError, ValueError, IndexError):
        return None


def serialize_agent(agent) -> Dict[str, Any]:
    state_val = agent.state
    if hasattr(state_val, "name"):
        state_str = state_val.name
    else:
        state_str = str(state_val)

    speed = 1.0
    try:
        if hasattr(agent, "speed_counter") and agent.speed_counter is not None:
            speed = float(agent.speed_counter.speed)
    except Exception:
        pass

    return {
        "handle": int(agent.handle),
        "position": _safe_pos(agent.position),
        "direction": _safe_int(agent.direction),
        "initial_position": _safe_pos(agent.initial_position),
        "initial_direction": _safe_int(agent.initial_direction),
        "target": _safe_pos(agent.target) or [0, 0],
        "state": state_str,
        "speed": speed,
        "earliest_departure": _safe_int(agent.earliest_departure),
        "latest_arrival": _safe_int(agent.latest_arrival),
    }


def serialize_rail_grid(env: RailEnv) -> List[List[int]]:
    grid = env.rail.grid
    return [[int(grid[r, c]) for c in range(env.width)] for r in range(env.height)]


def serialize_env(env: RailEnv) -> Dict[str, Any]:
    rail_grid = serialize_rail_grid(env)
    return {
        "width": int(env.width),
        "height": int(env.height),
        "num_agents": len(env.agents),
        "elapsed_steps": int(env._elapsed_steps),
        "max_episode_steps": int(env._max_episode_steps),
        "agents": [serialize_agent(a) for a in env.agents],
        "rail_grid": rail_grid,
        "rail_tiles": build_rail_tiles(rail_grid),
    }
