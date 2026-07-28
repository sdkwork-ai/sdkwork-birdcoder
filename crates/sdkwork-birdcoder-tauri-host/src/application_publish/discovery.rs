use std::collections::{BTreeSet, HashSet, VecDeque};
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;
use sha2::{Digest, Sha256};

use super::manifest::{read_application_manifest, ApplicationManifest};
use super::path_safety::metadata_is_link_like;
use super::types::{ApplicationPublishApplicationSnapshot, ApplicationPublishDiscoverySnapshot};

const MAX_DISCOVERY_DIRECTORIES: usize = 2_048;
const MAX_DISCOVERY_DEPTH: usize = 5;
const MAX_MARKER_BYTES: u64 = 1024 * 1024;
const SKIPPED_DIRECTORIES: &[&str] = &[
    ".git",
    ".next",
    ".nuxt",
    ".sdkwork-worktrees",
    ".turbo",
    ".vscode",
    ".worktrees",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "target",
];

fn is_skipped_directory(path: &Path) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|name| SKIPPED_DIRECTORIES.contains(&name))
}

fn read_bounded_text(path: &Path) -> Option<String> {
    let metadata = fs::symlink_metadata(path).ok()?;
    if metadata_is_link_like(&metadata) || !metadata.is_file() || metadata.len() > MAX_MARKER_BYTES
    {
        return None;
    }
    fs::read_to_string(path).ok()
}

fn package_dependencies(root: &Path) -> (Option<String>, HashSet<String>) {
    let Some(raw) = read_bounded_text(&root.join("package.json")) else {
        return (None, HashSet::new());
    };
    let Ok(value) = serde_json::from_str::<Value>(&raw) else {
        return (None, HashSet::new());
    };
    let name = value
        .get("displayName")
        .or_else(|| value.get("name"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let mut dependencies = HashSet::new();
    for key in ["dependencies", "devDependencies", "peerDependencies"] {
        if let Some(values) = value.get(key).and_then(Value::as_object) {
            dependencies.extend(values.keys().cloned());
        }
    }
    (name, dependencies)
}

fn read_pubspec_name(root: &Path) -> Option<String> {
    let raw = read_bounded_text(&root.join("pubspec.yaml"))?;
    raw.lines().find_map(|line| {
        let (key, value) = line.split_once(':')?;
        (key.trim() == "name")
            .then(|| value.trim().trim_matches(['"', '\'']).to_string())
            .filter(|value| !value.is_empty())
    })
}

fn fallback_name(root: &Path) -> String {
    root.file_name()
        .and_then(|value| value.to_str())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| "Application".to_string())
}

fn detect_kind(
    root: &Path,
    manifest: Option<&ApplicationManifest>,
) -> Option<(String, Option<String>, Option<String>)> {
    if root.join("apps").is_dir() && manifest.is_some() {
        return Some((
            "sdkwork-module".to_string(),
            manifest.and_then(|value| value.framework.clone()),
            None,
        ));
    }

    let manifest_framework = manifest.and_then(|value| value.framework.clone());
    let framework_lower = manifest_framework
        .as_deref()
        .unwrap_or_default()
        .to_ascii_lowercase();
    let app_type = manifest
        .and_then(|value| value.app_type.as_deref())
        .unwrap_or_default()
        .to_ascii_uppercase();
    if framework_lower.contains("flutter") || app_type == "APP_FLUTTER" {
        return Some(("flutter".to_string(), Some("flutter".to_string()), None));
    }
    if framework_lower.contains("mini-program") || framework_lower.contains("miniprogram") {
        return Some(("mini-program".to_string(), manifest_framework, None));
    }
    if framework_lower.contains("vue") || framework_lower.contains("nuxt") {
        return Some(("vue".to_string(), manifest_framework, None));
    }
    if framework_lower.contains("react")
        || framework_lower.contains("next")
        || framework_lower.contains("remix")
        || app_type == "APP_REACT"
    {
        return Some(("react".to_string(), manifest_framework, None));
    }
    if framework_lower.contains("static") {
        return Some(("static-web".to_string(), manifest_framework, None));
    }

    let (package_name, dependencies) = package_dependencies(root);
    if dependencies.contains("vue")
        || dependencies.contains("nuxt")
        || dependencies.contains("@vitejs/plugin-vue")
    {
        return Some(("vue".to_string(), Some("vue".to_string()), package_name));
    }
    if dependencies.contains("react")
        || dependencies.contains("next")
        || dependencies.contains("@remix-run/react")
    {
        return Some(("react".to_string(), Some("react".to_string()), package_name));
    }
    let pubspec = read_bounded_text(&root.join("pubspec.yaml"));
    if pubspec.as_deref().is_some_and(|value| {
        value.lines().any(|line| line.trim() == "flutter:") || value.contains("sdk: flutter")
    }) {
        return Some((
            "flutter".to_string(),
            Some("flutter".to_string()),
            read_pubspec_name(root),
        ));
    }
    if root.join("project.config.json").is_file()
        && (root.join("app.json").is_file()
            || root.join("mini.project.json").is_file()
            || root.join("project.private.config.json").is_file())
    {
        return Some((
            "mini-program".to_string(),
            Some("mini-program".to_string()),
            None,
        ));
    }
    if root.join("index.html").is_file() {
        return Some((
            "static-web".to_string(),
            Some("static".to_string()),
            package_name,
        ));
    }
    manifest.map(|value| {
        (
            "sdkwork-app".to_string(),
            value.framework.clone(),
            package_name,
        )
    })
}

fn portable_relative_path(project_root: &Path, app_root: &Path) -> String {
    let Ok(relative) = app_root.strip_prefix(project_root) else {
        return ".".to_string();
    };
    if relative.as_os_str().is_empty() {
        return ".".to_string();
    }
    relative
        .components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

fn application_id(relative_path: &str) -> String {
    let digest = Sha256::digest(
        format!("sdkwork.application-publish.application.v1\0{relative_path}").as_bytes(),
    );
    format!("app:{}", &hex::encode(digest)[..24])
}

fn inspect_candidate(
    project_root: &Path,
    app_root: &Path,
) -> Option<ApplicationPublishApplicationSnapshot> {
    let manifest_result = read_application_manifest(app_root);
    let manifest = manifest_result.as_ref().ok().and_then(Option::as_ref);
    let (kind, framework, marker_name) = detect_kind(app_root, manifest)?;
    let app_key = manifest.and_then(|value| value.app_key.clone());
    let relative_path = portable_relative_path(project_root, app_root);
    let mut issues = Vec::new();
    let (manifest_status, targets, manifest_name) = match manifest_result {
        Ok(Some(manifest)) => {
            issues.extend(manifest.issues.iter().cloned());
            (
                "valid".to_string(),
                manifest
                    .targets
                    .iter()
                    .map(|candidate| candidate.snapshot.clone())
                    .collect::<Vec<_>>(),
                manifest.name.clone(),
            )
        }
        Ok(None) => {
            issues.push("sdkwork.app.config.json is required before publishing.".to_string());
            ("missing".to_string(), Vec::new(), None)
        }
        Err(message) => {
            issues.push(message);
            ("invalid".to_string(), Vec::new(), None)
        }
    };
    let publish_ready = manifest_status == "valid"
        && issues.is_empty()
        && targets.iter().any(|target| target.ready);
    if !publish_ready && !targets.iter().any(|target| target.ready) {
        issues.push("Add at least one complete manifest-backed publish target.".to_string());
    }

    Some(ApplicationPublishApplicationSnapshot {
        application_id: application_id(&relative_path),
        app_key,
        name: manifest_name
            .or(marker_name)
            .unwrap_or_else(|| fallback_name(app_root)),
        relative_path,
        kind,
        framework,
        manifest_status,
        publish_status: if publish_ready {
            "ready".to_string()
        } else {
            "setupRequired".to_string()
        },
        targets,
        issues,
    })
}

fn collect_candidates(project_root: &Path) -> (BTreeSet<PathBuf>, bool, usize) {
    let mut candidates = BTreeSet::from([project_root.to_path_buf()]);
    let mut queue = VecDeque::from([(project_root.to_path_buf(), 0usize)]);
    let mut scanned = 0usize;
    let mut skipped_links = 0usize;
    let mut limit_reached = false;

    while let Some((directory, depth)) = queue.pop_front() {
        if scanned >= MAX_DISCOVERY_DIRECTORIES {
            limit_reached = true;
            break;
        }
        scanned += 1;
        if depth > 0 && directory.join("sdkwork.app.config.json").is_file() {
            candidates.insert(directory.clone());
        }
        if depth >= MAX_DISCOVERY_DEPTH {
            continue;
        }
        let Ok(entries) = fs::read_dir(&directory) else {
            continue;
        };
        let mut children = entries.flatten().collect::<Vec<_>>();
        children.sort_by_key(|entry| entry.file_name());
        for entry in children {
            let path = entry.path();
            let Ok(metadata) = fs::symlink_metadata(&path) else {
                continue;
            };
            if metadata_is_link_like(&metadata) {
                skipped_links += 1;
                continue;
            }
            if !metadata.is_dir() || is_skipped_directory(&path) {
                continue;
            }
            if directory.file_name().and_then(|value| value.to_str()) == Some("apps") {
                candidates.insert(path.clone());
            }
            queue.push_back((path, depth + 1));
        }
    }
    (candidates, limit_reached, skipped_links)
}

pub(crate) fn discover_applications(project_root: &Path) -> ApplicationPublishDiscoverySnapshot {
    let (candidates, scan_limit_reached, skipped_links) = collect_candidates(project_root);
    let mut applications = candidates
        .iter()
        .filter_map(|candidate| inspect_candidate(project_root, candidate))
        .collect::<Vec<_>>();
    applications.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    let mut warnings = Vec::new();
    if scan_limit_reached {
        warnings
            .push("Application discovery reached its bounded directory scan limit.".to_string());
    }
    if skipped_links > 0 {
        warnings.push(format!(
            "Application discovery skipped {skipped_links} linked or reparse-point directories."
        ));
    }
    ApplicationPublishDiscoverySnapshot {
        applications,
        scan_limit_reached,
        warnings,
    }
}

pub(crate) fn inspect_selected_application(
    project_root: &Path,
    app_root: &Path,
) -> Option<ApplicationPublishApplicationSnapshot> {
    inspect_candidate(project_root, app_root)
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn discovers_supported_application_families_below_apps() {
        let root = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-publish-discovery-{}",
            Uuid::new_v4()
        ));
        let apps = root.join("apps");
        for name in ["react", "vue", "flutter", "mini", "static"] {
            fs::create_dir_all(apps.join(name)).expect("application fixture directory");
        }
        fs::write(
            root.join("sdkwork.app.config.json"),
            r#"{
              "schemaVersion":3,
              "kind":"sdkwork.app",
              "app":{"key":"fixture-workspace","name":"Fixture workspace"},
              "devApp":{"build":{"targets":[]}}
            }"#,
        )
        .expect("workspace manifest");
        fs::write(
            apps.join("react/package.json"),
            r#"{"name":"react-app","dependencies":{"react":"1"}}"#,
        )
        .expect("react marker");
        fs::write(
            apps.join("vue/package.json"),
            r#"{"name":"vue-app","dependencies":{"vue":"1"}}"#,
        )
        .expect("vue marker");
        fs::write(
            apps.join("flutter/pubspec.yaml"),
            "name: flutter_app\ndependencies:\n  flutter:\n    sdk: flutter\n",
        )
        .expect("flutter marker");
        fs::write(apps.join("mini/project.config.json"), "{}").expect("mini marker");
        fs::write(apps.join("mini/app.json"), "{}").expect("mini app marker");
        fs::write(apps.join("static/index.html"), "<!doctype html>").expect("static marker");

        let snapshot = discover_applications(&root.canonicalize().expect("fixture root"));
        let kinds = snapshot
            .applications
            .iter()
            .map(|application| application.kind.as_str())
            .collect::<HashSet<_>>();
        assert_eq!(snapshot.applications.len(), 6);
        for kind in [
            "sdkwork-module",
            "react",
            "vue",
            "flutter",
            "mini-program",
            "static-web",
        ] {
            assert!(kinds.contains(kind), "missing kind {kind}");
        }
        for relative_path in [
            "apps/react",
            "apps/vue",
            "apps/flutter",
            "apps/mini",
            "apps/static",
        ] {
            assert!(snapshot
                .applications
                .iter()
                .any(|application| application.relative_path == relative_path));
        }
        assert!(snapshot
            .applications
            .iter()
            .all(|application| application.publish_status == "setupRequired"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn discovery_propagates_manifest_application_key() {
        let root = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-publish-discovery-key-{}",
            Uuid::new_v4()
        ));
        fs::create_dir_all(&root).expect("application fixture directory");
        fs::write(
            root.join("sdkwork.app.config.json"),
            r#"{
              "schemaVersion":3,
              "kind":"sdkwork.app",
              "app":{"key":"fixture-web","name":"Fixture web","appType":"APP_REACT"},
              "runtime":{"framework":"react"},
              "devApp":{"build":{"targets":[
                {"id":"web","command":"build","packageId":"web","outputs":[{"path":"dist","type":"directory","archive":"zip","fileName":"web.zip"}]}
              ]}}
            }"#,
        )
        .expect("application manifest");

        let snapshot = discover_applications(&root.canonicalize().expect("fixture root"));
        assert_eq!(snapshot.applications.len(), 1);
        assert_eq!(
            snapshot.applications[0].app_key.as_deref(),
            Some("fixture-web")
        );
        assert_eq!(snapshot.applications[0].publish_status, "ready");
        let serialized = serde_json::to_value(&snapshot.applications[0])
            .expect("serialized application snapshot");
        assert_eq!(
            serialized.get("appKey").and_then(Value::as_str),
            Some("fixture-web")
        );
        assert!(serialized.get("app_key").is_none());

        let _ = fs::remove_dir_all(root);
    }
}
