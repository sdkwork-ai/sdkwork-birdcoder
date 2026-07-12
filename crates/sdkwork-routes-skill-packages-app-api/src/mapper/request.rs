use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillPackageListQuery {
    pub workspace_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallSkillPackageBody {
    pub scope_id: String,
    pub scope_type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillPackagePathParams {
    pub package_id: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn skill_package_list_query_keeps_domain_filters_separate_from_pagination() {
        let query: SkillPackageListQuery = serde_json::from_value(json!({
            "workspaceId": "workspace-1"
        }))
        .expect("deserialize query");

        assert_eq!(query.workspace_id.as_deref(), Some("workspace-1"));
    }
}
