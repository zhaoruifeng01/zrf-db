"""Metadata repository boundaries for governance."""

from .datasource_adapter import GovernanceDatasourceAdapter
from .repository import (
    DatasourceMetadataRepository,
    MetadataRepository,
    SemanticMetadataRepository,
)
from .service import SemanticMetadataService

__all__ = [
    "DatasourceMetadataRepository",
    "GovernanceDatasourceAdapter",
    "MetadataRepository",
    "SemanticMetadataRepository",
    "SemanticMetadataService",
]
