from typing import Any, Dict, List
import numpy as np

from flatland.core.grid.grid4_utils import get_new_position
from flatland.envs.rail_env_action import RailEnvActions


def _act(action) -> int:
    if hasattr(action, "value"):
        return int(action.value)
    return int(action)


def _get_transitions(rail, row, col, direction):
    """Compatibility wrapper for different Flatland API versions."""
    try:
        return rail.get_transitions(int(row), int(col), int(direction))
    except TypeError:
        pass
    try:
        return rail.get_transitions((int(row), int(col), int(direction)))
    except TypeError:
        pass
    try:
        return rail.get_transitions((int(row), int(col)), int(direction))
    except TypeError:
        pass
    full = rail.get_full_transitions(int(row), int(col))
    return [(full >> (12 - 4 * d - i)) & 1 for d, i in [(direction, 0)] for i in range(4)]


class ShortestPathPolicy:
    def __init__(self, env):
        self.env = env

    def act_many(self, handles, observations, **kwargs):
        actions = {}
        dm = self.env.distance_map.get()
        for h in handles:
            agent = self.env.agents[h]
            actions[h] = self._best_action(agent, dm, h)
        return actions

    def _best_action(self, agent, dm, handle):
        if agent.position is None:
            return _act(RailEnvActions.MOVE_FORWARD)

        pos = agent.position
        direction = agent.direction
        if direction is None:
            return _act(RailEnvActions.MOVE_FORWARD)

        try:
            transitions = _get_transitions(self.env.rail, pos[0], pos[1], direction)
        except Exception:
            return _act(RailEnvActions.MOVE_FORWARD)

        valid = [d for d in range(4) if transitions[d]]

        if not valid:
            return _act(RailEnvActions.STOP_MOVING)

        best_dir = None
        best_dist = np.inf
        for d in valid:
            new_pos = get_new_position(pos, d)
            if 0 <= new_pos[0] < self.env.height and 0 <= new_pos[1] < self.env.width:
                dist = dm[handle, new_pos[0], new_pos[1], d]
                if dist < best_dist:
                    best_dist = dist
                    best_dir = d

        if best_dir is None:
            return _act(RailEnvActions.MOVE_FORWARD)

        rel = (best_dir - direction) % 4
        if rel == 0:
            return _act(RailEnvActions.MOVE_FORWARD)
        elif rel == 1:
            return _act(RailEnvActions.MOVE_RIGHT)
        elif rel == 3:
            return _act(RailEnvActions.MOVE_LEFT)
        else:
            return _act(RailEnvActions.STOP_MOVING)
