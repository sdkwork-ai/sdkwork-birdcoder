#[derive(Clone, Debug)]
pub struct NativeSessionContext {
    pub workspace_id: Option<String>,
    pub project_id: Option<String>,
    pub engine_id: Option<String>,
}
