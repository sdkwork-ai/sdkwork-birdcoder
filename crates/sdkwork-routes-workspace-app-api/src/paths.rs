pub const WORKSPACES_PATH: &str = "/app/v3/api/workspaces";
pub const WORKSPACE_DETAIL_PATH: &str = "/app/v3/api/workspaces/{workspaceId}";

pub const PROJECTS_PATH: &str = "/app/v3/api/projects";
pub const PROJECT_DETAIL_PATH: &str = "/app/v3/api/projects/{projectId}";
pub const PROJECT_DOCUMENT_BINDINGS_PATH: &str =
    "/app/v3/api/projects/{projectId}/document_bindings";
pub const PROJECT_DOCUMENT_BINDING_DETAIL_PATH: &str =
    "/app/v3/api/projects/{projectId}/document_bindings/{bindingId}";
pub const PROJECT_SANDBOX_BINDING_PATH: &str =
    "/app/v3/api/projects/{projectId}/sandbox_binding";

pub const PROJECT_RUNTIME_LOCATIONS_PATH: &str =
    "/app/v3/api/projects/{projectId}/runtime_locations";
pub const PROJECT_RUNTIME_LOCATION_DETAIL_PATH: &str =
    "/app/v3/api/projects/{projectId}/runtime_locations/{runtimeLocationId}";
pub const PROJECT_RUNTIME_LOCATION_REBIND_PATH: &str =
    "/app/v3/api/projects/{projectId}/runtime_locations/{runtimeLocationId}/rebind";
pub const PROJECT_RUNTIME_LOCATION_VERIFICATION_REQUEST_PATH: &str =
    "/app/v3/api/projects/{projectId}/runtime_locations/{runtimeLocationId}/request_verification";
pub const PROJECT_RUNTIME_LOCATION_PREFERENCES_PATH: &str =
    "/app/v3/api/projects/{projectId}/runtime_location_preferences";
pub const PROJECT_RUNTIME_LOCATION_PREFERENCE_PATH: &str =
    "/app/v3/api/projects/{projectId}/runtime_location_preferences/{capability}";

pub const PROJECT_GIT_OVERVIEW_PATH: &str = "/app/v3/api/projects/{projectId}/git/overview";
pub const PROJECT_GIT_DIFF_PATH: &str = "/app/v3/api/projects/{projectId}/git/diff";
pub const PROJECT_GIT_BRANCHES_PATH: &str = "/app/v3/api/projects/{projectId}/git/branches";
pub const PROJECT_GIT_BRANCH_SWITCH_PATH: &str =
    "/app/v3/api/projects/{projectId}/git/switch_branch";
pub const PROJECT_GIT_COMMITS_PATH: &str = "/app/v3/api/projects/{projectId}/git/commits";
pub const PROJECT_GIT_PUSHES_PATH: &str = "/app/v3/api/projects/{projectId}/git/push";
pub const PROJECT_GIT_WORKTREES_PATH: &str = "/app/v3/api/projects/{projectId}/git/worktrees";
pub const PROJECT_GIT_WORKTREE_REMOVALS_PATH: &str =
    "/app/v3/api/projects/{projectId}/git/remove_worktree";
pub const PROJECT_GIT_WORKTREE_PRUNE_PATH: &str =
    "/app/v3/api/projects/{projectId}/git/prune_worktrees";
