import logging
import os
import sys
import threading
import time
from typing import List, Optional  # noqa: F401 - kept for potential external imports

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# fastapi import time cost about 0.05s
from fastapi.staticfiles import StaticFiles

from dbgpt._version import version
from dbgpt.component import SystemApp
from dbgpt.configs.model_config import (
    LOGDIR,
    STATIC_MESSAGE_IMG_PATH,
)
from dbgpt.util.fastapi import create_app, replace_router
from dbgpt.util.i18n_utils import _, set_default_language
from dbgpt.util.parameter_utils import _get_dict_from_obj
from dbgpt.util.system_utils import get_system_info
from dbgpt.util.tracer import SpanType, SpanTypeRunName, initialize_tracer, root_tracer
from dbgpt.util.utils import (
    logging_str_to_uvicorn_level,
    setup_http_service_logging,
    setup_logging,
)
from dbgpt_app.base import (
    _create_model_start_listener,
    _migration_db_storage,
    server_init,
)

# initialize_components import time cost about 0.1s
from dbgpt_app.component_configs import initialize_components
from dbgpt_app.config import ApplicationConfig, ServiceWebParameters, SystemParameters
from dbgpt_serve.core import add_exception_handler

logger = logging.getLogger(__name__)
ROOT_PATH = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(ROOT_PATH)

# ---------------------------------------------------------------------------
# Readiness state: set after Phase 2 (deferred init) completes.
# APIs that depend on full initialization check this before processing.
# ---------------------------------------------------------------------------
_app_ready = threading.Event()

app = create_app(
    title=_("DB-GPT Open API"),
    description=_("DB-GPT Open API"),
    version=version,
    openapi_tags=[],
)
# Use custom router to support priority
replace_router(app)

system_app = SystemApp(app)


def mount_routers(app: FastAPI):
    """Lazy import to avoid high time cost"""
    from dbgpt_app.knowledge.api import router as knowledge_router
    from dbgpt_app.openapi.api_v1.agentic_data_api import router as agentic_data_api
    from dbgpt_app.openapi.api_v1.api_v1 import router as api_v1
    from dbgpt_app.openapi.api_v1.editor.api_editor_v1 import (
        router as api_editor_route_v1,
    )
    from dbgpt_app.openapi.api_v1.examples_api import router as examples_router
    from dbgpt_app.openapi.api_v1.feedback.api_fb_v1 import router as api_fb_v1
    from dbgpt_app.openapi.api_v1.python_upload_api import (
        router as python_upload_router,
    )
    from dbgpt_app.openapi.api_v2 import router as api_v2
    from dbgpt_serve.agent.app.controller import router as gpts_v1
    from dbgpt_serve.agent.app.endpoints import router as app_v2

    app.include_router(api_v1, prefix="/api", tags=["Chat"])
    app.include_router(api_v2, prefix="/api", tags=["ChatV2"])
    app.include_router(api_editor_route_v1, prefix="/api", tags=["Editor"])
    app.include_router(api_fb_v1, prefix="/api", tags=["FeedBack"])
    app.include_router(gpts_v1, prefix="/api", tags=["GptsApp"])
    app.include_router(app_v2, prefix="/api", tags=["App"])
    app.include_router(python_upload_router, prefix="/api", tags=["PythonUpload"])
    app.include_router(examples_router, prefix="/api", tags=["Examples"])
    app.include_router(agentic_data_api, prefix="/api", tags=["AgenticData"])

    app.include_router(knowledge_router, tags=["Knowledge"])

    from dbgpt_serve.agent.app.recommend_question.controller import (
        router as recommend_question_v1,
    )

    app.include_router(recommend_question_v1, prefix="/api", tags=["RecommendQuestion"])


def mount_static_files(app: FastAPI, param: ApplicationConfig):
    package_dir = os.path.dirname(os.path.abspath(__file__))
    if param.service.web.new_web_ui:
        static_file_path = os.path.join(package_dir, "static", "web")
    else:
        static_file_path = os.path.join(package_dir, "static", "old_web")

    os.makedirs(STATIC_MESSAGE_IMG_PATH, exist_ok=True)
    app.mount(
        "/images",
        StaticFiles(directory=STATIC_MESSAGE_IMG_PATH, html=True),
        name="static2",
    )
    app.mount(
        "/_next/static", StaticFiles(directory=static_file_path + "/_next/static")
    )

    # The Yunshu-derived governance UI shares the DB-GPT origin and this same
    # FastAPI process. It must be mounted before the root static application.
    governance_static_path = os.path.join(package_dir, "static", "governance")
    if os.path.isdir(governance_static_path):
        app.mount(
            "/governance",
            StaticFiles(directory=governance_static_path, html=True),
            name="governance_static",
        )

    # Serve the Next.js dynamic route page for /share/{token}.
    # Next.js static export produces share/[token]/index.html (literal directory
    # name "[token]"), but FastAPI StaticFiles cannot resolve dynamic segments.
    # Register explicit routes *before* the catch-all StaticFiles mount so that
    # /share/<any-token> is served correctly.
    from fastapi import HTTPException
    from fastapi.responses import FileResponse

    share_html = os.path.join(static_file_path, "share", "[token]", "index.html")

    @app.get("/share/{token}")
    @app.get("/share/{token}/")
    async def _share_page_fallback(token: str):
        if os.path.isfile(share_html):
            return FileResponse(share_html, media_type="text/html")
        raise HTTPException(status_code=404, detail="Page not found")

    app.mount("/", StaticFiles(directory=static_file_path, html=True), name="static")

    app.mount(
        "/swagger_static",
        StaticFiles(directory=static_file_path),
        name="swagger_static",
    )


add_exception_handler(app)


# ---------------------------------------------------------------------------
# Readiness middleware: returns 503 for non-critical APIs until Phase 2 done
# ---------------------------------------------------------------------------
_ALWAYS_ALLOW_PREFIXES = (
    "/api/health",
    "/api/v1/serve/permission/auth",
    "/docs",
    "/openapi.json",
    "/redoc",
)


@app.middleware("http")
async def readiness_middleware(request: Request, call_next):
    """Return 503 for business APIs while deferred initialization is running."""
    if _app_ready.is_set():
        return await call_next(request)
    path = request.url.path
    # Always allow health, login, static, docs
    if (
        path.startswith(_ALWAYS_ALLOW_PREFIXES)
        or path.startswith("/_next/")
        or path.startswith("/images")
        or not path.startswith("/api")
    ):
        return await call_next(request)
    return JSONResponse(
        status_code=503,
        content={
            "success": False,
            "err_code": "SERVICE_INITIALIZING",
            "err_msg": "Service is starting up, please wait...",
            "data": None,
        },
    )


# ---------------------------------------------------------------------------
# Health check endpoint (always available after Phase 1)
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health_check():
    """Health check endpoint. Returns readiness status."""
    if _app_ready.is_set():
        return {"status": "ready"}
    return {"status": "initializing"}


# ---------------------------------------------------------------------------
# Phase 1: Critical initialization (blocking, before uvicorn starts)
# ---------------------------------------------------------------------------
def _init_critical(param: ApplicationConfig):
    """Phase 1: Minimal blocking initialization.

    Only performs work that MUST complete before the server can accept any
    request: logging, DB connection, route registration, schema migration,
    prompt/permission serves required by startup/login, and static file mounting.
    """
    web_config = param.service.web
    log_config = web_config.log or param.log
    setup_logging(
        "dbgpt",
        log_config,
        default_logger_level=param.system.log_level,
        default_logger_filename=os.path.join(LOGDIR, "dbgpt_webserver.log"),
    )

    # DB connection (all components depend on this)
    server_init(param, system_app)

    # API routes (uvicorn needs them)
    mount_routers(app)

    # DB schema migration
    _migration_db_storage(
        param.service.web.database, web_config.disable_alembic_upgrade
    )

    # Prompt serve must be ready before AgentManager.after_start() registers agents.
    _init_prompt_serve(param)

    # Permission serve must be ready for login
    _init_permission_serve(param)

    # Static files for frontend
    mount_static_files(app, param)

    logger.info("Phase 1 (critical init) complete - server ready to accept requests")


def _init_prompt_serve(param: ApplicationConfig):
    """Register and start the prompt serve before agent startup hooks run."""
    from dbgpt_app.initialization.serve_initialization import get_config
    from dbgpt_serve.prompt.config import ServeConfig as PromptServeConfig
    from dbgpt_serve.prompt.serve import Serve as PromptServe

    if PromptServe.name in system_app.components:
        return

    serve_configs = {s.get_type_value(): s for s in param.serves}
    global_api_keys = _set_global_app_config(param)

    system_app.register(
        PromptServe,
        api_prefix="/prompt",
        config=get_config(
            serve_configs,
            PromptServe.name,
            PromptServeConfig,
            default_user="dbgpt",
            default_sys_code="dbgpt",
            api_keys=global_api_keys,
        ),
    )

    prompt_component = system_app.get_component(PromptServe.name, PromptServe)
    prompt_component.on_init()
    prompt_component.before_start()


def _set_global_app_config(param: ApplicationConfig) -> Optional[str]:
    """Set shared app config values used by early serve initialization."""
    global_api_keys = None
    if param.system.api_keys:
        global_api_keys = ",".join(param.system.api_keys)
        system_app.config.set(
            "dbgpt.app.global.api_keys", global_api_keys, overwrite=True
        )
    if param.system.encrypt_key:
        system_app.config.set(
            "dbgpt.app.global.encrypt_key",
            param.system.encrypt_key,
            overwrite=True,
        )
    system_app.config.set(
        "dbgpt.app.global.language", param.system.language, overwrite=True
    )
    return global_api_keys


def _init_permission_serve(param: ApplicationConfig):
    """Register and start the permission serve so login works immediately."""
    from dbgpt_app.initialization.serve_initialization import get_config
    from dbgpt_serve.permission.config import ServeConfig as PermissionServeConfig
    from dbgpt_serve.permission.serve import Serve as PermissionServe

    # Set global config values that permission serve depends on
    serve_configs = {s.get_type_value(): s for s in param.serves}
    global_api_keys = _set_global_app_config(param)

    # Register permission serve
    system_app.register(
        PermissionServe,
        config=get_config(
            serve_configs,
            PermissionServe.name,
            PermissionServeConfig,
            api_keys=global_api_keys,
        ),
    )

    # Trigger its lifecycle so it creates tables and default admin user
    permission_component = system_app.get_component(
        PermissionServe.name, PermissionServe
    )
    permission_component.on_init()
    permission_component.before_start()


# ---------------------------------------------------------------------------
# Phase 2: Deferred initialization (runs in background after uvicorn starts)
# ---------------------------------------------------------------------------
def _init_deferred(param: ApplicationConfig):
    """Phase 2: Non-critical initialization that runs after uvicorn is listening.

    Includes component registration, model worker setup, and other heavy work.
    """
    start_time = time.time()
    logger.info("Phase 2 (deferred init) starting...")

    try:
        from dbgpt.model.cluster import initialize_worker_manager_in_client

        web_config = param.service.web
        model_start_listener = _create_model_start_listener(system_app, web_config)

        # Register all components (embedding, AWEL, agent, serves, etc.)
        initialize_components(param, system_app)

        # Lifecycle hooks
        system_app.on_init()
        system_app.after_init()

        # Register default data sources
        _register_default_datasources()

        # Model worker initialization
        binding_port = web_config.port
        binding_host = web_config.host
        if not web_config.light:
            from dbgpt.model.cluster.storage import ModelStorage
            from dbgpt_serve.model.serve import Serve as ModelServe

            logger.info(
                "Model Unified Deployment Mode, run all services in the same process"
            )
            model_serve = ModelServe.get_instance(system_app)
            model_storage = ModelStorage(model_serve.model_storage)
            initialize_worker_manager_in_client(
                worker_params=param.service.model.worker,
                models_config=param.models,
                app=app,
                binding_port=binding_port,
                binding_host=binding_host,
                start_listener=model_start_listener,
                system_app=system_app,
                model_storage=model_storage,
            )
        else:
            controller_addr = web_config.controller_addr
            param.models.llms = []
            param.models.rerankers = []
            param.models.embeddings = []
            initialize_worker_manager_in_client(
                worker_params=param.service.model.worker,
                models_config=param.models,
                app=app,
                run_locally=False,
                controller_addr=controller_addr,
                binding_port=binding_port,
                binding_host=binding_host,
                start_listener=model_start_listener,
                system_app=system_app,
            )

        # Final lifecycle hook
        system_app.before_start()

        elapsed = time.time() - start_time
        logger.info(
            f"Phase 2 (deferred init) complete in {elapsed:.1f}s - all services ready"
        )
    except Exception as e:
        logger.error(f"Phase 2 (deferred init) failed: {e}", exc_info=True)
    finally:
        # Mark app as fully ready regardless (partial functionality is better
        # than permanent 503)
        _app_ready.set()


def _register_default_datasources():
    """Register default example data sources."""
    try:
        from dbgpt.configs.model_config import PILOT_PATH, ROOT_PATH
        from dbgpt_serve.datasource.manages.connect_config_db import ConnectConfigDao

        dao = ConnectConfigDao()
        db_name = "Walmart_Sales"
        if not dao.get_by_names(db_name):
            candidate_paths = [
                os.path.join(PILOT_PATH, "examples", "Walmart_Sales.db"),
                os.path.join(
                    ROOT_PATH, "docker", "examples", "dashboard", "Walmart_Sales.db"
                ),
            ]
            db_absolute_path = next(
                (p for p in candidate_paths if os.path.isfile(p)), None
            )
            if db_absolute_path is None:
                logger.info(
                    f"Skipping default data source '{db_name}': file not found "
                    f"at {candidate_paths}"
                )
            else:
                dao.add_file_db(
                    db_name=db_name,
                    db_type="sqlite",
                    db_path=db_absolute_path,
                    comment="Default Walmart Sales example database",
                )
                logger.info(
                    f"Successfully registered default data source: "
                    f"{db_name} at {db_absolute_path}"
                )
    except Exception as e:
        logger.error(f"Failed to register default data sources: {str(e)}")


def run_uvicorn(param: ServiceWebParameters):
    import uvicorn

    setup_http_service_logging()

    # https://github.com/encode/starlette/issues/617
    cors_app = CORSMiddleware(
        app=app,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )
    log_level = logging_str_to_uvicorn_level("WARNING")
    if param.log and param.log.level:
        log_level = logging_str_to_uvicorn_level(param.log.level)
    uvicorn.run(
        cors_app,
        host=param.host,
        port=param.port,
        log_level=log_level,
    )


def run_webserver(config_file: str):
    # Load configuration with specified config file
    param = load_config(config_file)
    trace_config = param.service.web.trace or param.trace
    trace_file = trace_config.file or os.path.join(
        "logs", "dbgpt_webserver_tracer.jsonl"
    )
    config = system_app.config
    config.configs["app_config"] = param
    initialize_tracer(
        trace_file,
        system_app=system_app,
        root_operation_name=trace_config.root_operation_name or "DB-GPT-Webserver",
        tracer_parameters=trace_config,
    )

    with root_tracer.start_span(
        "run_webserver",
        span_type=SpanType.RUN,
        metadata={
            "run_service": SpanTypeRunName.WEBSERVER,
            "params": _get_dict_from_obj(param),
            "sys_infos": _get_dict_from_obj(get_system_info()),
        },
    ):
        # Phase 1: Critical path only (fast)
        _init_critical(param)

        # Schedule Phase 2 to run in a background thread after uvicorn starts
        deferred_thread = threading.Thread(
            target=_init_deferred, args=(param,), daemon=True
        )
        deferred_thread.start()

        # Start uvicorn immediately (server accepts requests now)
        run_uvicorn(param.service.web)


def scan_configs():
    from dbgpt.model import scan_model_providers
    from dbgpt_app.initialization.app_initialization import scan_app_configs
    from dbgpt_app.initialization.serve_initialization import scan_serve_configs
    from dbgpt_ext.storage import scan_storage_configs
    from dbgpt_serve.datasource.manages.connector_manager import ConnectorManager

    cm = ConnectorManager(system_app)
    # pre import all connectors
    cm.on_init()
    # Register all model providers
    scan_model_providers()
    # Register all serve configs
    scan_serve_configs()
    # Register all storage configs
    scan_storage_configs()
    # Register all app configs
    scan_app_configs()


def load_config(config_file: str = None) -> ApplicationConfig:
    from dbgpt._private.config import Config
    from dbgpt.configs.model_config import ROOT_PATH as DBGPT_ROOT_PATH

    if config_file is None:
        config_file = os.path.join(
            DBGPT_ROOT_PATH, "configs", "dbgpt-proxy-siliconflow.toml"
        )
    elif not os.path.isabs(config_file):
        # If config_file is a relative path, make it relative to DBGPT_ROOT_PATH
        config_file = os.path.join(DBGPT_ROOT_PATH, config_file)

    if not os.path.exists(config_file):
        raise FileNotFoundError(f"Configuration file not found: {config_file}")
    from dbgpt.util.configure import ConfigurationManager

    logger.info(f"Loading configuration from: {config_file}")
    cfg = ConfigurationManager.from_file(config_file)
    sys_config = cfg.parse_config(SystemParameters, prefix="system")
    # Must set default language before any i18n usage
    set_default_language(sys_config.language)
    _CFG = Config()
    _CFG.LANGUAGE = sys_config.language

    # Scan all configs
    scan_configs()

    app_config = cfg.parse_config(ApplicationConfig, hook_section="hooks")
    return app_config


def parse_args():
    import argparse

    parser = argparse.ArgumentParser(description="DB-GPT Webserver")
    parser.add_argument(
        "-c",
        "--config",
        type=str,
        default=None,
        help="Path to the configuration file. Default: configs/dbgpt-siliconflow.toml",
    )
    return parser.parse_args()


if __name__ == "__main__":
    # Parse command line arguments
    _args = parse_args()
    _config_file = _args.config
    run_webserver(_config_file)
