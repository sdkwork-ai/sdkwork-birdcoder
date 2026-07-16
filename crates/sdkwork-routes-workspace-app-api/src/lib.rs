pub mod error;
pub mod handlers;
pub mod manifest;
pub mod mapper;
pub mod paths;
pub mod realtime_config;
pub mod realtime_hub;
pub mod realtime_metrics;
pub mod realtime_replay;
pub mod routes;

use sdkwork_web_core::HttpRouteManifest;

pub use handlers::WorkspaceAppState;
pub use manifest::workspace_app_api_route_manifest;
pub use realtime_config::{realtime_backend_from_env, resolve_redis_config, RealtimeBackendKind};
pub use realtime_hub::{RealtimePublishError, WorkspaceRealtimeHub};
pub use realtime_metrics::render_workspace_realtime_metrics;
pub use realtime_replay::{
    SharedWorkspaceRealtimeReplayProvider, WorkspaceRealtimeReplayError,
    WorkspaceRealtimeReplayEvent, WorkspaceRealtimeReplayPage, WorkspaceRealtimeReplayProvider,
    WorkspaceRealtimeReplayScope,
};
pub use routes::build_workspace_app_router;

pub fn gateway_route_manifest() -> HttpRouteManifest {
    workspace_app_api_route_manifest()
}

pub fn gateway_mount() -> axum::Router<WorkspaceAppState> {
    build_workspace_app_router()
}
