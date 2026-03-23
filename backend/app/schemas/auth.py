from pydantic import BaseModel, Field


class AuthMeResponse(BaseModel):
    is_authenticated: bool
    subject: str | None = None
    email: str | None = None
    roles: list[str] = Field(default_factory=list)
