from dataclasses import dataclass

from dbgpt.storage.metadata import DatabaseManager, Model
from dbgpt_serve.datasource.manages.connect_config_db import ConnectConfigEntity
from dbgpt_serve.governance.metadata.capabilities import capabilities_for
from dbgpt_serve.governance.metadata.models import (  # noqa: F401
    GovernanceColumnEntity,
    GovernanceDatasetEntity,
    GovernanceMetadataScanEntity,
    GovernanceMetricEntity,
    GovernanceRelationshipEntity,
    GovernanceTableEntity,
)
from dbgpt_serve.governance.metadata.repository import SemanticMetadataRepository
from dbgpt_serve.governance.metadata.scanner import MetadataScanner


@dataclass
class FakeDatasource:
    id: int
    db_name: str
    db_type: str = "sqlite"
    comment: str = "Sales datasource"


class FakeConnector:
    def get_table_names(self):
        return ["orders"]

    def get_columns(self, table_name):
        assert table_name == "orders"
        return [
            {
                "name": "id",
                "type": "INTEGER",
                "nullable": False,
                "is_in_primary_key": True,
                "comment": "Order id",
            },
            {
                "name": "amount",
                "type": "DECIMAL",
                "nullable": True,
                "comment": "Order amount",
            },
        ]


class FakeDatasourceAdapter:
    def get_datasource(self, datasource_id):
        return FakeDatasource(id=datasource_id, db_name="sales")

    def get_connector(self, datasource_id):
        return FakeConnector()


def _db(tmp_path):
    db = DatabaseManager.build_from(
        f"sqlite:///{tmp_path / 'governance_metadata.db'}", base=Model
    )
    db.create_all()
    with db.session() as session:
        session.add(
            ConnectConfigEntity(
                id=1,
                db_type="sqlite",
                db_name="sales",
                db_path="/tmp/sales.db",
            )
        )
        session.commit()
    return db


def test_metadata_scanner_is_idempotent_and_calculates_health(tmp_path):
    repository = SemanticMetadataRepository(_db(tmp_path))
    scanner = MetadataScanner(FakeDatasourceAdapter(), repository)

    first_scan = scanner.scan(1)
    second_scan = scanner.scan(1)

    assert first_scan["status"] == "success"
    assert second_scan["status"] == "success"
    assert len(repository.list_datasets()) == 1
    assert len(repository.list_tables(1)) == 1
    columns = repository.list_columns(1, "orders")
    assert [column["column_name"] for column in columns] == ["id", "amount"]
    assert scanner.health(1)["score"] > 80


def test_datasource_capabilities_are_explicit_for_common_types():
    sqlite = capabilities_for("sqlite")
    unknown = capabilities_for("something-new")

    assert sqlite.column is True
    assert sqlite.readonly_check is True
    assert unknown.column is True
    assert unknown.profile is False
