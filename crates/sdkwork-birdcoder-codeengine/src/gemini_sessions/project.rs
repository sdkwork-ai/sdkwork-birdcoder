use std::{collections::BTreeMap, fs, path::Path};

use serde_json::Value;
use sha2::{Digest, Sha256};

#[derive(Clone, Debug, Default)]
pub(super) struct GeminiProjectRegistry {
    roots_by_identifier: BTreeMap<String, String>,
}

pub(super) fn load_gemini_project_registry(root: &Path) -> GeminiProjectRegistry {
    let registry_path = root.join("projects.json");
    let Ok(contents) = fs::read_to_string(&registry_path) else {
        return GeminiProjectRegistry::default();
    };
    let Ok(payload) = serde_json::from_str::<Value>(contents.as_str()) else {
        return GeminiProjectRegistry::default();
    };
    let Some(projects) = payload.get("projects").and_then(Value::as_object) else {
        return GeminiProjectRegistry::default();
    };

    let mut roots_by_identifier = BTreeMap::new();
    for (project_root, project_value) in projects {
        let Some(project_identifier) = project_registry_identifier(project_value) else {
            continue;
        };
        let Some(native_cwd) = normalize_native_cwd(project_root) else {
            continue;
        };

        roots_by_identifier.insert(project_identifier, native_cwd.clone());
        for hash_candidate in project_path_hash_candidates(project_root) {
            roots_by_identifier.insert(hash_candidate, native_cwd.clone());
        }
    }

    GeminiProjectRegistry {
        roots_by_identifier,
    }
}

pub(super) fn resolve_gemini_project_root(
    gemini_root: &Path,
    project_directory: &Path,
    project_identifier: &str,
    registry: &GeminiProjectRegistry,
) -> Option<String> {
    read_project_root_marker(project_directory)
        .or_else(|| registry.resolve(project_identifier))
        .or_else(|| {
            read_project_root_marker(
                gemini_root
                    .join("history")
                    .join(project_identifier)
                    .as_path(),
            )
        })
}

impl GeminiProjectRegistry {
    fn resolve(&self, identifier: &str) -> Option<String> {
        self.roots_by_identifier.get(identifier.trim()).cloned()
    }
}

fn read_project_root_marker(project_directory: &Path) -> Option<String> {
    let marker = fs::read_to_string(project_directory.join(".project_root")).ok()?;
    normalize_native_cwd(marker.as_str())
}

fn project_registry_identifier(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => normalize_non_empty_string(value),
        Value::Object(record) => ["slug", "id", "projectId", "project_id"]
            .into_iter()
            .find_map(|field| record.get(field).and_then(Value::as_str))
            .and_then(normalize_non_empty_string),
        _ => None,
    }
}

fn project_path_hash_candidates(project_root: &str) -> Vec<String> {
    let mut candidates = BTreeMap::<String, String>::new();
    let raw = project_root.trim();
    for path_candidate in [
        raw.to_owned(),
        raw.replace('\\', "/"),
        raw.replace('/', "\\"),
        raw.to_ascii_lowercase(),
        raw.to_ascii_uppercase(),
        raw.replace('\\', "/").to_ascii_lowercase(),
        raw.replace('/', "\\").to_ascii_lowercase(),
    ] {
        candidates
            .entry(path_candidate.clone())
            .or_insert(path_candidate);
    }

    candidates
        .into_values()
        .map(|value| sha256_hex(value.as_bytes()))
        .collect()
}

fn sha256_hex(value: &[u8]) -> String {
    format!("{:x}", Sha256::digest(value))
}

fn normalize_native_cwd(value: &str) -> Option<String> {
    let normalized = value
        .trim()
        .trim_start_matches('\u{feff}')
        .replace('\\', "/");
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn normalize_non_empty_string(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_owned())
    }
}

#[cfg(test)]
pub(super) fn legacy_project_hash(project_root: &str) -> String {
    sha256_hex(project_root.as_bytes())
}
