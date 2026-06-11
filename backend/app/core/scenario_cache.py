"""Tiny per-session cache for scenario computation.

Two shapes per (session, step) key:
  * 'scenarios'   — List[Scenario] objects (used by /hmi/recommendations,
                    which needs the full Scenario incl. result + score).
  * 'options'     — List[ScenarioOption] (serialized DTOs, returned by
                    /hmi/scenarios to the frontend).

Both are computed from the same ScenarioBuilder run, so storing both
lets us serve recommendations and scenarios from one compute.
"""
from typing import Any, Dict, List, Optional, Tuple


class ScenarioCache:
    def __init__(self):
        # (session_id, elapsed_step) -> {"scenarios": [...], "options": [...]}
        self._cache: Dict[Tuple[str, int], Dict[str, List[Any]]] = {}

    # --- options (serialized DTOs for /hmi/scenarios) ---

    def get(self, session_id: str, step: int) -> Optional[List[Any]]:
        """Backwards-compatible getter: returns the 'options' list."""
        entry = self._cache.get((session_id, step))
        return entry["options"] if entry else None

    def put(self, session_id: str, step: int, options: List[Any]) -> None:
        """Backwards-compatible setter: stores only options.

        Existing callers that don't know about scenarios still work,
        but recommendations won't benefit from the cache for those
        entries. New paths should prefer put_full().
        """
        self._drop_session(session_id)
        self._cache[(session_id, step)] = {"options": options, "scenarios": None}

    # --- full (Scenario objects + options) ---

    def get_scenarios(self, session_id: str, step: int) -> Optional[List[Any]]:
        entry = self._cache.get((session_id, step))
        return entry["scenarios"] if entry else None

    def put_full(self, session_id: str, step: int,
                 scenarios: List[Any], options: List[Any]) -> None:
        """Store both shapes from a single ScenarioBuilder compute."""
        self._drop_session(session_id)
        self._cache[(session_id, step)] = {
            "scenarios": scenarios,
            "options": options,
        }

    def clear_session(self, session_id: str) -> None:
        self._drop_session(session_id)

    def _drop_session(self, session_id: str) -> None:
        self._cache = {k: v for k, v in self._cache.items() if k[0] != session_id}


scenario_cache = ScenarioCache()
