use sdkwork_agent_kernel::ModelDescriptor;
use serde::{Deserialize, Serialize};

/// BirdCoder-facing model catalog projection sourced from kernel `ModelDescriptor`.
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

pub fn kernel_model_descriptor_to_catalog_entry(
    engine_key: &str,
    descriptor: &ModelDescriptor,
    default_for_engine: bool,
) -> KernelModelCatalogEntryProjection {
    KernelModelCatalogEntryProjection {
        engine_key: engine_key.to_string(),
        model_id: descriptor.model_id.clone(),
        label: descriptor.display_name.clone(),
        description: descriptor.family.clone(),
        provider_id: descriptor.provider_id.clone(),
        default_for_engine,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sdkwork_agent_kernel::ModelResponseFormat;

    #[test]
    fn projects_kernel_model_descriptor() {
        let descriptor = ModelDescriptor::new(
            "codex-1",
            "provider.model.codex",
            "Codex 1",
            "codex",
        )
        .with_response_format(ModelResponseFormat::Text);

        let entry = kernel_model_descriptor_to_catalog_entry("codex", &descriptor, true);
        assert_eq!(entry.engine_key, "codex");
        assert_eq!(entry.model_id, "codex-1");
        assert_eq!(entry.label, "Codex 1");
        assert!(entry.default_for_engine);
    }
}
