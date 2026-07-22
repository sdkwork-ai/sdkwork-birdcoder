use std::sync::Arc;

use reqwest::Method;

use crate::api::paths::app_path;
use crate::http::{SdkworkError, SdkworkHttpClient};
use crate::models::{BirdCoderBooleanSuccessResult, BirdCoderIamDeviceAuthorizationCreateRequest, BirdCoderIamDeviceAuthorizationPasswordCompletionRequest, BirdCoderIamDeviceAuthorizationScanRequest, BirdCoderIamDeviceAuthorizationSessionExchangeRequest, BirdCoderIamDeviceAuthorizationSummary, BirdCoderIamOAuthAuthorizationCreateRequest, BirdCoderIamOAuthAuthorizationSummary, BirdCoderIamOAuthSessionCreateRequest, BirdCoderIamSessionSummary};

#[derive(Clone)]
pub struct OauthApi {
    client: Arc<SdkworkHttpClient>,
}

impl OauthApi {
    pub fn new(client: Arc<SdkworkHttpClient>) -> Self {
        Self { client }
    }

    /// Resolve OAuth authorization URL for SDKWork IAM sign-in
    pub async fn authorization_urls_create(&self, body: &BirdCoderIamOAuthAuthorizationCreateRequest) -> Result<BirdCoderIamOAuthAuthorizationSummary, SdkworkError> {
        let path = app_path(&"/oauth/authorization_urls".to_string());
        self.client.request_method(Method::POST, &path, Some(body), None, None, Some("application/json"), true).await
    }

    /// Create SDKWork IAM session with OAuth authorization code
    pub async fn sessions_create(&self, body: &BirdCoderIamOAuthSessionCreateRequest) -> Result<BirdCoderIamSessionSummary, SdkworkError> {
        let path = app_path(&"/oauth/sessions".to_string());
        self.client.request_method(Method::POST, &path, Some(body), None, None, Some("application/json"), true).await
    }

    /// Create SDKWork IAM OAuth device authorization
    pub async fn device_authorizations_create(&self, body: &BirdCoderIamDeviceAuthorizationCreateRequest) -> Result<BirdCoderIamDeviceAuthorizationSummary, SdkworkError> {
        let path = app_path(&"/oauth/device_authorizations".to_string());
        self.client.request_method(Method::POST, &path, Some(body), None, None, Some("application/json"), true).await
    }

    /// Get SDKWork IAM OAuth device authorization
    pub async fn device_authorizations_retrieve(&self, device_authorization_id: &str) -> Result<BirdCoderIamDeviceAuthorizationSummary, SdkworkError> {
        let path = app_path(&format!("/oauth/device_authorizations/{}", serialize_path_parameter(device_authorization_id, PathParameterSpec::new("deviceAuthorizationId", "simple", false))));
        self.client.request_method(Method::GET, &path, Option::<&serde_json::Value>::None, None, None, None, true).await
    }

    /// Create SDKWork IAM OAuth device authorization scan
    pub async fn device_authorizations_scans_create(&self, device_authorization_id: &str, body: &BirdCoderIamDeviceAuthorizationScanRequest) -> Result<BirdCoderBooleanSuccessResult, SdkworkError> {
        let path = app_path(&format!("/oauth/device_authorizations/{}/scans", serialize_path_parameter(device_authorization_id, PathParameterSpec::new("deviceAuthorizationId", "simple", false))));
        self.client.request_method(Method::POST, &path, Some(body), None, None, Some("application/json"), true).await
    }

    /// Complete SDKWork IAM OAuth device authorization with password
    pub async fn device_authorizations_password_completions_create(&self, device_authorization_id: &str, body: &BirdCoderIamDeviceAuthorizationPasswordCompletionRequest) -> Result<BirdCoderIamSessionSummary, SdkworkError> {
        let path = app_path(&format!("/oauth/device_authorizations/{}/password_completions", serialize_path_parameter(device_authorization_id, PathParameterSpec::new("deviceAuthorizationId", "simple", false))));
        self.client.request_method(Method::POST, &path, Some(body), None, None, Some("application/json"), true).await
    }

    /// Exchange SDKWork IAM OAuth device authorization for a session
    pub async fn device_authorizations_session_exchanges_create(&self, device_authorization_id: &str, body: &BirdCoderIamDeviceAuthorizationSessionExchangeRequest) -> Result<BirdCoderIamSessionSummary, SdkworkError> {
        let path = app_path(&format!("/oauth/device_authorizations/{}/session_exchanges", serialize_path_parameter(device_authorization_id, PathParameterSpec::new("deviceAuthorizationId", "simple", false))));
        self.client.request_method(Method::POST, &path, Some(body), None, None, Some("application/json"), true).await
    }

}

struct PathParameterSpec<'a> {
    name: &'a str,
    style: &'a str,
    explode: bool,
}

impl<'a> PathParameterSpec<'a> {
    fn new(name: &'a str, style: &'a str, explode: bool) -> Self {
        Self { name, style, explode }
    }
}

fn serialize_path_parameter<T: serde::Serialize>(value: T, spec: PathParameterSpec<'_>) -> String {
    let value = serde_json::to_value(value).unwrap_or(serde_json::Value::Null);
    if value.is_null() {
        return String::new();
    }
    let style = if spec.style.is_empty() { "simple" } else { spec.style };
    match value {
        serde_json::Value::Array(values) => serialize_path_array(spec.name, &values, style, spec.explode),
        serde_json::Value::Object(values) => serialize_path_object(spec.name, &values, style, spec.explode),
        value => format!("{}{}", path_primitive_prefix(spec.name, style), percent_encode(&primitive_to_string(&value))),
    }
}

fn serialize_path_array(name: &str, values: &[serde_json::Value], style: &str, explode: bool) -> String {
    let serialized = values
        .iter()
        .filter(|value| !value.is_null())
        .map(|value| percent_encode(&primitive_to_string(value)))
        .collect::<Vec<_>>();
    if serialized.is_empty() {
        return path_prefix(name, style);
    }
    if style == "matrix" {
        if explode {
            return serialized.iter().map(|item| format!(";{}={}", name, item)).collect::<Vec<_>>().join("");
        }
        return format!(";{}={}", name, serialized.join(","));
    }
    let separator = if explode { "." } else { "," };
    format!("{}{}", path_prefix(name, style), serialized.join(separator))
}

fn serialize_path_object(
    name: &str,
    values: &serde_json::Map<String, serde_json::Value>,
    style: &str,
    explode: bool,
) -> String {
    let mut entries = Vec::new();
    let mut exploded = Vec::new();
    for (key, value) in values {
        if value.is_null() {
            continue;
        }
        let escaped_key = percent_encode(key);
        let escaped_value = percent_encode(&primitive_to_string(value));
        if explode {
            if style == "matrix" {
                exploded.push(format!(";{}={}", escaped_key, escaped_value));
            } else {
                exploded.push(format!("{}={}", escaped_key, escaped_value));
            }
        } else {
            entries.push(escaped_key);
            entries.push(escaped_value);
        }
    }
    if style == "matrix" {
        if explode {
            return exploded.join("");
        }
        return format!(";{}={}", name, entries.join(","));
    }
    if explode {
        let separator = if style == "label" { "." } else { "," };
        return format!("{}{}", path_prefix(name, style), exploded.join(separator));
    }
    format!("{}{}", path_prefix(name, style), entries.join(","))
}

fn path_prefix(name: &str, style: &str) -> String {
    match style {
        "label" => ".".to_string(),
        "matrix" => format!(";{}", name),
        _ => String::new(),
    }
}

fn path_primitive_prefix(name: &str, style: &str) -> String {
    if style == "matrix" {
        format!(";{}=", name)
    } else {
        path_prefix(name, style)
    }
}



fn primitive_to_string(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(value) => value.clone(),
        serde_json::Value::Number(value) => value.to_string(),
        serde_json::Value::Bool(value) => value.to_string(),
        other => other.to_string(),
    }
}

fn percent_encode(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                vec![byte as char]
            }
            _ => format!("%{:02X}", byte).chars().collect(),
        })
        .collect()
}
