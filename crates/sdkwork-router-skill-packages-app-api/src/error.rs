use axum::http::StatusCode;
use axum::Json;
use sdkwork_birdcoder_app_templates_service::error::AppTemplateError;
use sdkwork_birdcoder_skill_packages_service::error::SkillPackageError;

pub use sdkwork_birdcoder_errors::ProblemDetailsPayload;

fn with_trace_id(
    payload: ProblemDetailsPayload,
    trace_id: Option<&str>,
) -> ProblemDetailsPayload {
    payload.with_trace_id(trace_id)
}

pub fn map_skill_package_error(
    error: SkillPackageError,
    trace_id: Option<&str>,
) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        SkillPackageError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(with_trace_id(
                ProblemDetailsPayload::new("not_found", msg, false),
                trace_id,
            )),
        ),
        SkillPackageError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(with_trace_id(
                ProblemDetailsPayload::new("invalid_input", msg, false),
                trace_id,
            )),
        ),
        SkillPackageError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(with_trace_id(
                ProblemDetailsPayload::new("conflict", msg, false),
                trace_id,
            )),
        ),
        SkillPackageError::NotImplemented(msg) => (
            StatusCode::NOT_IMPLEMENTED,
            Json(with_trace_id(
                ProblemDetailsPayload::new("not_implemented", msg, false),
                trace_id,
            )),
        ),
        SkillPackageError::Repository(msg) | SkillPackageError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(
                ProblemDetailsPayload::new("internal", msg, true),
                trace_id,
            )),
        ),
    }
}

pub fn map_app_template_error(
    error: AppTemplateError,
    trace_id: Option<&str>,
) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        AppTemplateError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(with_trace_id(
                ProblemDetailsPayload::new("not_found", msg, false),
                trace_id,
            )),
        ),
        AppTemplateError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(with_trace_id(
                ProblemDetailsPayload::new("invalid_input", msg, false),
                trace_id,
            )),
        ),
        AppTemplateError::Repository(msg) | AppTemplateError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(
                ProblemDetailsPayload::new("internal", msg, true),
                trace_id,
            )),
        ),
    }
}
