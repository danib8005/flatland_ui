"""GET /policies — list all available policies for the UI selector."""
from fastapi import APIRouter
from pydantic import BaseModel

from app.policies.registry import policy_specs

router = APIRouter()


class PolicyInfo(BaseModel):
    id: str
    label: str
    description: str
    is_default: bool = False


@router.get("/policies", response_model=list[PolicyInfo])
def list_policies() -> list[PolicyInfo]:
    specs = policy_specs(include_hidden=False)
    if not specs:
        return []

    default_id = next((spec.id for spec in specs if spec.is_default), specs[0].id)

    return [
        PolicyInfo(
            id=spec.id,
            label=spec.label,
            description=spec.description,
            is_default=(spec.id == default_id),
        )
        for spec in specs
    ]
