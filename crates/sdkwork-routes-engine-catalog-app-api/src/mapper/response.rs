use sdkwork_birdcoder_codeengine::{
    find_native_session_provider_catalog_entry, NativeSessionDiscoveryMode,
};
use sdkwork_birdcoder_engine_catalog_service::error::EngineCatalogError;
use sdkwork_birdcoder_engine_catalog_service::service::engine_catalog_service::NativeSessionProviderPayload;
use serde::Serialize;

pub use sdkwork_birdcoder_engine_catalog_service::service::engine_catalog_service::{
    CodeEngineModelConfigPayload, EngineCapabilityMatrixPayload, EngineDescriptorPayload,
    ModelCatalogEntryPayload, SyncModelConfigResultPayload,
};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineNativeSessionProviderPayload {
    pub engine_id: String,
    pub display_name: String,
    pub native_session_id_prefix: String,
    pub transport_kinds: Vec<String>,
    pub discovery_mode: NativeSessionDiscoveryMode,
}

pub(crate) fn map_native_session_provider_payloads(
    providers: Vec<NativeSessionProviderPayload>,
) -> Result<Vec<EngineNativeSessionProviderPayload>, EngineCatalogError> {
    providers
        .into_iter()
        .map(map_native_session_provider_payload)
        .collect()
}

fn map_native_session_provider_payload(
    provider: NativeSessionProviderPayload,
) -> Result<EngineNativeSessionProviderPayload, EngineCatalogError> {
    let record =
        find_native_session_provider_catalog_entry(&provider.provider_id).ok_or_else(|| {
            EngineCatalogError::Internal(format!(
                "native session provider catalog entry was not found for {}",
                provider.provider_id
            ))
        })?;

    if provider.name != record.display_name
        || provider.description != record.native_session_id_prefix
    {
        return Err(EngineCatalogError::Internal(format!(
            "native session provider catalog projection drifted for {}",
            provider.provider_id
        )));
    }

    Ok(EngineNativeSessionProviderPayload {
        engine_id: record.engine_id.clone(),
        display_name: record.display_name.clone(),
        native_session_id_prefix: record.native_session_id_prefix.clone(),
        transport_kinds: record.transport_kinds.clone(),
        discovery_mode: record.discovery_mode,
    })
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeSet;

    use sdkwork_birdcoder_codeengine::list_native_session_provider_catalog_entries;

    use super::*;

    fn service_provider_payloads() -> Vec<NativeSessionProviderPayload> {
        list_native_session_provider_catalog_entries()
            .into_iter()
            .map(|record| NativeSessionProviderPayload {
                provider_id: record.engine_id,
                name: record.display_name,
                description: record.native_session_id_prefix,
            })
            .collect()
    }

    #[test]
    fn native_session_provider_projection_matches_the_openapi_contract() {
        let payloads = map_native_session_provider_payloads(service_provider_payloads())
            .expect("native session provider catalog must map without drift");
        let engine_ids = payloads
            .iter()
            .map(|provider| provider.engine_id.as_str())
            .collect::<BTreeSet<_>>();

        assert_eq!(
            engine_ids,
            BTreeSet::from(["claude-code", "codex", "gemini", "opencode"])
        );

        for payload in &payloads {
            let json = serde_json::to_value(payload).expect("serialize provider payload");
            let keys = json
                .as_object()
                .expect("provider payload must serialize as an object")
                .keys()
                .map(String::as_str)
                .collect::<BTreeSet<_>>();
            assert_eq!(
                keys,
                BTreeSet::from([
                    "discoveryMode",
                    "displayName",
                    "engineId",
                    "nativeSessionIdPrefix",
                    "transportKinds",
                ])
            );
            assert!(!payload.native_session_id_prefix.is_empty());
            assert!(!payload.transport_kinds.is_empty());
        }

        let gemini = payloads
            .iter()
            .find(|provider| provider.engine_id == "gemini")
            .expect("Gemini CLI provider must be present");
        assert_eq!(gemini.native_session_id_prefix, "gemini-native:");
        assert_eq!(
            gemini.discovery_mode,
            NativeSessionDiscoveryMode::PassiveGlobal
        );
    }

    #[test]
    fn native_session_provider_projection_fails_closed_on_catalog_drift() {
        let mut providers = service_provider_payloads();
        providers
            .first_mut()
            .expect("provider catalog must not be empty")
            .name = "Drifted provider".to_owned();

        let error = map_native_session_provider_payloads(providers)
            .expect_err("catalog drift must not produce a misleading API payload");

        assert!(matches!(error, EngineCatalogError::Internal(_)));
    }
}
