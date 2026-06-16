"""Env factory with robust generation and configurable session properties."""
import warnings
from typing import Optional

from flatland.envs.rail_env import RailEnv
from flatland.envs import rail_generators as rail_gen
from flatland.envs import line_generators as line_gen
import flatland.envs.timetable_generators as ttg


class EnvGenerationError(Exception):
    """Raised when Flatland cannot produce a valid env for the given params."""
    def __init__(self, message: str, params: dict, attempts: int):
        super().__init__(message)
        self.params = params
        self.attempts = attempts


def _speed_ratio_map(profile: str) -> dict[float, float]:
    """Flatland speed profile probabilities."""
    profiles = {
        "uniform_1_0": {1.0: 1.0},
        "uniform_0_5": {0.5: 1.0},
        "uniform_0_33": {0.33: 1.0},
        "uniform_0_25": {0.25: 1.0},
        "mixed": {1.0: 0.25, 0.5: 0.25, 0.33: 0.25, 0.25: 0.25},
    }
    return profiles.get(profile, profiles["uniform_1_0"])


def _apply_latest_departure_limit(env: RailEnv, latest_departure_max: int | None) -> None:
    """Clamp agent earliest departures so no train starts later than the limit."""
    if latest_departure_max is None:
        return
    limit = max(0, int(latest_departure_max))
    for agent in getattr(env, "agents", []):
        if hasattr(agent, "earliest_departure"):
            try:
                current = int(getattr(agent, "earliest_departure") or 0)
                setattr(agent, "earliest_departure", min(current, limit))
            except Exception:
                pass


def _build_once(
    width,
    height,
    number_of_agents,
    seed,
    max_num_cities,
    max_rails_between_cities,
    max_rail_pairs_in_city,
    speed_profile,
    line_length,
    latest_departure_max,
):
    env = RailEnv(
        width=width,
        height=height,
        number_of_agents=number_of_agents,
        rail_generator=rail_gen.sparse_rail_generator(
            max_num_cities=max_num_cities,
            seed=seed,
            grid_mode=False,
            max_rails_between_cities=max_rails_between_cities,
            max_rail_pairs_in_city=max_rail_pairs_in_city,
        ),
        line_generator=line_gen.sparse_line_generator(
            speed_ratio_map=_speed_ratio_map(speed_profile),
            seed=seed,
            line_length=line_length,
        ),
        timetable_generator=ttg.timetable_generator,
    )
    obs, info = env.reset()
    _apply_latest_departure_limit(env, latest_departure_max)
    return env, obs, info


def create_env(
    width: int = 30,
    height: int = 30,
    number_of_agents: int = 3,
    seed: int = 42,
    max_num_cities: int = 2,
    max_rails_between_cities: int = 2,
    max_rail_pairs_in_city: int = 2,
    max_episode_steps: int | None = None,
    latest_departure_max: int | None = 20,
    speed_profile: str = "uniform_1_0",
    line_length: int = 4,
    max_retries: int = 5,
) -> RailEnv:
    """Build a RailEnv. If Flatland fails, retry with seed+1, seed+2, ..."""
    last_err: Optional[Exception] = None
    params = dict(
        width=width,
        height=height,
        number_of_agents=number_of_agents,
        seed=seed,
        max_num_cities=max_num_cities,
        max_rails_between_cities=max_rails_between_cities,
        max_rail_pairs_in_city=max_rail_pairs_in_city,
        max_episode_steps=max_episode_steps,
        latest_departure_max=latest_departure_max,
        speed_profile=speed_profile,
        line_length=line_length,
    )

    for attempt in range(max_retries):
        try_seed = seed + attempt
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                env, obs, info = _build_once(
                    width,
                    height,
                    number_of_agents,
                    try_seed,
                    max_num_cities,
                    max_rails_between_cities,
                    max_rail_pairs_in_city,
                    speed_profile,
                    line_length,
                    latest_departure_max,
                )
                if max_episode_steps is not None and max_episode_steps > 0:
                    env._max_episode_steps = int(max_episode_steps)
                env._initial_obs = obs
                env._initial_info = info
                return env
        except (IndexError, ValueError, RuntimeError) as e:
            last_err = e
            continue

    raise EnvGenerationError(
        f"Flatland could not generate a valid env after {max_retries} retries "
        f"(width={width}, height={height}, agents={number_of_agents}, "
        f"cities={max_num_cities}). Last error: {last_err!r}",
        params=params,
        attempts=max_retries,
    )
