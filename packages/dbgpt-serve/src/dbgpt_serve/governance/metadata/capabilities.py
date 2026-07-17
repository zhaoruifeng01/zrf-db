"""Datasource capability matrix for governance metadata collection."""

from dataclasses import dataclass


@dataclass(frozen=True)
class DatasourceCapabilities:
    """Connector capabilities used to plan metadata operations."""

    schema: bool = True
    table: bool = True
    column: bool = True
    profile: bool = False
    readonly_check: bool = False


_DEFAULT = DatasourceCapabilities()
_CAPABILITIES = {
    "sqlite": DatasourceCapabilities(profile=True, readonly_check=True),
    "mysql": DatasourceCapabilities(profile=True, readonly_check=True),
    "postgresql": DatasourceCapabilities(profile=True, readonly_check=True),
    "postgres": DatasourceCapabilities(profile=True, readonly_check=True),
    "clickhouse": DatasourceCapabilities(profile=True, readonly_check=True),
    "mssql": DatasourceCapabilities(profile=True, readonly_check=True),
    "duckdb": DatasourceCapabilities(profile=True, readonly_check=True),
    "tugraph": DatasourceCapabilities(schema=False, profile=False),
    "neo4j": DatasourceCapabilities(schema=False, profile=False),
}


def capabilities_for(db_type: str) -> DatasourceCapabilities:
    """Return governance capabilities for a DB-GPT datasource type."""
    return _CAPABILITIES.get((db_type or "").lower(), _DEFAULT)
