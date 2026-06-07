use std::sync::Arc;

use crate::api::paths::app_path;
use crate::http::{SdkworkError, SdkworkHttpClient};
use crate::models::{BirdCoderBooleanSuccessEnvelope, BirdCoderIamQrAuthSessionCreateRequest, BirdCoderIamQrAuthSessionEnvelope, BirdCoderIamQrAuthSessionPasswordRequest, BirdCoderIamQrAuthSessionScanRequest, BirdCoderIamSessionEnvelope};

#[derive(Clone)]
pub struct OpenPlatformApi {
    client: Arc<SdkworkHttpClient>,
}

impl OpenPlatformApi {
    pub fn new(client: Arc<SdkworkHttpClient>) -> Self {
        Self { client }
    }

    /// Create SDKWork IAM QR auth session
    pub async fn qr_auth_sessions_create(&self, body: &BirdCoderIamQrAuthSessionCreateRequest) -> Result<BirdCoderIamQrAuthSessionEnvelope, SdkworkError> {
        let path = app_path(&"/open_platform/qr_auth/sessions".to_string());
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Get SDKWork IAM QR auth session
    pub async fn qr_auth_sessions_retrieve(&self, session_key: &str) -> Result<BirdCoderIamQrAuthSessionEnvelope, SdkworkError> {
        let path = app_path(&format!("/open_platform/qr_auth/sessions/{}", serialize_path_parameter(session_key, PathParameterSpec::new("sessionKey", "simple", false))));
        self.client.get(&path, None, None).await
    }

    /// Create SDKWork IAM QR auth scan
    pub async fn qr_auth_sessions_scans_create(&self, session_key: &str, body: &BirdCoderIamQrAuthSessionScanRequest) -> Result<BirdCoderBooleanSuccessEnvelope, SdkworkError> {
        let path = app_path(&format!("/open_platform/qr_auth/sessions/{}/scans", serialize_path_parameter(session_key, PathParameterSpec::new("sessionKey", "simple", false))));
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Complete SDKWork IAM QR auth session with password
    pub async fn qr_auth_sessions_passwords_create(&self, session_key: &str, body: &BirdCoderIamQrAuthSessionPasswordRequest) -> Result<BirdCoderIamSessionEnvelope, SdkworkError> {
        let path = app_path(&format!("/open_platform/qr_auth/sessions/{}/passwords", serialize_path_parameter(session_key, PathParameterSpec::new("sessionKey", "simple", false))));
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
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
