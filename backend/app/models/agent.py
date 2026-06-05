from typing import List, Optional
from pydantic import BaseModel


class AgentDTO(BaseModel):
    handle: int
    position: Optional[List[int]]
    direction: Optional[int]
    initial_position: Optional[List[int]]
    initial_direction: Optional[int]
    target: List[int]
    state: str
    speed: float
    earliest_departure: Optional[int]
    latest_arrival: Optional[int]


class ActionRequest(BaseModel):
    handle: int
    action: int
