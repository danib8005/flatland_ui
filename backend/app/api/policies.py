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
    show_in_ui: bool = False
    supports_scenarios: bool = False


@router.get("/policies", response_model=list[PolicyInfo])
def list_policies() -> list[PolicyInfo]:
    specs = policy_specs(include_hidden=True)
    if not specs:
        return []

    default_id = next((spec.id for spec in specs if spec.is_default), specs[0].id)

    return [
        PolicyInfo(
            id=spec.id,
            label=spec.label,
            description=spec.description,
            is_default=(spec.id == default_id),
            show_in_ui=spec.show_in_ui,
            supports_scenarios=spec.supports_scenarios,
        )
        for spec in specs
    ]
