"""Business rules shared by governance HTTP and DB-GPT query paths."""

import fnmatch
import hashlib
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set

from fastapi import HTTPException

from dbgpt.component import SystemApp
from dbgpt.storage.metadata import DatabaseManager
from dbgpt_serve.datasource.manages.connect_config_db import ConnectConfigEntity
from dbgpt_serve.datasource.manages.connector_manager import ConnectorManager
from dbgpt_serve.governance.audit import AuditWriter, DatabaseAuditWriter
from dbgpt_serve.governance.config import ServeConfig
from dbgpt_serve.governance.metadata import (
    DatasourceMetadataRepository,
    MetadataRepository,
    SemanticMetadataService,
)
from dbgpt_serve.governance.models import (
    GovernanceAccessRequestEntity,
    GovernanceApiKeyEntity,
    GovernanceAuditLogEntity,
    GovernanceCatalogProductEntity,
    GovernanceDatasourcePolicyEntity,
    GovernanceMaskRuleEntity,
    GovernanceRoleGrantEntity,
)
from dbgpt_serve.governance.policy import (
    AuthorizationResource,
    Authorizer,
    LegacyRoleGrantAuthorizer,
    LocalTokenBucketRateLimiter,
)
from dbgpt_serve.governance.sql_guard import SqlGuard, SqlGuardConfig


@dataclass(frozen=True)
class Principal:
    user_id: int
    username: str
    role_codes: Sequence[str]

    @property
    def is_admin(self) -> bool:
        return "admin" in self.role_codes


class GovernanceQueryService:
    """Execute read-only datasource operations under governance policy."""

    def __init__(self, service: "GovernanceService"):
        self._service = service
        self._guard = SqlGuard(
            SqlGuardConfig(
                max_length=service.config.sql_guard_max_length,
                max_tokens=service.config.sql_guard_max_tokens,
                max_nesting_depth=service.config.sql_guard_max_nesting_depth,
                parse_timeout_seconds=service.config.sql_guard_parse_timeout_seconds,
                read_only_prefixes=service.config.sql_guard_read_only_prefixes,
            )
        )

    def query(
        self, principal: Principal, datasource_id: int, sql: str
    ) -> Dict[str, Any]:
        datasource = self._service.get_datasource(datasource_id)
        guard_result = self._guard.validate(sql)
        tables = guard_result.tables
        self._service.check_rate_limit(principal, datasource_id)
        for table in tables or {"*"}:
            self._service.require_permission(principal, datasource_id, table, "query")

        limited_sql = self._apply_row_limit(guard_result.statement)
        try:
            connector = ConnectorManager.get_instance(
                self._service.system_app
            ).get_connector(datasource.db_name)
            raw_rows = connector.run(limited_sql)
            result = self._service.format_and_mask_rows(
                principal, datasource_id, tables, raw_rows
            )
            self._service.audit(
                principal, "query", datasource_id, "success", sql_text=limited_sql
            )
            return result
        except Exception as exc:
            self._service.audit(
                principal,
                "query",
                datasource_id,
                "failed",
                sql_text=limited_sql,
                detail=str(exc),
            )
            raise

    def metadata(
        self, principal: Principal, datasource_id: int
    ) -> List[Dict[str, Any]]:
        datasource = self._service.get_datasource(datasource_id)
        connector = ConnectorManager.get_instance(
            self._service.system_app
        ).get_connector(datasource.db_name)
        items = []
        for table_name in connector.get_table_names():
            if not self._service.has_permission(
                principal, datasource_id, table_name, "query"
            ):
                continue
            items.append(
                {
                    "table_name": table_name,
                    "columns": connector.get_columns(table_name),
                }
            )
        self._service.audit(principal, "metadata.read", datasource_id, "success")
        return items

    @staticmethod
    def _validate_read_only(sql: str) -> Set[str]:
        guard = SqlGuard(SqlGuardConfig())
        return set(guard.validate(sql).tables)

    def _apply_row_limit(self, sql: str) -> str:
        statement = sql.strip().rstrip(";")
        if statement.upper().startswith(("SHOW", "DESCRIBE", "DESC", "EXPLAIN")):
            return statement
        if re.search(r"\bLIMIT\s+\d+", statement, re.IGNORECASE):
            return statement
        return f"{statement} LIMIT {self._service.config.query_row_limit}"


class GovernanceService:
    """Unified governance domain service backed by DB-GPT metadata storage."""

    def __init__(
        self, system_app: SystemApp, db_manager: DatabaseManager, config: ServeConfig
    ):
        self.system_app = system_app
        self.db_manager = db_manager
        self.config = config
        self.metadata_repository: MetadataRepository = DatasourceMetadataRepository(
            db_manager
        )
        self.authorizer: Authorizer = LegacyRoleGrantAuthorizer(db_manager)
        self.audit_writer: AuditWriter = DatabaseAuditWriter(db_manager)
        self.rate_limiter = LocalTokenBucketRateLimiter()
        self.query_service = GovernanceQueryService(self)
        self.metadata_service = SemanticMetadataService(system_app, db_manager)

    def get_datasource(self, datasource_id: int) -> ConnectConfigEntity:
        datasource = self.metadata_repository.get_datasource(datasource_id)
        if not datasource:
            raise HTTPException(status_code=404, detail="Datasource not found")
        return datasource

    def list_datasources(self, principal: Principal) -> List[Dict[str, Any]]:
        with self.db_manager.session() as session:
            rows = (
                session.query(ConnectConfigEntity, GovernanceDatasourcePolicyEntity)
                .outerjoin(
                    GovernanceDatasourcePolicyEntity,
                    GovernanceDatasourcePolicyEntity.datasource_id
                    == ConnectConfigEntity.id,
                )
                .all()
            )
            response = []
            for datasource, policy in rows:
                if not principal.is_admin and not self.has_permission(
                    principal, datasource.id, "*", "query"
                ):
                    continue
                response.append(
                    {
                        "id": datasource.id,
                        "db_name": datasource.db_name,
                        "db_type": datasource.db_type,
                        "comment": datasource.comment,
                        "policy": self._policy_dict(policy),
                    }
                )
            return response

    def list_metadata_datasets(self, principal: Principal) -> List[Dict[str, Any]]:
        self.require_admin(principal)
        return self.metadata_service.list_datasets()

    def list_metadata_tables(
        self, principal: Principal, datasource_id: int
    ) -> List[Dict[str, Any]]:
        self.require_permission(principal, datasource_id, "*", "query")
        return self.metadata_service.list_tables(datasource_id)

    def list_metadata_columns(
        self, principal: Principal, datasource_id: int, table_name: str
    ) -> List[Dict[str, Any]]:
        self.require_permission(principal, datasource_id, table_name, "query")
        return self.metadata_service.list_columns(datasource_id, table_name)

    def scan_metadata(self, principal: Principal, datasource_id: int) -> Dict[str, Any]:
        self.require_manage(principal, datasource_id)
        result = self.metadata_service.scan_datasource(datasource_id)
        self.audit(principal, "metadata.scan", datasource_id, result["status"])
        return result

    def metadata_health(
        self, principal: Principal, datasource_id: int
    ) -> Dict[str, Any]:
        self.require_permission(principal, datasource_id, "*", "query")
        return self.metadata_service.health(datasource_id)

    def update_datasource_policy(
        self, principal: Principal, datasource_id: int, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        self.require_admin(principal)
        self.get_datasource(datasource_id)
        with self.db_manager.session() as session:
            policy = (
                session.query(GovernanceDatasourcePolicyEntity)
                .filter_by(datasource_id=datasource_id)
                .first()
            )
            if policy is None:
                policy = GovernanceDatasourcePolicyEntity(datasource_id=datasource_id)
                session.add(policy)
            for field in ("status", "business_domain", "description", "owner_user_id"):
                if field in payload:
                    setattr(policy, field, payload[field])
            session.commit()
            session.refresh(policy)
            self.audit(principal, "datasource.policy.update", datasource_id, "success")
            return self._policy_dict(policy)

    def test_datasource(
        self, principal: Principal, datasource_id: int
    ) -> Dict[str, Any]:
        self.require_manage(principal, datasource_id)
        datasource = self.get_datasource(datasource_id)
        status, message = "healthy", "Connection successful"
        try:
            connector = ConnectorManager.get_instance(self.system_app).get_connector(
                datasource.db_name
            )
            connector.run("SELECT 1")
        except Exception as exc:
            status, message = "unhealthy", str(exc)
        with self.db_manager.session() as session:
            policy = (
                session.query(GovernanceDatasourcePolicyEntity)
                .filter_by(datasource_id=datasource_id)
                .first()
            )
            if policy is None:
                policy = GovernanceDatasourcePolicyEntity(datasource_id=datasource_id)
                session.add(policy)
            policy.health_status = status
            policy.health_message = message
            policy.health_checked_at = datetime.now()
            session.commit()
        self.audit(
            principal, "datasource.health_check", datasource_id, status, detail=message
        )
        return {"status": status, "message": message}

    def create_grant(
        self, principal: Principal, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        self.require_admin(principal)
        self.get_datasource(payload["datasource_id"])
        with self.db_manager.session() as session:
            grant = GovernanceRoleGrantEntity(**payload)
            session.add(grant)
            try:
                session.commit()
            except Exception:
                session.rollback()
                raise HTTPException(
                    status_code=409, detail="Duplicate governance grant"
                )
            session.refresh(grant)
            self.audit(principal, "role_grant.create", grant.datasource_id, "success")
            return self._grant_dict(grant)

    def list_grants(
        self, principal: Principal, datasource_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        self.require_admin(principal)
        with self.db_manager.session() as session:
            query = session.query(GovernanceRoleGrantEntity)
            if datasource_id is not None:
                query = query.filter_by(datasource_id=datasource_id)
            return [
                self._grant_dict(item)
                for item in query.order_by(GovernanceRoleGrantEntity.id).all()
            ]

    def delete_grant(self, principal: Principal, grant_id: int) -> None:
        self.require_admin(principal)
        with self.db_manager.session() as session:
            grant = session.get(GovernanceRoleGrantEntity, grant_id)
            if not grant:
                raise HTTPException(status_code=404, detail="Grant not found")
            datasource_id = grant.datasource_id
            session.delete(grant)
            session.commit()
        self.audit(principal, "role_grant.delete", datasource_id, "success")

    def create_mask_rule(
        self, principal: Principal, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        self.require_admin(principal)
        self.get_datasource(payload["datasource_id"])
        with self.db_manager.session() as session:
            rule = GovernanceMaskRuleEntity(**payload)
            session.add(rule)
            try:
                session.commit()
            except Exception:
                session.rollback()
                raise HTTPException(status_code=409, detail="Duplicate mask rule")
            session.refresh(rule)
            self.audit(principal, "mask_rule.create", rule.datasource_id, "success")
            return self._mask_rule_dict(rule)

    def list_mask_rules(
        self, principal: Principal, datasource_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        self.require_admin(principal)
        with self.db_manager.session() as session:
            query = session.query(GovernanceMaskRuleEntity)
            if datasource_id is not None:
                query = query.filter_by(datasource_id=datasource_id)
            return [
                self._mask_rule_dict(item)
                for item in query.order_by(GovernanceMaskRuleEntity.id).all()
            ]

    def delete_mask_rule(self, principal: Principal, rule_id: int) -> None:
        self.require_admin(principal)
        with self.db_manager.session() as session:
            rule = session.get(GovernanceMaskRuleEntity, rule_id)
            if not rule:
                raise HTTPException(status_code=404, detail="Mask rule not found")
            datasource_id = rule.datasource_id
            session.delete(rule)
            session.commit()
        self.audit(principal, "mask_rule.delete", datasource_id, "success")

    def create_product(
        self, principal: Principal, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        self.require_manage(principal, payload["datasource_id"])
        product = GovernanceCatalogProductEntity(
            owner_user_id=principal.user_id, **payload
        )
        with self.db_manager.session() as session:
            session.add(product)
            try:
                session.commit()
            except Exception:
                session.rollback()
                raise HTTPException(status_code=409, detail="Duplicate product key")
            session.refresh(product)
            self.audit(
                principal,
                "catalog_product.create",
                product.datasource_id,
                "success",
                resource_key=product.product_key,
            )
            return self._product_dict(product)

    def list_products(self, principal: Principal) -> List[Dict[str, Any]]:
        with self.db_manager.session() as session:
            products = (
                session.query(GovernanceCatalogProductEntity)
                .order_by(GovernanceCatalogProductEntity.gmt_modified.desc())
                .all()
            )
            return [
                self._product_dict(product)
                for product in products
                if principal.is_admin
                or self.has_permission(principal, product.datasource_id, "*", "query")
            ]

    def request_product_access(
        self, principal: Principal, product_id: int, reason: Optional[str]
    ) -> Dict[str, Any]:
        with self.db_manager.session() as session:
            product = session.get(GovernanceCatalogProductEntity, product_id)
            if not product:
                raise HTTPException(status_code=404, detail="Catalog product not found")
            request = GovernanceAccessRequestEntity(
                product_id=product_id,
                requester_user_id=principal.user_id,
                reason=reason,
            )
            session.add(request)
            session.commit()
            session.refresh(request)
            self.audit(
                principal,
                "catalog_access.request",
                product.datasource_id,
                "success",
                resource_key=product.product_key,
            )
            return self._access_request_dict(request)

    def review_access_request(
        self, principal: Principal, request_id: int, status: str, comment: Optional[str]
    ) -> Dict[str, Any]:
        self.require_admin(principal)
        if status not in {"approved", "rejected"}:
            raise HTTPException(
                status_code=400, detail="Status must be approved or rejected"
            )
        with self.db_manager.session() as session:
            request = session.get(GovernanceAccessRequestEntity, request_id)
            if not request:
                raise HTTPException(status_code=404, detail="Access request not found")
            request.status = status
            request.reviewer_user_id = principal.user_id
            request.review_comment = comment
            session.commit()
            session.refresh(request)
            return self._access_request_dict(request)

    def create_api_key(self, principal: Principal, name: str) -> Dict[str, Any]:
        raw_key = f"dbgpt_gov_{secrets.token_urlsafe(32)}"
        entity = GovernanceApiKeyEntity(
            name=name,
            key_prefix=raw_key[:12],
            key_hash=hashlib.sha256(raw_key.encode()).hexdigest(),
            owner_user_id=principal.user_id,
        )
        with self.db_manager.session() as session:
            session.add(entity)
            session.commit()
            session.refresh(entity)
            self.audit(principal, "api_key.create", None, "success")
            return {
                "id": entity.id,
                "name": entity.name,
                "api_key": raw_key,
                "key_prefix": entity.key_prefix,
            }

    def list_audits(
        self, principal: Principal, limit: int = 100
    ) -> List[Dict[str, Any]]:
        self.require_admin(principal)
        with self.db_manager.session() as session:
            entries = (
                session.query(GovernanceAuditLogEntity)
                .order_by(GovernanceAuditLogEntity.gmt_created.desc())
                .limit(min(limit, 500))
                .all()
            )
            return [
                {
                    "id": item.id,
                    "user_id": item.user_id,
                    "username": item.username,
                    "action": item.action,
                    "datasource_id": item.datasource_id,
                    "resource_key": item.resource_key,
                    "status": item.status,
                    "detail": item.detail,
                    "gmt_created": item.gmt_created,
                }
                for item in entries
            ]

    def overview(self, principal: Principal) -> Dict[str, Any]:
        self.require_admin(principal)
        with self.db_manager.session() as session:
            return {
                "datasources": session.query(ConnectConfigEntity).count(),
                "governed_datasources": session.query(
                    GovernanceDatasourcePolicyEntity
                ).count(),
                "catalog_products": session.query(
                    GovernanceCatalogProductEntity
                ).count(),
                "pending_access_requests": session.query(GovernanceAccessRequestEntity)
                .filter_by(status="pending")
                .count(),
                "audit_events_24h": session.query(GovernanceAuditLogEntity)
                .filter(
                    GovernanceAuditLogEntity.gmt_created
                    >= datetime.now() - timedelta(days=1)
                )
                .count(),
            }

    def require_permission(
        self, principal: Principal, datasource_id: int, table_name: str, permission: str
    ) -> None:
        if not self.has_permission(principal, datasource_id, table_name, permission):
            raise HTTPException(
                status_code=403,
                detail="Governance policy denies this datasource or table",
            )

    def require_manage(self, principal: Principal, datasource_id: int) -> None:
        if principal.is_admin:
            return
        self.require_permission(principal, datasource_id, "*", "manage")

    @staticmethod
    def require_admin(principal: Principal) -> None:
        if not principal.is_admin:
            raise HTTPException(status_code=403, detail="Administrator role required")

    def has_permission(
        self, principal: Principal, datasource_id: int, table_name: str, permission: str
    ) -> bool:
        decision = self.authorizer.authorize(
            principal,
            AuthorizationResource(
                datasource_id=datasource_id,
                table_name=table_name,
                action=permission,
            ),
        )
        return decision.allowed

    def check_rate_limit(self, principal: Principal, datasource_id: int) -> None:
        allowed = self.rate_limiter.allow(
            (principal.user_id, datasource_id),
            self.config.query_rate_limit_per_minute,
        )
        if not allowed:
            raise HTTPException(
                status_code=429, detail="Governance query rate limit exceeded"
            )

    def format_and_mask_rows(
        self,
        principal: Principal,
        datasource_id: int,
        tables: Iterable[str],
        raw_rows: List[Any],
    ) -> Dict[str, Any]:
        if not raw_rows:
            return {"columns": [], "items": []}
        columns = (
            [str(item) for item in raw_rows[0]]
            if isinstance(raw_rows[0], (list, tuple))
            else []
        )
        rows = [
            dict(zip(columns, row))
            for row in raw_rows[1:]
            if isinstance(row, (list, tuple))
        ]
        self._apply_masks(principal, datasource_id, set(tables), rows)
        return {"columns": columns, "items": rows}

    def _apply_masks(
        self,
        principal: Principal,
        datasource_id: int,
        tables: Set[str],
        rows: List[Dict[str, Any]],
    ) -> None:
        if principal.is_admin or not rows:
            return
        with self.db_manager.session() as session:
            rules = [
                {
                    "role_code": rule.role_code,
                    "table_name": rule.table_name,
                    "column_name": rule.column_name,
                    "mask_type": rule.mask_type,
                }
                for rule in session.query(GovernanceMaskRuleEntity)
                .filter(GovernanceMaskRuleEntity.datasource_id == datasource_id)
                .all()
            ]
        for rule in rules:
            if rule["role_code"] and rule["role_code"] not in principal.role_codes:
                continue
            if tables and not any(
                self._matches(table, rule["table_name"]) for table in tables
            ):
                continue
            for row in rows:
                column_name = rule["column_name"]
                if column_name in row:
                    row[column_name] = self._mask_value(
                        row[column_name], rule["mask_type"]
                    )

    @staticmethod
    def _mask_value(value: Any, mask_type: str) -> Any:
        if value is None:
            return None
        text = str(value)
        if mask_type == "full":
            return "***"
        if mask_type == "hash":
            return hashlib.sha256(text.encode()).hexdigest()
        if mask_type == "email" and "@" in text:
            name, domain = text.split("@", 1)
            return f"{name[:1]}***@{domain}"
        if len(text) <= 2:
            return "*" * len(text)
        return f"{text[:1]}***{text[-1:]}"

    @staticmethod
    def _matches(value: str, pattern: str) -> bool:
        return fnmatch.fnmatch(value.lower(), pattern.lower())

    def audit(
        self,
        principal: Principal,
        action: str,
        datasource_id: Optional[int],
        status: str,
        sql_text: Optional[str] = None,
        detail: Optional[str] = None,
        resource_key: Optional[str] = None,
    ) -> None:
        self.audit_writer.write(
            principal,
            action,
            datasource_id,
            status,
            sql_text=sql_text,
            detail=detail,
            resource_key=resource_key,
        )

    @staticmethod
    def _policy_dict(
        policy: Optional[GovernanceDatasourcePolicyEntity],
    ) -> Optional[Dict[str, Any]]:
        if policy is None:
            return None
        return {
            "status": policy.status,
            "business_domain": policy.business_domain,
            "description": policy.description,
            "owner_user_id": policy.owner_user_id,
            "health_status": policy.health_status,
            "health_message": policy.health_message,
            "health_checked_at": policy.health_checked_at,
        }

    @staticmethod
    def _grant_dict(grant: GovernanceRoleGrantEntity) -> Dict[str, Any]:
        return {
            "id": grant.id,
            "role_code": grant.role_code,
            "datasource_id": grant.datasource_id,
            "table_pattern": grant.table_pattern,
            "permission": grant.permission,
            "allowed_columns": grant.allowed_columns,
        }

    @staticmethod
    def _mask_rule_dict(rule: GovernanceMaskRuleEntity) -> Dict[str, Any]:
        return {
            "id": rule.id,
            "datasource_id": rule.datasource_id,
            "table_name": rule.table_name,
            "column_name": rule.column_name,
            "role_code": rule.role_code,
            "mask_type": rule.mask_type,
        }

    @staticmethod
    def _product_dict(product: GovernanceCatalogProductEntity) -> Dict[str, Any]:
        return {
            "id": product.id,
            "product_key": product.product_key,
            "datasource_id": product.datasource_id,
            "title": product.title,
            "description": product.description,
            "resource_type": product.resource_type,
            "resource_definition": product.resource_definition,
            "status": product.status,
            "owner_user_id": product.owner_user_id,
            "rate_limit_per_minute": product.rate_limit_per_minute,
        }

    @staticmethod
    def _access_request_dict(request: GovernanceAccessRequestEntity) -> Dict[str, Any]:
        return {
            "id": request.id,
            "product_id": request.product_id,
            "requester_user_id": request.requester_user_id,
            "reason": request.reason,
            "status": request.status,
            "reviewer_user_id": request.reviewer_user_id,
            "review_comment": request.review_comment,
        }
