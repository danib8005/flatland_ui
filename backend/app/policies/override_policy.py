"""OverridePolicy: wraps any inner Policy and applies user overrides
at SWITCH/MERGING cells.

Adapted to the R1 hybrid Policy interface: forwards lifecycle hooks
(reset/start_step/end_step) to the wrapped default policy, so
stateful heuristics (e.g. DeadLockAvoidance) keep working.
"""
from typing import Optional

from flatland.core.env_observation_builder import ObservationBuilder
from flatland.envs.rail_env import RailEnv
from flatland.envs.rail_env_action import RailEnvActions

from app.core.cell_classifier import classify_cell_at as classify_cell
from app.core.override_manager import override_manager
from app.policies.base import Policy


class OverridePolicy(Policy):
    """Wraps any policy; user overrides win at SWITCH/MERGING cells."""

    def __init__(self, default: Policy, session_id: str):
        self._default = default
        self._session_id = session_id
        self._env: Optional[RailEnv] = None

    # ── lifecycle: forward to wrapped policy ─────────────────────────
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

    # ── observation belongs to the wrapped policy ───────────────────
    def build_observation_builder(self) -> ObservationBuilder:
        return self._default.build_observation_builder()

    def build_predictor(self):
        return self._default.build_predictor()

    # ── action selection ─────────────────────────────────────────────
    def act_many(self, handles, observations, **kwargs):
        # 1) Ask default policy for baseline actions.
        actions = self._default.act_many(handles, observations, **kwargs)
        # 2) Overlay user overrides where applicable. Overrides are
        #    STICKY: once set, they apply at every decision point the
        #    agent passes — including STOP, which holds the agent at
        #    each switch indefinitely — until the user explicitly
        #    clears them via DELETE /override (toggled by clicking
        #    the same action pill again in the UI).
        #
        #    Rationale: a user instruction is a user instruction.
        #    'Go left' means 'go left at every switch you reach' until
        #    revoked, the same way 'STOP' means 'hold at every switch'
        #    until revoked. Earlier this code consumed the override on
        #    the first SWITCH/MERGING cell, which made STOP impossible
        #    (agent paused for one tick then continued) and routing
        #    overrides surprising at multi-switch junctions.
        env = self._env
        if env is None:
            return actions
        for h in handles:
            override = override_manager.get(self._session_id, h)
            if override is None:
                continue
            agent = env.agents[h]
            if agent.position is None:
                # Agent is off-map (WAITING / DONE). The override stays
                # parked and will apply once the agent enters the map
                # and reaches its first decision cell.
                continue
            cell_kind = classify_cell(env, agent.position, agent.direction)
            if cell_kind in ("SWITCH", "MERGING"):
                # Apply the override; do NOT clear — sticky semantics.
                actions[h] = RailEnvActions(int(override))
        return actions

    def act_for_handle(self, handle, observation=None, eps=0.0):
        # Single-agent path — used rarely, mainly for tests/tools.
        # Mirrors act_many: apply override at decision cells, then
        # auto-clear so it's a one-shot directive.
        action = self._default.act_for_handle(handle, observation, eps)
        env = self._env
        if env is None:
            return action
        override = override_manager.get(self._session_id, handle)
        if override is None:
            return action
        agent = env.agents[handle]
        if agent.position is None:
            return action
        cell_kind = classify_cell(env, agent.position, agent.direction)
        if cell_kind in ("SWITCH", "MERGING"):
            # Sticky override: do NOT clear — see act_many for rationale.
            return RailEnvActions(int(override))
        return action

    def get_name(self) -> str:
        return f"Override({self._default.get_name()})"
