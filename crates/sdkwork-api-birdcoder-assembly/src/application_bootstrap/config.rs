use std::fmt;

pub const DEFAULT_HOST: &str = "127.0.0.1";
pub const DEFAULT_PORT: u16 = 10240;
pub const DEFAULT_RATE_LIMIT_ENABLED: bool = true;
pub const DEFAULT_RATE_LIMIT_MAX_REQUESTS: u32 = 120;
pub const DEFAULT_RATE_LIMIT_WINDOW_SECS: u64 = 60;
pub const DEPLOYMENT_PROFILE_ENV: &str = "SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE";
pub const ENVIRONMENT_ENV: &str = "SDKWORK_BIRDCODER_ENVIRONMENT";
pub const RUNTIME_TARGET_ENV: &str = "SDKWORK_BIRDCODER_RUNTIME_TARGET";
pub const SERVER_HOST_ENV: &str = "SDKWORK_BIRDCODER_SERVER_HOST";
pub const SERVER_PORT_ENV: &str = "SDKWORK_BIRDCODER_SERVER_PORT";
pub const APPLICATION_PUBLIC_INGRESS_BIND_ENV: &str =
    "SDKWORK_BIRDCODER_APPLICATION_PUBLIC_INGRESS_BIND";
pub const ALLOWED_ORIGINS_ENV: &str = "SDKWORK_BIRDCODER_ALLOWED_ORIGINS";
pub const RETIRED_DEPLOYMENT_MODE_ENV: &str = "SDKWORK_DEPLOYMENT_MODE";
pub const RETIRED_PUBLIC_DEPLOYMENT_MODE_ENV: &str = "VITE_SDKWORK_DEPLOYMENT_MODE";

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

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum BirdServerConfigError {
    MissingEnvironment(String),
    InvalidDeploymentProfile(String),
    InvalidEnvironment(String),
    InvalidRuntimeTarget(String),
    RetiredDeploymentMode { key: &'static str, value: String },
    CloudRuntimeTarget,
    CloudAllowedOrigins,
    CloudLoopbackBind,
    InvalidApplicationPublicIngressBind(String),
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
            Self::CloudAllowedOrigins => write!(
                formatter,
                "cloud server configuration requires explicit non-wildcard {ALLOWED_ORIGINS_ENV}"
            ),
            Self::CloudLoopbackBind => write!(
                formatter,
                "cloud server configuration must not bind only to a loopback address"
            ),
            Self::InvalidApplicationPublicIngressBind(value) => write!(
                formatter,
                "{APPLICATION_PUBLIC_INGRESS_BIND_ENV} must be a valid host:port bind, got {value:?}"
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
    pub allowed_origins: Vec<String>,
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
        let ingress_bind = read_env(APPLICATION_PUBLIC_INGRESS_BIND_ENV)
            .map(|value| parse_bind_address(&value))
            .transpose()?;
        let host = read_env(SERVER_HOST_ENV)
            .or_else(|| ingress_bind.as_ref().map(|(host, _)| host.clone()))
            .unwrap_or_else(|| DEFAULT_HOST.to_string());
        let port: u16 = read_env(SERVER_PORT_ENV)
            .and_then(|v| v.parse().ok())
            .or_else(|| ingress_bind.as_ref().map(|(_, port)| *port))
            .unwrap_or(DEFAULT_PORT);
        let allowed_origins = read_env(ALLOWED_ORIGINS_ENV)
            .map(|v| v.split(',').map(|s| s.trim().to_string()).collect())
            .unwrap_or_else(|| default_allowed_origins_for_host(&host));
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
            allowed_origins,
            rate_limit_enabled,
            rate_limit_max_requests,
            rate_limit_window_secs,
        })
    }

    pub fn bind_address(&self) -> String {
        format!("{}:{}", self.host, self.port)
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

fn read_env(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn required_env(key: &str) -> Result<String, BirdServerConfigError> {
    read_env(key).ok_or_else(|| BirdServerConfigError::MissingEnvironment(key.to_owned()))
}

fn parse_bind_address(value: &str) -> Result<(String, u16), BirdServerConfigError> {
    let value = value.trim();
    let (host, port) = if let Some(rest) = value.strip_prefix('[') {
        let (host, rest) = rest.split_once(']').ok_or_else(|| {
            BirdServerConfigError::InvalidApplicationPublicIngressBind(value.to_owned())
        })?;
        let port = rest.strip_prefix(':').ok_or_else(|| {
            BirdServerConfigError::InvalidApplicationPublicIngressBind(value.to_owned())
        })?;
        (host, port)
    } else {
        value.rsplit_once(':').ok_or_else(|| {
            BirdServerConfigError::InvalidApplicationPublicIngressBind(value.to_owned())
        })?
    };
    if host.trim().is_empty() {
        return Err(BirdServerConfigError::InvalidApplicationPublicIngressBind(
            value.to_owned(),
        ));
    }
    let port = port
        .parse::<u16>()
        .ok()
        .filter(|port| *port != 0)
        .ok_or_else(|| {
            BirdServerConfigError::InvalidApplicationPublicIngressBind(value.to_owned())
        })?;
    Ok((host.to_owned(), port))
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
    use super::{
        default_allowed_origins_for_host, is_loopback_bind_host, is_wildcard_bind_host,
        parse_bind_address, BirdDeploymentProfile, BirdEnvironment, BirdRuntimeTarget,
        BirdServerConfigError,
    };

    #[test]
    fn ipv4_loopback_127_0_0_1_is_loopback() {
        assert!(is_loopback_bind_host("127.0.0.1"));
        assert!(!is_wildcard_bind_host("127.0.0.1"));
    }

    #[test]
    fn canonical_public_ingress_bind_supports_ipv4_and_ipv6() {
        assert_eq!(
            parse_bind_address("0.0.0.0:10240").expect("ipv4 bind"),
            ("0.0.0.0".to_owned(), 10240)
        );
        assert_eq!(
            parse_bind_address("[::]:10240").expect("ipv6 bind"),
            ("::".to_owned(), 10240)
        );
    }

    #[test]
    fn canonical_public_ingress_bind_rejects_invalid_values() {
        assert!(matches!(
            parse_bind_address("127.0.0.1"),
            Err(BirdServerConfigError::InvalidApplicationPublicIngressBind(
                _
            ))
        ));
        assert!(matches!(
            parse_bind_address("0.0.0.0:0"),
            Err(BirdServerConfigError::InvalidApplicationPublicIngressBind(
                _
            ))
        ));
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
}
