"""
Per-Session Per-Agent Action Overrides.

User can set an override action for an agent that will be used at the
next decision point. After the agent passes through the decision cell,
the override auto-clears.
"""
from typing import Dict, Optional


class OverrideManager:
    """In-Memory Override Storage."""

    def __init__(self):
        # session_id -> handle -> action_int
        self._overrides: Dict[str, Dict[int, int]] = {}

    def set(self, session_id: str, handle: int, action: int) -> None:
        if session_id not in self._overrides:
            self._overrides[session_id] = {}
        self._overrides[session_id][handle] = int(action)

    def get(self, session_id: str, handle: int) -> Optional[int]:
        return self._overrides.get(session_id, {}).get(handle)

    def clear(self, session_id: str, handle: int) -> None:
        if session_id in self._overrides:
            self._overrides[session_id].pop(handle, None)

    def clear_all(self, session_id: str) -> None:
        self._overrides.pop(session_id, None)

    def get_all(self, session_id: str) -> Dict[int, int]:
        return dict(self._overrides.get(session_id, {}))


override_manager = OverrideManager()
