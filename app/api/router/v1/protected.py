from fastapi import APIRouter, Depends

from app.database.models.user import User
from app.security.auth import require_current_user

router = APIRouter()


@router.get("/me")
def me(current_user: User = Depends(require_current_user)) -> dict[str, str | int | None]:
    return {
        "id": current_user.id,
        "email": current_user.email,
        "handle": current_user.handle,
    }
