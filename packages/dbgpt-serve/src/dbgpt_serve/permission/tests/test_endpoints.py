"""Permission endpoint tests."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from dbgpt.storage.metadata import DatabaseManager, Model
from dbgpt_serve.permission.api.endpoints import router, set_service
from dbgpt_serve.permission.config import ServeConfig
from dbgpt_serve.permission.models.models import (
    SysRoleEntity,
    SysUserEntity,
    SysUserRoleEntity,
)
from dbgpt_serve.permission.service.service import PermissionService


def _client(tmp_path):
    db = DatabaseManager.build_from(
        f"sqlite:///{tmp_path / 'permission_endpoint.db'}", base=Model
    )
    db.create_all()
    service = PermissionService(db, ServeConfig())
    service.init_default_data()
    with db.session() as session:
        normal_role = (
            session.query(SysRoleEntity)
            .filter(SysRoleEntity.role_code == "normal")
            .first()
        )
        user = SysUserEntity(
            username="alice",
            password_hash=service.hash_password("alice-password"),
            status=1,
            deleted=0,
        )
        session.add(user)
        session.flush()
        session.add(SysUserRoleEntity(user_id=user.id, role_id=normal_role.id))
        session.commit()

    app = FastAPI()
    app.include_router(router)
    set_service(service)
    return TestClient(app), service


def _token(service: PermissionService, username: str, password: str) -> str:
    login = service.authenticate(username, password)
    assert login is not None
    return login.access_token


def test_permission_routes_reject_anonymous_requests(tmp_path):
    client, _ = _client(tmp_path)

    response = client.get("/users")

    assert response.status_code == 401


def test_permission_management_requires_admin_or_permission_manage(tmp_path):
    client, service = _client(tmp_path)
    normal_token = _token(service, "alice", "alice-password")

    response = client.post(
        "/roles",
        headers={"Authorization": f"Bearer {normal_token}"},
        json={"role_code": "auditor", "role_name": "Auditor"},
    )

    assert response.status_code == 403


def test_permission_admin_can_manage_roles(tmp_path):
    client, service = _client(tmp_path)
    admin_token = _token(service, "admin", "admin123")

    response = client.post(
        "/roles",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role_code": "security", "role_name": "Security"},
    )

    assert response.status_code == 200
