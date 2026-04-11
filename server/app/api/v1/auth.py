from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
import httpx

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import create_access_token, get_current_user
from app.core.response import success, error
from app.models.user import User, UserRole

router = APIRouter()
settings = get_settings()


@router.get("/github/login")
def github_login():
    """Redirect URL for GitHub OAuth."""
    url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.github_client_id}"
        f"&redirect_uri={settings.github_redirect_uri}"
        f"&scope=read:user,user:email"
    )
    return success(data={"url": url})


@router.get("/github/callback")
async def github_callback(
    code: str = Query(...),
    redirect_uri: str = Query(""),
    db: Session = Depends(get_db),
):
    """Handle GitHub OAuth callback, create/update user, return JWT."""
    async with httpx.AsyncClient() as client:
        payload: dict = {
            "client_id": settings.github_client_id,
            "client_secret": settings.github_client_secret,
            "code": code,
        }
        if redirect_uri:
            payload["redirect_uri"] = redirect_uri
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json=payload,
            headers={"Accept": "application/json"},
        )
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return error(code=401, message="GitHub OAuth failed")

        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        gh_user = user_resp.json()

        # Public email may be null; fetch from /user/emails for private primary email
        gh_email = gh_user.get("email") or ""
        if not gh_email:
            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if emails_resp.status_code == 200:
                for em in emails_resp.json():
                    if em.get("primary"):
                        gh_email = em["email"]
                        break
    gh_login = gh_user["login"]

    admin_list = [u.strip().lower() for u in settings.admin_github_users.split(",") if u.strip()]
    is_admin = (
        gh_login.lower() in admin_list
        or (gh_email and gh_email.lower() in admin_list)
    )

    user = db.query(User).filter(User.github_id == gh_user["id"]).first()
    if user is None:
        role = UserRole.admin if is_admin else UserRole.user
        user = User(
            github_id=gh_user["id"],
            username=gh_login,
            display_name=gh_user.get("name"),
            avatar_url=gh_user.get("avatar_url"),
            email=gh_email,
            bio=gh_user.get("bio"),
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.avatar_url = gh_user.get("avatar_url")
        user.display_name = gh_user.get("name")
        if is_admin and user.role != UserRole.admin:
            user.role = UserRole.admin
        elif not is_admin and user.role == UserRole.admin:
            user.role = UserRole.user
        db.commit()

    jwt_token = create_access_token(data={"sub": str(user.id)})
    return success(data={"access_token": jwt_token, "token_type": "bearer", "user": {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "role": user.role.value,
    }})


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user."""
    return success(data={
        "id": current_user.id,
        "username": current_user.username,
        "display_name": current_user.display_name,
        "avatar_url": current_user.avatar_url,
        "email": current_user.email,
        "role": current_user.role.value,
    })
