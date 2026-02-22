from fastapi import APIRouter, Depends

from app.security.auth import require_api_key

router = APIRouter()


@router.get("/me", dependencies=[Depends(require_api_key)])
def me() -> dict[str, str]:
    return {"status": "ok"}
