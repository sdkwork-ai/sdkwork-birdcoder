use std::path::PathBuf;

use axum::Router;
use sdkwork_iam_embedded_application_bootstrap::{
    ensure_tenant_application_from_app_root, resolve_bootstrap_environment,
    EmbeddedApplicationBootstrapOptions,
};

#[derive(Clone, Debug)]
struct BirdCoderIamBootstrapConfig {
    app_root: PathBuf,
    environment: String,
}

fn resolve_birdcoder_iam_bootstrap_config() -> BirdCoderIamBootstrapConfig {
    BirdCoderIamBootstrapConfig {
        app_root: resolve_birdcoder_deployment_app_root(),
        environment: resolve_bootstrap_environment(),
    }
}

fn resolve_birdcoder_deployment_app_root() -> PathBuf {
    resolve_birdcoder_deployment_app_root_with(|key| std::env::var(key).ok())
}

fn resolve_birdcoder_deployment_app_root_with(
    mut read_environment: impl FnMut(&str) -> Option<String>,
) -> PathBuf {
    for key in ["SDKWORK_APP_ROOT", "SDKWORK_BIRDCODER_APP_ROOT"] {
        if let Some(value) = read_environment(key) {
            let path = value.trim();
            if !path.is_empty() {
                return PathBuf::from(path);
            }
        }
    }
    resolve_birdcoder_app_root()
}

async fn ensure_birdcoder_tenant_application_bootstrap(
    bootstrap: &BirdCoderIamBootstrapConfig,
) -> Result<(), String> {
    ensure_tenant_application_from_app_root(
        bootstrap.app_root.as_path(),
        &EmbeddedApplicationBootstrapOptions {
            environment: bootstrap.environment.clone(),
            ..EmbeddedApplicationBootstrapOptions::default()
        },
        None,
        &[],
    )
    .await
}

pub async fn wire_iam_app_router() -> Result<Router, String> {
    let bootstrap = resolve_birdcoder_iam_bootstrap_config();
    sdkwork_iam_database_host::bootstrap_iam_database_from_env()
        .await
        .map_err(|error| format!("failed to bootstrap IAM database lifecycle: {error}"))?;
    ensure_birdcoder_tenant_application_bootstrap(&bootstrap).await?;
    sdkwork_routes_iam_app_api::build_sdkwork_iam_app_api_router().await
}

pub async fn wire_iam_backend_router() -> Router {
    sdkwork_routes_iam_backend_api::build_sdkwork_iam_backend_api_router_from_env().await
}

pub async fn wire_iam_routers() -> Result<Router, String> {
    let app = wire_iam_app_router().await?;
    let backend = wire_iam_backend_router().await;
    Ok(Router::new().merge(app).merge(backend))
}

fn resolve_birdcoder_app_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.."))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    #[test]
    fn birdcoder_app_root_resolves_to_repository_root() {
        let root = resolve_birdcoder_app_root();
        assert!(root.join("sdkwork.app.config.json").is_file());
    }

    #[test]
    fn birdcoder_deployment_root_ignores_the_iam_catalog_root() {
        let environment = BTreeMap::from([
            ("SDKWORK_IAM_APP_ROOT", "D:/sdkwork-iam"),
            ("SDKWORK_BIRDCODER_APP_ROOT", "D:/sdkwork-birdcoder"),
        ]);

        let root = resolve_birdcoder_deployment_app_root_with(|key| {
            environment.get(key).map(|value| (*value).to_owned())
        });

        assert_eq!(root, PathBuf::from("D:/sdkwork-birdcoder"));
    }

    #[test]
    fn birdcoder_deployment_root_prefers_generic_root_and_falls_back_to_repository_root() {
        let environment = BTreeMap::from([
            ("SDKWORK_APP_ROOT", "D:/deployment-root"),
            ("SDKWORK_BIRDCODER_APP_ROOT", "D:/birdcoder-root"),
        ]);

        let selected = resolve_birdcoder_deployment_app_root_with(|key| {
            environment.get(key).map(|value| (*value).to_owned())
        });
        assert_eq!(selected, PathBuf::from("D:/deployment-root"));

        let fallback = resolve_birdcoder_deployment_app_root_with(|_| None);
        assert_eq!(fallback, resolve_birdcoder_app_root());
    }
}
