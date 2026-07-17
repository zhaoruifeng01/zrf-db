"""Semantic metadata application service."""

from typing import Dict, List

from dbgpt.component import SystemApp
from dbgpt.storage.metadata import DatabaseManager
from dbgpt_serve.governance.metadata.datasource_adapter import (
    GovernanceDatasourceAdapter,
)
from dbgpt_serve.governance.metadata.repository import SemanticMetadataRepository
from dbgpt_serve.governance.metadata.scanner import MetadataScanner


class SemanticMetadataService:
    """Facade for datasource governance and semantic metadata operations."""

    def __init__(self, system_app: SystemApp, db_manager: DatabaseManager):
        self.datasource_adapter = GovernanceDatasourceAdapter(system_app, db_manager)
        self.repository = SemanticMetadataRepository(db_manager)
        self.scanner = MetadataScanner(self.datasource_adapter, self.repository)

    def list_governed_datasources(self) -> List[Dict]:
        return self.datasource_adapter.list_datasources()

    def list_datasets(self) -> List[Dict]:
        return self.repository.list_datasets()

    def list_tables(self, datasource_id: int) -> List[Dict]:
        return self.repository.list_tables(datasource_id)

    def list_columns(self, datasource_id: int, table_name: str) -> List[Dict]:
        return self.repository.list_columns(datasource_id, table_name)

    def scan_datasource(self, datasource_id: int) -> Dict:
        return self.scanner.scan(datasource_id)

    def latest_scan(self, datasource_id: int) -> Dict:
        return self.repository.latest_scan(datasource_id) or {
            "datasource_id": datasource_id,
            "status": "never",
        }

    def health(self, datasource_id: int) -> Dict:
        health = self.scanner.health(datasource_id)
        self.repository.update_dataset_scan_state(
            datasource_id,
            scan_status=(self.latest_scan(datasource_id).get("status") or "pending"),
            health_score=health["score"],
        )
        return health
