"""Semantic metadata models for governance."""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from dbgpt.storage.metadata import Model


class GovernanceDatasetEntity(Model):
    """One governed semantic dataset backed by one DB-GPT datasource."""

    __tablename__ = "governance_metadata_dataset"
    __table_args__ = (
        UniqueConstraint("datasource_id", name="uk_governance_dataset_datasource"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    datasource_id = Column(Integer, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="active")
    health_score = Column(Float, nullable=False, default=0.0)
    scan_status = Column(String(32), nullable=False, default="pending")
    last_scanned_at = Column(DateTime, nullable=True)
    gmt_created = Column(DateTime, default=datetime.now, nullable=False)
    gmt_modified = Column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=False
    )


class GovernanceTableEntity(Model):
    """Semantic table metadata discovered from a datasource connector."""

    __tablename__ = "governance_metadata_table"
    __table_args__ = (
        UniqueConstraint(
            "datasource_id", "table_name", name="uk_governance_table_datasource_name"
        ),
        Index("idx_governance_table_dataset", "dataset_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    datasource_id = Column(Integer, nullable=False, index=True)
    dataset_id = Column(Integer, nullable=False, index=True)
    table_name = Column(String(255), nullable=False)
    table_type = Column(String(64), nullable=False, default="table")
    description = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="active")
    column_count = Column(Integer, nullable=False, default=0)
    health_score = Column(Float, nullable=False, default=0.0)
    last_scanned_at = Column(DateTime, nullable=True)
    gmt_created = Column(DateTime, default=datetime.now, nullable=False)
    gmt_modified = Column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=False
    )


class GovernanceColumnEntity(Model):
    """Semantic column metadata discovered from a datasource connector."""

    __tablename__ = "governance_metadata_column"
    __table_args__ = (
        UniqueConstraint(
            "datasource_id",
            "table_name",
            "column_name",
            name="uk_governance_column_datasource_table_name",
        ),
        Index("idx_governance_column_table", "table_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    datasource_id = Column(Integer, nullable=False, index=True)
    table_id = Column(Integer, nullable=False, index=True)
    table_name = Column(String(255), nullable=False)
    column_name = Column(String(255), nullable=False)
    data_type = Column(String(255), nullable=True)
    nullable = Column(Boolean, nullable=True)
    default_expression = Column(Text, nullable=True)
    is_primary_key = Column(Boolean, nullable=False, default=False)
    ordinal_position = Column(Integer, nullable=False, default=0)
    comment = Column(Text, nullable=True)
    semantic_type = Column(String(64), nullable=True)
    status = Column(String(32), nullable=False, default="active")
    gmt_created = Column(DateTime, default=datetime.now, nullable=False)
    gmt_modified = Column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=False
    )


class GovernanceMetricEntity(Model):
    """Governed metric definition attached to semantic metadata."""

    __tablename__ = "governance_metadata_metric"
    __table_args__ = (
        UniqueConstraint(
            "datasource_id", "metric_key", name="uk_governance_metric_key"
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    datasource_id = Column(Integer, nullable=False, index=True)
    metric_key = Column(String(128), nullable=False)
    name = Column(String(255), nullable=False)
    table_name = Column(String(255), nullable=True)
    expression = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="active")
    gmt_created = Column(DateTime, default=datetime.now, nullable=False)
    gmt_modified = Column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=False
    )


class GovernanceRelationshipEntity(Model):
    """Semantic relationship between two table columns."""

    __tablename__ = "governance_metadata_relationship"
    __table_args__ = (
        UniqueConstraint(
            "datasource_id",
            "source_table",
            "source_column",
            "target_table",
            "target_column",
            name="uk_governance_relationship",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    datasource_id = Column(Integer, nullable=False, index=True)
    source_table = Column(String(255), nullable=False)
    source_column = Column(String(255), nullable=False)
    target_table = Column(String(255), nullable=False)
    target_column = Column(String(255), nullable=False)
    relationship_type = Column(String(64), nullable=False, default="foreign_key")
    description = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="active")
    gmt_created = Column(DateTime, default=datetime.now, nullable=False)
    gmt_modified = Column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=False
    )


class GovernanceMetadataScanEntity(Model):
    """Metadata scan attempt state."""

    __tablename__ = "governance_metadata_scan"
    __table_args__ = (
        Index("idx_governance_scan_datasource_time", "datasource_id", "gmt_created"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    datasource_id = Column(Integer, nullable=False, index=True)
    status = Column(String(32), nullable=False, default="running")
    table_count = Column(Integer, nullable=False, default=0)
    column_count = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.now, nullable=False)
    finished_at = Column(DateTime, nullable=True)
    gmt_created = Column(DateTime, default=datetime.now, nullable=False)
