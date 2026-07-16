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
pub struct CodeEngineModelConfigEnginePayload {
    pub engine_id: String,
    pub default_model_id: String,
    pub selected_model_id: String,
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
    fn find_engine_descriptor(
        &self,
        engine_key: &str,
    ) -> Result<Option<EngineDescriptorPayload>, String>;
    fn list_model_catalog_entries(&self) -> Result<Vec<ModelCatalogEntryPayload>, String>;
    fn list_native_session_provider_entries(
        &self,
    ) -> Result<Vec<NativeSessionProviderPayload>, String>;
}

pub const MAX_BOUNDED_CATALOG_ITEMS: usize = 100;

fn ensure_bounded_catalog<T>(
    items: Vec<T>,
    resource_kind: &str,
) -> Result<Vec<T>, EngineCatalogError> {
    if items.len() > MAX_BOUNDED_CATALOG_ITEMS {
        return Err(EngineCatalogError::Internal(format!(
            "{resource_kind} catalog contains {} items; the bounded catalog maximum is {MAX_BOUNDED_CATALOG_ITEMS}.",
            items.len()
        )));
    }
    Ok(items)
}

// ── Service ──────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct EngineCatalogService<P: EngineCatalogProvider> {
    provider: P,
    api_version: String,
}

impl<P: EngineCatalogProvider> EngineCatalogService<P> {
    pub fn new(provider: P, api_version: String) -> Self {
        Self {
            provider,
            api_version,
        }
    }

    pub fn list_engines(&self) -> Result<Vec<EngineDescriptorPayload>, EngineCatalogError> {
        let items = self
            .provider
            .list_engine_descriptors()
            .map_err(EngineCatalogError::Repository)?;
        ensure_bounded_catalog(items, "engine")
    }

    pub fn get_engine_capabilities(
        &self,
        engine_key: &str,
    ) -> Result<EngineCapabilityMatrixPayload, EngineCatalogError> {
        let engine = self
            .provider
            .find_engine_descriptor(engine_key)
            .map_err(EngineCatalogError::Repository)?
            .ok_or_else(|| {
                EngineCatalogError::NotFound(format!("Engine \"{engine_key}\" was not found."))
            })?;
        Ok(engine.capability_matrix)
    }

    pub fn list_models(&self) -> Result<Vec<ModelCatalogEntryPayload>, EngineCatalogError> {
        let items = self
            .provider
            .list_model_catalog_entries()
            .map_err(EngineCatalogError::Repository)?;
        ensure_bounded_catalog(items, "model")
    }

    pub fn get_model_config(&self) -> Result<CodeEngineModelConfigPayload, EngineCatalogError> {
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
        let local_config = normalize_client_model_config(local_config, &server_config);
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
        let items = self
            .provider
            .list_native_session_provider_entries()
            .map_err(EngineCatalogError::Repository)?;
        ensure_bounded_catalog(items, "native session provider")
    }
}

fn normalize_client_model_config(
    client_config: CodeEngineModelConfigPayload,
    server_config: &CodeEngineModelConfigPayload,
) -> CodeEngineModelConfigPayload {
    let engines = server_config
        .engines
        .iter()
        .map(|(engine_key, server_engine)| {
            let client_engine = client_config.engines.get(engine_key);
            let requested_model_id = client_engine
                .map(|engine| engine.selected_model_id.as_str())
                .filter(|model_id| !model_id.trim().is_empty())
                .or_else(|| {
                    client_engine
                        .map(|engine| engine.default_model_id.as_str())
                        .filter(|model_id| !model_id.trim().is_empty())
                });
            let selected_model_id = requested_model_id
                .and_then(|model_id| {
                    server_engine
                        .models
                        .iter()
                        .find(|model| model.model_id == model_id)
                        .map(|model| model.model_id.clone())
                })
                .unwrap_or_else(|| server_engine.default_model_id.clone());

            (
                engine_key.clone(),
                CodeEngineModelConfigEnginePayload {
                    engine_id: engine_key.clone(),
                    default_model_id: selected_model_id.clone(),
                    selected_model_id,
                    models: server_engine.models.clone(),
                },
            )
        })
        .collect();

    CodeEngineModelConfigPayload {
        schema_version: server_config.schema_version,
        source: client_config.source,
        version: client_config.version,
        updated_at: client_config.updated_at,
        engines,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Clone)]
    struct TestCatalogProvider;

    impl EngineCatalogProvider for TestCatalogProvider {
        fn list_engine_descriptors(&self) -> Result<Vec<EngineDescriptorPayload>, String> {
            Ok(vec![
                EngineDescriptorPayload {
                    engine_key: "codex".to_string(),
                    name: "Codex".to_string(),
                    description: "OpenAI".to_string(),
                    default_model_id: "gpt-5.4".to_string(),
                    capability_matrix: EngineCapabilityMatrixPayload {
                        engine_key: "codex".to_string(),
                        capabilities: Vec::new(),
                    },
                },
                EngineDescriptorPayload {
                    engine_key: "gemini".to_string(),
                    name: "Gemini".to_string(),
                    description: "Google".to_string(),
                    default_model_id: "auto-gemini-3".to_string(),
                    capability_matrix: EngineCapabilityMatrixPayload {
                        engine_key: "gemini".to_string(),
                        capabilities: Vec::new(),
                    },
                },
            ])
        }

        fn find_engine_descriptor(
            &self,
            engine_key: &str,
        ) -> Result<Option<EngineDescriptorPayload>, String> {
            Ok(self
                .list_engine_descriptors()?
                .into_iter()
                .find(|engine| engine.engine_key == engine_key))
        }

        fn list_model_catalog_entries(&self) -> Result<Vec<ModelCatalogEntryPayload>, String> {
            Ok(vec![
                ModelCatalogEntryPayload {
                    engine_key: "codex".to_string(),
                    model_id: "gpt-5.4".to_string(),
                    label: "GPT-5.4".to_string(),
                    description: "Codex default".to_string(),
                    updated_at: "2026-07-16T00:00:00.000Z".to_string(),
                },
                ModelCatalogEntryPayload {
                    engine_key: "gemini".to_string(),
                    model_id: "auto-gemini-3".to_string(),
                    label: "Auto Gemini 3".to_string(),
                    description: "Gemini default".to_string(),
                    updated_at: "2026-07-16T00:00:00.000Z".to_string(),
                },
                ModelCatalogEntryPayload {
                    engine_key: "gemini".to_string(),
                    model_id: "gemini-2.5-pro".to_string(),
                    label: "Gemini 2.5 Pro".to_string(),
                    description: "Gemini alternate".to_string(),
                    updated_at: "2026-07-16T00:00:00.000Z".to_string(),
                },
            ])
        }

        fn list_native_session_provider_entries(
            &self,
        ) -> Result<Vec<NativeSessionProviderPayload>, String> {
            Ok(Vec::new())
        }
    }

    #[test]
    fn bounded_catalog_guard_accepts_the_cap_and_rejects_larger_collections() {
        let bounded = ensure_bounded_catalog(vec![(); MAX_BOUNDED_CATALOG_ITEMS], "engine")
            .expect("catalog at the documented cap must remain available");
        assert_eq!(bounded.len(), MAX_BOUNDED_CATALOG_ITEMS);

        let error = ensure_bounded_catalog(vec![(); MAX_BOUNDED_CATALOG_ITEMS + 1], "engine")
            .expect_err("catalog above the documented cap must fail closed");
        assert!(matches!(error, EngineCatalogError::Internal(_)));
    }

    #[test]
    fn sync_model_config_discards_legacy_custom_models_and_unknown_selections() {
        let local_config: CodeEngineModelConfigPayload =
            serde_json::from_value(serde_json::json!({
                "schemaVersion": 1,
                "source": "home-file",
                "version": "v2",
                "updatedAt": "2026-07-16T00:01:00.000Z",
                "engines": {
                    "gemini": {
                        "engineId": "gemini",
                        "defaultModelId": "gemini-custom",
                        "selectedModelId": "gemini-custom",
                        "customModels": [{ "id": "gemini-custom", "label": "Legacy Gemini" }],
                        "models": []
                    },
                    "unknown-engine": {
                        "engineId": "unknown-engine",
                        "defaultModelId": "unknown-model",
                        "selectedModelId": "unknown-model",
                        "models": []
                    }
                }
            }))
            .expect(
                "legacy custom-model payload must remain readable at the compatibility boundary",
            );
        let service = EngineCatalogService::new(TestCatalogProvider, "v1".to_string());

        let result = service
            .sync_model_config(local_config)
            .expect("model-config synchronization must sanitize legacy client input");

        assert_eq!(result.action, "push-local");
        assert_eq!(
            result
                .config
                .engines
                .get("gemini")
                .map(|engine| engine.selected_model_id.as_str()),
            Some("auto-gemini-3"),
        );
        assert_eq!(result.config.engines.len(), 2);
        assert!(!result.config.engines.contains_key("unknown-engine"));

        let serialized = serde_json::to_value(&result.config)
            .expect("sanitized model config must remain serializable");
        assert!(serialized.pointer("/engines/gemini/customModels").is_none());
    }
}
