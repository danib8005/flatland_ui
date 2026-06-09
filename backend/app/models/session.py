from typing import List, Optional
from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    width: int = Field(default=50, ge=25, le=200, description="grid width")
    height: int = Field(default=20, ge=20, le=150, description="grid height")
    number_of_agents: int = Field(default=3, ge=1, le=50)
    seed: int = 42
    max_num_cities: int = Field(default=4, ge=2, le=10)
    max_rails_between_cities: int = 2
    max_rail_pairs_in_city: int = 2


class SessionInfo(BaseModel):
    id: str
    width: int
    height: int
    num_agents: int


class StepRequest(BaseModel):
    policy: str = Field(default="deadlock_avoidance", description="random | shortest_path | do_nothing | forward_only | deadlock_avoidance")
    n_steps: int = Field(default=1, ge=1, le=100)


class StepResult(BaseModel):
    session_id: str
    elapsed_steps: int
    rewards: dict
    dones: dict
    all_done: bool
