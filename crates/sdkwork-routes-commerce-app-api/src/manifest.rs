use sdkwork_web_contract::{HttpMethod, HttpRoute};
use sdkwork_web_core::HttpRouteManifest;

use crate::paths;

pub const COMMERCE_APP_API_ROUTES: &[HttpRoute] = &[
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::ORDERS_PATH,
        "commerce",
        "commerce.orders.list",
    )
    .with_required_permission("birdcoder.commerce-orders.read"),
    HttpRoute::dual_token(
        HttpMethod::Post,
        paths::ORDERS_PATH,
        "commerce",
        "commerce.orders.create",
    )
    .with_required_permission("birdcoder.commerce-orders.create"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::ORDER_PATH,
        "commerce",
        "commerce.orders.retrieve",
    )
    .with_required_permission("birdcoder.commerce-orders.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::INVOICES_PATH,
        "commerce",
        "commerce.invoices.list",
    )
    .with_required_permission("birdcoder.commerce-invoices.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::INVOICE_PATH,
        "commerce",
        "commerce.invoices.retrieve",
    )
    .with_required_permission("birdcoder.commerce-invoices.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::PAYMENTS_PATH,
        "commerce",
        "commerce.payments.list",
    )
    .with_required_permission("birdcoder.commerce-payments.read"),
    HttpRoute::dual_token(
        HttpMethod::Post,
        paths::PAYMENTS_PATH,
        "commerce",
        "commerce.payments.create",
    )
    .with_required_permission("birdcoder.commerce-payments.create"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::PAYMENT_PATH,
        "commerce",
        "commerce.payments.retrieve",
    )
    .with_required_permission("birdcoder.commerce-payments.read"),
    HttpRoute::dual_token(
        HttpMethod::Post,
        paths::PAYMENT_CONFIRM_PATH,
        "commerce",
        "commerce.payments.confirm",
    )
    .with_required_permission("birdcoder.commerce-payments.execute"),
];

pub fn commerce_app_api_route_manifest() -> HttpRouteManifest {
    HttpRouteManifest::new(COMMERCE_APP_API_ROUTES)
}
