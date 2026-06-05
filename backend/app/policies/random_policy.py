from typing import Any, Dict, List
import numpy as np


class RandomPolicy:
    def __init__(self, action_size: int = 5, seed: int = 42):
        self.action_size = action_size
        self.rng = np.random.default_rng(seed)

    def act(self, observation: Any, **kwargs) -> int:
        return int(self.rng.integers(0, self.action_size))

    def act_many(self, handles: List[int], observations: Dict[int, Any], **kwargs) -> Dict[int, int]:
        return {h: self.act(observations.get(h)) for h in handles}
