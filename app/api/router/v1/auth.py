from fastapi import APIRouter, status
from pydantic import BaseModel

router = APIRouter()


class RequestOtpIn(BaseModel):
    email: str


@router.post("/auth/request-otp", status_code=status.HTTP_202_ACCEPTED)
def request_otp(payload: RequestOtpIn) -> dict[str, str]:
    _ = payload
    # Intentionally generic response to avoid user enumeration.
    return {"status": "accepted", "message": "If the email exists, an OTP will be sent."}
