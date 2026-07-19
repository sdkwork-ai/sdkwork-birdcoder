use axum::extract::Request;
use axum::http::header::{AUTHORIZATION, CONNECTION, UPGRADE};
use axum::http::{HeaderMap, HeaderName, HeaderValue, Method};
use axum::middleware::Next;
use axum::response::Response;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use sdkwork_web_axum::problem_response_for_request;
use sdkwork_web_core::WebFrameworkError;

const ACCESS_TOKEN_HEADER: HeaderName = HeaderName::from_static("access-token");
const WEBSOCKET_PROTOCOL_HEADER: HeaderName = HeaderName::from_static("sec-websocket-protocol");
const REALTIME_APPLICATION_PROTOCOL: &str = "sdkwork-realtime-v1";
const REALTIME_AUTH_PROTOCOL_PREFIX: &str = "sdkwork-realtime-auth-v1.";
const REALTIME_ACCESS_PROTOCOL_PREFIX: &str = "sdkwork-realtime-access-v1.";
const MAX_ENCODED_CREDENTIAL_LENGTH: usize = 8_192;
const MAX_PROTOCOL_HEADER_LENGTH: usize = 18_432;
const MAX_PROTOCOL_ITEMS: usize = 8;

#[derive(Default)]
struct RealtimeCredentialProtocols {
    application_protocol_count: usize,
    auth_token: Option<String>,
    access_token: Option<String>,
    retained_protocols: Vec<String>,
    saw_auth_protocol: bool,
    saw_access_protocol: bool,
}

fn header_has_token(headers: &HeaderMap, name: &HeaderName, expected: &str) -> bool {
    headers.get_all(name).iter().any(|value| {
        value.to_str().ok().is_some_and(|header| {
            header
                .split(',')
                .any(|token| token.trim().eq_ignore_ascii_case(expected))
        })
    })
}

fn is_workspace_realtime_path(path: &str) -> bool {
    let segments = path.split('/').collect::<Vec<_>>();
    matches!(
        segments.as_slice(),
        ["", "app", "v3", "api", "workspaces", workspace_id, "realtime"]
            if !workspace_id.is_empty()
    )
}

fn is_realtime_websocket_upgrade(request: &Request) -> bool {
    request.method() == Method::GET
        && is_workspace_realtime_path(request.uri().path())
        && header_has_token(request.headers(), &UPGRADE, "websocket")
        && header_has_token(request.headers(), &CONNECTION, "upgrade")
}

fn count_header_values(headers: &HeaderMap, name: &HeaderName) -> usize {
    headers.get_all(name).iter().count()
}

fn decode_credential_protocol(value: &str, prefix: &str) -> Result<String, WebFrameworkError> {
    let encoded = value
        .strip_prefix(prefix)
        .ok_or_else(|| WebFrameworkError::invalid_credentials("invalid realtime credentials"))?;
    if encoded.is_empty()
        || encoded.len() > MAX_ENCODED_CREDENTIAL_LENGTH
        || !encoded
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err(WebFrameworkError::invalid_credentials(
            "invalid realtime credentials",
        ));
    }
    let decoded = URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|_| WebFrameworkError::invalid_credentials("invalid realtime credentials"))?;
    let credential = String::from_utf8(decoded)
        .map_err(|_| WebFrameworkError::invalid_credentials("invalid realtime credentials"))?;
    if credential.is_empty()
        || credential.trim() != credential
        || credential
            .chars()
            .any(|character| character.is_whitespace() || character.is_control())
    {
        return Err(WebFrameworkError::invalid_credentials(
            "invalid realtime credentials",
        ));
    }
    Ok(credential)
}

fn parse_protocols(headers: &HeaderMap) -> Result<RealtimeCredentialProtocols, WebFrameworkError> {
    let mut parsed = RealtimeCredentialProtocols::default();
    let mut total_length = 0_usize;
    let mut item_count = 0_usize;

    for header in headers.get_all(&WEBSOCKET_PROTOCOL_HEADER) {
        total_length = total_length
            .checked_add(header.as_bytes().len())
            .ok_or_else(|| {
                WebFrameworkError::payload_too_large("realtime handshake is too large")
            })?;
        if total_length > MAX_PROTOCOL_HEADER_LENGTH {
            return Err(WebFrameworkError::payload_too_large(
                "realtime handshake is too large",
            ));
        }
        let value = header
            .to_str()
            .map_err(|_| WebFrameworkError::invalid_credentials("invalid realtime credentials"))?;
        for protocol in value.split(',').map(str::trim) {
            item_count += 1;
            if item_count > MAX_PROTOCOL_ITEMS || protocol.is_empty() {
                return Err(WebFrameworkError::invalid_credentials(
                    "invalid realtime credentials",
                ));
            }
            if protocol == REALTIME_APPLICATION_PROTOCOL {
                parsed.application_protocol_count += 1;
                parsed.retained_protocols.push(protocol.to_owned());
            } else if protocol.starts_with(REALTIME_AUTH_PROTOCOL_PREFIX) {
                if parsed.saw_auth_protocol {
                    return Err(WebFrameworkError::invalid_credentials(
                        "duplicate realtime credentials",
                    ));
                }
                parsed.saw_auth_protocol = true;
                parsed.auth_token = Some(decode_credential_protocol(
                    protocol,
                    REALTIME_AUTH_PROTOCOL_PREFIX,
                )?);
            } else if protocol.starts_with(REALTIME_ACCESS_PROTOCOL_PREFIX) {
                if parsed.saw_access_protocol {
                    return Err(WebFrameworkError::invalid_credentials(
                        "duplicate realtime credentials",
                    ));
                }
                parsed.saw_access_protocol = true;
                parsed.access_token = Some(decode_credential_protocol(
                    protocol,
                    REALTIME_ACCESS_PROTOCOL_PREFIX,
                )?);
            } else {
                parsed.retained_protocols.push(protocol.to_owned());
            }
        }
    }

    Ok(parsed)
}

fn normalize_realtime_websocket_credentials(
    request: &mut Request,
) -> Result<(), WebFrameworkError> {
    let parsed = parse_protocols(request.headers())?;
    let has_carrier = parsed.saw_auth_protocol || parsed.saw_access_protocol;
    if !is_realtime_websocket_upgrade(request) {
        return if has_carrier {
            Err(WebFrameworkError::invalid_credentials(
                "realtime credentials are not accepted on this route",
            ))
        } else {
            Ok(())
        };
    }

    let authorization_count = count_header_values(request.headers(), &AUTHORIZATION);
    let access_token_count = count_header_values(request.headers(), &ACCESS_TOKEN_HEADER);
    if authorization_count > 1 || access_token_count > 1 {
        return Err(WebFrameworkError::invalid_credentials(
            "duplicate realtime credentials",
        ));
    }
    if parsed.application_protocol_count != 1 {
        return Err(WebFrameworkError::invalid_credentials(
            "the realtime application protocol is required exactly once",
        ));
    }
    let has_authorization = authorization_count == 1;
    let has_access_token = access_token_count == 1;
    let has_standard_credentials = has_authorization || has_access_token;
    if has_standard_credentials && has_carrier {
        return Err(WebFrameworkError::invalid_credentials(
            "realtime credential transports must not be mixed",
        ));
    }
    if has_authorization != has_access_token {
        return Err(WebFrameworkError::missing_credentials(
            "both Authorization and Access-Token are required",
        ));
    }
    if !has_carrier {
        return Ok(());
    }
    if parsed.auth_token.is_none() || parsed.access_token.is_none() {
        return Err(WebFrameworkError::missing_credentials(
            "both realtime credentials are required",
        ));
    }
    let authorization = HeaderValue::from_str(&format!(
        "Bearer {}",
        parsed.auth_token.as_deref().unwrap_or_default()
    ))
    .map_err(|_| WebFrameworkError::invalid_credentials("invalid realtime credentials"))?;
    let access_token = HeaderValue::from_str(parsed.access_token.as_deref().unwrap_or_default())
        .map_err(|_| WebFrameworkError::invalid_credentials("invalid realtime credentials"))?;
    let retained_protocols = HeaderValue::from_str(&parsed.retained_protocols.join(", "))
        .map_err(|_| WebFrameworkError::invalid_credentials("invalid realtime protocol"))?;

    let headers = request.headers_mut();
    headers.insert(AUTHORIZATION, authorization);
    headers.insert(ACCESS_TOKEN_HEADER, access_token);
    headers.insert(WEBSOCKET_PROTOCOL_HEADER, retained_protocols);
    Ok(())
}

pub(crate) async fn realtime_websocket_credential_middleware(
    mut request: Request,
    next: Next,
) -> Response {
    if let Err(error) = normalize_realtime_websocket_credentials(&mut request) {
        return problem_response_for_request(&error, &request);
    }
    next.run(request).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;

    fn encoded(value: &str) -> String {
        URL_SAFE_NO_PAD.encode(value.as_bytes())
    }

    fn realtime_request(protocols: &str) -> Request {
        Request::builder()
            .method(Method::GET)
            .uri("/app/v3/api/workspaces/workspace-1/realtime?transport=websocket")
            .header(CONNECTION, "Upgrade")
            .header(UPGRADE, "websocket")
            .header(&WEBSOCKET_PROTOCOL_HEADER, protocols)
            .body(Body::empty())
            .expect("build realtime request")
    }

    #[test]
    fn canonicalizes_browser_carrier_and_removes_credential_protocols() {
        let protocols = format!(
            "{REALTIME_APPLICATION_PROTOCOL}, {REALTIME_AUTH_PROTOCOL_PREFIX}{}, {REALTIME_ACCESS_PROTOCOL_PREFIX}{}",
            encoded("auth-token"),
            encoded("access-token")
        );
        let mut request = realtime_request(&protocols);

        normalize_realtime_websocket_credentials(&mut request).expect("normalize credentials");

        assert_eq!(
            request
                .headers()
                .get(AUTHORIZATION)
                .and_then(|value| value.to_str().ok()),
            Some("Bearer auth-token")
        );
        assert_eq!(
            request
                .headers()
                .get(&ACCESS_TOKEN_HEADER)
                .and_then(|value| value.to_str().ok()),
            Some("access-token")
        );
        assert_eq!(
            request
                .headers()
                .get(&WEBSOCKET_PROTOCOL_HEADER)
                .and_then(|value| value.to_str().ok()),
            Some(REALTIME_APPLICATION_PROTOCOL)
        );
    }

    #[test]
    fn rejects_partial_duplicate_malformed_and_mixed_carriers() {
        let auth_protocol = format!("{REALTIME_AUTH_PROTOCOL_PREFIX}{}", encoded("auth-token"));
        let access_protocol = format!(
            "{REALTIME_ACCESS_PROTOCOL_PREFIX}{}",
            encoded("access-token")
        );

        for protocols in [
            format!("{REALTIME_APPLICATION_PROTOCOL}, {auth_protocol}"),
            format!(
                "{REALTIME_APPLICATION_PROTOCOL}, {auth_protocol}, {auth_protocol}, {access_protocol}"
            ),
            format!(
                "{REALTIME_APPLICATION_PROTOCOL}, {REALTIME_AUTH_PROTOCOL_PREFIX}***, {access_protocol}"
            ),
            format!(
                "{REALTIME_APPLICATION_PROTOCOL}, {REALTIME_APPLICATION_PROTOCOL}, {auth_protocol}, {access_protocol}"
            ),
        ] {
            let mut request = realtime_request(&protocols);
            assert!(normalize_realtime_websocket_credentials(&mut request).is_err());
        }

        let mut mixed = realtime_request(&format!(
            "{REALTIME_APPLICATION_PROTOCOL}, {auth_protocol}, {access_protocol}"
        ));
        mixed.headers_mut().insert(
            AUTHORIZATION,
            HeaderValue::from_static("Bearer standard-auth"),
        );
        mixed.headers_mut().insert(
            ACCESS_TOKEN_HEADER,
            HeaderValue::from_static("standard-access"),
        );
        assert!(normalize_realtime_websocket_credentials(&mut mixed).is_err());
    }

    #[test]
    fn rejects_oversized_and_control_character_credentials() {
        let oversized_header = "x".repeat(MAX_PROTOCOL_HEADER_LENGTH + 1);
        assert!(
            normalize_realtime_websocket_credentials(&mut realtime_request(&oversized_header))
                .is_err()
        );

        let oversized = format!(
            "{REALTIME_APPLICATION_PROTOCOL}, {REALTIME_AUTH_PROTOCOL_PREFIX}{}, {REALTIME_ACCESS_PROTOCOL_PREFIX}{}",
            "a".repeat(MAX_ENCODED_CREDENTIAL_LENGTH + 1),
            encoded("access-token")
        );
        assert!(
            normalize_realtime_websocket_credentials(&mut realtime_request(&oversized)).is_err()
        );

        let controls = format!(
            "{REALTIME_APPLICATION_PROTOCOL}, {REALTIME_AUTH_PROTOCOL_PREFIX}{}, {REALTIME_ACCESS_PROTOCOL_PREFIX}{}",
            encoded("auth\0token"),
            encoded("access-token")
        );
        assert!(
            normalize_realtime_websocket_credentials(&mut realtime_request(&controls)).is_err()
        );
    }

    #[test]
    fn rejects_carrier_on_non_realtime_routes_and_preserves_standard_headers() {
        let auth_protocol = format!("{REALTIME_AUTH_PROTOCOL_PREFIX}{}", encoded("auth-token"));
        let access_protocol = format!(
            "{REALTIME_ACCESS_PROTOCOL_PREFIX}{}",
            encoded("access-token")
        );
        let mut wrong_route = Request::builder()
            .method(Method::GET)
            .uri("/app/v3/api/workspaces")
            .header(
                &WEBSOCKET_PROTOCOL_HEADER,
                format!("{REALTIME_APPLICATION_PROTOCOL}, {auth_protocol}, {access_protocol}"),
            )
            .body(Body::empty())
            .expect("build wrong-route request");
        assert!(normalize_realtime_websocket_credentials(&mut wrong_route).is_err());

        let mut standard = realtime_request(REALTIME_APPLICATION_PROTOCOL);
        standard.headers_mut().insert(
            AUTHORIZATION,
            HeaderValue::from_static("Bearer standard-auth"),
        );
        standard.headers_mut().insert(
            ACCESS_TOKEN_HEADER,
            HeaderValue::from_static("standard-access"),
        );
        normalize_realtime_websocket_credentials(&mut standard)
            .expect("preserve standard credentials");
        assert_eq!(
            standard.headers().get(AUTHORIZATION),
            Some(&HeaderValue::from_static("Bearer standard-auth"))
        );

        let mut unversioned = realtime_request("other-protocol");
        unversioned.headers_mut().insert(
            AUTHORIZATION,
            HeaderValue::from_static("Bearer standard-auth"),
        );
        unversioned.headers_mut().insert(
            ACCESS_TOKEN_HEADER,
            HeaderValue::from_static("standard-access"),
        );
        assert!(normalize_realtime_websocket_credentials(&mut unversioned).is_err());
    }
}
