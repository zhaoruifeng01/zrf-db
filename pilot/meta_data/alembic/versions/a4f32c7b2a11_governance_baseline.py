"""Governance metadata baseline

Revision ID: a4f32c7b2a11
Revises: 13b1750a8c07
Create Date: 2026-07-16 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a4f32c7b2a11"
down_revision: Union[str, None] = "13b1750a8c07"
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
        "governance_datasource_policy",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("datasource_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("business_domain", sa.String(length=128), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=True),
        sa.Column("health_status", sa.String(length=32), nullable=False),
        sa.Column("health_message", sa.Text(), nullable=True),
        sa.Column("health_checked_at", sa.DateTime(), nullable=True),
        sa.Column("gmt_created", sa.DateTime(), nullable=False),
        sa.Column("gmt_modified", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("datasource_id"),
    )
    _create_table_if_missing(
        "governance_role_grant",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("role_code", sa.String(length=64), nullable=False),
        sa.Column("datasource_id", sa.Integer(), nullable=False),
        sa.Column("table_pattern", sa.String(length=255), nullable=False),
        sa.Column("permission", sa.String(length=32), nullable=False),
        sa.Column("allowed_columns", sa.Text(), nullable=True),
        sa.Column("gmt_created", sa.DateTime(), nullable=False),
        sa.Column("gmt_modified", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "role_code",
            "datasource_id",
            "table_pattern",
            "permission",
            name="uk_governance_role_grant",
        ),
    )
    _create_table_if_missing(
        "governance_mask_rule",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("datasource_id", sa.Integer(), nullable=False),
        sa.Column("table_name", sa.String(length=255), nullable=False),
        sa.Column("column_name", sa.String(length=255), nullable=False),
        sa.Column("role_code", sa.String(length=64), nullable=True),
        sa.Column("mask_type", sa.String(length=32), nullable=False),
        sa.Column("gmt_created", sa.DateTime(), nullable=False),
        sa.Column("gmt_modified", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "datasource_id",
            "table_name",
            "column_name",
            "role_code",
            name="uk_governance_mask_rule",
        ),
    )
    _create_table_if_missing(
        "governance_catalog_product",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("product_key", sa.String(length=128), nullable=False),
        sa.Column("datasource_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("resource_type", sa.String(length=32), nullable=False),
        sa.Column("resource_definition", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("rate_limit_per_minute", sa.Integer(), nullable=False),
        sa.Column("gmt_created", sa.DateTime(), nullable=False),
        sa.Column("gmt_modified", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_key", name="uk_governance_product_key"),
    )
    _create_table_if_missing(
        "governance_access_request",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("requester_user_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("reviewer_user_id", sa.Integer(), nullable=True),
        sa.Column("review_comment", sa.Text(), nullable=True),
        sa.Column("gmt_created", sa.DateTime(), nullable=False),
        sa.Column("gmt_modified", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    _create_table_if_missing(
        "governance_api_key",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("key_prefix", sa.String(length=16), nullable=False),
        sa.Column("key_hash", sa.String(length=128), nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("gmt_created", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key_hash", name="uk_governance_api_key_hash"),
    )
    _create_table_if_missing(
        "governance_audit_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("username", sa.String(length=128), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("datasource_id", sa.Integer(), nullable=True),
        sa.Column("resource_key", sa.String(length=128), nullable=True),
        sa.Column("sql_text", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("gmt_created", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    _create_index_if_missing(
        "ix_governance_datasource_policy_datasource_id",
        "governance_datasource_policy",
        ["datasource_id"],
    )
    _create_index_if_missing(
        "ix_governance_datasource_policy_owner_user_id",
        "governance_datasource_policy",
        ["owner_user_id"],
    )
    _create_index_if_missing(
        "ix_governance_role_grant_role_code",
        "governance_role_grant",
        ["role_code"],
    )
    _create_index_if_missing(
        "idx_governance_grant_datasource",
        "governance_role_grant",
        ["datasource_id"],
    )
    _create_index_if_missing(
        "idx_governance_mask_datasource",
        "governance_mask_rule",
        ["datasource_id"],
    )
    _create_index_if_missing(
        "ix_governance_catalog_product_product_key",
        "governance_catalog_product",
        ["product_key"],
    )
    _create_index_if_missing(
        "ix_governance_catalog_product_datasource_id",
        "governance_catalog_product",
        ["datasource_id"],
    )
    _create_index_if_missing(
        "ix_governance_catalog_product_owner_user_id",
        "governance_catalog_product",
        ["owner_user_id"],
    )
    _create_index_if_missing(
        "idx_governance_request_product",
        "governance_access_request",
        ["product_id", "status"],
    )
    _create_index_if_missing(
        "ix_governance_access_request_requester_user_id",
        "governance_access_request",
        ["requester_user_id"],
    )
    _create_index_if_missing(
        "ix_governance_api_key_owner_user_id",
        "governance_api_key",
        ["owner_user_id"],
    )
    _create_index_if_missing(
        "ix_governance_audit_log_user_id",
        "governance_audit_log",
        ["user_id"],
    )
    _create_index_if_missing(
        "ix_governance_audit_log_datasource_id",
        "governance_audit_log",
        ["datasource_id"],
    )
    _create_index_if_missing(
        "idx_governance_audit_user_time",
        "governance_audit_log",
        ["user_id", "gmt_created"],
    )
    _create_index_if_missing(
        "idx_governance_audit_datasource_time",
        "governance_audit_log",
        ["datasource_id", "gmt_created"],
    )


def downgrade() -> None:
    for table_name in (
        "governance_audit_log",
        "governance_api_key",
        "governance_access_request",
        "governance_catalog_product",
        "governance_mask_rule",
        "governance_role_grant",
        "governance_datasource_policy",
    ):
        if _has_table(table_name):
            op.drop_table(table_name)
