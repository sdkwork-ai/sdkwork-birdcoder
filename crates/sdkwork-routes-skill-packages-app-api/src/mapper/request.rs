use serde::Deserialize;

use sdkwork_birdcoder_project_service::pagination::clamp_list_page_size;

pub(crate) fn normalize_catalog_list_pagination(
    offset: Option<i64>,
    limit: Option<i64>,
) -> (usize, usize) {
    let offset_usize = offset.map(|value| value.max(0) as usize);
    let limit_usize = limit.map(|value| value.max(0) as usize);
    clamp_list_page_size(offset_usize, limit_usize)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillPackageListQuery {
    pub workspace_id: Option<String>,
    pub offset: Option<i64>,
    pub limit: Option<i64>,
}

impl SkillPackageListQuery {
    pub fn normalized_pagination(&self) -> (usize, usize) {
        normalize_catalog_list_pagination(self.offset, self.limit)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppTemplateListQuery {
    pub offset: Option<i64>,
    pub limit: Option<i64>,
}

impl AppTemplateListQuery {
    pub fn normalized_pagination(&self) -> (usize, usize) {
        normalize_catalog_list_pagination(self.offset, self.limit)
    }
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
