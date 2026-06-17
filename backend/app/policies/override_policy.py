"""OverridePolicy: wraps a policy and applies user overrides.

Semantics:
- A user override is parked until the agent reaches a SWITCH/MERGING cell.
- At that decision cell the override wins for exactly one action.
- Immediately after application the override is cleared.
- If the agent is not at a decision cell, the override remains parked.
"""
from typing import Optional

from flatland.core.env_observation_builder import ObservationBuilder
from flatland.envs.rail_env import RailEnv
from flatland.envs.rail_env_action import RailEnvActions

STOP_MOVING_ACTION_VALUE = int(RailEnvActions.STOP_MOVING.value)

from app.core.cell_classifier import classify_cell_at as classify_cell
from app.core.override_manager import override_manager
from app.policies.base import Policy


class OverridePolicy(Policy):
    """Wraps any policy; user overrides are one-shot at next decision point."""

    def __init__(self, default: Policy, session_id: str):
        self._default = default
        self._session_id = session_id
        self._env: Optional[RailEnv] = None

    def reset(self, env: RailEnv) -> None:
        self._env = env
        self._default.reset(env)

    def start_episode(self, train: bool = False) -> None:
        self._default.start_episode(train)

    def start_step(self, train: bool = False) -> None:
        self._default.start_step(train)

    def end_step(self, train: bool = False) -> None:
        self._default.end_step(train)

    def end_episode(self, train: bool = False) -> None:
        self._default.end_episode(train)

    def build_observation_builder(self) -> ObservationBuilder:
        return self._default.build_observation_builder()

    def build_predictor(self):
        return self._default.build_predictor()

    def _one_shot_override_for(self, handle):
        """Return override for handle.

        UX semantics:
        - STOP_MOVING is persistent and applies immediately on every step
          until the user explicitly clears/releases it.
        - LEFT/FORWARD/RIGHT are decision overrides:
          they are parked until the agent reaches SWITCH/MERGING, then
          applied once and cleared.
        """
        h = int(handle)
        override = override_manager.get(self._session_id, h)
        if override is None:
            return None

        override_int = int(override.value if hasattr(override, "value") else override)

        # Manual STOP is sticky/persistent and applies anywhere.
        if override_int == STOP_MOVING_ACTION_VALUE:
            return RailEnvActions.STOP_MOVING

        # Non-stop overrides are only consumed at decision cells.
        env = getattr(self, "_env", None) or getattr(self, "env", None)
        if env is None:
            return None

        try:
            agent = env.agents[h]
        except Exception:
            return None

        if agent.position is None or agent.direction is None:
            return None

        kind = classify_cell(env, agent.position, agent.direction)
        if kind not in ("SWITCH", "MERGING"):
            # Park override until decision cell.
            return None

        # Consume one-shot decision override.
        override_manager.clear(self._session_id, h)
        return RailEnvActions(override_int)

    def act_many(self, handles, observations, **kwargs):
        actions = self._default.act_many(handles, observations, **kwargs)
        for h in handles:
            override_action = self._one_shot_override_for(h)
            if override_action is not None:
                actions[h] = override_action
        return actions

    def act_for_handle(self, handle, observation=None, eps=0.0):
        action = self._default.act_for_handle(handle, observation, eps)
        override_action = self._one_shot_override_for(handle)
        return override_action if override_action is not None else action

    def get_name(self) -> str:
        return f"Override({self._default.get_name()})"
