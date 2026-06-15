use crate::domain::models::AppTemplatePayload;
use crate::error::AppTemplateError;

// ── Repository trait ─────────────────────────────────────────────────

pub trait AppTemplateRepository: Send + Sync {
    fn list_templates(&self) -> Result<Vec<AppTemplatePayload>, String>;
    fn find_template_by_id(&self, template_id: &str) -> Result<Option<AppTemplatePayload>, String>;
}

// ── Service ──────────────────────────────────────────────────────────

pub struct AppTemplateService<R: AppTemplateRepository> {
    repository: R,
}

impl<R: AppTemplateRepository> AppTemplateService<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn list_templates(&self) -> Result<Vec<AppTemplatePayload>, AppTemplateError> {
        self.repository
            .list_templates()
            .map_err(AppTemplateError::Repository)
    }

    pub fn get_template(&self, template_id: &str) -> Result<AppTemplatePayload, AppTemplateError> {
        let normalized_id = normalize_required(template_id).ok_or_else(|| {
            AppTemplateError::InvalidInput("templateId is required.".to_string())
        })?;

        self.repository
            .find_template_by_id(&normalized_id)
            .map_err(AppTemplateError::Repository)?
            .ok_or_else(|| {
                AppTemplateError::NotFound(format!("Template \"{normalized_id}\" was not found."))
            })
    }
}

fn normalize_required(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}
