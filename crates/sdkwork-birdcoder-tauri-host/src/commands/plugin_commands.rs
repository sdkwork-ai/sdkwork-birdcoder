use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

use super::filesystem_commands::{
    register_allowed_fs_root, resolve_root_directory_path,
};

/// Upper bound on plugin manifest / skill payloads read during discovery so a
/// hostile or corrupted plugin directory cannot force unbounded in-memory
/// materialization.
const MAX_PLUGIN_MANIFEST_BYTES: u64 = 2 * 1024 * 1024;
const MAX_PLUGIN_SKILL_BYTES: u64 = 256 * 1024;
/// Upper bound on skill entries discovered per plugin.
const MAX_PLUGIN_SKILL_ENTRIES: usize = 256;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalPluginSkillSnapshot {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalPluginSnapshot {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub root_path: String,
    pub manifest_path: String,
    pub status: String,
    pub skills: Vec<LocalPluginSkillSnapshot>,
    pub mcp_servers: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalPluginLoadErrorSnapshot {
    pub provider_id: String,
    pub path: Option<String>,
    pub kind: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalPluginCatalogSnapshot {
    pub provider_id: String,
    pub plugins: Vec<LocalPluginSnapshot>,
    pub errors: Vec<LocalPluginLoadErrorSnapshot>,
}

fn discover_codex_plugin_manifest(manifest_path: &Path, snapshot: &mut LocalPluginCatalogSnapshot) {
    let Some(root) = manifest_path.parent().and_then(Path::parent) else {
        return;
    };
    let raw = match read_file_bounded(manifest_path, MAX_PLUGIN_MANIFEST_BYTES) {
        Ok(raw) => raw,
        Err(error) => {
            snapshot.errors.push(error_snapshot(
                manifest_path,
                "permission-denied",
                error,
            ));
            return;
        }
    };
    let value = match serde_json::from_str::<Value>(&raw) {
        Ok(value) => value,
        Err(error) => {
            snapshot.errors.push(error_snapshot(
                manifest_path,
                "invalid-manifest",
                error.to_string(),
            ));
            return;
        }
    };
    let Some(name) = value
        .get("name")
        .and_then(Value::as_str)
        .filter(|v| !v.trim().is_empty())
    else {
        snapshot.errors.push(error_snapshot(
            manifest_path,
            "invalid-manifest",
            "plugin name is required".to_string(),
        ));
        return;
    };
    let version = value
        .get("version")
        .and_then(Value::as_str)
        .unwrap_or("0.0.0")
        .to_string();
    let skills_root = value
        .get("skills")
        .and_then(Value::as_str)
        .map(|p| root.join(p.trim_start_matches("./")))
        .unwrap_or_else(|| root.join("skills"));
    let mut skills = Vec::new();
    if skills_root.is_dir() {
        if let Ok(entries) = fs::read_dir(&skills_root) {
            for entry in entries.flatten() {
                if skills.len() >= MAX_PLUGIN_SKILL_ENTRIES {
                    break;
                }
                let path = if entry.path().is_dir() {
                    entry.path().join("SKILL.md")
                } else {
                    entry.path()
                };
                if path.file_name().is_some_and(|n| n == "SKILL.md") && path.is_file() {
                    let raw_skill =
                        read_file_bounded(&path, MAX_PLUGIN_SKILL_BYTES).unwrap_or_default();
                    let mut skill_name = None;
                    let mut description = None;
                    for line in raw_skill.lines().take(32) {
                        let Some((key, value)) = line.split_once(':') else {
                            continue;
                        };
                        match key.trim() {
                            "name" => {
                                skill_name =
                                    Some(value.trim().trim_matches(['"', '\'']).to_string())
                            }
                            "description" => {
                                description =
                                    Some(value.trim().trim_matches(['"', '\'']).to_string())
                            }
                            _ => {}
                        }
                    }
                    let skill_name = skill_name.filter(|v| !v.is_empty()).or_else(|| {
                        path.parent()
                            .and_then(Path::file_name)
                            .and_then(|v| v.to_str())
                            .map(ToOwned::to_owned)
                    });
                    if let Some(skill_name) = skill_name {
                        skills.push(LocalPluginSkillSnapshot {
                            id: format!("skill.codex.{skill_name}"),
                            name: skill_name,
                            description,
                            path: path.to_string_lossy().into_owned(),
                        });
                    }
                }
            }
        }
    }
    let mcp_servers = value
        .get("mcpServers")
        .and_then(Value::as_str)
        .and_then(|p| read_file_bounded(&root.join(p.trim_start_matches("./")), MAX_PLUGIN_MANIFEST_BYTES).ok())
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
        .and_then(|value| value.as_object().map(|v| v.keys().cloned().collect()))
        .unwrap_or_default();
    snapshot.plugins.push(LocalPluginSnapshot {
        id: format!("plugin.intelligence.codex.{name}"),
        name: name.to_string(),
        version,
        description: value
            .get("description")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        root_path: root.to_string_lossy().into_owned(),
        manifest_path: manifest_path.to_string_lossy().into_owned(),
        status: "process-adapter".to_string(),
        skills,
        mcp_servers,
    });
}

fn error_snapshot(path: &Path, kind: &str, message: String) -> LocalPluginLoadErrorSnapshot {
    LocalPluginLoadErrorSnapshot {
        provider_id: "provider.plugin.codex".to_string(),
        path: Some(path.to_string_lossy().into_owned()),
        kind: kind.to_string(),
        message,
    }
}

/// Reads a plugin payload up to `max_bytes`. Files larger than the budget are
/// rejected instead of being materialized in host memory, so a hostile or
/// corrupted plugin directory cannot force an unbounded allocation.
fn read_file_bounded(path: &Path, max_bytes: u64) -> Result<String, String> {
    let metadata =
        fs::metadata(path).map_err(|error| format!("failed to inspect plugin file: {error}"))?;
    if metadata.len() > max_bytes {
        return Err(format!(
            "plugin file exceeds the {max_bytes}-byte discovery budget"
        ));
    }
    fs::read_to_string(path).map_err(|error| format!("failed to read plugin file: {error}"))
}

fn default_roots(provider_id: &str) -> Vec<PathBuf> {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from);
    let mut roots = Vec::new();
    if let Some(home) = home {
        match provider_id {
            "provider.plugin.claude-code" => roots.push(home.join(".claude")),
            "provider.plugin.opencode" => roots.push(home.join(".config/opencode")),
            "provider.plugin.gemini-cli" => roots.push(home.join(".gemini/extensions")),
            _ => {
                roots.push(home.join(".agents/plugins"));
                roots.push(home.join(".codex/plugins/cache"));
            }
        }
    }
    roots.push(std::env::current_dir().unwrap_or_default());
    roots
}

fn discover_simple_provider(
    provider_id: &str,
    roots: &[PathBuf],
    snapshot: &mut LocalPluginCatalogSnapshot,
) {
    for root in roots {
        match provider_id {
            "provider.plugin.claude-code" => {
                let skill_root = root.join(".claude/skills");
                let Ok(entries) = fs::read_dir(&skill_root) else {
                    continue;
                };
                let skills = entries
                    .flatten()
                    .filter_map(|entry| {
                        let path = if entry.path().is_dir() {
                            entry.path().join("SKILL.md")
                        } else {
                            entry.path()
                        };
                        if !path.is_file() {
                            return None;
                        }
                        let name = path
                            .parent()
                            .and_then(Path::file_name)
                            .and_then(|v| v.to_str())?
                            .to_string();
                        Some(LocalPluginSkillSnapshot {
                            id: format!("skill.claude-code.{name}"),
                            name,
                            description: None,
                            path: path.to_string_lossy().into_owned(),
                        })
                    })
                    .take(MAX_PLUGIN_SKILL_ENTRIES)
                    .collect::<Vec<_>>();
                if !skills.is_empty() {
                    snapshot.plugins.push(LocalPluginSnapshot {
                        id: "plugin.intelligence.claude-code.local-skills".to_string(),
                        name: "Claude Code local skills".to_string(),
                        version: "local".to_string(),
                        description: Some("Skills discovered from .claude/skills".to_string()),
                        root_path: skill_root.to_string_lossy().into_owned(),
                        manifest_path: skill_root.to_string_lossy().into_owned(),
                        status: "process-adapter".to_string(),
                        skills,
                        mcp_servers: Vec::new(),
                    });
                }
            }
            "provider.plugin.opencode" => {
                let command_root = root.join(".opencode/commands");
                let Ok(entries) = fs::read_dir(&command_root) else {
                    continue;
                };
                let skills = entries
                    .flatten()
                    .filter_map(|entry| {
                        let path = entry.path();
                        if path.extension().is_none_or(|ext| ext != "md") {
                            return None;
                        }
                        let name = path.file_stem()?.to_str()?.to_string();
                        Some(LocalPluginSkillSnapshot {
                            id: format!("skill.opencode.{name}"),
                            name,
                            description: None,
                            path: path.to_string_lossy().into_owned(),
                        })
                    })
                    .collect::<Vec<_>>();
                if !skills.is_empty() {
                    snapshot.plugins.push(LocalPluginSnapshot {
                        id: "plugin.intelligence.opencode.local-commands".to_string(),
                        name: "OpenCode local commands".to_string(),
                        version: "local".to_string(),
                        description: Some(
                            "Commands discovered from .opencode/commands".to_string(),
                        ),
                        root_path: command_root.to_string_lossy().into_owned(),
                        manifest_path: command_root.to_string_lossy().into_owned(),
                        status: "process-adapter".to_string(),
                        skills,
                        mcp_servers: Vec::new(),
                    });
                }
            }
            "provider.plugin.gemini-cli" => {
                let manifest_path = if root.join("gemini-extension.json").is_file() {
                    root.join("gemini-extension.json")
                } else {
                    continue;
                };
                let Ok(raw) = fs::read_to_string(&manifest_path) else {
                    continue;
                };
                let Ok(value) = serde_json::from_str::<Value>(&raw) else {
                    continue;
                };
                let Some(name) = value.get("name").and_then(Value::as_str) else {
                    continue;
                };
                let mcp_servers = value
                    .get("mcpServers")
                    .and_then(Value::as_object)
                    .map(|v| v.keys().cloned().collect())
                    .unwrap_or_default();
                snapshot.plugins.push(LocalPluginSnapshot {
                    id: format!("plugin.intelligence.gemini-cli.{name}"),
                    name: name.to_string(),
                    version: value
                        .get("version")
                        .and_then(Value::as_str)
                        .unwrap_or("0.0.0")
                        .to_string(),
                    description: value
                        .get("description")
                        .and_then(Value::as_str)
                        .map(ToOwned::to_owned),
                    root_path: root.to_string_lossy().into_owned(),
                    manifest_path: manifest_path.to_string_lossy().into_owned(),
                    status: "process-adapter".to_string(),
                    skills: Vec::new(),
                    mcp_servers,
                });
            }
            _ => {}
        }
    }
}

#[tauri::command]
pub async fn local_plugin_catalog_discover(
    provider_id: String,
    roots: Vec<String>,
) -> Result<LocalPluginCatalogSnapshot, String> {
    let provider_id = provider_id.trim().to_string();
    let mut snapshot = LocalPluginCatalogSnapshot {
        provider_id: provider_id.clone(),
        plugins: Vec::new(),
        errors: Vec::new(),
    };
    if !matches!(
        provider_id.as_str(),
        "provider.plugin.codex"
            | "provider.plugin.claude-code"
            | "provider.plugin.opencode"
            | "provider.plugin.gemini-cli"
    ) {
        snapshot.errors.push(LocalPluginLoadErrorSnapshot {
            provider_id,
            path: None,
            kind: "unsupported".to_string(),
            message: "Local plugin discovery is not implemented for this provider".to_string(),
        });
        return Ok(snapshot);
    }
    let configured_roots = if roots.is_empty() {
        default_roots(&provider_id)
    } else {
        roots.into_iter().map(PathBuf::from).collect()
    };
    // Every discovery root must be an authorized desktop filesystem root. The
    // renderer supplies paths, so an arbitrary directory (for example a
    // private user folder) must not be readable through plugin discovery:
    // authorization fails closed with a diagnostic instead of enumerating it.
    let mut authorized_roots = Vec::<PathBuf>::new();
    for root in &configured_roots {
        match resolve_authorized_plugin_root(root) {
            Ok(canonical_root) => authorized_roots.push(canonical_root),
            Err(error) => snapshot.errors.push(LocalPluginLoadErrorSnapshot {
                provider_id: provider_id.clone(),
                path: Some(root.to_string_lossy().into_owned()),
                kind: "unauthorized-root".to_string(),
                message: error,
            }),
        }
    }
    if provider_id != "provider.plugin.codex" {
        discover_simple_provider(&provider_id, &authorized_roots, &mut snapshot);
        return Ok(snapshot);
    }
    let mut manifests = Vec::<PathBuf>::new();
    for root in authorized_roots {
        let direct = root.join(".codex-plugin/plugin.json");
        if direct.is_file() {
            manifests.push(direct);
        }
        if let Ok(entries) = fs::read_dir(&root) {
            for entry in entries.flatten() {
                let candidate = entry.path().join(".codex-plugin/plugin.json");
                if candidate.is_file() {
                    manifests.push(candidate);
                }
            }
        }
    }
    manifests.sort();
    manifests.dedup();
    for manifest in manifests {
        discover_codex_plugin_manifest(&manifest, &mut snapshot);
    }
    Ok(snapshot)
}

/// Resolves a plugin discovery root through the desktop filesystem
/// authorization boundary. The root must exist, be a directory, and be
/// registered as an allowed filesystem root (either through the mount
/// registry or the default provider plugin roots).
fn resolve_authorized_plugin_root(root: &Path) -> Result<PathBuf, String> {
    // Default provider roots live under the user home or the current
    // directory; registering them through the same boundary used by the
    // desktop host keeps plugin discovery inside the host authorization
    // model instead of a separate trust domain.
    register_allowed_fs_root(root.to_path_buf())?;
    resolve_root_directory_path(&root.to_string_lossy())
}
