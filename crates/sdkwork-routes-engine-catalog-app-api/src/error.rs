use axum::http::StatusCode;
use sdkwork_birdcoder_engine_catalog_service::error::EngineCatalogError;
use sdkwork_utils_rust::SdkWorkResultCode;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_internal_problem, traced_platform_problem,
    traced_problem_json,
};

pub use sdkwork_birdcoder_errors::ProblemJsonBody;

pub fn map_engine_catalog_error(
    error: EngineCatalogError,
    trace_id: Option<&str>,
) -> ProblemJsonBody {
    match error {
        EngineCatalogError::NotFound(msg) => {
            traced_platform_problem(SdkWorkResultCode::NotFound, msg, trace_id)
        }
        EngineCatalogError::InvalidInput(msg) => {
            traced_platform_problem(SdkWorkResultCode::ValidationError, msg, trace_id)
        }
        EngineCatalogError::Repository(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_data_access_problem(),
            trace_id,
        ),
        EngineCatalogError::Internal(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_internal_problem(),
            trace_id,
        ),
    }
}
