#[derive(Clone, Debug)]
pub struct AppTemplateContext {
    pub tenant_id: Option<String>,
    pub organization_id: Option<String>,
}
