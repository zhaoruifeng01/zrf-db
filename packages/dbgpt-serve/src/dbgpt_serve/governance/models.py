"""Persistent models for the embedded governance module."""

from datetime import datetime

from sqlalchemy import Column, DateTime, Index, Integer, String, Text, UniqueConstraint

from dbgpt.storage.metadata import Model


class GovernanceDatasourcePolicyEntity(Model):
    """Governance metadata attached to an existing ``connect_config`` record."""

    __tablename__ = "governance_datasource_policy"

    id = Column(Integer, primary_key=True, autoincrement=True)
    datasource_id = Column(Integer, nullable=False, unique=True, index=True)
    status = Column(String(32), nullable=False, default="enabled")
    business_domain = Column(String(128), nullable=True)
    description = Column(Text, nullable=True)
    owner_user_id = Column(Integer, nullable=True, index=True)
    health_status = Column(String(32), nullable=False, default="unknown")
    health_message = Column(Text, nullable=True)
    health_checked_at = Column(DateTime, nullable=True)
    gmt_created = Column(DateTime, default=datetime.now, nullable=False)
    gmt_modified = Column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=False
    )


class GovernanceRoleGrantEntity(Model):
    """A role-code based datasource/table permission grant."""

    __tablename__ = "governance_role_grant"
    __table_args__ = (
        UniqueConstraint(
            "role_code",
            "datasource_id",
            "table_pattern",
            "permission",
            name="uk_governance_role_grant",
        ),
        Index("idx_governance_grant_datasource", "datasource_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    role_code = Column(String(64), nullable=False, index=True)
    datasource_id = Column(Integer, nullable=False)
    table_pattern = Column(String(255), nullable=False, default="*")
    permission = Column(String(32), nullable=False, default="query")
    allowed_columns = Column(Text, nullable=True)
    gmt_created = Column(DateTime, default=datetime.now, nullable=False)
    gmt_modified = Column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=False
    )


class GovernanceMaskRuleEntity(Model):
    """Column masking rule that applies after an authorised query."""

    __tablename__ = "governance_mask_rule"
    __table_args__ = (
        UniqueConstraint(
            "datasource_id",
            "table_name",
            "column_name",
            "role_code",
            name="uk_governance_mask_rule",
        ),
        Index("idx_governance_mask_datasource", "datasource_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    datasource_id = Column(Integer, nullable=False)
    table_name = Column(String(255), nullable=False, default="*")
    column_name = Column(String(255), nullable=False)
    role_code = Column(String(64), nullable=True)
    mask_type = Column(String(32), nullable=False, default="partial")
    gmt_created = Column(DateTime, default=datetime.now, nullable=False)
    gmt_modified = Column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=False
    )


class GovernanceCatalogProductEntity(Model):
    """A manually published, governed data product."""

    __tablename__ = "governance_catalog_product"
    __table_args__ = (
        UniqueConstraint("product_key", name="uk_governance_product_key"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_key = Column(String(128), nullable=False, index=True)
    datasource_id = Column(Integer, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    resource_type = Column(String(32), nullable=False, default="table")
    resource_definition = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="draft")
    owner_user_id = Column(Integer, nullable=False, index=True)
    rate_limit_per_minute = Column(Integer, nullable=False, default=60)
    gmt_created = Column(DateTime, default=datetime.now, nullable=False)
    gmt_modified = Column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=False
    )


class GovernanceAccessRequestEntity(Model):
    """Approval workflow for a catalog product."""

    __tablename__ = "governance_access_request"
    __table_args__ = (Index("idx_governance_request_product", "product_id", "status"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, nullable=False)
    requester_user_id = Column(Integer, nullable=False, index=True)
    reason = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="pending")
    reviewer_user_id = Column(Integer, nullable=True)
    review_comment = Column(Text, nullable=True)
    gmt_created = Column(DateTime, default=datetime.now, nullable=False)
    gmt_modified = Column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=False
    )


class GovernanceApiKeyEntity(Model):
    """Hashed developer key bound to a DB-GPT user, not a duplicate identity."""

    __tablename__ = "governance_api_key"
    __table_args__ = (UniqueConstraint("key_hash", name="uk_governance_api_key_hash"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(128), nullable=False)
    key_prefix = Column(String(16), nullable=False)
    key_hash = Column(String(128), nullable=False)
    owner_user_id = Column(Integer, nullable=False, index=True)
    status = Column(String(32), nullable=False, default="active")
    expires_at = Column(DateTime, nullable=True)
    last_used_at = Column(DateTime, nullable=True)
    gmt_created = Column(DateTime, default=datetime.now, nullable=False)


class GovernanceAuditLogEntity(Model):
    """Immutable audit trail for governed operations."""

    __tablename__ = "governance_audit_log"
    __table_args__ = (
        Index("idx_governance_audit_user_time", "user_id", "gmt_created"),
        Index("idx_governance_audit_datasource_time", "datasource_id", "gmt_created"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True, index=True)
    username = Column(String(128), nullable=True)
    action = Column(String(64), nullable=False)
    datasource_id = Column(Integer, nullable=True, index=True)
    resource_key = Column(String(128), nullable=True)
    sql_text = Column(Text, nullable=True)
    status = Column(String(32), nullable=False)
    detail = Column(Text, nullable=True)
    gmt_created = Column(DateTime, default=datetime.now, nullable=False)
