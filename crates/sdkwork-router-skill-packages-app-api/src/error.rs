use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;
use sdkwork_birdcoder_skill_packages_service::error::SkillPackageError;
use sdkwork_birdcoder_app_templates_service::error::AppTemplateError;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemDetailsPayload {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

pub fn map_skill_package_error(error: SkillPackageError) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        SkillPackageError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetailsPayload {
                code: "not_found".into(),
                message: msg,
                retryable: false,
            }),
        ),
        SkillPackageError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetailsPayload {
                code: "invalid_input".into(),
                message: msg,
                retryable: false,
            }),
        ),
        SkillPackageError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(ProblemDetailsPayload {
                code: "conflict".into(),
                message: msg,
                retryable: false,
            }),
        ),
        SkillPackageError::NotImplemented(msg) => (
            StatusCode::NOT_IMPLEMENTED,
            Json(ProblemDetailsPayload {
                code: "not_implemented".into(),
                message: msg,
                retryable: false,
            }),
        ),
        SkillPackageError::Repository(msg) | SkillPackageError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ProblemDetailsPayload {
                code: "internal".into(),
                message: msg,
                retryable: true,
            }),
        ),
    }
}

pub fn map_app_template_error(error: AppTemplateError) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        AppTemplateError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetailsPayload {
                code: "not_found".into(),
                message: msg,
                retryable: false,
            }),
        ),
        AppTemplateError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetailsPayload {
                code: "invalid_input".into(),
                message: msg,
                retryable: false,
            }),
        ),
        AppTemplateError::Repository(msg) | AppTemplateError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ProblemDetailsPayload {
                code: "internal".into(),
                message: msg,
                retryable: true,
            }),
        ),
    }
}
