from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..contracts.companies import CompanyCreateRequest, CompanyUpdateRequest
from ..database import get_db
from ..models import CalendarEvent, Company, Task, User
from ..security import get_current_user

router = APIRouter(prefix="/api/companies", tags=["companies"])


def serialize_company(company: Company) -> dict:
    return {"id": company.id, "name": company.name, "color": company.color}


@router.get("")
def list_companies(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    companies = db.execute(
        select(Company).where(Company.userId == user.id).order_by(Company.name.asc())
    ).scalars()
    return {"companies": [serialize_company(company) for company in companies]}


@router.post("")
def create_company(
    body: CompanyCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = body.name.strip()
    existing = db.execute(
        select(Company).where(Company.userId == user.id, Company.name == name)
    ).scalar_one_or_none()
    if existing:
        return {"company": serialize_company(existing)}
    company = Company(userId=user.id, name=name, color=body.color or "#8da2fb")
    db.add(company)
    db.flush()
    return {"company": serialize_company(company)}


@router.patch("")
def update_company(
    body: CompanyUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.execute(
        select(Company).where(Company.id == body.id, Company.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Company not found")
    if body.name is not None:
        existing.name = body.name.strip()
    if body.color is not None:
        existing.color = body.color
    db.flush()
    return {"company": serialize_company(existing)}


@router.delete("")
def delete_company(
    id: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not id:
        raise HTTPException(status_code=400, detail="Missing company id")
    existing = db.execute(
        select(Company).where(Company.id == id, Company.userId == user.id)
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Company not found")
    db.execute(Task.__table__.update().where(Task.companyId == id).values(companyId=None))
    db.execute(CalendarEvent.__table__.update().where(CalendarEvent.companyId == id).values(companyId=None))
    db.delete(existing)
    db.flush()
    return {"ok": True}
