use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::commands::{
    CreateProjectRequest, UpdateProjectRequest,
};
use sdkwork_birdcoder_project_service::domain::results::ProjectPayload;
use sdkwork_birdcoder_project_service::domain::sandbox_binding::{
    NewProjectSandboxBinding, ProjectSandboxBindingAuditContext, ProjectSandboxBindingAuditEntry,
    ProjectSandboxBindingPayload, UpsertProjectSandboxBindingRequest,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::repository::ProjectRepository;
use sdkwork_birdcoder_project_service::ports::sandbox_binding_repository::ProjectSandboxBindingRepository;
use sdkwork_birdcoder_project_service::service::project_sandbox_binding_service::ProjectSandboxBindingService;

type ProjectCallLog = Arc<Mutex<Vec<String>>>;
type BindingCallLog = Arc<Mutex<Vec<BindingRepositoryCall>>>;

#[derive(Clone)]
struct StubProjectRepository {
    calls: ProjectCallLog,
    project: Option<ProjectPayload>,
    write_result: Result<(), ProjectError>,
}

impl StubProjectRepository {
    fn record(&self, call: impl Into<String>) {
        self.calls
            .lock()
            .expect("record project repository call")
            .push(call.into());
    }
}

#[async_trait]
impl ProjectRepository for StubProjectRepository {
    async fn find_project_by_id(
        &self,
        _context: &ProjectContext,
        project_id: &str,
    ) -> Result<Option<ProjectPayload>, ProjectError> {
        self.record(format!("find:{project_id}"));
        Ok(self.project.clone())
    }

    async fn ensure_workspace_access(
        &self,
        _context: &ProjectContext,
        _workspace_id: &str,
    ) -> Result<(), ProjectError> {
        Err(unused_project_repository_method())
    }

    async fn ensure_project_write_access(
        &self,
        _context: &ProjectContext,
        project_id: &str,
    ) -> Result<(), ProjectError> {
        self.record(format!("write:{project_id}"));
        self.write_result.clone()
    }

    async fn list_projects_by_workspace(
        &self,
        _context: &ProjectContext,
        _workspace_id: &str,
        _user_id: Option<&str>,
        _offset: usize,
        _limit: usize,
    ) -> Result<(Vec<ProjectPayload>, usize), ProjectError> {
        Err(unused_project_repository_method())
    }

    async fn create_project(
        &self,
        _context: &ProjectContext,
        _request: &CreateProjectRequest,
    ) -> Result<ProjectPayload, ProjectError> {
        Err(unused_project_repository_method())
    }

    async fn update_project(
        &self,
        _context: &ProjectContext,
        _project_id: &str,
        _request: &UpdateProjectRequest,
    ) -> Result<ProjectPayload, ProjectError> {
        Err(unused_project_repository_method())
    }

    async fn delete_project(
        &self,
        _context: &ProjectContext,
        _project_id: &str,
        _expected_version: i64,
    ) -> Result<(), ProjectError> {
        Err(unused_project_repository_method())
    }
}

#[derive(Clone)]
struct RecordingBindingRepository {
    calls: BindingCallLog,
    get_result: Option<ProjectSandboxBindingPayload>,
}

#[derive(Clone)]
enum BindingRepositoryCall {
    Get {
        project_id: String,
    },
    Upsert {
        binding: Box<NewProjectSandboxBinding>,
        audit: ProjectSandboxBindingAuditEntry,
    },
    Delete {
        project_id: String,
        expected_version: i64,
        audit: ProjectSandboxBindingAuditEntry,
    },
}

#[async_trait]
impl ProjectSandboxBindingRepository for RecordingBindingRepository {
    async fn get_sandbox_binding(
        &self,
        _context: &ProjectContext,
        project_id: &str,
    ) -> Result<Option<ProjectSandboxBindingPayload>, ProjectError> {
        self.calls
            .lock()
            .expect("record binding get")
            .push(BindingRepositoryCall::Get {
                project_id: project_id.to_owned(),
            });
        Ok(self.get_result.clone())
    }

    async fn upsert_sandbox_binding(
        &self,
        _context: &ProjectContext,
        binding: &NewProjectSandboxBinding,
        audit: &ProjectSandboxBindingAuditEntry,
    ) -> Result<ProjectSandboxBindingPayload, ProjectError> {
        self.calls
            .lock()
            .expect("record binding upsert")
            .push(BindingRepositoryCall::Upsert {
                binding: Box::new(binding.clone()),
                audit: audit.clone(),
            });
        Ok(ProjectSandboxBindingPayload {
            id: "700000000000000001".to_owned(),
            project_id: binding.project_id.clone(),
            sandbox_id: binding.sandbox_id.clone(),
            root_entry_id: binding.root_entry_id.clone(),
            logical_path: binding.logical_path.clone(),
            status: binding.status.clone(),
            version: binding.expected_version.unwrap_or(0).to_string(),
            created_at: "2026-07-16T00:00:00Z".to_owned(),
            updated_at: "2026-07-16T00:00:00Z".to_owned(),
        })
    }

    async fn delete_sandbox_binding(
        &self,
        _context: &ProjectContext,
        project_id: &str,
        expected_version: i64,
        audit: &ProjectSandboxBindingAuditEntry,
    ) -> Result<(), ProjectError> {
        self.calls
            .lock()
            .expect("record binding delete")
            .push(BindingRepositoryCall::Delete {
                project_id: project_id.to_owned(),
                expected_version,
                audit: audit.clone(),
            });
        Ok(())
    }
}

fn unused_project_repository_method() -> ProjectError {
    ProjectError::Internal("unused project repository method".to_owned())
}

fn project() -> ProjectPayload {
    ProjectPayload {
        id: "1".to_owned(),
        uuid: "project-uuid-1".to_owned(),
        tenant_id: "100001".to_owned(),
        organization_id: "0".to_owned(),
        workspace_id: "1".to_owned(),
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
        organization_id: "0".to_owned(),
        user_id: "200001".to_owned(),
    }
}

fn audit_context() -> ProjectSandboxBindingAuditContext {
    ProjectSandboxBindingAuditContext {
        trace_id: Some("trace-sandbox-binding-test".to_owned()),
    }
}

fn service(
    project: Option<ProjectPayload>,
) -> (ProjectSandboxBindingService, ProjectCallLog, BindingCallLog) {
    let project_calls = Arc::new(Mutex::new(Vec::new()));
    let binding_calls = Arc::new(Mutex::new(Vec::new()));
    (
        ProjectSandboxBindingService::new(
            Arc::new(StubProjectRepository {
                calls: project_calls.clone(),
                project,
                write_result: Ok(()),
            }),
            Arc::new(RecordingBindingRepository {
                calls: binding_calls.clone(),
                get_result: None,
            }),
        ),
        project_calls,
        binding_calls,
    )
}

#[tokio::test]
async fn upsert_hashes_idempotency_and_keeps_only_drive_references() {
    let (service, project_calls, binding_calls) = service(Some(project()));
    let request = UpsertProjectSandboxBindingRequest {
        sandbox_id: "sandbox:primary".to_owned(),
        root_entry_id: "entry:project-root".to_owned(),
        logical_path: " source files / feature ".to_owned(),
    };

    let result = service
        .upsert_binding(
            &context(),
            "1",
            &request,
            None,
            "sandbox-binding-create-1",
            &audit_context(),
        )
        .await
        .expect("upsert sandbox binding");

    assert_eq!(result.sandbox_id, request.sandbox_id);
    assert_eq!(result.root_entry_id, request.root_entry_id);
    assert_eq!(result.logical_path, request.logical_path);
    assert_eq!(
        *project_calls.lock().expect("read project calls"),
        vec!["write:1", "find:1"]
    );

    let calls = binding_calls.lock().expect("read binding calls");
    let BindingRepositoryCall::Upsert { binding, audit } = &calls[0] else {
        panic!("expected sandbox-binding upsert call");
    };
    assert_eq!(binding.sandbox_id, "sandbox:primary");
    assert_eq!(binding.root_entry_id, "entry:project-root");
    assert_eq!(binding.logical_path, " source files / feature ");
    assert_eq!(binding.status, "active");
    assert_eq!(binding.idempotency.key_hash.len(), 64);
    assert_eq!(binding.idempotency.request_fingerprint.len(), 64);
    assert!(!binding
        .idempotency
        .key_hash
        .contains("sandbox-binding-create-1"));
    assert_eq!(audit.action, "project.sandbox_binding.upsert");
    assert_eq!(audit.result, "succeeded");
    assert_eq!(audit.reason_code, None);
    assert_eq!(
        audit.trace_id.as_deref(),
        Some("trace-sandbox-binding-test")
    );
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&audit.redacted_metadata_json)
            .expect("parse redacted audit metadata"),
        serde_json::json!({
            "event": "project.sandbox_binding.upsert",
            "hasLogicalPath": true,
        })
    );
    for secret in [
        "sandbox:primary",
        "entry:project-root",
        "source files",
        "sandbox-binding-create-1",
    ] {
        assert!(!audit.redacted_metadata_json.contains(secret));
    }
}

#[tokio::test]
async fn invalid_input_is_rejected_before_any_repository_access() {
    let (service, project_calls, binding_calls) = service(Some(project()));
    let cases = [
        (
            "1",
            UpsertProjectSandboxBindingRequest {
                sandbox_id: " sandbox".to_owned(),
                root_entry_id: "entry".to_owned(),
                logical_path: String::new(),
            },
            None,
            "sandbox-binding-create-1",
        ),
        (
            "1",
            UpsertProjectSandboxBindingRequest {
                sandbox_id: "sandbox".to_owned(),
                root_entry_id: "entry\n".to_owned(),
                logical_path: String::new(),
            },
            None,
            "sandbox-binding-create-1",
        ),
        (
            "1",
            UpsertProjectSandboxBindingRequest {
                sandbox_id: "sandbox".to_owned(),
                root_entry_id: "entry".to_owned(),
                logical_path: "src/../private".to_owned(),
            },
            None,
            "sandbox-binding-create-1",
        ),
        (
            "1",
            UpsertProjectSandboxBindingRequest {
                sandbox_id: "sandbox".to_owned(),
                root_entry_id: "entry".to_owned(),
                logical_path: String::new(),
            },
            Some(-1),
            "sandbox-binding-create-1",
        ),
        (
            "1",
            UpsertProjectSandboxBindingRequest {
                sandbox_id: "sandbox".to_owned(),
                root_entry_id: "entry".to_owned(),
                logical_path: String::new(),
            },
            None,
            "short",
        ),
        (
            "0",
            UpsertProjectSandboxBindingRequest {
                sandbox_id: "sandbox".to_owned(),
                root_entry_id: "entry".to_owned(),
                logical_path: String::new(),
            },
            None,
            "sandbox-binding-create-1",
        ),
    ];

    for (project_id, request, expected_version, idempotency_key) in cases {
        let result = service
            .upsert_binding(
                &context(),
                project_id,
                &request,
                expected_version,
                idempotency_key,
                &audit_context(),
            )
            .await;
        assert!(matches!(result, Err(ProjectError::InvalidInput(_))));
    }

    assert!(project_calls.lock().expect("read project calls").is_empty());
    assert!(binding_calls.lock().expect("read binding calls").is_empty());
}

#[tokio::test]
async fn get_stops_before_binding_repository_when_project_is_missing() {
    let (service, project_calls, binding_calls) = service(None);

    let result = service.get_binding(&context(), "1").await;

    assert!(matches!(result, Err(ProjectError::NotFound(_))));
    assert_eq!(
        *project_calls.lock().expect("read project calls"),
        vec!["find:1"]
    );
    assert!(binding_calls.lock().expect("read binding calls").is_empty());
}

#[tokio::test]
async fn delete_forwards_compare_and_swap_version_with_redacted_audit() {
    let (service, project_calls, binding_calls) = service(Some(project()));

    let invalid = service
        .delete_binding(&context(), "1", -1, &audit_context())
        .await;
    assert!(matches!(invalid, Err(ProjectError::InvalidInput(_))));

    service
        .delete_binding(&context(), "1", 7, &audit_context())
        .await
        .expect("delete sandbox binding");

    assert_eq!(
        *project_calls.lock().expect("read project calls"),
        vec!["write:1"]
    );
    let calls = binding_calls.lock().expect("read binding calls");
    let BindingRepositoryCall::Delete {
        project_id,
        expected_version,
        audit,
    } = &calls[0]
    else {
        panic!("expected sandbox-binding delete call");
    };
    assert_eq!(project_id, "1");
    assert_eq!(*expected_version, 7);
    assert_eq!(audit.action, "project.sandbox_binding.delete");
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&audit.redacted_metadata_json)
            .expect("parse redacted delete metadata"),
        serde_json::json!({
            "event": "project.sandbox_binding.delete",
            "expectedVersion": "7",
        })
    );
}

#[tokio::test]
async fn get_returns_only_the_scoped_binding_payload() {
    let project_calls = Arc::new(Mutex::new(Vec::new()));
    let binding_calls = Arc::new(Mutex::new(Vec::new()));
    let expected = ProjectSandboxBindingPayload {
        id: "binding-1".to_owned(),
        project_id: "1".to_owned(),
        sandbox_id: "sandbox:primary".to_owned(),
        root_entry_id: "entry:project-root".to_owned(),
        logical_path: "src".to_owned(),
        status: "active".to_owned(),
        version: "3".to_owned(),
        created_at: "2026-07-16T00:00:00Z".to_owned(),
        updated_at: "2026-07-16T01:00:00Z".to_owned(),
    };
    let service = ProjectSandboxBindingService::new(
        Arc::new(StubProjectRepository {
            calls: project_calls.clone(),
            project: Some(project()),
            write_result: Ok(()),
        }),
        Arc::new(RecordingBindingRepository {
            calls: binding_calls.clone(),
            get_result: Some(expected.clone()),
        }),
    );

    let result = service
        .get_binding(&context(), "1")
        .await
        .expect("get sandbox binding");

    assert_eq!(result, expected);
    assert_eq!(
        *project_calls.lock().expect("read project calls"),
        vec!["find:1"]
    );
    let calls = binding_calls.lock().expect("read binding calls");
    let BindingRepositoryCall::Get { project_id } = &calls[0] else {
        panic!("expected sandbox-binding get call");
    };
    assert_eq!(project_id, "1");
}
