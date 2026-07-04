# Interaction framework — tiles, functions, allocation, accountability

> The conceptual backbone for **authoring** HMI elements ("tiles") in this
> playground. It answers three questions about any element: **what function** it
> serves in the human-AI loop, **at what granularity**, and **who owns which
> part** of the loop. It is grounded in the AI4REALNET / InteractiveAI reference
> framework and classic control-room theory.
>
> Companions: [visual-concept.md](visual-concept.md) (canonical surface names +
> zones), [panel-mode-matrix.md](panel-mode-matrix.md) (per-panel behaviour per
> mode), [interaction-modes-brief.md](interaction-modes-brief.md) (authoritative
> mode spec). This doc is the layer *above* those: the vocabulary they instantiate.

## 1. Grounding — the AI4REALNET / InteractiveAI vocabulary

The consortium reference is the **AI4REALNET Conceptual Framework for AI-based
Decision Systems in Critical Infrastructures** (arXiv 2504.16133), sharpened by
deliverable **D3.1 "AI4REALNET solutions to augment human decision-making"
(2026)**. It names **eight system functions**:

1. Context Determination · 2. **Anticipation** · 3. Operator Interaction ·
4. Feedback Integration · 5. Interaction Mode Selection · 6. Learning ·
7. Decision Assistance · 8. Compliance Monitoring

The **InteractiveAI** platform (IRT SystemX) instantiates this as an event loop:
**Event → Context → (AI) → Notification → Human Decision → Capitalization
(learning)**.

Two AI capabilities are treated as **distinct** and are the novel core:
- **Prediction (Anticipation)** — *forecasting future events to enable proactive
  intervention.*
- **Assessment (Evaluative AI)** — *providing evidence for and against a range of
  options* rather than a single directive (present trade-offs, don't prescribe).

## 2. Tile `kind` — function in the human-AI loop

The **primary** classification of a tile is its function in the loop, not its
form (text/chart/button). Sub-types can be added under a `kind` later without
reshuffling the top level.

| `kind` | AI4REALNET function | What the tile answers | Examples today | AI-novel |
|--------|---------------------|-----------------------|----------------|:--------:|
| **Event** | Event / Context (detect) | *What is happening?* (event synthesis / Hypervision) | Situation Summary, Event Feed | |
| **Context** | Context Determination | *Why, how bad, whom does it affect?* | Conflict Panel, Train Detail Overlay | |
| **Prediction** | Anticipation | *What happens next / what-if?* | Marey forecast, ETA overlays | ⭐ |
| **Decision Support** | Decision Assistance / Evaluative AI | *Which option, on what evidence?* | Recommendation Panel, Scenario compare | ⭐ |
| **Control** | Operator Interaction / Mode Selection | *Enact / adjust.* | Toolbar, overrides, KPI filter, Director directive | |
| **Capitalization** | Feedback Integration / Learning | *What do we learn from this?* | Co-Learning reflection, feedback log | ⭐ |
| **Trust** | Compliance Monitoring (+ Evaluative AI) | *Can I rely on the AI here?* | (honest-uncertainty, confidence, explanation, reliability) | ⭐ |

### Decision Support has mode-framings (extensible sub-types)
The same decision surface is **framed by the mode** — this is why `kind` predicts
mode-behaviour:
- **Assessment** (Evaluative AI: evidence for/against, neutral) → **Co-Learning**
- **Recommendation** (ranked + confidence) → **Recommendation** mode
- suppressed / read-only → **Director** (AI acts)

`Recommendation` is therefore **not** a peer `kind`: it is a *framing of Decision
Support* that feeds Control, and it stays advisory under **Human-in-Control**
(§4). Further sub-types (e.g. counterfactual, contrastive) can be added later.

## 3. Orthogonal axes (attributes, not kinds)

- **`granularity` — overview ↔ detail.** Shneiderman's mantra ("overview first,
  zoom and filter, details on demand"). The overview end *is* Hypervision (the
  big-board synthesis); the detail end is drill-down / detail-in-context (Train
  Detail Overlay, Event Detail Card). A tile declares where it sits and, ideally,
  what it drills into.

- **`allocation` — who owns each loop stage.** A map `{loop-stage → human | ai |
  shared}`. **Today it is derived from the interaction mode** (static per
  condition — correct for a controlled experiment). It is modelled as its **own
  concept**, *not* baked into `InteractionMode`, so that dynamic reallocation
  becomes a runtime change of the same structure rather than a refactor (§5).

## 4. Human-in-Control — the autonomy principle

"Human-in-Control" is **not a tile kind**; it is the principle governing
`allocation`: actuation authority stays with the human unless explicitly and
reversibly delegated. Grounded in levels-of-automation theory (Sheridan &
Verplank 1978; Parasuraman, Sheridan & Wickens 2000: *types × levels* of
automation) and in AI4REALNET's three collaboration levels (= our three modes).
It is why a prominent Recommendation is still advisory input, not control.

## 5. Reserved seams — designed for, not yet built

These are **deliberately not implemented now**. They are documented so current
choices don't foreclose them.

### 5a. Dynamic function allocation (adaptive/adaptable autonomy)
Today allocation changes only on **mode switch**. The frontier (T3.4 "adjustable
autonomy") is **runtime** reallocation — per situation, per agent, negotiated.
**Seam:** because `allocation` is a first-class data structure (§3), enabling
this later means changing *when/what sets it*, not the model. Do not couple
allocation logic irreversibly to the mode union.

### 5b. Accountability (responsibility-taking)
Distinct from liability: this is about the operator's **readiness and ability to
take on delegated responsibility**, and what a system must provide so that
responsibility is *fair and real* — see **Meaningful Human Control** (Santoni de
Sio & van den Hoven 2018) and the **"moral crumple zone"** failure mode (Elish
2019), where a human is nominally responsible but not actually in a position to
act.

**Seam (measurement-ready):** model decisions as **first-class events with an
`accountableOwner`** (derived from `allocation`) and a lifecycle
(`detected → acknowledged → decision → resolved → logged`, per InteractiveAI +
the [interaction-logging-plan](../plans/interaction-logging-plan.md)). Then the
behavioural signals that indicate responsibility-taking fall out for free:
acceptance / override / deferral / reaction time / non-action. Building none of
this now; but if decisions are logged as owned events, accountability becomes
**analysable later without a refactor**.

> **Operator's own framing — to integrate.** This section will be deepened from
> the project owner's accountability notes (definitions, enabling conditions,
> failure modes, observable signals, references). Placeholder until then.

## 6. What this means for the build

Materialise now: **`kind` + `granularity`** on `PanelDefinition`, and **Trust** as
a first-class kind. Introduce **`allocation`** as a concept derived from the mode
(seam for §5a). Keep accountability as the documented seam in §5b (events with an
owner) — realised together with interaction logging, not before. The tile-spec
template builds on this: `kind × granularity`, then per-mode framing (Decision
Support: Assessment ↔ Recommendation), then system interaction (data in / actions
out), then the grounding reference + acceptance scenario.

## Sources
- AI4REALNET Conceptual Framework — arXiv 2504.16133; AI4REALNET **D3.1** (2026), https://ai4realnet.eu/deliverables/
- InteractiveAI (IRT SystemX) — https://github.com/IRT-SystemX/InteractiveAI
- Situation awareness — Endsley (1995). Levels/types of automation — Sheridan & Verplank (1978); Parasuraman, Sheridan & Wickens (2000).
- Meaningful Human Control — Santoni de Sio & van den Hoven (2018). Moral crumple zone — Elish (2019).
- Trust calibration — Lee & See (2004); Parasuraman & Riley (1997). Information-seeking mantra — Shneiderman (1996).
