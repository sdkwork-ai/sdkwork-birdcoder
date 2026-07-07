use axum::{routing::get, routing::post, Router};

use crate::handlers;
use crate::handlers::CommerceAppState;
use crate::paths;

pub fn build_commerce_app_router() -> Router<CommerceAppState> {
    Router::new()
        .route(paths::ORDERS_PATH, get(handlers::list_orders).post(handlers::create_order))
        .route(paths::ORDER_PATH, get(handlers::get_order))
        .route(paths::INVOICES_PATH, get(handlers::list_invoices))
        .route(paths::INVOICE_PATH, get(handlers::get_invoice))
        .route(
            paths::PAYMENTS_PATH,
            get(handlers::list_payments).post(handlers::create_payment),
        )
        .route(paths::PAYMENT_PATH, get(handlers::get_payment))
        .route(paths::PAYMENT_CONFIRM_PATH, post(handlers::confirm_payment))
}
