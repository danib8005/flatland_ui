"""ForwardOnlyPolicy: always emits MOVE_FORWARD. From flatland-baselines."""
from flatland.core.env_observation_builder import (
    DummyObservationBuilder, ObservationBuilder,
)
from flatland.envs.rail_env_action import RailEnvActions
from app.policies.base import Policy


class ForwardOnlyPolicy(Policy):
    def act_for_handle(self, handle, observation=None, eps=0.0):
        return RailEnvActions.MOVE_FORWARD

    def build_observation_builder(self) -> ObservationBuilder:
        return DummyObservationBuilder()
