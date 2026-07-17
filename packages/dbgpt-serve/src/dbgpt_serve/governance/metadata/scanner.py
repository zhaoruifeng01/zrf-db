"""Connector-backed semantic metadata scanner."""

from typing import Dict, Iterable, List

from dbgpt_serve.governance.metadata.repository import SemanticMetadataRepository


class MetadataScanner:
    """Scan tables and columns through DB-GPT connectors."""

    def __init__(
        self,
        datasource_adapter,
        repository: SemanticMetadataRepository,
    ):
        self._datasource_adapter = datasource_adapter
        self._repository = repository

    def scan(self, datasource_id: int) -> Dict:
        datasource = self._datasource_adapter.get_datasource(datasource_id)
        dataset = self._repository.ensure_dataset(datasource)
        scan = self._repository.mark_scan_start(datasource_id)
        table_count = 0
        column_count = 0
        try:
            connector = self._datasource_adapter.get_connector(datasource_id)
            for table_name in self._safe_table_names(connector):
                columns = self._safe_columns(connector, table_name)
                table = self._repository.upsert_table(
                    datasource_id=datasource_id,
                    dataset_id=dataset["id"],
                    table_name=table_name,
                    column_count=len(columns),
                )
                table_count += 1
                for index, column in enumerate(columns, start=1):
                    self._repository.upsert_column(
                        datasource_id=datasource_id,
                        table_id=table["id"],
                        table_name=table_name,
                        column=column,
                        ordinal_position=index,
                    )
                    column_count += 1

            health = self.health(datasource_id)
            self._repository.update_dataset_scan_state(
                datasource_id,
                scan_status="success",
                health_score=health["score"],
            )
            return self._repository.mark_scan_finish(
                scan_id=scan["id"],
                status="success",
                table_count=table_count,
                column_count=column_count,
            )
        except Exception as exc:
            self._repository.update_dataset_scan_state(
                datasource_id, scan_status="failed"
            )
            return self._repository.mark_scan_finish(
                scan_id=scan["id"],
                status="failed",
                table_count=table_count,
                column_count=column_count,
                error_message=str(exc),
            )

    def health(self, datasource_id: int) -> Dict:
        from dbgpt_serve.governance.metadata.health import calculate_metadata_health

        return calculate_metadata_health(self._repository.health_inputs(datasource_id))

    @staticmethod
    def _safe_table_names(connector) -> Iterable[str]:
        return list(connector.get_table_names() or [])

    @staticmethod
    def _safe_columns(connector, table_name: str) -> List[Dict]:
        return list(connector.get_columns(table_name) or [])
