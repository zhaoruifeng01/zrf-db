"""Audit writer boundary for governance events."""

from typing import Optional, Protocol

from dbgpt.storage.metadata import DatabaseManager
from dbgpt_serve.governance.audit.sanitizer import (
    sanitize_audit_detail,
    sql_audit_summary,
)
from dbgpt_serve.governance.models import GovernanceAuditLogEntity


class AuditWriter(Protocol):
    """Audit write interface used by governance services."""

    def write(
        self,
        principal,
        action: str,
        datasource_id: Optional[int],
        status: str,
        sql_text: Optional[str] = None,
        detail: Optional[str] = None,
        resource_key: Optional[str] = None,
    ) -> None:
        """Persist or enqueue one sanitized audit event."""


class DatabaseAuditWriter:
    """Synchronous legacy audit writer backed by metadata storage."""

    def __init__(self, db_manager: DatabaseManager):
        self._db_manager = db_manager

    def write(
        self,
        principal,
        action: str,
        datasource_id: Optional[int],
        status: str,
        sql_text: Optional[str] = None,
        detail: Optional[str] = None,
        resource_key: Optional[str] = None,
    ) -> None:
        with self._db_manager.session() as session:
            session.add(
                GovernanceAuditLogEntity(
                    user_id=principal.user_id,
                    username=principal.username,
                    action=action,
                    datasource_id=datasource_id,
                    resource_key=resource_key,
                    sql_text=sql_audit_summary(sql_text),
                    status=status,
                    detail=sanitize_audit_detail(detail),
                )
            )
            session.commit()
