"""ScenarioBuilder — generates what-if trajectory scenarios for the HMI.

Given a base env, finds the next decision point for a given agent, runs
a branch under each possible action option (LEFT / FORWARD / RIGHT /
STOP) plus the default policy's choice as a baseline, and returns a
sorted list of Scenario objects.

Usage
-----
    builder = ScenarioBuilder(env, default_policy_factory=DLAPolicy)
    scenarios = builder.generate_scenarios(handle=0, horizon=20)
    # → [Scenario(name='DLA', score=0.92, recommended=True, …),
    #    Scenario(name='LEFT', score=0.85, …),
    #    Scenario(name='STOP', score=0.40, badge='avoid', …)]

Scoring
-------
A scenario's score combines success rate, delay, and conflicts:

    score = w_success * success_rate
          - w_delay   * normalized_delay
          - w_conflict * normalized_conflicts

Higher is better. Range typically ~ [-0.5, 1.0].

Tags
----
- 'recommended' : top-scoring option with score >= 0.7
- 'avoid'       : score < 0.3 OR has deadlock_cycle / overdue_arrival
- (no tag)      : everything in between
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from flatland.envs.rail_env import RailEnv
from flatland.envs.rail_env_action import RailEnvActions

from app.core.scenario_runner import BranchResult, TrajectoryBranchRunner
from app.policies.base import Policy


PolicyFactory = Callable[[], Policy]


# ── Public types ────────────────────────────────────────────────────


@dataclass
class Scenario:
    """One what-if alternative for a given decision point."""
    name: str                                # human label: "LEFT", "DLA" baseline, …
    override_action: Optional[int]           # int(RailEnvActions) or None for baseline
    result: BranchResult
    score: float = 0.0
    tag: Optional[str] = None                # "recommended" | "avoid" | None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "override_action": self.override_action,
            "score": float(self.score),
            "tag": self.tag,
            "result": self.result.to_dict(),
        }


# ── Scoring ─────────────────────────────────────────────────────────


@dataclass
class ScoringWeights:
    """Weights for the scenario score. Sums need not be normalised;
    we report the raw weighted sum and let the UI rank by it."""
    success: float = 1.0
    delay: float = 0.4          # subtracted
    conflict: float = 0.2       # subtracted
    deadlock_penalty: float = 0.5  # extra penalty if any deadlock occurred


def score_branch(result: BranchResult, weights: ScoringWeights = ScoringWeights()) -> float:
    """Combine BranchResult metrics into a single score in roughly [-1, 1]."""
    sr = result.success_rate                      # in [0, 1]
    n_agents = max(1, result.total_agents)

    # Normalise delay: cap at 50 steps per agent
    total_delay = float(result.kpis.get("total_delay", 0))
    norm_delay = min(1.0, total_delay / (50.0 * n_agents))

    # Normalise conflicts: cap at 5 per agent
    n_blocked = float(result.kpis.get("num_blocked_events", 0))
    n_swap = float(result.kpis.get("num_swap_attempts", 0))
    n_total = n_blocked + n_swap
    norm_conflict = min(1.0, n_total / (5.0 * n_agents))

    # Hard penalty for deadlocks
    n_deadlock = float(result.kpis.get("num_deadlock_cycles", 0))
    deadlock = weights.deadlock_penalty if n_deadlock > 0 else 0.0

    return (
        weights.success * sr
        - weights.delay * norm_delay
        - weights.conflict * norm_conflict
        - deadlock
    )


def tag_for_score(score: float, result: BranchResult) -> Optional[str]:
    """Categorise a scored scenario for the UI."""
    if score < 0.3:
        return "avoid"
    if result.kpis.get("num_deadlock_cycles", 0) > 0:
        return "avoid"
    if result.kpis.get("num_overdue_arrivals", 0) > 0:
        return "avoid"
    if score >= 0.7:
        return "recommended"
    return None


# ── Builder ─────────────────────────────────────────────────────────


class ScenarioBuilder:
    """Generates and ranks what-if scenarios for one or more agents.

    The default candidate set per decision is:
        LEFT, FORWARD, RIGHT, STOP_MOVING

    Plus we always include a 'baseline' branch with no overrides
    (the default policy decides for everyone).
    """

    # Action labels used in scenario names / API payload.
    ACTION_LABELS: Dict[int, str] = {
        RailEnvActions.MOVE_LEFT.value: "LEFT",
        RailEnvActions.MOVE_FORWARD.value: "FORWARD",
        RailEnvActions.MOVE_RIGHT.value: "RIGHT",
        RailEnvActions.STOP_MOVING.value: "STOP",
    }

    def __init__(
        self,
        base_env: RailEnv,
        default_policy_factory: PolicyFactory,
        scoring_weights: ScoringWeights = ScoringWeights(),
    ):
        self._env = base_env
        self._policy_factory = default_policy_factory
        self._weights = scoring_weights
        self._runner = TrajectoryBranchRunner(base_env, default_policy_factory)

    # ── public API (filled in Part 2/3) ────────────────────────────

    def generate_scenarios(
        self,
        handle: int,
        horizon: int = 20,
        blocked_threshold: int = 3,
        candidate_actions: Optional[List[int]] = None,
    ) -> List[Scenario]:
        """For the given agent, run one branch per candidate action plus
        a baseline, score them, and return sorted descending by score.

        Parameters
        ----------
        handle : int
            Which agent gets the override applied.
        horizon : int
            Max steps per branch run.
        blocked_threshold : int
            Threshold for the conflict detector's blocked-streak metric.
        candidate_actions : list[int] | None
            Override the default candidate set
            (LEFT / FORWARD / RIGHT / STOP). Useful when the UI wants to
            restrict to a smaller subset (e.g. just the two switch options
            offered at the next decision cell).

        Returns
        -------
        list[Scenario]
            Sorted descending by score. The baseline is always included
            and labelled "baseline" so the UI can highlight it.
        """
        if handle < 0 or handle >= len(self._env.agents):
            raise ValueError(
                f"handle {handle} out of range; env has {len(self._env.agents)} agents"
            )

        if candidate_actions is None:
            candidate_actions = list(self.ACTION_LABELS.keys())
        # Normalise: enum members → ints
        candidates_int: List[int] = []
        for a in candidate_actions:
            ai = a.value if hasattr(a, "value") else int(a)
            if ai not in candidates_int:
                candidates_int.append(ai)

        scenarios: List[Scenario] = []

        # 1) Baseline first (no overrides → pure default policy).
        scenarios.append(self._baseline_scenario(horizon, blocked_threshold))

        # 2) One branch per candidate action.
        for action_int in candidates_int:
            scenarios.append(
                self._scenario_for_action(handle, action_int, horizon, blocked_threshold)
            )

        # 3) Sort descending by score.
        scenarios.sort(key=lambda s: s.score, reverse=True)

        # 4) Recompute tags so only the *top* scenario can be "recommended".
        #    Lower-ranked ties keep their tag (or stay None).
        if scenarios:
            top = scenarios[0]
            for s in scenarios[1:]:
                if s.tag == "recommended":
                    s.tag = None  # only one recommendation
            # If top did not earn "recommended" via threshold, leave as-is
            # (don't fabricate a recommendation).
            _ = top  # keep for clarity

        return scenarios

    # ── internals ──────────────────────────────────────────────────

    def _baseline_scenario(self, horizon: int, blocked_threshold: int) -> Scenario:
        """Run a branch with no overrides — pure default policy behaviour."""
        result = self._runner.run_branch(
            overrides={},
            max_steps=horizon,
            blocked_threshold=blocked_threshold,
        )
        score = score_branch(result, self._weights)
        return Scenario(
            name="baseline",
            override_action=None,
            result=result,
            score=score,
            tag=tag_for_score(score, result),
        )

    def _scenario_for_action(
        self, handle: int, action: int, horizon: int, blocked_threshold: int,
    ) -> Scenario:
        action_int = action.value if hasattr(action, "value") else int(action)
        result = self._runner.run_branch(
            overrides={handle: action_int},
            max_steps=horizon,
            blocked_threshold=blocked_threshold,
        )
        score = score_branch(result, self._weights)
        label = self.ACTION_LABELS.get(action_int, f"ACTION_{action_int}")
        return Scenario(
            name=label,
            override_action=action_int,
            result=result,
            score=score,
            tag=tag_for_score(score, result),
        )
