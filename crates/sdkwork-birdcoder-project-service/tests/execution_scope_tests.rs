use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::commands::{
    CreateProjectRequest, UpdateProjectRequest,
};
use sdkwork_birdcoder_project_service::domain::results::ProjectPayload;
use sdkwork_birdcoder_project_service::domain::runtime_location::{
    ResolvedProjectRuntimeLocationExecution, RuntimeLocationCapability,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::git::{
    GitMutationError, GitOperations, GitProjectDiff, GitProjectOverview,
};
use sdkwork_birdcoder_project_service::ports::repository::ProjectRepository;
use sdkwork_birdcoder_project_service::ports::runtime_location_execution::{
    DenyProjectRuntimeLocationExecutionResolver, ProjectRuntimeLocationExecutionResolver,
};
use sdkwork_birdcoder_project_service::service::project_service::ProjectService;

#[derive(Clone)]
struct RecordingProjectRepository {
    calls: Arc<Mutex<Vec<String>>>,
    project: ProjectPayload,
    workspace_result: Result<(), ProjectError>,
    write_result: Result<(), ProjectError>,
}

impl RecordingProjectRepository {
    fn record(&self, value: String) {
        self.calls
            .lock()
            .expect("record project repository call")
            .push(value);
    }
}

#[async_trait]
impl ProjectRepository for RecordingProjectRepository {
    async fn find_project_by_id(
        &self,
        ctx: &ProjectContext,
        id: &str,
    ) -> Result<Option<ProjectPayload>, ProjectError> {
        self.record(format!("find:{id}:{}", ctx.organization_id));
        Ok(Some(self.project.clone()))
    }

    async fn ensure_workspace_access(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
    ) -> Result<(), ProjectError> {
        self.record(format!("workspace:{workspace_id}:{}", ctx.organization_id));
        self.workspace_result.clone()
    }

    async fn ensure_project_write_access(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
    ) -> Result<(), ProjectError> {
        self.record(format!("write:{project_id}:{}", ctx.organization_id));
        self.write_result.clone()
    }

    async fn list_projects_by_workspace(
        &self,
        _ctx: &ProjectContext,
        _workspace_id: &str,
        _user_id: Option<&str>,
        _offset: usize,
        _limit: usize,
    ) -> Result<(Vec<ProjectPayload>, usize), ProjectError> {
        Err(ProjectError::Internal(
            "not used by execution scope".to_owned(),
        ))
    }

    async fn create_project(
        &self,
        _ctx: &ProjectContext,
        _req: &CreateProjectRequest,
    ) -> Result<ProjectPayload, ProjectError> {
        Err(ProjectError::Internal(
            "not used by execution scope".to_owned(),
        ))
    }

    async fn update_project(
        &self,
        _ctx: &ProjectContext,
        _id: &str,
        _req: &UpdateProjectRequest,
    ) -> Result<ProjectPayload, ProjectError> {
        Err(ProjectError::Internal(
            "not used by execution scope".to_owned(),
        ))
    }

    async fn delete_project(
        &self,
        _ctx: &ProjectContext,
        _id: &str,
        _expected_version: i64,
    ) -> Result<(), ProjectError> {
        Err(ProjectError::Internal(
            "not used by execution scope".to_owned(),
        ))
    }
}

struct UnusedGitOperations;

#[async_trait]
impl GitOperations for UnusedGitOperations {
    async fn inspect_overview(
        &self,
        _project_root_path: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate(
            "not used by execution scope".to_owned(),
        ))
    }

    async fn inspect_diff(
        &self,
        _project_root_path: &str,
    ) -> Result<GitProjectDiff, GitMutationError> {
        Err(GitMutationError::Mutate(
            "not used by execution scope".to_owned(),
        ))
    }

    async fn create_branch(
        &self,
        _project_root_path: &str,
        _branch_name: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate(
            "not used by execution scope".to_owned(),
        ))
    }

    async fn switch_branch(
        &self,
        _project_root_path: &str,
        _branch_name: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate(
            "not used by execution scope".to_owned(),
        ))
    }

    async fn commit_changes(
        &self,
        _project_root_path: &str,
        _message: &str,
        _include_unstaged: bool,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate(
            "not used by execution scope".to_owned(),
        ))
    }

    async fn push_branch(
        &self,
        _project_root_path: &str,
        _branch_name: Option<&str>,
        _remote_name: Option<&str>,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate(
            "not used by execution scope".to_owned(),
        ))
    }

    async fn create_worktree(
        &self,
        _project_root_path: &str,
        _branch_name: &str,
        _worktree_path: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate(
            "not used by execution scope".to_owned(),
        ))
    }

    async fn remove_worktree(
        &self,
        _project_root_path: &str,
        _worktree_path: &str,
        _force: bool,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate(
            "not used by execution scope".to_owned(),
        ))
    }

    async fn prune_worktrees(
        &self,
        _project_root_path: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate(
            "not used by execution scope".to_owned(),
        ))
    }
}

#[derive(Clone)]
struct RecordingRuntimeLocationExecutionResolver {
    calls: Arc<Mutex<Vec<String>>>,
    root: PathBuf,
}

#[async_trait]
impl ProjectRuntimeLocationExecutionResolver for RecordingRuntimeLocationExecutionResolver {
    async fn resolve_execution_root(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        capability: RuntimeLocationCapability,
    ) -> Result<ResolvedProjectRuntimeLocationExecution, ProjectError> {
        self.calls
            .lock()
            .expect("record explicit execution resolver call")
            .push(format!(
                "explicit:{project_id}:{runtime_location_id}:{}:{}",
                capability.as_str(),
                context.organization_id
            ));
        Ok(ResolvedProjectRuntimeLocationExecution {
            runtime_location_id: "runtime-location-1".to_owned(),
            runtime_target_id: "target-1".to_owned(),
            runtime_target_kind: "server".to_owned(),
            location_kind: "server_workspace".to_owned(),
            capability,
            canonical_root: std::fs::canonicalize(&self.root)
                .expect("canonical test runtime-location root"),
        })
    }
}

struct TestDirectory {
    root: PathBuf,
}

impl TestDirectory {
    fn new() -> Self {
        static NEXT_DIRECTORY_ID: AtomicU64 = AtomicU64::new(1);

        let root = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-project-execution-scope-{}-{}",
            std::process::id(),
            NEXT_DIRECTORY_ID.fetch_add(1, Ordering::Relaxed),
        ));
        std::fs::create_dir_all(&root).expect("create test project root");
        Self { root }
    }
}

impl Drop for TestDirectory {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn project(workspace_id: &str) -> ProjectPayload {
    ProjectPayload {
        id: "project-1".to_owned(),
        uuid: "project-uuid-1".to_owned(),
        tenant_id: "100001".to_owned(),
        organization_id: "300001".to_owned(),
        workspace_id: workspace_id.to_owned(),
        owner_user_id: "200001".to_owned(),
        created_by_user_id: "200001".to_owned(),
        code: "project-code-1".to_owned(),
        name: "Project".to_owned(),
        description: None,
        project_kind: "coding".to_owned(),
        default_agent_project_id: None,
        status: "active".to_owned(),
        version: "1".to_owned(),
        created_at: "2026-07-16T00:00:00Z".to_owned(),
        updated_at: "2026-07-16T00:00:00Z".to_owned(),
    }
}

fn context() -> ProjectContext {
    ProjectContext {
        tenant_id: "100001".to_owned(),
        organization_id: "300001".to_owned(),
        user_id: "200001".to_owned(),
    }
}

fn service(
    project_workspace_id: &str,
    workspace_result: Result<(), ProjectError>,
    write_result: Result<(), ProjectError>,
    root: PathBuf,
) -> (ProjectService, Arc<Mutex<Vec<String>>>) {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let runtime_location_execution_resolver = Arc::new(RecordingRuntimeLocationExecutionResolver {
        calls: calls.clone(),
        root: root.clone(),
    });
    service_with_runtime_location_execution_resolver(
        project_workspace_id,
        workspace_result,
        write_result,
        runtime_location_execution_resolver,
        calls,
    )
}

fn service_with_runtime_location_execution_resolver(
    project_workspace_id: &str,
    workspace_result: Result<(), ProjectError>,
    write_result: Result<(), ProjectError>,
    runtime_location_execution_resolver: Arc<dyn ProjectRuntimeLocationExecutionResolver>,
    calls: Arc<Mutex<Vec<String>>>,
) -> (ProjectService, Arc<Mutex<Vec<String>>>) {
    let repository = RecordingProjectRepository {
        calls: calls.clone(),
        project: project(project_workspace_id),
        workspace_result,
        write_result,
    };
    (
        ProjectService::new(
            Arc::new(repository),
            Arc::new(UnusedGitOperations),
            runtime_location_execution_resolver,
        ),
        calls,
    )
}

#[tokio::test]
async fn explicit_execution_root_requires_workspace_membership_write_access_and_matching_scope() {
    let root = TestDirectory::new();
    let (service, calls) = service("workspace-1", Ok(()), Ok(()), root.root.clone());

    let resolved = service
        .resolve_runtime_location_execution_root(
            &context(),
            "workspace-1",
            "project-1",
            "runtime-location-1",
            RuntimeLocationCapability::Terminal,
        )
        .await
        .expect("resolve authorized execution root");

    assert_eq!(
        resolved,
        std::fs::canonicalize(&root.root).expect("canonical test project root")
    );
    assert_eq!(
        *calls.lock().expect("read recorded calls"),
        vec![
            "workspace:workspace-1:300001",
            "write:project-1:300001",
            "find:project-1:300001",
            "explicit:project-1:runtime-location-1:terminal:300001",
        ]
    );
}

#[tokio::test]
async fn execution_root_requires_an_explicit_runtime_location_without_root_fallback() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let (service, calls) = service_with_runtime_location_execution_resolver(
        "workspace-1",
        Ok(()),
        Ok(()),
        Arc::new(DenyProjectRuntimeLocationExecutionResolver),
        calls,
    );

    let result = service
        .resolve_runtime_location_execution_root(
            &context(),
            "workspace-1",
            "project-1",
            "runtime-location-1",
            RuntimeLocationCapability::Terminal,
        )
        .await;

    assert!(matches!(result, Err(ProjectError::Unavailable(_))));
    assert_eq!(
        *calls.lock().expect("read recorded calls"),
        vec![
            "workspace:workspace-1:300001",
            "write:project-1:300001",
            "find:project-1:300001",
        ]
    );
}

#[tokio::test]
async fn execution_root_rejects_project_workspace_mismatch_before_filesystem_resolution() {
    let root = TestDirectory::new();
    let (service, calls) = service("workspace-other", Ok(()), Ok(()), root.root.clone());

    let result = service
        .resolve_runtime_location_execution_root(
            &context(),
            "workspace-1",
            "project-1",
            "runtime-location-1",
            RuntimeLocationCapability::Terminal,
        )
        .await;

    assert!(matches!(result, Err(ProjectError::Forbidden(_))));
    assert_eq!(
        *calls.lock().expect("read recorded calls"),
        vec![
            "workspace:workspace-1:300001",
            "write:project-1:300001",
            "find:project-1:300001",
        ]
    );
}

#[tokio::test]
async fn git_overview_requires_a_resolved_runtime_location_and_never_uses_project_root_fallback() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let (service, calls) = service_with_runtime_location_execution_resolver(
        "workspace-1",
        Ok(()),
        Ok(()),
        Arc::new(DenyProjectRuntimeLocationExecutionResolver),
        calls,
    );

    let result = service
        .get_project_git_overview(&context(), "project-1", "runtime-location-1")
        .await;

    assert!(matches!(result, Err(ProjectError::Unavailable(_))));
    assert_eq!(
        *calls.lock().expect("read recorded calls"),
        Vec::<String>::new(),
        "Git must use only the explicit runtime-location execution authority.",
    );
}

#[tokio::test]
async fn execution_root_stops_before_project_lookup_when_write_access_is_denied() {
    let root = TestDirectory::new();
    let (service, calls) = service(
        "workspace-1",
        Ok(()),
        Err(ProjectError::Forbidden("write access denied".to_owned())),
        root.root.clone(),
    );

    let result = service
        .resolve_runtime_location_execution_root(
            &context(),
            "workspace-1",
            "project-1",
            "runtime-location-1",
            RuntimeLocationCapability::Terminal,
        )
        .await;

    assert!(matches!(result, Err(ProjectError::Forbidden(_))));
    assert_eq!(
        *calls.lock().expect("read recorded calls"),
        vec!["workspace:workspace-1:300001", "write:project-1:300001"]
    );
}
