"""Governance semantic metadata

Revision ID: b2c6f0e9a314
Revises: a4f32c7b2a11
Create Date: 2026-07-17 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c6f0e9a314"
down_revision: Union[str, None] = "a4f32c7b2a11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table_name)


def _create_table_if_missing(table_name: str, *columns, **kwargs) -> None:
    if not _has_table(table_name):
        op.create_table(table_name, *columns, **kwargs)


def _create_index_if_missing(
    index_name: str, table_name: str, columns: list[str]
) -> None:
    indexes = sa.inspect(op.get_bind()).get_indexes(table_name)
    if not any(index["name"] == index_name for index in indexes):
        op.create_index(index_name, table_name, columns)


def upgrade() -> None:
    _create_table_if_missing(
        "governance_metadata_dataset",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("datasource_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("health_score", sa.Float(), nullable=False),
        sa.Column("scan_status", sa.String(length=32), nullable=False),
        sa.Column("last_scanned_at", sa.DateTime(), nullable=True),
        sa.Column("gmt_created", sa.DateTime(), nullable=False),
        sa.Column("gmt_modified", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("datasource_id", name="uk_governance_dataset_datasource"),
    )
    _create_table_if_missing(
        "governance_metadata_table",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("datasource_id", sa.Integer(), nullable=False),
        sa.Column("dataset_id", sa.Integer(), nullable=False),
        sa.Column("table_name", sa.String(length=255), nullable=False),
        sa.Column("table_type", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("column_count", sa.Integer(), nullable=False),
        sa.Column("health_score", sa.Float(), nullable=False),
        sa.Column("last_scanned_at", sa.DateTime(), nullable=True),
        sa.Column("gmt_created", sa.DateTime(), nullable=False),
        sa.Column("gmt_modified", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "datasource_id",
            "table_name",
            name="uk_governance_table_datasource_name",
        ),
    )
    _create_table_if_missing(
        "governance_metadata_column",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("datasource_id", sa.Integer(), nullable=False),
        sa.Column("table_id", sa.Integer(), nullable=False),
        sa.Column("table_name", sa.String(length=255), nullable=False),
        sa.Column("column_name", sa.String(length=255), nullable=False),
        sa.Column("data_type", sa.String(length=255), nullable=True),
        sa.Column("nullable", sa.Boolean(), nullable=True),
        sa.Column("default_expression", sa.Text(), nullable=True),
        sa.Column("is_primary_key", sa.Boolean(), nullable=False),
        sa.Column("ordinal_position", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("semantic_type", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("gmt_created", sa.DateTime(), nullable=False),
        sa.Column("gmt_modified", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "datasource_id",
            "table_name",
            "column_name",
            name="uk_governance_column_datasource_table_name",
        ),
    )
    _create_table_if_missing(
        "governance_metadata_metric",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("datasource_id", sa.Integer(), nullable=False),
        sa.Column("metric_key", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("table_name", sa.String(length=255), nullable=True),
        sa.Column("expression", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("gmt_created", sa.DateTime(), nullable=False),
        sa.Column("gmt_modified", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "datasource_id", "metric_key", name="uk_governance_metric_key"
        ),
    )
    _create_table_if_missing(
        "governance_metadata_relationship",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("datasource_id", sa.Integer(), nullable=False),
        sa.Column("source_table", sa.String(length=255), nullable=False),
        sa.Column("source_column", sa.String(length=255), nullable=False),
        sa.Column("target_table", sa.String(length=255), nullable=False),
        sa.Column("target_column", sa.String(length=255), nullable=False),
        sa.Column("relationship_type", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("gmt_created", sa.DateTime(), nullable=False),
        sa.Column("gmt_modified", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "datasource_id",
            "source_table",
            "source_column",
            "target_table",
            "target_column",
            name="uk_governance_relationship",
        ),
    )
    _create_table_if_missing(
        "governance_metadata_scan",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("datasource_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("table_count", sa.Integer(), nullable=False),
        sa.Column("column_count", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("gmt_created", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    _create_index_if_missing(
        "ix_governance_metadata_dataset_datasource_id",
        "governance_metadata_dataset",
        ["datasource_id"],
    )
    _create_index_if_missing(
        "ix_governance_metadata_table_datasource_id",
        "governance_metadata_table",
        ["datasource_id"],
    )
    _create_index_if_missing(
        "idx_governance_table_dataset",
        "governance_metadata_table",
        ["dataset_id"],
    )
    _create_index_if_missing(
        "ix_governance_metadata_column_datasource_id",
        "governance_metadata_column",
        ["datasource_id"],
    )
    _create_index_if_missing(
        "idx_governance_column_table",
        "governance_metadata_column",
        ["table_id"],
    )
    _create_index_if_missing(
        "ix_governance_metadata_metric_datasource_id",
        "governance_metadata_metric",
        ["datasource_id"],
    )
    _create_index_if_missing(
        "ix_governance_metadata_relationship_datasource_id",
        "governance_metadata_relationship",
        ["datasource_id"],
    )
    _create_index_if_missing(
        "ix_governance_metadata_scan_datasource_id",
        "governance_metadata_scan",
        ["datasource_id"],
    )
    _create_index_if_missing(
        "idx_governance_scan_datasource_time",
        "governance_metadata_scan",
        ["datasource_id", "gmt_created"],
    )


def downgrade() -> None:
    for table_name in (
        "governance_metadata_scan",
        "governance_metadata_relationship",
        "governance_metadata_metric",
        "governance_metadata_column",
        "governance_metadata_table",
        "governance_metadata_dataset",
    ):
        if _has_table(table_name):
            op.drop_table(table_name)
