"""
WebSocket Connection Manager.

Hält pro Session eine Liste verbundener WebSocket-Clients und broadcasted
State-Updates an alle.
"""
from typing import Dict, List
from fastapi import WebSocket


class WebSocketManager:
    def __init__(self):
        self._connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self._connections:
            self._connections[session_id] = []
        self._connections[session_id].append(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket):
        if session_id in self._connections:
            try:
                self._connections[session_id].remove(websocket)
            except ValueError:
                pass
            if not self._connections[session_id]:
                del self._connections[session_id]

    async def broadcast(self, session_id: str, payload: dict):
        if session_id not in self._connections:
            return
        dead = []
        for ws in list(self._connections[session_id]):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(session_id, ws)

    def has_listeners(self, session_id: str) -> bool:
        return session_id in self._connections and len(self._connections[session_id]) > 0


ws_manager = WebSocketManager()
