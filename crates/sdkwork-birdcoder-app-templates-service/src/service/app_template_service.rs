use crate::domain::models::AppTemplatePayload;
use crate::error::AppTemplateError;

#[async_trait::async_trait]
pub trait AppTemplateRepository: Send + Sync {
    async fn list_templates(&self) -> Result<Vec<AppTemplatePayload>, String>;
    async fn find_template_by_id(&self, template_id: &str) -> Result<Option<AppTemplatePayload>, String>;
}

#[derive(Clone)]
pub struct AppTemplateService<R: AppTemplateRepository> {
    repository: R,
}

impl<R: AppTemplateRepository> AppTemplateService<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub async fn list_templates(&self) -> Result<Vec<AppTemplatePayload>, AppTemplateError> {
        self.repository
            .list_templates()
            .await
            .map_err(AppTemplateError::Repository)
    }

    pub async fn get_template(&self, template_id: &str) -> Result<AppTemplatePayload, AppTemplateError> {
        let normalized_id = normalize_required(template_id).ok_or_else(|| {
            AppTemplateError::InvalidInput("templateId is required.".to_string())
        })?;

        self.repository
            .find_template_by_id(&normalized_id)
            .await
            .map_err(AppTemplateError::Repository)?
            .ok_or_else(|| {
                AppTemplateError::NotFound(format!("Template \"{normalized_id}\" was not found."))
            })
    }
}

fn normalize_required(value: &str) -> Option<String> {
    if sdkwork_utils_rust::is_blank(Some(value)) {
        None
    } else {
        Some(sdkwork_utils_rust::trim(value))
    }
}
