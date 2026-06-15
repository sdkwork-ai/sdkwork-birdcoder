use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;
use sdkwork_birdcoder_skill_packages_service::error::SkillPackageError;
use sdkwork_birdcoder_app_templates_service::error::AppTemplateError;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemDetails {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

pub fn map_skill_package_error(error: SkillPackageError) -> (StatusCode, Json<ProblemDetails>) {
    match error {
        SkillPackageError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetails {
                code: "not_found".into(),
                message: msg,
                retryable: false,
            }),
        ),
        SkillPackageError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetails {
                code: "invalid_input".into(),
                message: msg,
                retryable: false,
            }),
        ),
        SkillPackageError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(ProblemDetails {
                code: "conflict".into(),
                message: msg,
                retryable: false,
            }),
        ),
        SkillPackageError::Repository(msg) | SkillPackageError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ProblemDetails {
                code: "internal".into(),
                message: msg,
                retryable: true,
            }),
        ),
    }
}

pub fn map_app_template_error(error: AppTemplateError) -> (StatusCode, Json<ProblemDetails>) {
    match error {
        AppTemplateError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetails {
                code: "not_found".into(),
                message: msg,
                retryable: false,
            }),
        ),
        AppTemplateError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetails {
                code: "invalid_input".into(),
                message: msg,
                retryable: false,
            }),
        ),
        AppTemplateError::Repository(msg) | AppTemplateError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ProblemDetails {
                code: "internal".into(),
                message: msg,
                retryable: true,
            }),
        ),
    }
}

