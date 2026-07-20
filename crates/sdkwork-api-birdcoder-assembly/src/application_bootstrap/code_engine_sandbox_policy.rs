use std::path::{Path, PathBuf};

use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_database_sqlx::DatabasePool;
use serde::Deserialize;
use sqlx::Row;

const SANDBOX_CONFIG_ENV: &str = "BIRDCODER_CODE_ENGINE_SANDBOX_CONFIG";
const TENANT_POLICY_CODE: &str = "birdcoder.code-engine-sandbox.tenant";
const USER_POLICY_CODE_PREFIX: &str = "birdcoder.code-engine-sandbox.user.";

#[derive(Clone, Copy, Debug, Eq, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum SandboxAccessMode {
    AllDrives,
    Directories,
    ReadOnly,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SandboxRule {
    access_mode: SandboxAccessMode,
    #[serde(default)]
    allowed_directories: Vec<PathBuf>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SandboxConfigDocument {
    schema_version: u32,
    default_policy: SandboxRule,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StoredSandboxPolicy {
    policy_category: String,
    scope_type: SandboxScopeType,
    scope_id: String,
    access_mode: SandboxAccessMode,
    #[serde(default)]
    allowed_directories: Vec<PathBuf>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum SandboxScopeType {
    Tenant,
    User,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct ResolvedCodeEngineSandboxPolicy {
    rule: SandboxRule,
}

#[derive(Debug)]
pub(super) enum SandboxPolicyError {
    Configuration(String),
    Repository(String),
    WorkingDirectoryDenied,
}

impl ResolvedCodeEngineSandboxPolicy {
    #[cfg(test)]
    pub(super) fn all_drives() -> Self {
        Self {
            rule: builtin_default_rule(),
        }
    }

    pub(super) fn sandbox_mode(&self) -> &'static str {
        match self.rule.access_mode {
            SandboxAccessMode::AllDrives => "danger-full-access",
            SandboxAccessMode::Directories => "workspace-write",
            SandboxAccessMode::ReadOnly => "read-only",
        }
    }

    pub(super) fn authorize_working_directory(
        &self,
        working_directory: &Path,
    ) -> Result<(), SandboxPolicyError> {
        if self.rule.access_mode != SandboxAccessMode::Directories {
            return Ok(());
        }

        let canonical_working_directory = std::fs::canonicalize(working_directory)
            .map_err(|error| SandboxPolicyError::Configuration(error.to_string()))?;
        for allowed_directory in &self.rule.allowed_directories {
            let canonical_allowed_directory = std::fs::canonicalize(allowed_directory)
                .map_err(|error| SandboxPolicyError::Configuration(error.to_string()))?;
            if !canonical_allowed_directory.is_dir() {
                return Err(SandboxPolicyError::Configuration(
                    "a configured sandbox directory is not a directory".to_owned(),
                ));
            }
            if canonical_working_directory.starts_with(&canonical_allowed_directory) {
                return Ok(());
            }
        }
        Err(SandboxPolicyError::WorkingDirectoryDenied)
    }
}

pub(super) async fn resolve_code_engine_sandbox_policy(
    context: &CodingSessionContext,
) -> Result<ResolvedCodeEngineSandboxPolicy, SandboxPolicyError> {
    let Some(host) = sdkwork_iam_database_host::installed_iam_database_host() else {
        return Ok(ResolvedCodeEngineSandboxPolicy {
            rule: load_default_rule()?,
        });
    };

    let tenant_id = require_identity(&context.tenant_id, "tenant")?;
    let user_id = require_identity(&context.user_id, "user")?;
    let user_policy_code = user_policy_code(user_id)?;
    let pool = host.pool();

    if let Some(policy_json) = fetch_active_policy_json(pool, tenant_id, &user_policy_code).await? {
        return parse_stored_policy(
            &policy_json,
            SandboxScopeType::User,
            user_id,
            &user_policy_code,
        );
    }
    if let Some(policy_json) = fetch_active_policy_json(pool, tenant_id, TENANT_POLICY_CODE).await?
    {
        return parse_stored_policy(
            &policy_json,
            SandboxScopeType::Tenant,
            tenant_id,
            TENANT_POLICY_CODE,
        );
    }

    Ok(ResolvedCodeEngineSandboxPolicy {
        rule: load_default_rule()?,
    })
}

fn load_default_rule() -> Result<SandboxRule, SandboxPolicyError> {
    let explicit_path = std::env::var_os(SANDBOX_CONFIG_ENV).map(PathBuf::from);
    let config_path = explicit_path.clone().unwrap_or_else(default_config_path);
    if !config_path.exists() {
        if explicit_path.is_some() {
            return Err(SandboxPolicyError::Configuration(format!(
                "configured code-engine sandbox file does not exist: {}",
                config_path.display()
            )));
        }
        return Ok(builtin_default_rule());
    }

    let bytes = std::fs::read(&config_path).map_err(|error| {
        SandboxPolicyError::Configuration(format!(
            "read code-engine sandbox config {} failed: {error}",
            config_path.display()
        ))
    })?;
    let document: SandboxConfigDocument = serde_json::from_slice(&bytes).map_err(|error| {
        SandboxPolicyError::Configuration(format!(
            "parse code-engine sandbox config {} failed: {error}",
            config_path.display()
        ))
    })?;
    if document.schema_version != 1 {
        return Err(SandboxPolicyError::Configuration(format!(
            "unsupported code-engine sandbox schemaVersion {}",
            document.schema_version
        )));
    }
    validate_rule(document.default_policy, "etc default policy")
}

fn default_config_path() -> PathBuf {
    for key in ["SDKWORK_APP_ROOT", "SDKWORK_BIRDCODER_APP_ROOT"] {
        if let Some(app_root) = std::env::var_os(key).filter(|value| !value.is_empty()) {
            return PathBuf::from(app_root)
                .join("etc")
                .join("code-engine-sandbox.json");
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join("etc")
        .join("code-engine-sandbox.json")
}

fn builtin_default_rule() -> SandboxRule {
    SandboxRule {
        access_mode: SandboxAccessMode::AllDrives,
        allowed_directories: Vec::new(),
    }
}

fn require_identity<'a>(value: &'a str, label: &str) -> Result<&'a str, SandboxPolicyError> {
    let value = value.trim();
    if value.is_empty() {
        return Err(SandboxPolicyError::Configuration(format!(
            "authenticated {label} identity is required for sandbox policy resolution"
        )));
    }
    Ok(value)
}

fn user_policy_code(user_id: &str) -> Result<String, SandboxPolicyError> {
    if !user_id
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.'))
    {
        return Err(SandboxPolicyError::Configuration(
            "authenticated user identity cannot be represented in an IAM sandbox policy code"
                .to_owned(),
        ));
    }
    Ok(format!("{USER_POLICY_CODE_PREFIX}{user_id}"))
}

async fn fetch_active_policy_json(
    pool: &DatabasePool,
    tenant_id: &str,
    policy_code: &str,
) -> Result<Option<String>, SandboxPolicyError> {
    let table_name = pool.table_name("iam_policy");
    match pool {
        DatabasePool::Sqlite(inner, _) => {
            let row = sqlx::query(&format!(
                "SELECT policy_json FROM {table_name} WHERE tenant_id = ?1 AND code = ?2 AND status = 'active' LIMIT 1"
            ))
            .bind(tenant_id)
            .bind(policy_code)
            .fetch_optional(inner)
            .await
            .map_err(map_policy_query_error)?;
            decode_policy_json(row)
        }
        DatabasePool::Postgres(inner, _) => {
            let row = sqlx::query(&format!(
                "SELECT policy_json FROM {table_name} WHERE tenant_id = $1 AND code = $2 AND status = 'active' LIMIT 1"
            ))
            .bind(tenant_id)
            .bind(policy_code)
            .fetch_optional(inner)
            .await
            .map_err(map_policy_query_error)?;
            decode_policy_json(row)
        }
    }
}

fn map_policy_query_error(error: sqlx::Error) -> SandboxPolicyError {
    SandboxPolicyError::Repository(format!(
        "load IAM code-engine sandbox policy failed: {error}"
    ))
}

fn decode_policy_json<R>(row: Option<R>) -> Result<Option<String>, SandboxPolicyError>
where
    R: Row,
    for<'column> &'column str: sqlx::ColumnIndex<R>,
    String: for<'row> sqlx::Decode<'row, R::Database> + sqlx::Type<R::Database>,
{
    row.map(|row| {
        row.try_get::<String, _>("policy_json").map_err(|error| {
            SandboxPolicyError::Repository(format!(
                "decode IAM code-engine sandbox policy failed: {error}"
            ))
        })
    })
    .transpose()
}

fn parse_stored_policy(
    policy_json: &str,
    expected_scope_type: SandboxScopeType,
    expected_scope_id: &str,
    policy_code: &str,
) -> Result<ResolvedCodeEngineSandboxPolicy, SandboxPolicyError> {
    let policy: StoredSandboxPolicy = serde_json::from_str(policy_json).map_err(|error| {
        SandboxPolicyError::Configuration(format!(
            "IAM sandbox policy {policy_code} is invalid: {error}"
        ))
    })?;
    if policy.policy_category != "code-engine-sandbox"
        || policy.scope_type != expected_scope_type
        || policy.scope_id != expected_scope_id
    {
        return Err(SandboxPolicyError::Configuration(format!(
            "IAM sandbox policy {policy_code} does not match its authenticated scope"
        )));
    }
    let rule = validate_rule(
        SandboxRule {
            access_mode: policy.access_mode,
            allowed_directories: policy.allowed_directories,
        },
        policy_code,
    )?;
    Ok(ResolvedCodeEngineSandboxPolicy { rule })
}

fn validate_rule(rule: SandboxRule, source: &str) -> Result<SandboxRule, SandboxPolicyError> {
    if rule.access_mode == SandboxAccessMode::Directories && rule.allowed_directories.is_empty() {
        return Err(SandboxPolicyError::Configuration(format!(
            "{source} must provide allowedDirectories when accessMode is directories"
        )));
    }
    if rule.access_mode == SandboxAccessMode::Directories
        && rule
            .allowed_directories
            .iter()
            .any(|directory| !directory.is_absolute())
    {
        return Err(SandboxPolicyError::Configuration(format!(
            "{source} must use absolute allowedDirectories paths"
        )));
    }
    Ok(rule)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtin_default_grants_all_operating_system_visible_drives() {
        let policy = ResolvedCodeEngineSandboxPolicy::all_drives();

        assert_eq!(policy.sandbox_mode(), "danger-full-access");
    }

    #[test]
    fn user_policy_requires_exact_authenticated_scope() {
        let result = parse_stored_policy(
            r#"{
                "policyCategory":"code-engine-sandbox",
                "scopeType":"user",
                "scopeId":"different-user",
                "accessMode":"read-only",
                "allowedDirectories":[]
            }"#,
            SandboxScopeType::User,
            "user-1",
            "birdcoder.code-engine-sandbox.user.user-1",
        );

        assert!(matches!(result, Err(SandboxPolicyError::Configuration(_))));
    }

    #[test]
    fn directory_policy_accepts_only_descendant_working_directories() {
        let root = std::env::temp_dir().join(format!("birdcoder-sandbox-{}", uuid::Uuid::new_v4()));
        let allowed = root.join("allowed");
        let child = allowed.join("child");
        let denied = root.join("denied");
        std::fs::create_dir_all(&child).expect("create allowed test directory");
        std::fs::create_dir_all(&denied).expect("create denied test directory");
        let policy = ResolvedCodeEngineSandboxPolicy {
            rule: SandboxRule {
                access_mode: SandboxAccessMode::Directories,
                allowed_directories: vec![allowed],
            },
        };

        assert!(policy.authorize_working_directory(&child).is_ok());
        assert!(matches!(
            policy.authorize_working_directory(&denied),
            Err(SandboxPolicyError::WorkingDirectoryDenied)
        ));
        std::fs::remove_dir_all(root).expect("remove sandbox test directory");
    }

    #[test]
    fn directories_mode_requires_an_allowlist() {
        let result = validate_rule(
            SandboxRule {
                access_mode: SandboxAccessMode::Directories,
                allowed_directories: Vec::new(),
            },
            "test policy",
        );

        assert!(matches!(result, Err(SandboxPolicyError::Configuration(_))));
    }

    #[test]
    fn directories_mode_rejects_relative_paths() {
        let result = validate_rule(
            SandboxRule {
                access_mode: SandboxAccessMode::Directories,
                allowed_directories: vec![PathBuf::from("relative/project")],
            },
            "test policy",
        );

        assert!(matches!(result, Err(SandboxPolicyError::Configuration(_))));
    }
}
