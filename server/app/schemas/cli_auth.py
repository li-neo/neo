from pydantic import BaseModel


class CliBootstrapStart(BaseModel):
    token_name: str = "openclaw-operator"
    expires_in_days: int | None = 30
    client_name: str | None = None


class CliBootstrapApprove(BaseModel):
    session_id: str
    user_code: str

