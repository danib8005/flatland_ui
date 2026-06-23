# Recommender roadmap — two pluggable seams

Goal: stay flexible so other / trained (RL) algorithms can be plugged in later,
and keep **policy change (system-wide strategy)** separate from **intervention
recommendation (local fix for a malfunction)**.

## The two seams

1. **Agent / Policy seam** — drives the trains. Existing `app/policies` registry.
   Heuristics, PP/CBS planners, and trained RL (PPO) all implement `Policy` and
   register. This is where RL ultimately lives (a trained model = one more Policy).
2. **Intervention recommender seam** — suggests the local action for a
   malfunction. New `app/core/recommenders` registry (`InterventionRecommender`).
   Stable dict contract so the engine can change without UI changes.

A trained RL model can serve **either** role (Policy for Director, or Recommender
for Recommendation / Co-Learning).

## Status

- ✅ Policy registry (heuristics today).
- ✅ Intervention recommender seam: `InterventionRecommender` + registry;
  `Phase1ProximityRecommender` is the first implementation (wraps the impact
  analysis); `/hmi/impact` resolves the active recommender.

## Planned (in order)

1. **Greedy what-if recommender** (`recommenders/greedy_whatif.py`): for each
   affected train, simulate its options (reroute / hold / proceed) with the
   ScenarioRunner, score KPI-weighted, pick best. Up to 3 ranked per situation.
2. **PP replan recommender** (`recommenders/pp_replan.py`): block the malfunction
   cell for its duration, run Prioritized Planning on the affected trains only →
   coherent multi-train reroute/hold/reorder set. First real use of our own PP
   planner ([[cbs-pp-planner-integration]]), scoped locally. CBS variant later.
3. **Impact panel: up to 3 ranked intervention options** + mode-aware apply
   (recommendation = highlighted + apply; co-learning = neutral / inspect;
   director = overview).
4. **Clear UI separation**: intervention recommendations live in the impact panel;
   policy-change recommendations stay in the scenario panel. Label both distinctly.
5. **RL recommender** (`recommenders/rl_recommender.py`): a trained model behind
   the same seam. No UI change.
6. **Recommender selection** (settings / per session): choose the active
   recommender, like policy selection.

## RL wave (Policy seam)

- PPO agent as a `Policy` (the "real RL" goal). Train ourselves (no pretrained in
  T3.4). See rl-agents-goal memory.

Keep the data contracts stable (`Intervention` item dict / `Recommendation` list)
throughout so any engine swap is transparent to the frontend.
