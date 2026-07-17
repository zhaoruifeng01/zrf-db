"""Authorization boundary for governed resources."""

import fnmatch
from dataclasses import dataclass
from typing import Protocol

from dbgpt.storage.metadata import DatabaseManager
from dbgpt_serve.governance.models import GovernanceRoleGrantEntity


@dataclass(frozen=True)
class AuthorizationResource:
    """A resource/action pair that must be authorized."""

    datasource_id: int
    table_name: str
    action: str


@dataclass(frozen=True)
class AuthorizationDecision:
    """Structured authorization result."""

    allowed: bool
    reason: str


class Authorizer(Protocol):
    """Policy interface used by routes and execution services."""

    def authorize(
        self, principal, resource: AuthorizationResource
    ) -> AuthorizationDecision:
        """Return an allow/deny decision for a principal and resource."""


class LegacyRoleGrantAuthorizer:
    """Adapter for the existing role-code grant table.

    This keeps the current behavior behind an explicit Authorizer interface so
    the structured grant model can replace it without changing callers.
    """

    def __init__(self, db_manager: DatabaseManager):
        self._db_manager = db_manager

    def authorize(
        self, principal, resource: AuthorizationResource
    ) -> AuthorizationDecision:
        if principal.is_admin:
            return AuthorizationDecision(True, "admin")
        role_codes = list(principal.role_codes or [])
        if not role_codes:
            return AuthorizationDecision(False, "principal has no roles")

        with self._db_manager.session() as session:
            grants = (
                session.query(GovernanceRoleGrantEntity)
                .filter(
                    GovernanceRoleGrantEntity.datasource_id == resource.datasource_id,
                    GovernanceRoleGrantEntity.role_code.in_(role_codes),
                    GovernanceRoleGrantEntity.permission.in_(
                        [resource.action, "manage"]
                    ),
                )
                .all()
            )
            for grant in grants:
                if fnmatch.fnmatch(
                    resource.table_name.lower(), grant.table_pattern.lower()
                ):
                    return AuthorizationDecision(True, "legacy role grant")

        return AuthorizationDecision(False, "no matching governance grant")
