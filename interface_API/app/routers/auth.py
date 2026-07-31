from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..security import authenticate_access_key, clear_session_cookie, set_session_cookie

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginBody(BaseModel):
    accessKey: str = ""


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    user = authenticate_access_key(db, body.accessKey)
    if user is None:
        return JSONResponse({"error": "Invalid access key"}, status_code=401)
    response = JSONResponse({"ok": True})
    set_session_cookie(response, user.id)
    return response


@router.post("/logout")
def logout(response: Response):
    response = JSONResponse({"ok": True})
    clear_session_cookie(response)
    return response
