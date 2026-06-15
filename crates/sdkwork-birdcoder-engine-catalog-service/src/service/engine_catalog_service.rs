use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::error::EngineCatalogError;

// ── Payload types ────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineCapabilityEntryPayload {
    pub key: String,
    pub label: String,
    pub description: String,
    pub enabled: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineCapabilityMatrixPayload {
    pub engine_key: String,
    pub capabilities: Vec<EngineCapabilityEntryPayload>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineDescriptorPayload {
    pub engine_key: String,
    pub name: String,
    pub description: String,
    pub default_model_id: String,
    pub capability_matrix: EngineCapabilityMatrixPayload,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelCatalogEntryPayload {
    pub engine_key: String,
    pub model_id: String,
    pub label: String,
    pub description: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionProviderPayload {
    pub provider_id: String,
    pub name: String,
    pub description: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineModelConfigCustomModelPayload {
    pub id: String,
    pub label: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineModelConfigEnginePayload {
    pub engine_id: String,
    pub default_model_id: String,
    pub selected_model_id: String,
    #[serde(default)]
    pub custom_models: Vec<CodeEngineModelConfigCustomModelPayload>,
    #[serde(default)]
    pub models: Vec<ModelCatalogEntryPayload>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineModelConfigPayload {
    pub schema_version: u8,
    pub source: String,
    pub version: String,
    pub updated_at: String,
    pub engines: BTreeMap<String, CodeEngineModelConfigEnginePayload>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncModelConfigResultPayload {
    pub action: String,
    pub authoritative_source: String,
    pub config: CodeEngineModelConfigPayload,
    pub should_write_local: bool,
    pub should_write_server: bool,
}

// ── Provider trait ───────────────────────────────────────────────────

pub trait EngineCatalogProvider: Send + Sync {
    fn list_engine_descriptors(&self) -> Result<Vec<EngineDescriptorPayload>, String>;
    fn find_engine_descriptor(&self, engine_key: &str) -> Result<Option<EngineDescriptorPayload>, String>;
    fn list_model_catalog_entries(&self) -> Result<Vec<ModelCatalogEntryPayload>, String>;
    fn list_native_session_provider_entries(&self) -> Result<Vec<NativeSessionProviderPayload>, String>;
}

// ── Service ──────────────────────────────────────────────────────────

pub struct EngineCatalogService<P: EngineCatalogProvider> {
    provider: P,
    api_version: String,
}

impl<P: EngineCatalogProvider> EngineCatalogService<P> {
    pub fn new(provider: P, api_version: String) -> Self {
        Self { provider, api_version }
    }

    pub fn list_engines(&self) -> Result<Vec<EngineDescriptorPayload>, EngineCatalogError> {
        self.provider
            .list_engine_descriptors()
            .map_err(EngineCatalogError::Repository)
    }

    pub fn get_engine_capabilities(
        &self,
        engine_key: &str,
    ) -> Result<EngineCapabilityMatrixPayload, EngineCatalogError> {
        let engine = self
            .provider
            .find_engine_descriptor(engine_key)
            .map_err(EngineCatalogError::Repository)?
            .ok_or_else(|| EngineCatalogError::NotFound(format!(
                "Engine \"{engine_key}\" was not found."
            )))?;
        Ok(engine.capability_matrix)
    }

    pub fn list_models(&self) -> Result<Vec<ModelCatalogEntryPayload>, EngineCatalogError> {
        self.provider
            .list_model_catalog_entries()
            .map_err(EngineCatalogError::Repository)
    }

    pub fn get_model_config(
        &self,
    ) -> Result<CodeEngineModelConfigPayload, EngineCatalogError> {
        let models = self.list_models()?;
        let updated_at = models
            .iter()
            .map(|model| model.updated_at.as_str())
            .max()
            .unwrap_or("2026-01-01T00:00:00.000Z")
            .to_string();

        let mut models_by_engine: BTreeMap<String, Vec<ModelCatalogEntryPayload>> = BTreeMap::new();
        for model in models {
            models_by_engine
                .entry(model.engine_key.clone())
                .or_default()
                .push(model);
        }

        let engines = self
            .list_engines()?
            .into_iter()
            .map(|engine| {
                let engine_models = models_by_engine
                    .remove(&engine.engine_key)
                    .unwrap_or_default();
                let engine_config = CodeEngineModelConfigEnginePayload {
                    engine_id: engine.engine_key.clone(),
                    default_model_id: engine.default_model_id.clone(),
                    selected_model_id: engine.default_model_id,
                    custom_models: Vec::new(),
                    models: engine_models,
                };
                (engine.engine_key, engine_config)
            })
            .collect();

        Ok(CodeEngineModelConfigPayload {
            schema_version: 1,
            source: "server".to_string(),
            version: self.api_version.clone(),
            updated_at,
            engines,
        })
    }

    pub fn sync_model_config(
        &self,
        local_config: CodeEngineModelConfigPayload,
    ) -> Result<SyncModelConfigResultPayload, EngineCatalogError> {
        let server_config = self.get_model_config()?;
        let comparison = compare_model_config_versions(&local_config, &server_config);

        let result = match comparison {
            std::cmp::Ordering::Greater => SyncModelConfigResultPayload {
                action: "push-local".to_string(),
                authoritative_source: "local".to_string(),
                config: local_config,
                should_write_local: false,
                should_write_server: true,
            },
            std::cmp::Ordering::Equal => SyncModelConfigResultPayload {
                action: "noop".to_string(),
                authoritative_source: "equal".to_string(),
                config: local_config,
                should_write_local: false,
                should_write_server: false,
            },
            std::cmp::Ordering::Less => SyncModelConfigResultPayload {
                action: "overwrite-local".to_string(),
                authoritative_source: "server".to_string(),
                config: server_config,
                should_write_local: true,
                should_write_server: false,
            },
        };

        Ok(result)
    }

    pub fn list_native_session_providers(
        &self,
    ) -> Result<Vec<NativeSessionProviderPayload>, EngineCatalogError> {
        self.provider
            .list_native_session_provider_entries()
            .map_err(EngineCatalogError::Repository)
    }
}

fn compare_model_config_versions(
    left: &CodeEngineModelConfigPayload,
    right: &CodeEngineModelConfigPayload,
) -> std::cmp::Ordering {
    match left.version.cmp(&right.version) {
        std::cmp::Ordering::Equal => left.updated_at.cmp(&right.updated_at),
        ordering => ordering,
    }
}
