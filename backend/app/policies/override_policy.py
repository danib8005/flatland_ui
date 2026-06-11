"""OverridePolicy: wraps any inner Policy and applies user overrides
at decision points with sticky semantics per position.

Semantics:
- When agent reaches a SWITCH/MERGING cell AND has an override set:
  Apply the override and remember the position
- While agent stays at that position: keep applying override (sticky)
- When agent moves away: auto-clear override and return to default policy

This allows:
- STOP override to hold agent at a switch indefinitely (sticky)
- Once user clicks override again or agent is pushed away, resets
- Multi-switch junctions work intuitively (override per decision point)
"""
from typing import Dict, Optional, Tuple

from flatland.core.env_observation_builder import ObservationBuilder
from flatland.envs.rail_env import RailEnv
from flatland.envs.rail_env_action import RailEnvActions

from app.core.cell_classifier import classify_cell_at as classify_cell
from app.core.override_manager import override_manager
from app.policies.base import Policy


class OverridePolicy(Policy):
    """Wraps any policy; user overrides apply at ONE decision point (sticky while there)."""

    def __init__(self, default: Policy, session_id: str):
        self._default = default
        self._session_id = session_id
        self._env: Optional[RailEnv] = None
        # Track which agents have override active at which position
        # handle -> (row, col) of the decision point where override is active
        self._override_active_at: Dict[int, Tuple[int, int]] = {}

    # ── lifecycle: forward to wrapped policy ─────────────────────────
    def reset(self, env: RailEnv) -> None:
        self._env = env
        self._default.reset(env)
        self._override_active_at.clear()

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
        
        # 2) Apply/maintain overrides at decision points
        env = self._env
        if env is None:
            return actions
        
        for h in handles:
            agent = env.agents[h]
            if agent.position is None:
                # Agent is off-map (WAITING / DONE).
                continue
            
            current_pos = (int(agent.position[0]), int(agent.position[1]))
            
            # Case 1: Override was active at a position, check if agent left
            if h in self._override_active_at:
                active_pos = self._override_active_at[h]
                if current_pos != active_pos:
                    # Agent has moved away from the decision point → auto-clear
                    override_manager.clear(self._session_id, h)
                    del self._override_active_at[h]
                    continue  # Use default policy action
                # Still at same position → stay sticky, apply override
                override = override_manager.get(self._session_id, h)
                if override is not None:
                    actions[h] = RailEnvActions(int(override))
                continue
            
            # Case 2: Agent not currently at override position, check if reaching decision
            override = override_manager.get(self._session_id, h)
            if override is None:
                continue
            
            cell_kind = classify_cell(env, agent.position, agent.direction)
            if cell_kind in ("SWITCH", "MERGING"):
                # Found a decision cell with override set → activate it
                actions[h] = RailEnvActions(int(override))
                self._override_active_at[h] = current_pos  # Mark as active here
        
        return actions

    def act_for_handle(self, handle, observation=None, eps=0.0):
        # Single-agent path — mirrors act_many logic
        action = self._default.act_for_handle(handle, observation, eps)
        env = self._env
        if env is None:
            return action
        
        agent = env.agents[handle]
        if agent.position is None:
            return action
        
        current_pos = (int(agent.position[0]), int(agent.position[1]))
        
        # Check if override is active at current position (sticky)
        if handle in self._override_active_at:
            active_pos = self._override_active_at[handle]
            if current_pos != active_pos:
                override_manager.clear(self._session_id, handle)
                del self._override_active_at[handle]
                return action
            # Still at same position → apply override
            override = override_manager.get(self._session_id, handle)
            if override is not None:
                return RailEnvActions(int(override))
            return action
        
        # Check for override at new decision point
        override = override_manager.get(self._session_id, handle)
        if override is None:
            return action
        
        cell_kind = classify_cell(env, agent.position, agent.direction)
        if cell_kind in ("SWITCH", "MERGING"):
            self._override_active_at[handle] = current_pos
            return RailEnvActions(int(override))
        
        return action

    def get_name(self) -> str:
        return f"Override({self._default.get_name()})"
