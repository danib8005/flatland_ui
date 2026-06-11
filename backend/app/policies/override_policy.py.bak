"""
Override Policy - wraps a default policy.

For each agent:
- If user has set an override action AND agent is at/past decision point,
  use the override and clear it.
- Otherwise, delegate to the default policy.
"""
from typing import Dict

from app.core.cell_classifier import classify_cell_type
from app.core.override_manager import override_manager


class OverridePolicy:
    def __init__(self, env, session_id: str, default_policy):
        self.env = env
        self.session_id = session_id
        self.default_policy = default_policy

    def act_many(self, handles, observations) -> Dict[int, int]:
        # First, get default actions
        default_actions = self.default_policy.act_many(handles, observations)

        # Apply overrides if applicable
        for h in handles:
            override = override_manager.get(self.session_id, h)
            if override is None:
                continue

            # Check if agent is at decision point (SWITCH or MERGING)
            try:
                agent = self.env.agents[h]
                cell_type = classify_cell_type(self.env, agent)
                if cell_type in ("SWITCH", "MERGING"):
                    # Use override and clear it
                    default_actions[h] = override
                    override_manager.clear(self.session_id, h)
            except Exception:
                pass

        return default_actions
