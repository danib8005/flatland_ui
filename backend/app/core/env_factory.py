"""Env factory with robust generation: retries on Flatland's seed-dependent
crashes (timetable IndexError, line generator TruncationError, etc.).

If all retries fail, raises EnvGenerationError which the API layer turns
into a 422 response.
"""
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


def _build_once(width, height, number_of_agents, seed,
                max_num_cities, max_rails_between_cities, max_rail_pairs_in_city):
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
            speed_ratio_map={1.0: 0.25, 0.5: 0.25, 0.33: 0.25, 0.25: 0.25},
            seed=seed,
            line_length=4,
        ),
        timetable_generator=ttg.timetable_generator,
    )
    env.reset()
    return env


def create_env(
    width: int = 30,
    height: int = 30,
    number_of_agents: int = 3,
    seed: int = 42,
    max_num_cities: int = 2,
    max_rails_between_cities: int = 2,
    max_rail_pairs_in_city: int = 2,
    max_episode_steps: int | None = None,
    max_retries: int = 5,
) -> RailEnv:
    """Build a RailEnv. If Flatland fails to generate (seed/size combo
    is unfortunate), retry with seed+1, seed+2, ..."""
    last_err: Optional[Exception] = None
    params = dict(
        width=width, height=height, number_of_agents=number_of_agents,
        seed=seed, max_num_cities=max_num_cities,
        max_rails_between_cities=max_rails_between_cities,
        max_rail_pairs_in_city=max_rail_pairs_in_city,
    )

    for attempt in range(max_retries):
        try_seed = seed + attempt
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                env = _build_once(
                    width, height, number_of_agents, try_seed,
                    max_num_cities, max_rails_between_cities, max_rail_pairs_in_city,
                )
                if max_episode_steps is not None and max_episode_steps > 0:
                    env._max_episode_steps = int(max_episode_steps)
                return env
        except (IndexError, ValueError, RuntimeError) as e:
            # Typical: timetable_generator IndexError, line_generator truncation.
            last_err = e
            continue

    raise EnvGenerationError(
        f"Flatland could not generate a valid env after {max_retries} retries "
        f"(width={width}, height={height}, agents={number_of_agents}, "
        f"cities={max_num_cities}). Last error: {last_err!r}",
        params=params,
        attempts=max_retries,
    )
