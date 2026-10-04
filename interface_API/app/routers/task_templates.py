from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..contracts.task_templates import TaskTemplateCreateRequest, reusable_task_fields
from ..core.task_content import has_task_content
from ..database import get_db
from ..models import TaskTemplate, User
from ..security import get_current_user

router = APIRouter(prefix="/api/task-templates", tags=["task templates"])


def serialize_template(template: TaskTemplate) -> dict:
    return {"id": template.id, "name": template.name, "fields": template.fields}


@router.get("")
def list_templates(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    templates = db.scalars(select(TaskTemplate).where(TaskTemplate.userId == user.id).order_by(TaskTemplate.createdAt))
    return {"templates": [serialize_template(template) for template in templates]}


@router.post("")
def create_template(body: TaskTemplateCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not has_task_content(body.fields.title, body.fields.description, body.fields.is_day):
        raise HTTPException(status_code=400, detail="Add content to the template")
    template = TaskTemplate(userId=user.id, name=body.name, fields=reusable_task_fields(body.fields))
    db.add(template)
    db.flush()
    return {"template": serialize_template(template)}


@router.delete("")
def delete_template(id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    template = db.scalar(select(TaskTemplate).where(TaskTemplate.id == id, TaskTemplate.userId == user.id))
    if template is None:
        raise HTTPException(status_code=404, detail="Task template not found")
    db.delete(template)
    db.flush()
    return {"ok": True}
