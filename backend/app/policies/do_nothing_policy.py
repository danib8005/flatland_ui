"""DoNothingPolicy: always emits DO_NOTHING. From flatland-baselines."""
from flatland.core.env_observation_builder import (
    DummyObservationBuilder, ObservationBuilder,
)
from flatland.envs.rail_env_action import RailEnvActions
from app.policies.base import Policy


class DoNothingPolicy(Policy):
    def act_for_handle(self, handle, observation=None, eps=0.0):
        return RailEnvActions.DO_NOTHING

    def build_observation_builder(self) -> ObservationBuilder:
        return DummyObservationBuilder()
