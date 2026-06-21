use crate::{
    session_id_targets_engine, standard_native_session_provider_registry, CodeEngineSessionDetailRecord,
    CodeEngineSessionSummaryRecord,
};

pub fn list_codeengine_native_session_summaries(
    engine_id: Option<&str>,
) -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
    let registry = standard_native_session_provider_registry();
    let providers = registry.resolve_provider(engine_id)?;
    let mut sessions = Vec::new();
    for provider in providers {
        sessions.extend(provider.list_sessions()?);
    }
    Ok(sessions)
}

pub fn get_codeengine_native_session_detail(
    session_id: &str,
    engine_id: Option<&str>,
) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
    let registry = standard_native_session_provider_registry();
    if let Some(engine_id) = engine_id.filter(|value| !value.trim().is_empty()) {
        let providers = registry.resolve_provider(Some(engine_id))?;
        if let Some(provider) = providers.first() {
            return provider.get_session(session_id);
        }
    }

    for provider in registry.resolve_provider(None)? {
        if !session_id_targets_engine(session_id, provider.registration().engine_id.as_str()) {
            continue;
        }
        if let Some(detail) = provider.get_session(session_id)? {
            return Ok(Some(detail));
        }
    }
    Ok(None)
}

pub fn get_codeengine_native_session_summary(
    session_id: &str,
    engine_id: Option<&str>,
) -> Result<Option<CodeEngineSessionSummaryRecord>, String> {
    Ok(get_codeengine_native_session_detail(session_id, engine_id)?.map(|detail| detail.summary))
}
