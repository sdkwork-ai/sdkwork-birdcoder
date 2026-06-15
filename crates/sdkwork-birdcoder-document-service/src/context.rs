#[derive(Clone, Debug)]
pub struct DocumentContext {
    pub tenant_id: Option<String>,
    pub organization_id: Option<String>,
    pub project_id: String,
}
