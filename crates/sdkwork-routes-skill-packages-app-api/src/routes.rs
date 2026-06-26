use axum::{routing::get, routing::post, Router};

use crate::handlers;
use crate::handlers::SkillPackagesAppState;
use crate::paths;

pub fn build_skill_packages_app_router() -> Router<SkillPackagesAppState> {
    Router::new()
        .route(
            paths::SKILL_PACKAGES_PATH,
            get(handlers::list_skill_packages),
        )
        .route(
            paths::SKILL_PACKAGE_INSTALLATIONS_PATH,
            post(handlers::install_skill_package),
        )
        .route(paths::APP_TEMPLATES_PATH, get(handlers::list_app_templates))
}
