use axum::http::StatusCode;
use sdkwork_birdcoder_app_templates_service::error::AppTemplateError;
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_skill_packages_service::error::SkillPackageError;
use sdkwork_utils_rust::SdkWorkResultCode;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_event_publish_problem,
    client_safe_internal_problem, traced_legacy_problem, traced_platform_problem,
    traced_problem_json,
};

pub use sdkwork_birdcoder_errors::ProblemJsonBody;

pub fn map_skill_package_error(
    error: SkillPackageError,
    trace_id: Option<&str>,
) -> ProblemJsonBody {
    match error {
        SkillPackageError::NotFound(msg) => {
            traced_platform_problem(SdkWorkResultCode::NotFound, msg, trace_id)
        }
        SkillPackageError::InvalidInput(msg) => traced_platform_problem(
            SdkWorkResultCode::ValidationError,
            msg,
            trace_id,
        ),
        SkillPackageError::Conflict(msg) => {
            traced_platform_problem(SdkWorkResultCode::Conflict, msg, trace_id)
        }
        SkillPackageError::NotImplemented(msg) => {
            traced_legacy_problem("not_implemented", msg, trace_id)
        }
        SkillPackageError::Repository(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_data_access_problem(),
            trace_id,
        ),
        SkillPackageError::Internal(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_internal_problem(),
            trace_id,
        ),
    }
}

pub fn map_not_found(message: String, trace_id: Option<&str>) -> ProblemJsonBody {
    traced_platform_problem(SdkWorkResultCode::NotFound, message, trace_id)
}

pub fn map_project_error(error: ProjectError, trace_id: Option<&str>) -> ProblemJsonBody {
    match error {
        ProjectError::NotFound(msg) => {
            traced_platform_problem(SdkWorkResultCode::NotFound, msg, trace_id)
        }
        ProjectError::Forbidden(msg) => traced_platform_problem(
            SdkWorkResultCode::PermissionRequired,
            msg,
            trace_id,
        ),
        ProjectError::InvalidInput(msg) => traced_platform_problem(
            SdkWorkResultCode::ValidationError,
            msg,
            trace_id,
        ),
        ProjectError::Conflict(msg) => {
            traced_platform_problem(SdkWorkResultCode::Conflict, msg, trace_id)
        }
        ProjectError::GitOperation(msg) => traced_legacy_problem("git_operation", msg, trace_id),
        ProjectError::Repository(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_data_access_problem(),
            trace_id,
        ),
        ProjectError::EventPublish(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_event_publish_problem(),
            trace_id,
        ),
        ProjectError::Internal(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_internal_problem(),
            trace_id,
        ),
    }
}

pub fn map_app_template_error(
    error: AppTemplateError,
    trace_id: Option<&str>,
) -> ProblemJsonBody {
    match error {
        AppTemplateError::NotFound(msg) => {
            traced_platform_problem(SdkWorkResultCode::NotFound, msg, trace_id)
        }
        AppTemplateError::InvalidInput(msg) => traced_platform_problem(
            SdkWorkResultCode::ValidationError,
            msg,
            trace_id,
        ),
        AppTemplateError::Repository(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_data_access_problem(),
            trace_id,
        ),
        AppTemplateError::Internal(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_internal_problem(),
            trace_id,
        ),
    }
}
