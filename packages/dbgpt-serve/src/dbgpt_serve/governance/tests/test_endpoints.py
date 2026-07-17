"""Governance endpoint security tests."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from dbgpt.storage.metadata import DatabaseManager, Model
from dbgpt_serve.datasource.manages.connect_config_db import ConnectConfigEntity
from dbgpt_serve.governance.api import endpoints
from dbgpt_serve.governance.config import ServeConfig
from dbgpt_serve.governance.models import GovernanceApiKeyEntity
from dbgpt_serve.governance.service import GovernanceService, Principal


def _client(tmp_path, config: ServeConfig | None = None):
    db = DatabaseManager.build_from(
        f"sqlite:///{tmp_path / 'governance_endpoint.db'}", base=Model
    )
    db.create_all()
    with db.session() as session:
        session.add(
            ConnectConfigEntity(
                db_type="sqlite",
                db_name="sales",
                db_path="/tmp/sales.db",
            )
        )
        session.commit()

    service = GovernanceService(object(), db, config or ServeConfig())
    principal = Principal(user_id=1, username="admin", role_codes=["admin"])
    app = FastAPI()
    app.include_router(endpoints.router)
    app.dependency_overrides[endpoints.get_service] = lambda: service
    app.dependency_overrides[endpoints.get_principal] = lambda: principal
    return TestClient(app), service


def test_governance_query_is_disabled_by_default(tmp_path):
    client, _ = _client(tmp_path)

    response = client.post("/query", json={"datasource_id": 1, "sql": "SELECT 1"})

    assert response.status_code == 404


def test_governance_api_key_creation_is_disabled_by_default(tmp_path):
    client, service = _client(tmp_path)

    response = client.post("/developer/api-keys", json={"name": "ci"})

    assert response.status_code == 404
    with service.db_manager.session() as session:
        assert session.query(GovernanceApiKeyEntity).count() == 0


def test_metadata_dataset_route_requires_admin_and_returns_rows(tmp_path):
    client, service = _client(tmp_path)
    datasource = service.get_datasource(1)
    service.metadata_service.repository.ensure_dataset(datasource)

    response = client.get("/metadata/datasets")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"][0]["datasource_id"] == 1
