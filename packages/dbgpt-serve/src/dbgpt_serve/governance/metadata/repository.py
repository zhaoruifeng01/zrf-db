"""Metadata repository interfaces backed by DB-GPT datasource metadata."""

from datetime import datetime
from typing import Dict, List, Optional, Protocol

from dbgpt.storage.metadata import DatabaseManager
from dbgpt_serve.datasource.manages.connect_config_db import ConnectConfigEntity
from dbgpt_serve.governance.metadata.models import (
    GovernanceColumnEntity,
    GovernanceDatasetEntity,
    GovernanceMetadataScanEntity,
    GovernanceMetricEntity,
    GovernanceRelationshipEntity,
    GovernanceTableEntity,
)


class MetadataRepository(Protocol):
    """Repository boundary for governance metadata reads."""

    def get_datasource(self, datasource_id: int) -> Optional[ConnectConfigEntity]:
        """Return one DB-GPT datasource config."""

    def list_datasources(self) -> List[Dict]:
        """Return datasource summaries used by governance pages and services."""


class DatasourceMetadataRepository:
    """Adapter over DB-GPT's canonical `connect_config` table."""

    def __init__(self, db_manager: DatabaseManager):
        self._db_manager = db_manager

    def get_datasource(self, datasource_id: int) -> Optional[ConnectConfigEntity]:
        with self._db_manager.session() as session:
            datasource = session.get(ConnectConfigEntity, datasource_id)
            if datasource is None:
                return None
            datasource.id
            datasource.db_name
            datasource.db_type
            datasource.comment
            session.expunge(datasource)
            return datasource

    def list_datasources(self) -> List[Dict]:
        with self._db_manager.session() as session:
            rows = session.query(ConnectConfigEntity).all()
            return [
                {
                    "id": row.id,
                    "db_name": row.db_name,
                    "db_type": row.db_type,
                    "comment": row.comment,
                }
                for row in rows
            ]


class SemanticMetadataRepository:
    """Repository for governed semantic metadata entities."""

    def __init__(self, db_manager: DatabaseManager):
        self._db_manager = db_manager

    def ensure_dataset(self, datasource: ConnectConfigEntity) -> Dict:
        now = datetime.now()
        with self._db_manager.session() as session:
            dataset = (
                session.query(GovernanceDatasetEntity)
                .filter_by(datasource_id=datasource.id)
                .first()
            )
            if dataset is None:
                dataset = GovernanceDatasetEntity(
                    datasource_id=datasource.id,
                    name=datasource.db_name,
                    display_name=datasource.db_name,
                    description=datasource.comment,
                    gmt_created=now,
                    gmt_modified=now,
                )
                session.add(dataset)
            else:
                dataset.name = datasource.db_name
                dataset.display_name = dataset.display_name or datasource.db_name
                dataset.description = dataset.description or datasource.comment
                dataset.gmt_modified = now
            session.commit()
            session.refresh(dataset)
            return self._dataset_dict(dataset)

    def upsert_table(
        self,
        datasource_id: int,
        dataset_id: int,
        table_name: str,
        column_count: int,
        table_type: str = "table",
    ) -> Dict:
        now = datetime.now()
        with self._db_manager.session() as session:
            table = (
                session.query(GovernanceTableEntity)
                .filter_by(datasource_id=datasource_id, table_name=table_name)
                .first()
            )
            if table is None:
                table = GovernanceTableEntity(
                    datasource_id=datasource_id,
                    dataset_id=dataset_id,
                    table_name=table_name,
                    table_type=table_type,
                    gmt_created=now,
                    gmt_modified=now,
                )
                session.add(table)
            table.dataset_id = dataset_id
            table.column_count = column_count
            table.status = "active"
            table.last_scanned_at = now
            table.gmt_modified = now
            session.commit()
            session.refresh(table)
            return self._table_dict(table)

    def upsert_column(
        self,
        datasource_id: int,
        table_id: int,
        table_name: str,
        column: Dict,
        ordinal_position: int,
    ) -> Dict:
        now = datetime.now()
        column_name = column.get("name") or column.get("column_name")
        if not column_name:
            raise ValueError("Column metadata must include a name")
        with self._db_manager.session() as session:
            entity = (
                session.query(GovernanceColumnEntity)
                .filter_by(
                    datasource_id=datasource_id,
                    table_name=table_name,
                    column_name=column_name,
                )
                .first()
            )
            if entity is None:
                entity = GovernanceColumnEntity(
                    datasource_id=datasource_id,
                    table_id=table_id,
                    table_name=table_name,
                    column_name=column_name,
                    gmt_created=now,
                    gmt_modified=now,
                )
                session.add(entity)
            entity.table_id = table_id
            entity.data_type = str(column.get("type") or "")
            entity.nullable = column.get("nullable")
            entity.default_expression = column.get("default") or column.get(
                "default_expression"
            )
            entity.is_primary_key = bool(column.get("is_in_primary_key", False))
            entity.ordinal_position = ordinal_position
            entity.comment = column.get("comment")
            entity.status = "active"
            entity.gmt_modified = now
            session.commit()
            session.refresh(entity)
            return self._column_dict(entity)

    def mark_scan_start(self, datasource_id: int) -> Dict:
        now = datetime.now()
        with self._db_manager.session() as session:
            scan = GovernanceMetadataScanEntity(
                datasource_id=datasource_id,
                status="running",
                started_at=now,
                gmt_created=now,
            )
            session.add(scan)
            session.commit()
            session.refresh(scan)
            return self._scan_dict(scan)

    def mark_scan_finish(
        self,
        scan_id: int,
        status: str,
        table_count: int = 0,
        column_count: int = 0,
        error_message: Optional[str] = None,
    ) -> Dict:
        now = datetime.now()
        with self._db_manager.session() as session:
            scan = session.get(GovernanceMetadataScanEntity, scan_id)
            if scan is None:
                raise ValueError(f"Metadata scan not found: {scan_id}")
            scan.status = status
            scan.table_count = table_count
            scan.column_count = column_count
            scan.error_message = error_message
            scan.finished_at = now
            session.commit()
            session.refresh(scan)
            return self._scan_dict(scan)

    def update_dataset_scan_state(
        self,
        datasource_id: int,
        scan_status: str,
        health_score: Optional[float] = None,
    ) -> None:
        now = datetime.now()
        with self._db_manager.session() as session:
            dataset = (
                session.query(GovernanceDatasetEntity)
                .filter_by(datasource_id=datasource_id)
                .first()
            )
            if dataset:
                dataset.scan_status = scan_status
                dataset.last_scanned_at = now
                if health_score is not None:
                    dataset.health_score = health_score
                dataset.gmt_modified = now
                session.commit()

    def list_datasets(self) -> List[Dict]:
        with self._db_manager.session() as session:
            return [
                self._dataset_dict(item)
                for item in session.query(GovernanceDatasetEntity)
                .order_by(GovernanceDatasetEntity.id)
                .all()
            ]

    def list_tables(self, datasource_id: int) -> List[Dict]:
        with self._db_manager.session() as session:
            return [
                self._table_dict(item)
                for item in session.query(GovernanceTableEntity)
                .filter_by(datasource_id=datasource_id, status="active")
                .order_by(GovernanceTableEntity.table_name)
                .all()
            ]

    def list_columns(self, datasource_id: int, table_name: str) -> List[Dict]:
        with self._db_manager.session() as session:
            return [
                self._column_dict(item)
                for item in session.query(GovernanceColumnEntity)
                .filter_by(
                    datasource_id=datasource_id,
                    table_name=table_name,
                    status="active",
                )
                .order_by(GovernanceColumnEntity.ordinal_position)
                .all()
            ]

    def latest_scan(self, datasource_id: int) -> Optional[Dict]:
        with self._db_manager.session() as session:
            scan = (
                session.query(GovernanceMetadataScanEntity)
                .filter_by(datasource_id=datasource_id)
                .order_by(GovernanceMetadataScanEntity.id.desc())
                .first()
            )
            return self._scan_dict(scan) if scan else None

    def health_inputs(self, datasource_id: int) -> Dict:
        tables = self.list_tables(datasource_id)
        with self._db_manager.session() as session:
            columns = (
                session.query(GovernanceColumnEntity)
                .filter_by(datasource_id=datasource_id, status="active")
                .all()
            )
            metrics_count = (
                session.query(GovernanceMetricEntity)
                .filter_by(datasource_id=datasource_id, status="active")
                .count()
            )
            relationships_count = (
                session.query(GovernanceRelationshipEntity)
                .filter_by(datasource_id=datasource_id, status="active")
                .count()
            )
            return {
                "tables": tables,
                "columns": [self._column_dict(column) for column in columns],
                "metrics_count": metrics_count,
                "relationships_count": relationships_count,
            }

    @staticmethod
    def _dataset_dict(entity: GovernanceDatasetEntity) -> Dict:
        return {
            "id": entity.id,
            "datasource_id": entity.datasource_id,
            "name": entity.name,
            "display_name": entity.display_name,
            "description": entity.description,
            "status": entity.status,
            "health_score": entity.health_score,
            "scan_status": entity.scan_status,
            "last_scanned_at": entity.last_scanned_at,
        }

    @staticmethod
    def _table_dict(entity: GovernanceTableEntity) -> Dict:
        return {
            "id": entity.id,
            "datasource_id": entity.datasource_id,
            "dataset_id": entity.dataset_id,
            "table_name": entity.table_name,
            "table_type": entity.table_type,
            "description": entity.description,
            "status": entity.status,
            "column_count": entity.column_count,
            "health_score": entity.health_score,
            "last_scanned_at": entity.last_scanned_at,
        }

    @staticmethod
    def _column_dict(entity: GovernanceColumnEntity) -> Dict:
        return {
            "id": entity.id,
            "datasource_id": entity.datasource_id,
            "table_id": entity.table_id,
            "table_name": entity.table_name,
            "column_name": entity.column_name,
            "data_type": entity.data_type,
            "nullable": entity.nullable,
            "default_expression": entity.default_expression,
            "is_primary_key": entity.is_primary_key,
            "ordinal_position": entity.ordinal_position,
            "comment": entity.comment,
            "semantic_type": entity.semantic_type,
            "status": entity.status,
        }

    @staticmethod
    def _scan_dict(entity: GovernanceMetadataScanEntity) -> Dict:
        return {
            "id": entity.id,
            "datasource_id": entity.datasource_id,
            "status": entity.status,
            "table_count": entity.table_count,
            "column_count": entity.column_count,
            "error_message": entity.error_message,
            "started_at": entity.started_at,
            "finished_at": entity.finished_at,
        }
