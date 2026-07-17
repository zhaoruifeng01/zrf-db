from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from dbgpt.storage.metadata import DatabaseManager, Model
from dbgpt_serve.datasource.manages.connect_config_db import ConnectConfigEntity
from dbgpt_serve.governance.config import ServeConfig
from dbgpt_serve.governance.models import GovernanceMaskRuleEntity
from dbgpt_serve.governance.service import GovernanceService, Principal


@pytest.fixture
def service(tmp_path):
    # Importing the models above registers them on DB-GPT's shared metadata base.
    db = DatabaseManager.build_from(
        f"sqlite:///{tmp_path / 'governance.db'}", base=Model
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
    return GovernanceService(MagicMock(), db, ServeConfig())


@pytest.fixture
def admin():
    return Principal(user_id=1, username="admin", role_codes=["admin"])


@pytest.fixture
def analyst():
    return Principal(user_id=2, username="analyst", role_codes=["analyst"])


def test_role_grant_is_required_for_non_admin(service, admin, analyst):
    assert service.has_permission(analyst, 1, "orders", "query") is False

    service.create_grant(
        admin,
        {
            "role_code": "analyst",
            "datasource_id": 1,
            "table_pattern": "orders*",
            "permission": "query",
            "allowed_columns": None,
        },
    )

    assert service.has_permission(analyst, 1, "orders", "query") is True
    assert service.has_permission(analyst, 1, "customers", "query") is False


def test_mask_rules_are_applied_to_non_admin_rows(service, admin, analyst):
    with service.db_manager.session() as session:
        session.add(
            GovernanceMaskRuleEntity(
                datasource_id=1,
                table_name="orders",
                column_name="phone",
                mask_type="partial",
            )
        )

    rows = [{"id": 1, "phone": "13800138000"}]
    service._apply_masks(analyst, 1, {"orders"}, rows)

    assert rows == [{"id": 1, "phone": "1***0"}]


def test_read_only_sql_guard_rejects_writes_and_extracts_tables():
    assert service_tables("SELECT * FROM orders JOIN customers ON 1=1") == {
        "orders",
        "customers",
    }
    assert service_tables("WITH recent AS (SELECT * FROM orders) SELECT * FROM recent")
    with pytest.raises(HTTPException, match="read-only"):
        service_tables("DELETE FROM orders")
    with pytest.raises(HTTPException, match="one read-only"):
        service_tables("SELECT 1; SELECT 2")


def test_sql_guard_rejects_complex_or_ambiguous_input():
    from dbgpt_serve.governance.sql_guard import SqlGuard, SqlGuardConfig

    with pytest.raises(HTTPException, match="length"):
        SqlGuard(SqlGuardConfig(max_length=20)).validate(
            "SELECT * FROM very_long_table_name"
        )
    with pytest.raises(HTTPException, match="token"):
        SqlGuard(SqlGuardConfig(max_tokens=8)).validate(
            "SELECT a, b, c, d, e, f FROM t"
        )
    with pytest.raises(HTTPException, match="nesting"):
        SqlGuard(SqlGuardConfig(max_nesting_depth=0)).validate(
            "SELECT * FROM t WHERE id IN (SELECT id FROM x)"
        )


def test_audit_sanitizes_sql_and_details(service, admin):
    service.audit(
        admin,
        "query",
        1,
        "failed",
        sql_text="SELECT * FROM users WHERE password = 'plain' AND id = 42",
        detail="dsn=mysql://root:secret@localhost/db token=abc123",
    )

    with service.db_manager.session() as session:
        entry = session.query(service_models().GovernanceAuditLogEntity).first()
        sql_text = entry.sql_text
        detail = entry.detail

    assert "plain" not in sql_text
    assert sql_text.startswith("sha256:")
    assert "password = ? AND id = ?" in sql_text
    assert "secret" not in detail
    assert "abc123" not in detail


def test_rate_limit_uses_token_bucket(service, admin):
    service.config.query_rate_limit_per_minute = 1

    service.check_rate_limit(admin, 1)

    with pytest.raises(HTTPException, match="rate limit"):
        service.check_rate_limit(admin, 1)


def service_models():
    from dbgpt_serve.governance import models

    return models


def service_tables(sql):
    from dbgpt_serve.governance.service import GovernanceQueryService

    return GovernanceQueryService._validate_read_only(sql)


def test_catalog_access_request_uses_existing_principal(service, admin, analyst):
    service.create_grant(
        admin,
        {
            "role_code": "analyst",
            "datasource_id": 1,
            "table_pattern": "*",
            "permission": "manage",
            "allowed_columns": None,
        },
    )
    product = service.create_product(
        analyst,
        {
            "product_key": "orders_api",
            "datasource_id": 1,
            "title": "订单数据",
            "description": None,
            "resource_type": "table",
            "resource_definition": "orders",
            "status": "draft",
            "rate_limit_per_minute": 60,
        },
    )

    request = service.request_product_access(analyst, product["id"], "报表分析")

    assert request["requester_user_id"] == analyst.user_id
    assert request["status"] == "pending"
