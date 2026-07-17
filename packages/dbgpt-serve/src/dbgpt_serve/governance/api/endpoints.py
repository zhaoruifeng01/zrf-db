"""Unified FastAPI routes for the embedded governance module."""

from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from dbgpt.component import SystemApp
from dbgpt_serve.core import Result
from dbgpt_serve.governance.api.schemas import (
    AccessRequestCreate,
    AccessRequestReview,
    ApiKeyCreateRequest,
    CatalogProductRequest,
    DatasourcePolicyRequest,
    MaskRuleRequest,
    QueryRequest,
    RoleGrantRequest,
)
from dbgpt_serve.governance.service import GovernanceService, Principal
from dbgpt_serve.permission.serve import Serve as PermissionServe

router = APIRouter()
global_system_app: Optional[SystemApp] = None
_service: Optional[GovernanceService] = None


def init_endpoints(system_app: SystemApp, service: GovernanceService) -> None:
    global global_system_app, _service
    global_system_app = system_app
    _service = service


def get_service() -> GovernanceService:
    if _service is None:
        raise HTTPException(status_code=503, detail="Governance service is not ready")
    return _service


def require_feature(enabled: bool, feature_name: str) -> None:
    if not enabled:
        raise HTTPException(status_code=404, detail=f"{feature_name} is disabled")


def get_principal(authorization: Optional[str] = Header(None)) -> Principal:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    token = authorization[7:] if authorization.startswith("Bearer ") else authorization
    permission_serve = PermissionServe.get_current_serve(global_system_app)
    if permission_serve is None or permission_serve.service is None:
        raise HTTPException(status_code=503, detail="Permission service is not ready")
    payload = permission_serve.service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = permission_serve.service.get_user(int(payload["user_id"]))
    if not user or user.status != 1:
        raise HTTPException(status_code=401, detail="User is unavailable")
    return Principal(
        user_id=user.id,
        username=user.username,
        role_codes=[role.role_code for role in user.roles],
    )


@router.get("/me", response_model=Result[dict])
def me(principal: Principal = Depends(get_principal)):
    return Result.succ(
        {
            "user_id": principal.user_id,
            "username": principal.username,
            "role_codes": list(principal.role_codes),
        }
    )


@router.get("/overview", response_model=Result[dict])
def overview(
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(service.overview(principal))


@router.get("/datasources", response_model=Result[list])
def datasources(
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(service.list_datasources(principal))


@router.put("/datasources/{datasource_id}/policy", response_model=Result[dict])
def update_datasource_policy(
    datasource_id: int,
    request: DatasourcePolicyRequest,
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(
        service.update_datasource_policy(principal, datasource_id, request.model_dump())
    )


@router.post("/datasources/{datasource_id}/health", response_model=Result[dict])
def test_datasource(
    datasource_id: int,
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(service.test_datasource(principal, datasource_id))


@router.get("/datasources/{datasource_id}/metadata", response_model=Result[list])
def metadata(
    datasource_id: int,
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(service.query_service.metadata(principal, datasource_id))


@router.get("/metadata/datasets", response_model=Result[list])
def metadata_datasets(
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(service.list_metadata_datasets(principal))


@router.get("/metadata/datasources/{datasource_id}/tables", response_model=Result[list])
def metadata_tables(
    datasource_id: int,
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(service.list_metadata_tables(principal, datasource_id))


@router.get(
    "/metadata/datasources/{datasource_id}/tables/{table_name}/columns",
    response_model=Result[list],
)
def metadata_columns(
    datasource_id: int,
    table_name: str,
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(
        service.list_metadata_columns(principal, datasource_id, table_name)
    )


@router.post("/metadata/datasources/{datasource_id}/scan", response_model=Result[dict])
def scan_metadata(
    datasource_id: int,
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(service.scan_metadata(principal, datasource_id))


@router.get("/metadata/datasources/{datasource_id}/health", response_model=Result[dict])
def metadata_health(
    datasource_id: int,
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(service.metadata_health(principal, datasource_id))


@router.post("/query", response_model=Result[dict])
def query(
    request: QueryRequest,
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    require_feature(service.config.query_enabled, "Governance query")
    return Result.succ(
        service.query_service.query(principal, request.datasource_id, request.sql)
    )


@router.get("/grants", response_model=Result[list])
def grants(
    datasource_id: Optional[int] = Query(None),
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(service.list_grants(principal, datasource_id))


@router.post("/grants", response_model=Result[dict])
def create_grant(
    request: RoleGrantRequest,
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(service.create_grant(principal, request.model_dump()))


@router.delete("/grants/{grant_id}", response_model=Result[None])
def delete_grant(
    grant_id: int,
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    service.delete_grant(principal, grant_id)
    return Result.succ(None)


@router.get("/mask-rules", response_model=Result[list])
def mask_rules(
    datasource_id: Optional[int] = Query(None),
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(service.list_mask_rules(principal, datasource_id))


@router.post("/mask-rules", response_model=Result[dict])
def create_mask_rule(
    request: MaskRuleRequest,
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(service.create_mask_rule(principal, request.model_dump()))


@router.delete("/mask-rules/{rule_id}", response_model=Result[None])
def delete_mask_rule(
    rule_id: int,
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    service.delete_mask_rule(principal, rule_id)
    return Result.succ(None)


@router.get("/catalog/products", response_model=Result[list])
def catalog_products(
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(service.list_products(principal))


@router.post("/catalog/products", response_model=Result[dict])
def create_catalog_product(
    request: CatalogProductRequest,
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(service.create_product(principal, request.model_dump()))


@router.post(
    "/catalog/products/{product_id}/access-requests", response_model=Result[dict]
)
def request_catalog_access(
    product_id: int,
    request: AccessRequestCreate,
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(
        service.request_product_access(principal, product_id, request.reason)
    )


@router.put("/catalog/access-requests/{request_id}", response_model=Result[dict])
def review_catalog_access(
    request_id: int,
    request: AccessRequestReview,
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(
        service.review_access_request(
            principal, request_id, request.status, request.review_comment
        )
    )


@router.post("/developer/api-keys", response_model=Result[dict])
def create_api_key(
    request: ApiKeyCreateRequest,
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    require_feature(service.config.api_key_enabled, "Governance API key")
    return Result.succ(service.create_api_key(principal, request.name))


@router.get("/audit-logs", response_model=Result[list])
def audit_logs(
    limit: int = Query(100, ge=1, le=500),
    principal: Principal = Depends(get_principal),
    service: GovernanceService = Depends(get_service),
):
    return Result.succ(service.list_audits(principal, limit))
