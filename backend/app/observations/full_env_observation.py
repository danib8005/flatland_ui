"""FullEnvObservation: returns the RailEnv itself as observation.

Pattern adopted from flatland-baselines, where DeadLockAvoidancePolicy
consumes the full env (it needs distance_map, transitions, agent
positions across all agents).
"""
from typing import List, Optional, Dict
from flatland.core.env_observation_builder import ObservationBuilder


class FullEnvObservation(ObservationBuilder):
    def reset(self) -> None:
        pass

    def get(self, handle: int = 0):
        return self.env

    def get_many(self, handles: Optional[List[int]] = None):
        if handles is None:
            handles = list(range(self.env.get_num_agents()))
        return {h: self.env for h in handles}
