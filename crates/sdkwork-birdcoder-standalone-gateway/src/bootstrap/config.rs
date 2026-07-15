use std::fmt;
use std::path::{Path, PathBuf};

pub const DEFAULT_HOST: &str = "127.0.0.1";
pub const DEFAULT_PORT: u16 = 10240;
pub const DEFAULT_SQLITE_FILE: &str = "target/dev/birdcoder/data/birdcoder.sqlite3";
pub const DEFAULT_RATE_LIMIT_ENABLED: bool = true;
pub const DEFAULT_RATE_LIMIT_MAX_REQUESTS: u32 = 120;
pub const DEFAULT_RATE_LIMIT_WINDOW_SECS: u64 = 60;
const BIRDCODER_DATABASE_SERVICE: &str = "BIRDCODER";
pub const PROVIDER_RUNNER_ROOT_ENV: &str = "SDKWORK_BIRDCODER_PROVIDER_RUNNER_ROOT";
pub const DEPLOYMENT_PROFILE_ENV: &str = "SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE";
pub const ENVIRONMENT_ENV: &str = "SDKWORK_BIRDCODER_ENVIRONMENT";
pub const RUNTIME_TARGET_ENV: &str = "SDKWORK_BIRDCODER_RUNTIME_TARGET";
pub const SERVER_HOST_ENV: &str = "SDKWORK_BIRDCODER_SERVER_HOST";
pub const SERVER_PORT_ENV: &str = "SDKWORK_BIRDCODER_SERVER_PORT";
pub const DATABASE_FILE_ENV: &str = "SDKWORK_BIRDCODER_DATABASE_FILE";
pub const ALLOWED_ORIGINS_ENV: &str = "SDKWORK_BIRDCODER_ALLOWED_ORIGINS";
pub const RETIRED_DEPLOYMENT_MODE_ENV: &str = "SDKWORK_DEPLOYMENT_MODE";
pub const RETIRED_PUBLIC_DEPLOYMENT_MODE_ENV: &str = "VITE_SDKWORK_DEPLOYMENT_MODE";

const LEGACY_SERVER_HOST_ENV: &str = "BIRDCODER_SERVER_HOST";
const LEGACY_SERVER_PORT_ENV: &str = "BIRDCODER_SERVER_PORT";
const LEGACY_DATABASE_FILE_ENV: &str = "BIRDCODER_CODING_SERVER_SQLITE_FILE";
const LEGACY_ALLOWED_ORIGINS_ENV: &str = "BIRDCODER_CODING_SERVER_ALLOWED_ORIGINS";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BirdDeploymentProfile {
    Standalone,
    Cloud,
}

impl BirdDeploymentProfile {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Standalone => "standalone",
            Self::Cloud => "cloud",
        }
    }

    fn parse(value: &str) -> Result<Self, BirdServerConfigError> {
        match value.trim().to_ascii_lowercase().as_str() {
            "standalone" => Ok(Self::Standalone),
            "cloud" => Ok(Self::Cloud),
            _ => Err(BirdServerConfigError::InvalidDeploymentProfile(
                value.to_owned(),
            )),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BirdEnvironment {
    Development,
    Test,
    Staging,
    Production,
}

impl BirdEnvironment {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Development => "development",
            Self::Test => "test",
            Self::Staging => "staging",
            Self::Production => "production",
        }
    }

    fn parse(value: &str) -> Result<Self, BirdServerConfigError> {
        match value.trim().to_ascii_lowercase().as_str() {
            "development" => Ok(Self::Development),
            "test" => Ok(Self::Test),
            "staging" => Ok(Self::Staging),
            "production" => Ok(Self::Production),
            _ => Err(BirdServerConfigError::InvalidEnvironment(value.to_owned())),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BirdRuntimeTarget {
    Browser,
    Desktop,
    TabletIpados,
    TabletAndroid,
    CapacitorIos,
    CapacitorAndroid,
    FlutterIos,
    FlutterAndroid,
    AndroidNative,
    IosNative,
    HarmonyNative,
    MiniProgram,
    Server,
    Container,
    TestRunner,
}

impl BirdRuntimeTarget {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Browser => "browser",
            Self::Desktop => "desktop",
            Self::TabletIpados => "tablet-ipados",
            Self::TabletAndroid => "tablet-android",
            Self::CapacitorIos => "capacitor-ios",
            Self::CapacitorAndroid => "capacitor-android",
            Self::FlutterIos => "flutter-ios",
            Self::FlutterAndroid => "flutter-android",
            Self::AndroidNative => "android-native",
            Self::IosNative => "ios-native",
            Self::HarmonyNative => "harmony-native",
            Self::MiniProgram => "mini-program",
            Self::Server => "server",
            Self::Container => "container",
            Self::TestRunner => "test-runner",
        }
    }

    fn parse(value: &str) -> Result<Self, BirdServerConfigError> {
        match value.trim().to_ascii_lowercase().as_str() {
            "browser" => Ok(Self::Browser),
            "desktop" => Ok(Self::Desktop),
            "tablet-ipados" => Ok(Self::TabletIpados),
            "tablet-android" => Ok(Self::TabletAndroid),
            "capacitor-ios" => Ok(Self::CapacitorIos),
            "capacitor-android" => Ok(Self::CapacitorAndroid),
            "flutter-ios" => Ok(Self::FlutterIos),
            "flutter-android" => Ok(Self::FlutterAndroid),
            "android-native" => Ok(Self::AndroidNative),
            "ios-native" => Ok(Self::IosNative),
            "harmony-native" => Ok(Self::HarmonyNative),
            "mini-program" => Ok(Self::MiniProgram),
            "server" => Ok(Self::Server),
            "container" => Ok(Self::Container),
            "test-runner" => Ok(Self::TestRunner),
            _ => Err(BirdServerConfigError::InvalidRuntimeTarget(
                value.to_owned(),
            )),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CodeExecutionCapability {
    LocalHost,
    UnavailableCloudRunner,
    UnavailableNonLocalRuntime,
}

impl CodeExecutionCapability {
    pub fn unavailable_reason(self) -> Option<&'static str> {
        match self {
            Self::LocalHost => None,
            Self::UnavailableCloudRunner => Some(
                "remote code execution is unavailable until a strongly isolated cloud runner is configured and verified.",
            ),
            Self::UnavailableNonLocalRuntime => Some(
                "code execution is unavailable for non-local server and container runtimes without a strongly isolated runner.",
            ),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum BirdServerConfigError {
    MissingEnvironment(String),
    InvalidDeploymentProfile(String),
    InvalidEnvironment(String),
    InvalidRuntimeTarget(String),
    RetiredDeploymentMode { key: &'static str, value: String },
    CloudRuntimeTarget,
    CloudDatabaseEngine,
    CloudDatabaseUrl,
    CloudAllowedOrigins,
    CloudLoopbackBind,
}

impl fmt::Display for BirdServerConfigError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingEnvironment(key) => write!(
                formatter,
                "{key} must be configured explicitly for the BirdCoder server runtime"
            ),
            Self::InvalidDeploymentProfile(value) => write!(
                formatter,
                "{DEPLOYMENT_PROFILE_ENV} must be standalone or cloud, got {value:?}"
            ),
            Self::InvalidEnvironment(value) => write!(
                formatter,
                "{ENVIRONMENT_ENV} must be development, test, staging, or production, got {value:?}"
            ),
            Self::InvalidRuntimeTarget(value) => write!(
                formatter,
                "{RUNTIME_TARGET_ENV} is not a supported SDKWork runtime target: {value:?}"
            ),
            Self::RetiredDeploymentMode { key, value } => write!(
                formatter,
                "{key}={value:?} is retired; use {DEPLOYMENT_PROFILE_ENV}=standalone|cloud and {RUNTIME_TARGET_ENV} instead"
            ),
            Self::CloudRuntimeTarget => write!(
                formatter,
                "cloud server configuration requires {RUNTIME_TARGET_ENV}=server or container"
            ),
            Self::CloudDatabaseEngine => write!(
                formatter,
                "cloud server configuration requires SDKWORK_BIRDCODER_DATABASE_ENGINE=postgresql"
            ),
            Self::CloudDatabaseUrl => write!(
                formatter,
                "cloud server configuration requires a protected SDKWORK_BIRDCODER_DATABASE_URL"
            ),
            Self::CloudAllowedOrigins => write!(
                formatter,
                "cloud server configuration requires explicit non-wildcard {ALLOWED_ORIGINS_ENV}"
            ),
            Self::CloudLoopbackBind => write!(
                formatter,
                "cloud server configuration must not bind only to a loopback address"
            ),
        }
    }
}

impl std::error::Error for BirdServerConfigError {}

pub struct BirdServerConfig {
    pub environment: BirdEnvironment,
    pub deployment_profile: BirdDeploymentProfile,
    pub runtime_target: BirdRuntimeTarget,
    pub host: String,
    pub port: u16,
    pub sqlite_file: PathBuf,
    pub allowed_origins: Vec<String>,
    pub project_root: Option<String>,
    pub rate_limit_enabled: bool,
    pub rate_limit_max_requests: u32,
    pub rate_limit_window_secs: u64,
}

impl BirdServerConfig {
    pub fn from_env() -> Result<Self, BirdServerConfigError> {
        reject_retired_deployment_mode_env()?;
        let environment = BirdEnvironment::parse(&required_env(ENVIRONMENT_ENV)?)?;
        let deployment_profile =
            BirdDeploymentProfile::parse(&required_env(DEPLOYMENT_PROFILE_ENV)?)?;
        let runtime_target = BirdRuntimeTarget::parse(&required_env(RUNTIME_TARGET_ENV)?)?;
        let host = read_env(SERVER_HOST_ENV)
            .or_else(|| read_env(LEGACY_SERVER_HOST_ENV))
            .unwrap_or_else(|| DEFAULT_HOST.to_string());
        let port: u16 = read_env(SERVER_PORT_ENV)
            .or_else(|| read_env(LEGACY_SERVER_PORT_ENV))
            .and_then(|v| v.parse().ok())
            .unwrap_or(DEFAULT_PORT);
        let sqlite_file = read_env(DATABASE_FILE_ENV)
            .or_else(|| read_env(LEGACY_DATABASE_FILE_ENV))
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(DEFAULT_SQLITE_FILE));
        let allowed_origins = read_env(ALLOWED_ORIGINS_ENV)
            .or_else(|| read_env(LEGACY_ALLOWED_ORIGINS_ENV))
            .map(|v| v.split(',').map(|s| s.trim().to_string()).collect())
            .unwrap_or_else(|| default_allowed_origins_for_host(&host));
        let project_root = std::env::var("BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT").ok();
        let rate_limit_enabled = std::env::var("BIRDCODER_RATE_LIMIT_ENABLED")
            .ok()
            .map(|value| matches!(value.trim(), "1" | "true" | "TRUE" | "yes" | "YES"))
            .unwrap_or(DEFAULT_RATE_LIMIT_ENABLED);
        let rate_limit_max_requests: u32 = std::env::var("BIRDCODER_RATE_LIMIT_MAX_REQUESTS")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(DEFAULT_RATE_LIMIT_MAX_REQUESTS);
        let rate_limit_window_secs: u64 = std::env::var("BIRDCODER_RATE_LIMIT_WINDOW_SECONDS")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(DEFAULT_RATE_LIMIT_WINDOW_SECS);

        Ok(Self {
            environment,
            deployment_profile,
            runtime_target,
            host,
            port,
            sqlite_file,
            allowed_origins,
            project_root,
            rate_limit_enabled,
            rate_limit_max_requests,
            rate_limit_window_secs,
        })
    }

    pub fn bind_address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }

    /// Returns the resolved database URL, preferring env var over config default.
    /// This replaces the former `seed_birdcoder_database_env` method to avoid
    /// `std::env::set_var` which is unsafe in multi-threaded contexts.
    pub fn resolved_database_url(&self) -> String {
        let url_key = format!("SDKWORK_{BIRDCODER_DATABASE_SERVICE}_DATABASE_URL");
        std::env::var(&url_key).unwrap_or_else(|_| sqlite_database_url(&self.sqlite_file))
    }

    /// Returns the resolved database engine, preferring env var over default.
    pub fn resolved_database_engine(&self) -> String {
        let engine_key = format!("SDKWORK_{BIRDCODER_DATABASE_SERVICE}_DATABASE_ENGINE");
        std::env::var(&engine_key).unwrap_or_else(|_| "sqlite".to_string())
    }

    pub fn provider_runner_root(&self) -> Option<PathBuf> {
        let configured_root = std::env::var_os(PROVIDER_RUNNER_ROOT_ENV)
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
            .or_else(|| {
                (self.code_execution_capability() == CodeExecutionCapability::LocalHost).then(
                    || {
                        self.sqlite_file
                            .parent()
                            .unwrap_or_else(|| Path::new("."))
                            .join("project-workspaces")
                    },
                )
            })?;
        Some(resolve_runtime_path(configured_root))
    }

    pub fn code_execution_capability(&self) -> CodeExecutionCapability {
        if self.deployment_profile == BirdDeploymentProfile::Cloud {
            return CodeExecutionCapability::UnavailableCloudRunner;
        }

        if self.runtime_target == BirdRuntimeTarget::Desktop {
            return CodeExecutionCapability::LocalHost;
        }

        if self.runtime_target == BirdRuntimeTarget::Server
            && self.environment == BirdEnvironment::Development
            && is_loopback_bind_host(&self.host)
        {
            return CodeExecutionCapability::LocalHost;
        }

        CodeExecutionCapability::UnavailableNonLocalRuntime
    }

    pub fn validate_runtime(&self) -> Result<(), BirdServerConfigError> {
        if self.deployment_profile != BirdDeploymentProfile::Cloud {
            return Ok(());
        }

        if !matches!(
            self.runtime_target,
            BirdRuntimeTarget::Server | BirdRuntimeTarget::Container
        ) {
            return Err(BirdServerConfigError::CloudRuntimeTarget);
        }
        if !matches!(
            self.resolved_database_engine()
                .trim()
                .to_ascii_lowercase()
                .as_str(),
            "postgres" | "postgresql"
        ) {
            return Err(BirdServerConfigError::CloudDatabaseEngine);
        }
        if read_env(&format!(
            "SDKWORK_{BIRDCODER_DATABASE_SERVICE}_DATABASE_URL"
        ))
        .is_none()
        {
            return Err(BirdServerConfigError::CloudDatabaseUrl);
        }
        if self.allowed_origins.is_empty()
            || self.allowed_origins.iter().any(|origin| origin == "*")
        {
            return Err(BirdServerConfigError::CloudAllowedOrigins);
        }
        if is_loopback_bind_host(&self.host) {
            return Err(BirdServerConfigError::CloudLoopbackBind);
        }

        Ok(())
    }
}

fn resolve_runtime_path(path: PathBuf) -> PathBuf {
    if path.is_absolute() {
        return path;
    }
    std::env::current_dir()
        .map(|current_dir| current_dir.join(&path))
        .unwrap_or(path)
}

fn read_env(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn required_env(key: &str) -> Result<String, BirdServerConfigError> {
    read_env(key).ok_or_else(|| BirdServerConfigError::MissingEnvironment(key.to_owned()))
}

fn reject_retired_deployment_mode_env() -> Result<(), BirdServerConfigError> {
    for key in [
        RETIRED_DEPLOYMENT_MODE_ENV,
        RETIRED_PUBLIC_DEPLOYMENT_MODE_ENV,
    ] {
        if let Some(value) = read_env(key) {
            return Err(BirdServerConfigError::RetiredDeploymentMode { key, value });
        }
    }
    Ok(())
}

pub fn sqlite_database_url(path: &Path) -> String {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(path)
    };
    let normalized = absolute.to_string_lossy().replace('\\', "/");
    format!("sqlite:///{normalized}?mode=rwc")
}

pub fn default_allowed_origins_for_host(host: &str) -> Vec<String> {
    if is_loopback_bind_host(host) || is_wildcard_bind_host(host) {
        default_loopback_browser_origins()
    } else {
        Vec::new()
    }
}

/// Returns true when `host` is a loopback address.
///
/// IPv4 loopback is strictly `127.0.0.0/8` (any `127.x.x.x`).
/// IPv6 loopback is strictly `::1`. `0.0.0.0` is NOT loopback; use
/// [`is_wildcard_bind_host`] to detect wildcard/any bind hosts.
pub fn is_loopback_bind_host(host: &str) -> bool {
    let normalized = normalize_bind_host(host);
    if normalized.eq_ignore_ascii_case("localhost") {
        return true;
    }
    match normalized.parse::<std::net::IpAddr>() {
        Ok(std::net::IpAddr::V4(addr)) => addr.is_loopback(),
        Ok(std::net::IpAddr::V6(addr)) => addr.is_loopback(),
        Err(_) => false,
    }
}

/// Returns true when `host` is a wildcard/any bind address (`0.0.0.0` or `::`).
///
/// Wildcard hosts are not loopback; binding to them makes the server reachable
/// via loopback, so [`default_allowed_origins_for_host`] still returns loopback
/// origins for wildcard hosts.
pub fn is_wildcard_bind_host(host: &str) -> bool {
    let normalized = normalize_bind_host(host);
    match normalized.parse::<std::net::IpAddr>() {
        Ok(std::net::IpAddr::V4(addr)) => addr.is_unspecified(),
        Ok(std::net::IpAddr::V6(addr)) => addr.is_unspecified(),
        Err(_) => false,
    }
}

fn normalize_bind_host(host: &str) -> String {
    host.trim()
        .trim_start_matches('[')
        .trim_end_matches(']')
        .to_ascii_lowercase()
}

pub fn default_loopback_browser_origins() -> Vec<String> {
    let mut origins = Vec::new();
    let vite_ports = (3000..=3019).chain(4173..=4192).chain(5173..=5192);
    for port in vite_ports.chain(std::iter::once(10240)) {
        origins.push(format!("http://127.0.0.1:{port}"));
        origins.push(format!("http://localhost:{port}"));
    }
    origins.push("tauri://localhost".to_string());
    origins.push("https://tauri.localhost".to_string());
    origins
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::{
        default_allowed_origins_for_host, is_loopback_bind_host, is_wildcard_bind_host,
        BirdDeploymentProfile, BirdEnvironment, BirdRuntimeTarget, BirdServerConfig,
        CodeExecutionCapability, DEFAULT_RATE_LIMIT_ENABLED, DEFAULT_RATE_LIMIT_MAX_REQUESTS,
        DEFAULT_RATE_LIMIT_WINDOW_SECS,
    };

    use super::resolve_runtime_path;

    fn config_for(
        environment: BirdEnvironment,
        deployment_profile: BirdDeploymentProfile,
        runtime_target: BirdRuntimeTarget,
        host: &str,
    ) -> BirdServerConfig {
        BirdServerConfig {
            environment,
            deployment_profile,
            runtime_target,
            host: host.to_owned(),
            port: 0,
            sqlite_file: PathBuf::from("target/test/birdcoder.sqlite"),
            allowed_origins: Vec::new(),
            project_root: None,
            rate_limit_enabled: DEFAULT_RATE_LIMIT_ENABLED,
            rate_limit_max_requests: DEFAULT_RATE_LIMIT_MAX_REQUESTS,
            rate_limit_window_secs: DEFAULT_RATE_LIMIT_WINDOW_SECS,
        }
    }

    #[test]
    fn ipv4_loopback_127_0_0_1_is_loopback() {
        assert!(is_loopback_bind_host("127.0.0.1"));
        assert!(!is_wildcard_bind_host("127.0.0.1"));
    }

    #[test]
    fn ipv4_loopback_127_1_2_3_is_loopback() {
        assert!(is_loopback_bind_host("127.1.2.3"));
        assert!(!is_wildcard_bind_host("127.1.2.3"));
    }

    #[test]
    fn wildcard_0_0_0_0_is_not_loopback() {
        assert!(!is_loopback_bind_host("0.0.0.0"));
        assert!(is_wildcard_bind_host("0.0.0.0"));
    }

    #[test]
    fn ipv6_loopback_is_loopback() {
        assert!(is_loopback_bind_host("::1"));
        assert!(is_loopback_bind_host("[::1]"));
        assert!(!is_wildcard_bind_host("::1"));
    }

    #[test]
    fn private_ipv4_is_not_loopback() {
        assert!(!is_loopback_bind_host("192.168.1.1"));
        assert!(!is_wildcard_bind_host("192.168.1.1"));
    }

    #[test]
    fn localhost_is_loopback() {
        assert!(is_loopback_bind_host("localhost"));
        assert!(is_loopback_bind_host("Localhost"));
        assert!(!is_wildcard_bind_host("localhost"));
    }

    #[test]
    fn ipv6_wildcard_is_wildcard() {
        assert!(!is_loopback_bind_host("::"));
        assert!(is_wildcard_bind_host("::"));
        assert!(is_wildcard_bind_host("[::]"));
    }

    #[test]
    fn default_origins_returned_for_loopback_and_wildcard() {
        let loopback_origins = default_allowed_origins_for_host("127.0.0.1");
        assert!(loopback_origins
            .iter()
            .any(|origin| origin == "http://127.0.0.1:5192"));
        assert!(loopback_origins
            .iter()
            .any(|origin| origin == "http://localhost:3019"));
        assert!(!default_allowed_origins_for_host("0.0.0.0").is_empty());
        assert!(default_allowed_origins_for_host("192.168.1.1").is_empty());
    }

    #[test]
    fn runtime_configuration_labels_match_the_canonical_environment_values() {
        assert_eq!(BirdDeploymentProfile::Standalone.as_str(), "standalone");
        assert_eq!(BirdDeploymentProfile::Cloud.as_str(), "cloud");
        assert_eq!(BirdEnvironment::Production.as_str(), "production");
        assert_eq!(BirdRuntimeTarget::Container.as_str(), "container");
    }

    #[test]
    fn runtime_paths_are_resolved_to_absolute_paths() {
        assert!(resolve_runtime_path(PathBuf::from(".runtime/project-workspaces")).is_absolute());
        let absolute = std::env::temp_dir().join("birdcoder-project-workspaces");
        assert_eq!(resolve_runtime_path(absolute.clone()), absolute);
    }

    #[test]
    fn cloud_profile_never_enables_the_process_local_provider_runner() {
        let config = config_for(
            BirdEnvironment::Production,
            BirdDeploymentProfile::Cloud,
            BirdRuntimeTarget::Container,
            "0.0.0.0",
        );

        assert_eq!(
            config.code_execution_capability(),
            CodeExecutionCapability::UnavailableCloudRunner
        );
    }

    #[test]
    fn only_desktop_or_loopback_development_server_can_use_local_execution() {
        let desktop = config_for(
            BirdEnvironment::Production,
            BirdDeploymentProfile::Standalone,
            BirdRuntimeTarget::Desktop,
            "127.0.0.1",
        );
        let local_development_server = config_for(
            BirdEnvironment::Development,
            BirdDeploymentProfile::Standalone,
            BirdRuntimeTarget::Server,
            "127.0.0.1",
        );
        let remote_windows_server = config_for(
            BirdEnvironment::Production,
            BirdDeploymentProfile::Standalone,
            BirdRuntimeTarget::Server,
            "0.0.0.0",
        );

        assert_eq!(
            desktop.code_execution_capability(),
            CodeExecutionCapability::LocalHost
        );
        assert_eq!(
            local_development_server.code_execution_capability(),
            CodeExecutionCapability::LocalHost
        );
        assert_eq!(
            remote_windows_server.code_execution_capability(),
            CodeExecutionCapability::UnavailableNonLocalRuntime
        );
    }
}
