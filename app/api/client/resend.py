import json
from urllib import error, request


class ResendError(RuntimeError):
    pass


def send_otp_email(
    *,
    api_key: str,
    from_email: str,
    to_email: str,
    otp_code: str,
    otp_ttl_minutes: int,
    base_url: str = "https://api.resend.com",
) -> None:
    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": "Your Blyss login code",
        "text": f"Your Blyss verification code is {otp_code}. It expires in {otp_ttl_minutes} minutes.",
    }
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url=f"{base_url.rstrip('/')}/emails",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with request.urlopen(req, timeout=10) as resp:
            status_code = getattr(resp, "status", 200)
            if status_code < 200 or status_code >= 300:
                raise ResendError(f"Resend returned non-success status: {status_code}")
    except error.HTTPError as exc:
        raise ResendError(f"Resend HTTP error: {exc.code}") from exc
    except error.URLError as exc:
        raise ResendError("Could not reach Resend API") from exc
