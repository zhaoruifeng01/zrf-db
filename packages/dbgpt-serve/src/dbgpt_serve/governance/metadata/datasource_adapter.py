"""Governance adapter over DB-GPT datasource primitives."""

from typing import Dict, List

from fastapi import HTTPException

from dbgpt.component import SystemApp
from dbgpt.storage.metadata import DatabaseManager
from dbgpt_serve.datasource.manages.connect_config_db import ConnectConfigEntity
from dbgpt_serve.datasource.manages.connector_manager import ConnectorManager
from dbgpt_serve.governance.metadata.capabilities import capabilities_for
from dbgpt_serve.governance.metadata.repository import DatasourceMetadataRepository


class GovernanceDatasourceAdapter:
    """Adapter that keeps governance bound to `connect_config` and ConnectorManager."""

    def __init__(self, system_app: SystemApp, db_manager: DatabaseManager):
        self._system_app = system_app
        self._repository = DatasourceMetadataRepository(db_manager)

    def get_datasource(self, datasource_id: int) -> ConnectConfigEntity:
        datasource = self._repository.get_datasource(datasource_id)
        if datasource is None:
            raise HTTPException(status_code=404, detail="Datasource not found")
        return datasource

    def list_datasources(self) -> List[Dict]:
        rows = self._repository.list_datasources()
        return [
            {
                **row,
                "capabilities": capabilities_for(row["db_type"]).__dict__,
            }
            for row in rows
        ]

    def get_connector(self, datasource_id: int):
        datasource = self.get_datasource(datasource_id)
        return ConnectorManager.get_instance(self._system_app).get_connector(
            datasource.db_name
        )

    def invalidate(self, datasource_id: int) -> None:
        datasource = self.get_datasource(datasource_id)
        ConnectorManager.get_instance(self._system_app).invalidate_connector(
            datasource.db_name
        )

    def test_connection(self, datasource_id: int) -> Dict:
        datasource = self.get_datasource(datasource_id)
        try:
            connector = self.get_connector(datasource_id)
            connector.run("SELECT 1")
            return {"status": "healthy", "message": "Connection successful"}
        except Exception as exc:
            return {
                "status": "unhealthy",
                "message": str(exc),
                "db_name": datasource.db_name,
            }

    def mark_metadata_stale(self, datasource_id: int) -> None:
        self.invalidate(datasource_id)
