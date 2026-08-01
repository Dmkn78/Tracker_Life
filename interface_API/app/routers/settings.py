from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..contracts.settings import SettingsUpdateRequest
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
    body: SettingsUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.calorie_target is not None:
        user.calorieTarget = body.calorie_target
    if body.default_sleep_delay_min is not None:
        user.defaultSleepDelayMin = body.default_sleep_delay_min
    db.add(user)
    db.flush()
    return _settings_payload(user)
