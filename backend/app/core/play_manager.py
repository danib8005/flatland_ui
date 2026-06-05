"""
Verwaltet pro Session einen Play-Loop: Auto-Step mit definierter Speed.

Loop laeuft im asyncio-Task. Stoppt automatisch bei Episode-Ende oder
wenn explizit gestoppt.
"""
import asyncio
from typing import Dict, Optional


class PlayState:
    def __init__(self, session_id: str, speed: float, policy: str):
        self.session_id = session_id
        self.speed = speed  # steps per second
        self.policy = policy
        self.task: Optional[asyncio.Task] = None
        self.running = False


class PlayManager:
    def __init__(self):
        self._states: Dict[str, PlayState] = {}

    def get(self, session_id: str) -> Optional[PlayState]:
        return self._states.get(session_id)

    def is_playing(self, session_id: str) -> bool:
        st = self._states.get(session_id)
        return st is not None and st.running

    def register(self, state: PlayState):
        self._states[state.session_id] = state

    async def stop(self, session_id: str):
        st = self._states.get(session_id)
        if st is None:
            return
        st.running = False
        if st.task and not st.task.done():
            st.task.cancel()
            try:
                await st.task
            except asyncio.CancelledError:
                pass
        self._states.pop(session_id, None)


play_manager = PlayManager()
