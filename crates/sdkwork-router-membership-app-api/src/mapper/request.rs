use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MembershipQuery {
    pub owner_user_id: Option<String>,
}
