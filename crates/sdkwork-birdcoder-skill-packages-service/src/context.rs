#[derive(Clone, Debug)]
pub struct SkillPackageContext {
    pub tenant_id: Option<String>,
    pub organization_id: Option<String>,
    pub user_id: String,
}
