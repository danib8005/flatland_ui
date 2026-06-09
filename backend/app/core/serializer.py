from typing import Any, Dict, List
from flatland.envs.rail_env import RailEnv

from app.core.tile_resolver import build_rail_tiles
from app.core.cell_classifier import classify_cell_type, lookahead_to_decision, find_decision_cells


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


def serialize_agent(env, agent, override_action=None) -> Dict[str, Any]:
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

    # Cell type classification
    try:
        cell_type = classify_cell_type(env, agent)
    except Exception:
        cell_type = "UNKNOWN"

    # Lookahead to next decision point
    next_decision = None
    try:
        next_decision = lookahead_to_decision(env, agent)
    except Exception:
        next_decision = None

    # ── ETA / deadline / visibility ─────────────────────────────────
    elapsed = int(getattr(env, "_elapsed_steps", 0))
    earliest = _safe_int(agent.earliest_departure)
    latest = _safe_int(agent.latest_arrival)

    # Steps until the agent is allowed to enter the map.
    # 0 means "may depart now" (assuming state == READY_TO_DEPART).
    eta_to_depart = max(0, earliest - elapsed) if earliest is not None else None

    # Steps to the latest_arrival deadline. Negative means overdue.
    time_to_deadline = (latest - elapsed) if latest is not None else None

    # Delay only meaningful while the agent is still active and overdue.
    delay = 0
    if (
        latest is not None
        and elapsed > latest
        and state_str not in ("DONE",)
    ):
        delay = elapsed - latest

    # Sidebar visibility: hide WAITING (too early) and DONE (already arrived).
    is_visible = state_str not in ("WAITING", "DONE")

    # Color intensity for the sidebar badge (0.0 = grey/relaxed,
    # 1.0 = warm orange). Smooth ramp:
    #   time_to_deadline >= 50 → 0.0
    #   0 <= time_to_deadline < 50 → linear (50-t)/50
    #   time_to_deadline < 0 → 1.0 (overdue → fully warm)
    if time_to_deadline is None:
        delay_color_intensity = 0.0
    elif time_to_deadline >= 50:
        delay_color_intensity = 0.0
    elif time_to_deadline < 0:
        delay_color_intensity = 1.0
    else:
        delay_color_intensity = round((50 - time_to_deadline) / 50.0, 3)

    return {
        "handle": int(agent.handle),
        "position": _safe_pos(agent.position),
        "direction": _safe_int(agent.direction),
        "initial_position": _safe_pos(agent.initial_position),
        "initial_direction": _safe_int(agent.initial_direction),
        "target": _safe_pos(agent.target) or [0, 0],
        "state": state_str,
        "speed": speed,
        "earliest_departure": earliest,
        "latest_arrival": latest,
        "eta_to_depart": eta_to_depart,
        "time_to_deadline": time_to_deadline,
        "delay": int(delay),
        "is_visible": bool(is_visible),
        "delay_color_intensity": float(delay_color_intensity),
        "cell_type": cell_type,
        "next_decision": next_decision,
        "override_action": override_action,
    }


def serialize_rail_grid(env: RailEnv) -> List[List[int]]:
    grid = env.rail.grid
    return [[int(grid[r, c]) for c in range(env.width)] for r in range(env.height)]


def serialize_env(env: RailEnv, overrides: Dict[int, int] = None) -> Dict[str, Any]:
    overrides = overrides or {}
    rail_grid = serialize_rail_grid(env)
    return {
        "width": int(env.width),
        "height": int(env.height),
        "num_agents": len(env.agents),
        "elapsed_steps": int(env._elapsed_steps),
        "max_episode_steps": int(env._max_episode_steps),
        "agents": [
            serialize_agent(env, a, overrides.get(a.handle))
            for a in env.agents
        ],
        "rail_grid": rail_grid,
        "rail_tiles": build_rail_tiles(rail_grid),
        "decision_cells": find_decision_cells(env),
    }
