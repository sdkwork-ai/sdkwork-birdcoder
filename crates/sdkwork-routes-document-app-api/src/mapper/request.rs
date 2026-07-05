use serde::Deserialize;

use sdkwork_birdcoder_project_service::pagination::clamp_list_page_size;

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DocumentListQuery {
    pub project_id: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

impl DocumentListQuery {
    pub fn normalized_pagination(&self) -> (usize, usize) {
        clamp_list_page_size(self.offset, self.limit)
    }
}
