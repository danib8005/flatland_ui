"""GET /policies — list all available policies for the UI selector."""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class PolicyInfo(BaseModel):
    id: str
    label: str
    description: str
    is_default: bool = False


_POLICIES: list[PolicyInfo] = [
    PolicyInfo(
        id="deadlock_avoidance",
        label="DLA (Default)",
        description="Avoids deadlocks proactively by checking opponent paths.",
        is_default=True,
    ),
    PolicyInfo(
        id="shortest_path",
        label="Shortest Path",
        description="Each agent picks the action that minimises distance to its target.",
    ),
    PolicyInfo(
        id="forward_only",
        label="Forward Only",
        description="Always MOVE_FORWARD; ignores switches.",
    ),
    PolicyInfo(
        id="do_nothing",
        label="Do Nothing",
        description="All agents stay still (DO_NOTHING).",
    ),
    PolicyInfo(
        id="random",
        label="Random",
        description="Picks a random valid action per agent.",
    ),
]


# Policies kept registered (for API backward compat) but hidden from the
# UI selector — they're didactic baselines, not useful in operation.
_HIDDEN_FROM_UI = {"forward_only", "do_nothing"}


@router.get("/policies", response_model=list[PolicyInfo])
def list_policies() -> list[PolicyInfo]:
    return [p for p in _POLICIES if p.id not in _HIDDEN_FROM_UI]
