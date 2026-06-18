use axum::Router;

pub async fn wire_iam_app_router() -> Result<Router, String> {
    sdkwork_router_iam_app_api::build_sdkwork_appbase_app_api_router().await
}
