"""Serve component that embeds governance in the DB-GPT API server."""

import logging
from typing import List, Optional, Union

from sqlalchemy import URL, inspect

from dbgpt.component import SystemApp
from dbgpt.storage.metadata import DatabaseManager
from dbgpt_serve.core import BaseServe
from dbgpt_serve.governance.api.endpoints import init_endpoints, router
from dbgpt_serve.governance.config import (
    APP_NAME,
    SERVE_APP_NAME,
    SERVE_APP_NAME_HUMP,
    SERVE_CONFIG_KEY_PREFIX,
    ServeConfig,
)
from dbgpt_serve.governance.service import GovernanceService

logger = logging.getLogger(__name__)


class GovernanceServe(BaseServe):
    """Register governance routes and services in the main DB-GPT process."""

    name = SERVE_APP_NAME

    def __init__(
        self,
        system_app: SystemApp,
        config: Optional[ServeConfig] = None,
        api_prefix: str = f"/api/v1/serve/{APP_NAME}",
        api_tags: Optional[List[str]] = None,
        db_url_or_db: Union[str, URL, DatabaseManager] = None,
        try_create_tables: Optional[bool] = False,
    ):
        super().__init__(
            system_app,
            api_prefix,
            api_tags or [SERVE_APP_NAME_HUMP],
            db_url_or_db,
            try_create_tables,
        )
        self._config = config
        self._service: Optional[GovernanceService] = None

    def init_app(self, system_app: SystemApp):
        if self._app_has_initiated:
            return
        self._system_app = system_app
        self._system_app.app.include_router(
            router, prefix=self._api_prefix, tags=self._api_tags
        )
        self._app_has_initiated = True

    def on_init(self):
        from . import models as _  # noqa: F401
        from .metadata import models as _metadata_models  # noqa: F401

    def _ensure_governance_tables(self, db_manager: DatabaseManager) -> None:
        required_tables = (
            "governance_datasource_policy",
            "governance_role_grant",
            "governance_mask_rule",
            "governance_catalog_product",
            "governance_access_request",
            "governance_api_key",
            "governance_audit_log",
            "governance_metadata_dataset",
            "governance_metadata_table",
            "governance_metadata_column",
            "governance_metadata_metric",
            "governance_metadata_relationship",
            "governance_metadata_scan",
        )
        inspector = inspect(db_manager.engine)
        missing_tables = [
            table_name
            for table_name in required_tables
            if not inspector.has_table(table_name)
        ]
        if missing_tables:
            raise RuntimeError(
                "Governance metadata schema is not ready. Run Alembic migrations "
                f"before startup. Missing tables: {', '.join(missing_tables)}"
            )
        logger.info("Governance metadata tables are ready.")

    def before_start(self):
        config = self._config or ServeConfig.from_app_config(
            self._system_app.config, SERVE_CONFIG_KEY_PREFIX
        )
        if not config.enabled:
            return
        db_manager = self.create_or_get_db_manager()
        self._ensure_governance_tables(db_manager)
        self._service = GovernanceService(self._system_app, db_manager, config)
        init_endpoints(self._system_app, self._service)

    @property
    def service(self) -> Optional[GovernanceService]:
        return self._service
