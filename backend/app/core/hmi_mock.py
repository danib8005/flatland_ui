"""Procedurale HMI-Mock-Daten basierend auf Session-Seed.

Reproduzierbar (gleicher Seed -> gleiche Daten), aber abwechslungsreich
genug fuer einen realistischen PoC-Eindruck.
"""
import hashlib
from typing import List

from app.models.hmi import (
    AppNotification,
    HmiBundle,
    KpiDelta,
    Recommendation,
    RelatedElement,
    ScenarioOption,
)

_NOTIFICATION_TEMPLATES = [
    ("warning", "Switch Failure",     "Switch {id} reports a fault."),
    ("warning", "Train Delay",        "Train {id} is running 90s late."),
    ("info",    "Signal Restored",    "Signal {id} cleared after maintenance."),
    ("error",   "Track Blocked",      "Track segment near switch {id} is blocked."),
    ("info",    "Train Departed",     "Train {id} has departed station."),
    ("warning", "Conflict Detected",  "Routing conflict at switch {id}."),
]

_SCENARIO_TEMPLATES = [
    ("Reroute via Track 2", "Take alternate route via track 2 to avoid conflict."),
    ("Hold and Wait",       "Hold train at current position for 60s."),
    ("Proceed Normally",    "Continue with current plan, accept delay."),
    ("Skip Stop",           "Skip non-essential stop to recover time."),
]

_RECOMMENDATION_TEMPLATES = [
    ("Take Scenario {sid}",         "AI recommends scenario {sid} based on KPI weights."),
    ("Override Agent {aid} = LEFT", "AI suggests turning agent {aid} left at next switch."),
    ("Hold Agent {aid}",            "Hold agent {aid} for 1 step to resolve conflict."),
]


def _seeded(session_id: str, step: int, salt: str = "") -> int:
    h = hashlib.md5(f"{session_id}|{step}|{salt}".encode()).hexdigest()
    return int(h[:8], 16)


def _pick(items, n: int):
    return items[n % len(items)]


def generate_notifications(session_id: str, step: int) -> List[AppNotification]:
    out: List[AppNotification] = []
    for i in range(3):
        slot = step // 25 - i
        if slot < 0:
            continue
        seed = _seeded(session_id, slot, "noti")
        kind, title, tmpl = _pick(_NOTIFICATION_TEMPLATES, seed)
        elem_id = str(seed % 9999).zfill(4)
        elem_kind = _pick(["train", "switch", "signal"], seed >> 8)
        out.append(AppNotification(
            id=f"n_{slot}_{seed % 1000}",
            kind=kind,
            title=title,
            message=tmpl.format(id=elem_id),
            timestamp=slot * 25,
            relatedElement=RelatedElement(kind=elem_kind, id=elem_id),
        ))
    return out


def generate_scenarios(session_id: str, step: int) -> List[ScenarioOption]:
    out: List[ScenarioOption] = []
    base_seed = _seeded(session_id, step // 50, "scn")
    for i in range(3):
        seed = base_seed + i * 7919
        title, desc = _pick(_SCENARIO_TEMPLATES, seed)
        time_delta = -((seed % 180) - 60)
        energy_delta = ((seed >> 4) % 80) - 40
        out.append(ScenarioOption(
            id=f"s_{step // 50}_{i}",
            title=title,
            description=desc,
            kpiDelta=KpiDelta(time=time_delta, energy=energy_delta),
            isRecommended=(i == 0),
        ))
    return out


def generate_recommendations(session_id: str, step: int) -> List[Recommendation]:
    seed = _seeded(session_id, step // 30, "rec")
    title_tmpl, desc_tmpl = _pick(_RECOMMENDATION_TEMPLATES, seed)
    sid = f"s_{step // 50}_{seed % 3}"
    aid = str(seed % 5)
    confidence = 0.55 + ((seed >> 6) % 45) / 100.0
    countdown = 15 + (seed % 45)
    return [Recommendation(
        id=f"r_{step // 30}_{seed % 100}",
        title=title_tmpl.format(sid=sid, aid=aid),
        description=desc_tmpl.format(sid=sid, aid=aid),
        confidence=round(confidence, 2),
        countdownSeconds=countdown,
        scenarioId=sid,
    )]


def generate_bundle(session_id: str, step: int) -> HmiBundle:
    return HmiBundle(
        notifications=generate_notifications(session_id, step),
        scenarios=generate_scenarios(session_id, step),
        recommendations=generate_recommendations(session_id, step),
    )
