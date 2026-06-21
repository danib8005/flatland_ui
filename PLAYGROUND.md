# Playground — what's new in this branch

> Branch: `experiment/vibecoding-playground` (fork `danib8005/flatland_ui`).
> This document summarises the changes made on top of `upstream/aiAdrian` so the
> work is easy to review and selectively adopt. Nothing here changes the backend
> contract — all features are frontend-first unless noted.

To see the raw diff against the original:

```bash
git fetch upstream
git diff upstream/main...experiment/vibecoding-playground
```

---

## TL;DR

The branch turns the dispatcher into a **mode-driven human-AI teaming prototype**
aligned with the three AI4REALNET collaboration modes (WP 3.1 / 3.3 / 3.4), plus
a round of UI cleanup toward the SBB design system and the InteractiveAI
event-centric direction.

The full design rationale (grounded in AI4REALNET RP2 Part B) lives in
[`docs/interaction-modes-brief.md`](docs/interaction-modes-brief.md).

---

## 1. Three interaction modes (WP 3.1 / 3.3 / 3.4)

A new `InteractionMode` (`recommendation` | `co-learning` | `director`) drives the
whole UI. Switchable at runtime from the header; behaviour differs per mode.

- **Recommendation (WP 3.1):** AI surfaces a preferred option with confidence; the
  recommendations panel is shown and scenarios are ranked/badged by KPI score.
- **Co-Learning (WP 3.3):** options are presented **neutrally** — no recommended
  badge, no score reordering, recommendation panel hidden. Human interventions
  (overrides) are logged (`coLearningFeedback`) and a **reflection panel** appears
  at episode end (questions mirror AI4REALNET/T3.3-3.4-HMI).
- **Director (WP 3.4):** AI dispatches autonomously (auto-play on entering the
  mode), per-incident option prompts are suppressed, and an **"AI in control"**
  banner is shown; overrides count as manual interventions.

The single source of truth for option framing is the `optionPresentation`
computed (`recommended` | `neutral` | `none`) in `SessionStore` — every options
surface reads it, there is no parallel flag.

Key files: `core/session.store.ts`, `core/events/event-types.ts`,
`app.component.*`, `features/scenario-panel/*`, `features/co-learning-reflection/*`.

## 2. KPI filter is now wired

Previously the KPI sliders set a signal that nothing consumed. Added
`kpiWeights` (normalised) in `SessionStore` as the single consumption surface;
the scenario panel now ranks alternatives by a KPI-weighted score in
Recommendation mode (`rankedScenarios`). The concrete weight→KPI scoring is
intentionally provisional — the wiring is the point; final semantics (and any
backend scoring) are open.

Key files: `core/session.store.ts`, `features/kpi-filter/*`,
`features/scenario-panel/*`.

## 3. Header redesign (SBB app-shell direction)

- AI4REALNET logo + title on the left.
- **Mode switcher** as an sbb.ch-style dropdown (`sbb-menu`) showing the current
  mode with a colour dot; WP labels in the menu.
- **☰ app menu** holds Session Settings, Scenarios / Policy, and Reset — these
  moved out of the toolbar. The toolbar now only carries simulation controls
  (Play/Pause, speed, step, policy).
- The old top **toggle switches** for Settings / Scenarios (semantically wrong —
  they opened dialogs) were replaced by real buttons / menu entries.

Key files: `app.component.*`, `features/toolbar/*`, `main.ts` (menu imports).

## 4. Event feed (toward InteractiveAI)

The notifications panel became a leading **Event Feed**: header with
error/warning/total **count badges**, criticality colour markers (replacing the
emoji icons), clearer hierarchy. Lays groundwork for the event-centric layout.

Key files: `features/notifications-panel/*`.

## 5. Agent details as an inline card

The thin "Agent Info" line + fixed hover-popover were replaced by a clean
**inline detail card** that appears when an agent is selected (colour dot, train
id, state badge, 2-column data grid, delay/malfunction highlighting). The
component's ~500-line `!important`-heavy SCSS was rewritten to ~90 clean lines.

Key files: `features/agent-inspector/*`.

## 6. Layer visibility moved to the map

Layer toggles control the map, so they moved from the left column into a **map
controls bar** above the map (next to the View toggle), rendered as compact
chips and only shown when the map is visible. The left column is now Event Feed +
KPI filter.

Key files: `app.component.*`, `features/layer-visibility/*`,
`features/view-toggle/*`.

## 7. Cleanup

- Removed ~180 lines of dead/duplicated settings + policy dialog markup in
  `app.component.html` (the welcome `@else` branches were unreachable).
- Replaced emoji icons (KPI filter, notifications) with SBB-consistent markers.

---

## Status / known limitations

- All AI in every mode still runs the existing **heuristic policies**. Real RL
  agents (e.g. the PPO agent from AI4REALNET/T3.4-with-HMI, or CBS/PP from
  Tokener) are the intended next step via the existing `Policy` registry — see
  the brief.
- Co-Learning feedback and reflection answers are **client-side only** (no
  persistence layer yet).
- KPI weights affect scenario ordering, not backend scoring.
- Not yet implemented from the brief: reflection "when calm" (§3.2), Director
  pre-run directive + goal-achievement view (§3.4), what-if "actual vs
  alternative" compare (§3.3).

## Build & run

Unchanged from the main README — `npm install` + `ng serve` in `frontend/`,
FastAPI backend in `backend/`.
