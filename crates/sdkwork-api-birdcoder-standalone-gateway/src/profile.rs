use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use axum::Router;
use sdkwork_api_birdcoder_assembly::bootstrap::config::BirdServerConfig;
use sdkwork_web_bootstrap::{CompositeReadinessCheck, ReadinessCheck};
use sdkwork_web_contract::{route_inventory_from_openapi, route_inventory_from_routes, HttpRoute};
use sdkwork_web_core::{DomainContextInjector, HttpRouteManifest};

const STANDALONE_OPENAPI_TITLE: &str = "SDKWork BirdCoder Standalone App API";

pub(crate) struct StandaloneApiProfile {
    pub router: Router,
    pub route_manifest: HttpRouteManifest,
    pub openapi: serde_json::Value,
    pub permission_catalog: Vec<&'static str>,
    pub domain_context_injectors: Vec<Arc<dyn DomainContextInjector>>,
    pub readiness_check: Arc<dyn ReadinessCheck>,
}

struct OwnerApiContribution {
    owner: &'static str,
    router: Router,
    route_manifest: HttpRouteManifest,
    openapi: serde_json::Value,
    permission_catalog: Vec<&'static str>,
    domain_context_injectors: Vec<Arc<dyn DomainContextInjector>>,
    readiness_check: Arc<dyn ReadinessCheck>,
}

/// Assembles the exact standalone HTTP unit from owner assembly entrypoints.
pub(crate) async fn assemble_standalone_profile(
    config: &BirdServerConfig,
) -> Result<StandaloneApiProfile, String> {
    let birdcoder = sdkwork_api_birdcoder_assembly::assemble_api_router(config)
        .await
        .map_err(|error| format!("assemble BirdCoder owner App API failed: {error}"))?;
    let iam = sdkwork_api_iam_assembly::assemble_app_api_contribution()
        .await
        .map_err(|error| format!("assemble IAM owner App API failed: {error}"))?;
    let agents = sdkwork_api_agents_assembly::assemble_app_api_contribution()
        .await
        .map_err(|error| format!("assemble Agents owner App API failed: {error}"))?;
    let documents = sdkwork_api_documents_assembly::assemble_app_api_contribution()
        .await
        .map_err(|error| format!("assemble Documents owner App API failed: {error}"))?;
    let drive = sdkwork_api_drive_assembly::assemble_app_api_contribution()
        .await
        .map_err(|error| format!("assemble Drive owner App API failed: {error}"))?;
    let membership = sdkwork_api_membership_assembly::assemble_app_api_contribution()
        .await
        .map_err(|error| format!("assemble Membership owner App API failed: {error}"))?;
    let order = sdkwork_api_order_assembly::assemble_app_api_contribution()
        .await
        .map_err(|error| format!("assemble Order owner App API failed: {error}"))?;
    let prompts = sdkwork_api_prompts_assembly::assemble_app_api_contribution()
        .await
        .map_err(|error| format!("assemble Prompts owner App API failed: {error}"))?;
    let skills = sdkwork_api_skills_assembly::assemble_app_api_contribution()
        .await
        .map_err(|error| format!("assemble Skills owner App API failed: {error}"))?;

    compose_owner_contributions(vec![
        OwnerApiContribution {
            owner: "sdkwork-birdcoder",
            router: birdcoder.router,
            route_manifest: birdcoder.route_manifest,
            openapi: birdcoder.openapi,
            permission_catalog: birdcoder.permission_catalog,
            domain_context_injectors: birdcoder.domain_context_injectors,
            readiness_check: birdcoder.readiness_check,
        },
        OwnerApiContribution {
            owner: "sdkwork-iam",
            router: iam.router,
            route_manifest: iam.route_manifest,
            openapi: iam.openapi,
            permission_catalog: iam.permission_catalog,
            domain_context_injectors: iam.domain_context_injectors,
            readiness_check: iam.readiness_check,
        },
        OwnerApiContribution {
            owner: "sdkwork-agents",
            router: agents.router,
            route_manifest: agents.route_manifest,
            openapi: agents.openapi,
            permission_catalog: agents.permission_catalog,
            domain_context_injectors: agents.domain_context_injectors,
            readiness_check: agents.readiness_check,
        },
        OwnerApiContribution {
            owner: "sdkwork-documents",
            router: documents.router,
            route_manifest: documents.route_manifest,
            openapi: documents.openapi,
            permission_catalog: documents.permission_catalog,
            domain_context_injectors: documents.domain_context_injectors,
            readiness_check: documents.readiness_check,
        },
        OwnerApiContribution {
            owner: "sdkwork-drive",
            router: drive.router,
            route_manifest: drive.route_manifest,
            openapi: drive.openapi,
            permission_catalog: drive.permission_catalog,
            domain_context_injectors: drive.domain_context_injectors,
            readiness_check: drive.readiness_check,
        },
        OwnerApiContribution {
            owner: "sdkwork-membership",
            router: membership.router,
            route_manifest: membership.route_manifest,
            openapi: membership.openapi,
            permission_catalog: membership.permission_catalog,
            domain_context_injectors: membership.domain_context_injectors,
            readiness_check: membership.readiness_check,
        },
        OwnerApiContribution {
            owner: "sdkwork-order",
            router: order.router,
            route_manifest: order.route_manifest,
            openapi: order.openapi,
            permission_catalog: order.permission_catalog,
            domain_context_injectors: order.domain_context_injectors,
            readiness_check: order.readiness_check,
        },
        OwnerApiContribution {
            owner: "sdkwork-prompts",
            router: prompts.router,
            route_manifest: prompts.route_manifest,
            openapi: prompts.openapi,
            permission_catalog: prompts.permission_catalog,
            domain_context_injectors: prompts.domain_context_injectors,
            readiness_check: prompts.readiness_check,
        },
        OwnerApiContribution {
            owner: "sdkwork-skills",
            router: skills.router,
            route_manifest: skills.route_manifest,
            openapi: skills.openapi,
            permission_catalog: skills.permission_catalog,
            domain_context_injectors: skills.domain_context_injectors,
            readiness_check: skills.readiness_check,
        },
    ])
}

fn compose_owner_contributions(
    contributions: Vec<OwnerApiContribution>,
) -> Result<StandaloneApiProfile, String> {
    for contribution in &contributions {
        validate_owner_contribution(contribution)?;
    }
    validate_no_route_collisions(&contributions)?;

    let mut router = Router::new();
    let mut routes = Vec::new();
    let mut domain_context_injectors = Vec::new();
    let mut readiness_checks = Vec::new();
    for contribution in contributions {
        router = router.merge(contribution.router);
        routes.extend_from_slice(contribution.route_manifest.routes());
        domain_context_injectors.extend(contribution.domain_context_injectors);
        readiness_checks.push(contribution.readiness_check);
    }

    let route_manifest = HttpRouteManifest::from_owned_routes(routes);
    let openapi = sdkwork_web_contract::build_openapi_document(
        STANDALONE_OPENAPI_TITLE,
        route_manifest.routes(),
    );
    let permission_catalog = permission_catalog(route_manifest.routes());

    Ok(StandaloneApiProfile {
        router,
        route_manifest,
        openapi,
        permission_catalog,
        domain_context_injectors,
        readiness_check: Arc::new(CompositeReadinessCheck::new(readiness_checks)),
    })
}

fn validate_owner_contribution(contribution: &OwnerApiContribution) -> Result<(), String> {
    let manifest_inventory = route_inventory_from_routes(contribution.route_manifest.routes());
    let openapi_inventory =
        route_inventory_from_openapi(&contribution.openapi).map_err(|error| {
            format!(
                "{} OpenAPI inventory is invalid: {error}",
                contribution.owner
            )
        })?;
    if manifest_inventory != openapi_inventory {
        return Err(format!(
            "{} route manifest and OpenAPI inventories differ",
            contribution.owner
        ));
    }

    let expected_permissions = permission_catalog(contribution.route_manifest.routes());
    if contribution.permission_catalog != expected_permissions {
        return Err(format!(
            "{} permission catalog differs from its route manifest",
            contribution.owner
        ));
    }
    Ok(())
}

fn validate_no_route_collisions(contributions: &[OwnerApiContribution]) -> Result<(), String> {
    let mut routes = BTreeMap::<(String, String, String), (&str, String)>::new();
    for contribution in contributions {
        for route in route_inventory_from_routes(contribution.route_manifest.routes()) {
            let identity = (
                route.surface.clone(),
                route.method.clone(),
                route.normalized_path.clone(),
            );
            if let Some((existing_owner, existing_operation)) = routes.insert(
                identity.clone(),
                (contribution.owner, route.operation_id.clone()),
            ) {
                return Err(format!(
                    "route collision for {} {} {}: {} ({}) conflicts with {} ({})",
                    identity.0,
                    identity.1,
                    identity.2,
                    existing_owner,
                    existing_operation,
                    contribution.owner,
                    route.operation_id
                ));
            }
        }
    }
    Ok(())
}

fn permission_catalog(routes: &[HttpRoute]) -> Vec<&'static str> {
    let mut permissions = BTreeSet::new();
    for route in routes {
        if let Some(permission) = route.required_permission {
            permissions.insert(permission);
        }
        if let Some(alternate_permissions) = route.alternate_permissions {
            permissions.extend(alternate_permissions.iter().copied());
        }
    }
    permissions.into_iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use sdkwork_web_bootstrap::AlwaysReady;
    use sdkwork_web_contract::{HttpMethod, RouteAuth};

    const FIRST_ROUTES: &[HttpRoute] = &[HttpRoute::new(
        HttpMethod::Get,
        "/app/v3/api/examples",
        "examples",
        "examples.list",
        RouteAuth::DualToken,
    )
    .with_required_permission("examples.read")];
    const COLLIDING_ROUTES: &[HttpRoute] = &[HttpRoute::new(
        HttpMethod::Get,
        "/app/v3/api/examples/",
        "otherExamples",
        "otherExamples.list",
        RouteAuth::DualToken,
    )
    .with_required_permission("other-examples.read")];

    fn contribution(owner: &'static str, routes: &'static [HttpRoute]) -> OwnerApiContribution {
        OwnerApiContribution {
            owner,
            router: Router::new(),
            route_manifest: HttpRouteManifest::new(routes),
            openapi: sdkwork_web_contract::build_openapi_document(owner, routes),
            permission_catalog: permission_catalog(routes),
            domain_context_injectors: Vec::new(),
            readiness_check: Arc::new(AlwaysReady),
        }
    }

    #[test]
    fn rejects_manifest_openapi_inventory_drift() {
        let mut owner = contribution("owner-a", FIRST_ROUTES);
        owner.openapi = sdkwork_web_contract::build_openapi_document("owner-a", &[]);

        let error = validate_owner_contribution(&owner).expect_err("inventory drift");
        assert!(error.contains("manifest and OpenAPI inventories differ"));
    }

    #[test]
    fn rejects_permission_catalog_drift() {
        let mut owner = contribution("owner-a", FIRST_ROUTES);
        owner.permission_catalog.clear();

        let error = validate_owner_contribution(&owner).expect_err("permission drift");
        assert!(error.contains("permission catalog differs"));
    }

    #[test]
    fn rejects_normalized_cross_owner_route_collisions() {
        let contributions = vec![
            contribution("owner-a", FIRST_ROUTES),
            contribution("owner-b", COLLIDING_ROUTES),
        ];

        let error =
            validate_no_route_collisions(&contributions).expect_err("cross-owner collision");
        assert!(error.contains("route collision"));
        assert!(error.contains("owner-a"));
        assert!(error.contains("owner-b"));
    }

    #[test]
    fn combined_contract_is_derived_from_selected_routes() {
        let profile = compose_owner_contributions(vec![contribution("owner-a", FIRST_ROUTES)])
            .expect("compose selected profile");

        assert_eq!(
            route_inventory_from_routes(profile.route_manifest.routes()),
            route_inventory_from_openapi(&profile.openapi).expect("combined OpenAPI inventory")
        );
        assert_eq!(profile.permission_catalog, ["examples.read"]);
    }
}
