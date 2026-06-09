"""ShortestPathPolicy: action that minimizes distance_map[handle].

Refactored to the new Policy base class (R1). Behaviour unchanged.
"""
from typing import Optional

from flatland.core.env_observation_builder import (
    DummyObservationBuilder, ObservationBuilder,
)
from flatland.core.grid.grid4_utils import get_new_position
from flatland.envs.fast_methods import fast_argmax
from flatland.envs.rail_env import RailEnv
from flatland.envs.rail_env_action import RailEnvActions

from app.policies.base import Policy


class ShortestPathPolicy(Policy):
    """Picks the action that follows the shortest path to the target,
    using env.distance_map. Falls back to MOVE_FORWARD."""

    def __init__(self, env: Optional[RailEnv] = None):
        self._env = env

    def reset(self, env: RailEnv) -> None:
        self._env = env

    def build_observation_builder(self) -> ObservationBuilder:
        # ShortestPath uses env.distance_map directly; obs is unused.
        return DummyObservationBuilder()

    def act_for_handle(
        self, handle: int, observation=None, eps: float = 0.0
    ) -> RailEnvActions:
        env = self._env
        if env is None:
            return RailEnvActions.MOVE_FORWARD

        agent = env.agents[handle]
        if agent.position is None:
            # Not yet on map → request to depart by moving forward.
            return RailEnvActions.MOVE_FORWARD

        position = agent.position
        direction = agent.direction
        possible_transitions = env.rail.get_transitions(*position, direction)

        # If only one transition is possible, just go forward.
        num_transitions = sum(possible_transitions)
        if num_transitions <= 1:
            return RailEnvActions.MOVE_FORWARD

        # Evaluate the distance for each possible next direction.
        min_distances = []
        for new_direction in range(4):
            if not possible_transitions[new_direction]:
                min_distances.append(float("inf"))
                continue
            new_position = get_new_position(position, new_direction)
            min_distances.append(
                env.distance_map.get()[
                    handle, new_position[0], new_position[1], new_direction
                ]
            )

        best_direction = int(fast_argmax(
            [-d if d != float("inf") else float("-inf") for d in min_distances]
        ))

        # Map (current_direction → best_direction) to LEFT/FORWARD/RIGHT.
        delta = (best_direction - direction) % 4
        if delta == 0:
            return RailEnvActions.MOVE_FORWARD
        if delta == 3:
            return RailEnvActions.MOVE_LEFT
        if delta == 1:
            return RailEnvActions.MOVE_RIGHT
        # delta == 2 → reversal not allowed except dead-end (handled by env)
        return RailEnvActions.MOVE_FORWARD
