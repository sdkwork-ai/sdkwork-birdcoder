#[derive(Clone, Debug)]
pub struct MembershipContext {
    pub tenant_id: Option<String>,
    pub organization_id: Option<String>,
    pub owner_user_id: String,
}
