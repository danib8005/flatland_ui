"""Adapter: ScenarioBuilder.Scenario → app.models.hmi.ScenarioOption.

Keeps the API contract stable for the frontend while we replace the
hmi_mock with real what-if trajectories.

The kpiDelta is computed *relative to the baseline*:
  - time:    baseline.total_delay - candidate.total_delay
             (positive → candidate has less delay → "better")
  - energy:  baseline.num_conflicts*5 - candidate.num_conflicts*5
             (rough heuristic: each conflict costs 5 energy units)
"""
from __future__ import annotations

from typing import List, Optional

from app.core.scenario_builder import Scenario
from app.core.scenario_runner import BranchResult
from app.models.hmi import KpiDelta, ScenarioOption


def _describe(result: BranchResult) -> str:
    """Generate a human-readable one-liner describing the branch outcome."""
    done = f"{result.success_count}/{result.total_agents} trains arrive"
    n_conf = len(result.conflicts)
    delay = int(result.kpis.get("total_delay", 0))
    n_dl = int(result.kpis.get("num_deadlock_cycles", 0))

    parts = [done]
    if n_conf:
        parts.append(f"{n_conf} conflict{'s' if n_conf != 1 else ''}")
    if delay:
        parts.append(f"{delay}-step delay")
    if n_dl:
        parts.append(f"⚠ {n_dl} deadlock{'s' if n_dl != 1 else ''}")
    return ", ".join(parts) + f" (over {result.elapsed_steps} steps)"


def _conflict_count(result: BranchResult) -> int:
    """Total non-informational conflicts (used for energy proxy)."""
    by_kind = result.kpis.get("by_kind", {}) or {}
    return (
        int(by_kind.get("blocked", 0))
        + int(by_kind.get("swap_attempt", 0))
        + int(by_kind.get("deadlock_cycle", 0))
    )


def scenario_to_option(
    scenario: Scenario,
    baseline: Optional[BranchResult],
    handle: int,
) -> ScenarioOption:
    """Convert one Scenario to the API-compatible ScenarioOption."""
    res = scenario.result

    base_delay = int((baseline.kpis.get("total_delay", 0) if baseline else 0))
    cand_delay = int(res.kpis.get("total_delay", 0))
    time_delta = base_delay - cand_delay

    base_conflicts = _conflict_count(baseline) if baseline else 0
    cand_conflicts = _conflict_count(res)
    energy_delta = (base_conflicts - cand_conflicts) * 5

    return ScenarioOption(
        id=f"s_h{handle}_{scenario.name.lower()}",
        title=scenario.name,
        description=_describe(res),
        kpiDelta=KpiDelta(time=int(time_delta), energy=int(energy_delta)),
        isRecommended=(scenario.tag == "recommended"),
    )


def scenarios_to_options(scenarios: List[Scenario], handle: int) -> List[ScenarioOption]:
    """Convert a list of Scenarios. Uses the baseline (name='baseline')
    as reference for delta calculation."""
    baseline_result = next(
        (s.result for s in scenarios if s.name == "baseline"),
        None,
    )
    return [scenario_to_option(s, baseline_result, handle) for s in scenarios]
