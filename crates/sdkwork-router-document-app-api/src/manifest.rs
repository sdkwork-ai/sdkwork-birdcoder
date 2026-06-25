use sdkwork_web_contract::{HttpMethod, HttpRoute};
use sdkwork_web_core::HttpRouteManifest;

use crate::paths;

pub const DOCUMENT_APP_API_ROUTES: &[HttpRoute] = &[
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::DOCUMENTS_PATH,
        "documents",
        "documents.list",
    )
    .with_required_permission("content.documents.read"),
];

pub fn document_app_api_route_manifest() -> HttpRouteManifest {
    HttpRouteManifest::new(DOCUMENT_APP_API_ROUTES)
}
