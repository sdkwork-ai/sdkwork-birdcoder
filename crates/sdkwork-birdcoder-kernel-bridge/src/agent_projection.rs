use sdkwork_agents_runtime_facade::{
    code_engine_binding_id, model_descriptor_to_catalog_entry, CodeEngineModelCatalogEntry,
    ModelDescriptor,
};
use serde::{Deserialize, Serialize};

/// BirdCoder-facing model catalog projection sourced from agents runtime facade.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelModelCatalogEntryProjection {
    pub engine_key: String,
    pub model_id: String,
    pub label: String,
    pub description: String,
    pub provider_id: String,
    pub default_for_engine: bool,
}

impl From<CodeEngineModelCatalogEntry> for KernelModelCatalogEntryProjection {
    fn from(entry: CodeEngineModelCatalogEntry) -> Self {
        Self {
            engine_key: entry.engine_key,
            model_id: entry.model_id,
            label: entry.label,
            description: entry.description,
            provider_id: entry.provider_id,
            default_for_engine: entry.default_for_engine,
        }
    }
}

pub fn kernel_model_descriptor_to_catalog_entry(
    engine_key: &str,
    descriptor: &ModelDescriptor,
    default_for_engine: bool,
) -> KernelModelCatalogEntryProjection {
    let binding_id = code_engine_binding_id(engine_key).unwrap_or("binding.unknown");
    model_descriptor_to_catalog_entry(engine_key, binding_id, descriptor, default_for_engine).into()
}

#[cfg(test)]
mod tests {
    use super::*;
    use sdkwork_agents_runtime_facade::{ModelDescriptor, ModelResponseFormat};

    #[test]
    fn projects_model_descriptor_through_facade() {
        let descriptor =
            ModelDescriptor::new("codex-1", "provider.model.codex", "Codex 1", "codex")
                .with_response_format(ModelResponseFormat::Text);

        let entry = kernel_model_descriptor_to_catalog_entry("codex", &descriptor, true);
        assert_eq!(entry.engine_key, "codex");
        assert_eq!(entry.model_id, "codex-1");
        assert!(entry.default_for_engine);
    }

    #[test]
    fn facade_entry_converts_to_projection() {
        let entry = CodeEngineModelCatalogEntry {
            engine_key: "codex".to_string(),
            model_id: "codex-1".to_string(),
            label: "Codex 1".to_string(),
            description: "codex".to_string(),
            provider_id: "provider.model.codex".to_string(),
            binding_id: "binding.codex".to_string(),
            default_for_engine: true,
        };
        let projection: KernelModelCatalogEntryProjection = entry.into();
        assert_eq!(projection.model_id, "codex-1");
    }
}
