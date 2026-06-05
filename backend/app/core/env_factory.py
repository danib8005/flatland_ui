from flatland.envs.rail_env import RailEnv
from flatland.envs import rail_generators as rail_gen
from flatland.envs import line_generators as line_gen
import flatland.envs.timetable_generators as ttg


def create_env(
    width: int = 30,
    height: int = 30,
    number_of_agents: int = 3,
    seed: int = 42,
    max_num_cities: int = 2,
    max_rails_between_cities: int = 2,
    max_rail_pairs_in_city: int = 2,
) -> RailEnv:
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
