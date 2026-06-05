from typing import List, Optional
from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    width: int = Field(default=30, ge=25, le=150, description="min 25 fuer 2 Cities")
    height: int = Field(default=30, ge=25, le=150, description="min 25 fuer 2 Cities")
    number_of_agents: int = Field(default=3, ge=1, le=50)
    seed: int = 42
    max_num_cities: int = Field(default=2, ge=2, le=10)
    max_rails_between_cities: int = 2
    max_rail_pairs_in_city: int = 2


class SessionInfo(BaseModel):
    id: str
    width: int
    height: int
    num_agents: int


class StepRequest(BaseModel):
    policy: str = Field(default="random", description="random | shortest_path")
    n_steps: int = Field(default=1, ge=1, le=100)


class StepResult(BaseModel):
    session_id: str
    elapsed_steps: int
    rewards: dict
    dones: dict
    all_done: bool
