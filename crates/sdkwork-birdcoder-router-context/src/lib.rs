use std::collections::HashSet;

use axum::extract::{FromRequestParts, Query};
use axum::http::request::Parts;
use axum::http::Uri;
use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_deployment_service::context::DeploymentContext;
use sdkwork_birdcoder_errors::{
    trace_id_from_request_id, traced_legacy_problem, traced_platform_problem, ProblemJsonBody,
};
use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_workspace_service::context::WorkspaceContext;
use sdkwork_iam_context_service::IamAppContext;
use sdkwork_iam_web_adapter::iam_app_context_from_web_request;
use sdkwork_utils_rust::{validated_offset_list_params, OffsetListPageParams, SdkWorkResultCode};

pub use sdkwork_web_core::WebRequestContext;

pub const MAX_OFFSET_LIST_OFFSET: i64 = 200_000;

const LEGACY_PAGINATION_QUERY_KEYS: &[&str] = &[
    "pageSize", "limit", "offset", "page_no", "pageNo", "per_page", "size",
];

/// Validated standard offset pagination extracted from the raw request query.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StrictOffsetListQuery(pub OffsetListPageParams);

impl<S> FromRequestParts<S> for StrictOffsetListQuery
where
    S: Send + Sync,
{
    type Rejection = ProblemJsonBody;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let trace_id = parts
            .extensions
            .get::<WebRequestContext>()
            .and_then(|web| trace_id_from_request_id(web.request_id.0.as_str()));
        strict_offset_list_params(&parts.uri)
            .map(Self)
            .map_err(|code| {
                traced_platform_problem(code, "Invalid list pagination parameters.", trace_id)
            })
    }
}

/// Parses standard `page` and `page_size` parameters before typed query decoding.
///
/// The raw query pass makes duplicate keys and deprecated aliases observable; Axum's
/// normal typed `Query<T>` extractor cannot reliably distinguish those invalid forms.
pub fn strict_offset_list_params(uri: &Uri) -> Result<OffsetListPageParams, SdkWorkResultCode> {
    let Query(parameters) = Query::<Vec<(String, String)>>::try_from_uri(uri)
        .map_err(|_| SdkWorkResultCode::InvalidParameter)?;
    let mut seen_pagination_keys = HashSet::with_capacity(3);
    let mut page = None;
    let mut page_size = None;
    let mut cursor_supplied = false;

    for (key, value) in parameters {
        if LEGACY_PAGINATION_QUERY_KEYS.contains(&key.as_str()) {
            return Err(SdkWorkResultCode::InvalidParameter);
        }

        match key.as_str() {
            "page" => {
                reject_duplicate_pagination_key(&mut seen_pagination_keys, key)?;
                page = Some(parse_positive_decimal_parameter(&value)?);
            }
            "page_size" => {
                reject_duplicate_pagination_key(&mut seen_pagination_keys, key)?;
                page_size = Some(parse_positive_decimal_parameter(&value)?);
            }
            "cursor" => {
                reject_duplicate_pagination_key(&mut seen_pagination_keys, key)?;
                cursor_supplied = true;
            }
            _ => {}
        }
    }

    if cursor_supplied {
        return Err(SdkWorkResultCode::InvalidParameter);
    }

    let resolved_page = page.unwrap_or(1);
    let resolved_page_size = page_size.unwrap_or(20);
    let offset = resolved_page
        .checked_sub(1)
        .and_then(|value| value.checked_mul(resolved_page_size))
        .ok_or(SdkWorkResultCode::InvalidParameter)?;
    if offset > MAX_OFFSET_LIST_OFFSET {
        return Err(SdkWorkResultCode::InvalidParameter);
    }

    validated_offset_list_params(Some(resolved_page), Some(resolved_page_size))
}

fn reject_duplicate_pagination_key(
    seen_keys: &mut HashSet<String>,
    key: String,
) -> Result<(), SdkWorkResultCode> {
    if seen_keys.insert(key) {
        Ok(())
    } else {
        Err(SdkWorkResultCode::InvalidParameter)
    }
}

fn parse_positive_decimal_parameter(value: &str) -> Result<i64, SdkWorkResultCode> {
    if value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(SdkWorkResultCode::InvalidParameter);
    }
    value
        .parse::<i64>()
        .map_err(|_| SdkWorkResultCode::InvalidParameter)
}
/// Authenticated IAM context resolved from `WebRequestContext` (preferred) or request extensions.
#[derive(Clone, Debug)]
pub struct RequiredIamContext(pub IamAppContext);

impl<S> FromRequestParts<S> for RequiredIamContext
where
    S: Send + Sync,
{
    type Rejection = ProblemJsonBody;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        if let Some(web) = parts.extensions.get::<WebRequestContext>() {
            if let Some(iam) = iam_app_context_from_web_request(web) {
                return Ok(RequiredIamContext(iam));
            }
        }

        parts
            .extensions
            .get::<IamAppContext>()
            .cloned()
            .map(RequiredIamContext)
            .ok_or(traced_legacy_problem("4010", "session required", None))
    }
}

pub fn coding_session_context(iam: &IamAppContext) -> CodingSessionContext {
    CodingSessionContext {
        tenant_id: iam.tenant_id.clone(),
        user_id: iam.user_id.clone(),
        session_id: iam.session_id.clone(),
    }
}

pub fn workspace_context(iam: &IamAppContext) -> WorkspaceContext {
    WorkspaceContext {
        tenant_id: iam.tenant_id.clone(),
        user_id: iam.user_id.clone(),
    }
}

pub fn project_context(iam: &IamAppContext) -> ProjectContext {
    ProjectContext {
        tenant_id: iam.tenant_id.clone(),
        user_id: iam.user_id.clone(),
    }
}

pub fn deployment_context(iam: &IamAppContext) -> DeploymentContext {
    DeploymentContext {
        tenant_id: iam.tenant_id.clone(),
        user_id: iam.user_id.clone(),
    }
}

#[cfg(test)]
mod tests {
    use axum::http::Uri;

    use super::*;

    #[test]
    fn strict_offset_pagination_parses_the_standard_wire_parameters() {
        let uri = Uri::from_static("/app/v3/api/intelligence/coding_sessions?page=2&page_size=20");

        let page = strict_offset_list_params(&uri).expect("parse standard pagination");

        assert_eq!(page.page, 2);
        assert_eq!(page.page_size, 20);
        assert_eq!(page.offset, 20);
    }

    #[test]
    fn strict_offset_pagination_rejects_duplicate_alias_and_invalid_values() {
        for query in [
            "?page=1&page=2",
            "?pageSize=20",
            "?limit=20",
            "?offset=20",
            "?page=0",
            "?page_size=0",
            "?page_size=201",
            "?page=1.5",
            "?page=1&cursor=opaque",
        ] {
            let uri: Uri = format!("/app/v3/api/intelligence/coding_sessions{query}")
                .parse()
                .expect("build URI");
            assert!(
                strict_offset_list_params(&uri).is_err(),
                "{query} must be rejected"
            );
        }
    }

    #[test]
    fn strict_offset_pagination_allows_repeated_domain_filters() {
        let uri = Uri::from_static(
            "/app/v3/api/deployments?status=queued&status=running&page=2&page_size=20",
        );

        let page = strict_offset_list_params(&uri).expect("parse repeated domain filters");

        assert_eq!(page.page, 2);
        assert_eq!(page.page_size, 20);
        assert_eq!(page.offset, 20);
    }
}
