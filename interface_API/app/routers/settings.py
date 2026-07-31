from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..security import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _settings_payload(user: User) -> dict:
    return {
        "settings": {
            "calorieTarget": user.calorieTarget,
            "defaultSleepDelayMin": user.defaultSleepDelayMin,
            "theme": "dark",
        }
    }


@router.get("")
def get_settings_route(user: User = Depends(get_current_user)):
    return _settings_payload(user)


@router.patch("")
def update_settings(
    body: dict = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    def as_int(value):
        try:
            parsed = int(float(value))
            return parsed
        except (TypeError, ValueError):
            return None

    calorie_target = as_int(body.get("calorieTarget"))
    sleep_delay = as_int(body.get("defaultSleepDelayMin"))
    if calorie_target is not None:
        user.calorieTarget = calorie_target
    if sleep_delay is not None:
        user.defaultSleepDelayMin = sleep_delay
    db.add(user)
    db.flush()
    return _settings_payload(user)
