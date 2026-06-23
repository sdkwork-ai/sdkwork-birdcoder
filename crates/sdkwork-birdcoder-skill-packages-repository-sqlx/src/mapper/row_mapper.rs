use crate::db::rows::{
    SkillCapabilityRow, SkillInstallationRow, SkillPackageRow, SkillVersionRow,
};
use sdkwork_birdcoder_skill_packages_service::domain::results::{
    SkillCatalogEntryPayload, SkillInstallationPayload, SkillPackagePayload,
};

fn i64_to_string(v: i64) -> String {
    v.to_string()
}

pub fn skill_package_row_to_payload(
    row: &SkillPackageRow,
    versions: Vec<SkillVersionRow>,
    capabilities: &[SkillCapabilityRow],
    installed: bool,
) -> SkillPackagePayload {
    let first_version = versions.first();
    SkillPackagePayload {
        id: row.id.clone(),
        uuid: row.uuid.clone(),
        tenant_id: Some(i64_to_string(row.tenant_id)),
        organization_id: Some(i64_to_string(row.organization_id)),
        created_at: Some(row.created_at.clone()),
        updated_at: Some(row.updated_at.clone()),
        slug: row.slug.clone(),
        name: extract_name_from_manifest(&row.manifest_json),
        description: extract_description_from_manifest(&row.manifest_json),
        icon: extract_icon_from_manifest(&row.manifest_json),
        author: extract_author_from_manifest(&row.manifest_json),
        version_id: first_version.map(|v| v.id.clone()).unwrap_or_default(),
        version_label: first_version
            .map(|v| v.version_label.clone())
            .unwrap_or_default(),
        install_count: None,
        long_description: None,
        source_uri: Some(row.source_uri.clone()),
        installed,
        skills: versions
            .iter()
            .flat_map(|v| {
                capabilities
                    .iter()
                    .filter(|c| c.skill_version_id == v.id)
                    .map(|c| skill_capability_row_to_catalog_entry(c, v, row))
            })
            .collect(),
    }
}

pub fn skill_version_row_to_catalog_entry(
    version: &SkillVersionRow,
    capabilities: &[SkillCapabilityRow],
    package: &SkillPackageRow,
    _installed: bool,
) -> Vec<SkillCatalogEntryPayload> {
    capabilities
        .iter()
        .filter(|c| c.skill_version_id == version.id)
        .map(|c| skill_capability_row_to_catalog_entry(c, version, package))
        .collect()
}

fn skill_capability_row_to_catalog_entry(
    cap: &SkillCapabilityRow,
    version: &SkillVersionRow,
    package: &SkillPackageRow,
) -> SkillCatalogEntryPayload {
    SkillCatalogEntryPayload {
        id: cap.id.clone(),
        package_id: package.id.clone(),
        slug: package.slug.clone(),
        name: cap.capability_key.clone(),
        description: cap.description_text.clone(),
        icon: None,
        author: None,
        version_id: version.id.clone(),
        version_label: version.version_label.clone(),
        install_count: None,
        long_description: None,
        tags: Vec::new(),
        license: None,
        repository_url: None,
        last_updated: Some(version.updated_at.clone()),
        readme: None,
        capability_keys: vec![cap.capability_key.clone()],
        installed: false,
    }
}

pub fn skill_installation_row_to_payload(row: &SkillInstallationRow) -> SkillInstallationPayload {
    SkillInstallationPayload {
        id: row.id.clone(),
        uuid: row.uuid.clone(),
        tenant_id: Some(i64_to_string(row.tenant_id)),
        organization_id: Some(i64_to_string(row.organization_id)),
        created_at: Some(row.created_at.clone()),
        updated_at: Some(row.updated_at.clone()),
        package_id: row.skill_version_id.clone(),
        scope_id: row.scope_id.clone(),
        scope_type: row.scope_type.clone(),
        status: row.status.clone(),
        version_id: row.skill_version_id.clone(),
        installed_at: row.installed_at.clone(),
    }
}

fn extract_name_from_manifest(manifest_json: &str) -> String {
    serde_json::from_str::<serde_json::Value>(manifest_json)
        .ok()
        .and_then(|v| v.get("name").and_then(|n| n.as_str()).map(String::from))
        .unwrap_or_default()
}

fn extract_description_from_manifest(manifest_json: &str) -> String {
    serde_json::from_str::<serde_json::Value>(manifest_json)
        .ok()
        .and_then(|v| {
            v.get("description")
                .and_then(|n| n.as_str())
                .map(String::from)
        })
        .unwrap_or_default()
}

fn extract_icon_from_manifest(manifest_json: &str) -> Option<String> {
    serde_json::from_str::<serde_json::Value>(manifest_json)
        .ok()
        .and_then(|v| v.get("icon").and_then(|n| n.as_str()).map(String::from))
}

fn extract_author_from_manifest(manifest_json: &str) -> Option<String> {
    serde_json::from_str::<serde_json::Value>(manifest_json)
        .ok()
        .and_then(|v| v.get("author").and_then(|n| n.as_str()).map(String::from))
}

