#[derive(Clone, Debug)]
pub struct SessionContext {
    pub tenant_id: String,
    pub user_id: String,
    pub session_id: String,
}
