use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use sqlx::AnyPool;

use sdkwork_birdcoder_commerce_repository_sqlx::SqliteCommerceRepository;
use sdkwork_birdcoder_commerce_service::context::CommerceContext;
use sdkwork_birdcoder_commerce_service::domain::models::{
    CommerceInvoicePayload, CommerceListQuery, CommerceOrderPayload, CommercePaymentPayload,
};
use sdkwork_birdcoder_commerce_service::service::commerce_service::CommerceService;
use sdkwork_birdcoder_errors::{
    build_data_envelope, build_offset_list_envelope, trace_id_from_request_id, ApiDataEnvelope,
    ApiListEnvelope,
};
use sdkwork_birdcoder_router_context::{RequiredIamContext, WebRequestContext};
use sdkwork_iam_context_service::IamAppContext;

use crate::error;
use crate::mapper::request::{
    CommerceListQueryParams, CreateOrderBody, CreatePaymentBody,
};

fn request_trace_id(web: &WebRequestContext) -> Option<&str> {
    trace_id_from_request_id(web.request_id.0.as_str())
}

fn request_id(web: &WebRequestContext) -> &str {
    web.request_id.0.as_str()
}

fn commerce_context(iam: &IamAppContext) -> CommerceContext {
    CommerceContext {
        tenant_id: iam.tenant_id.clone(),
        user_id: iam.user_id.clone(),
    }
}

#[derive(Clone)]
pub struct CommerceAppState {
    pub service: CommerceService<SqliteCommerceRepository>,
}

impl CommerceAppState {
    pub fn new(pool: AnyPool) -> Self {
        Self {
            service: CommerceService::new(SqliteCommerceRepository::new(pool)),
        }
    }
}

pub async fn list_orders(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CommerceAppState>,
    Query(query): Query<CommerceListQueryParams>,
) -> Result<Json<ApiListEnvelope<CommerceOrderPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = commerce_context(&iam);
    let list_query: CommerceListQuery = query.into();
    let offset = list_query.offset;
    let limit = list_query.limit;
    match state.service.list_orders(&ctx, list_query).await {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            usize::try_from(offset).unwrap_or(0),
            usize::try_from(limit).unwrap_or(50),
            usize::try_from(total).unwrap_or(0),
            request_id(&web),
        ))),
        Err(service_error) => Err(error::map_service_error(service_error, trace_id)),
    }
}

pub async fn create_order(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CommerceAppState>,
    Json(body): Json<CreateOrderBody>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<CommerceOrderPayload>>), error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = commerce_context(&iam);
    match state.service.create_order(&ctx, body.into()).await {
        Ok(item) => Ok((
            StatusCode::CREATED,
            Json(build_data_envelope(item, request_id(&web))),
        )),
        Err(service_error) => Err(error::map_service_error(service_error, trace_id)),
    }
}

pub async fn get_order(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CommerceAppState>,
    Path(order_id): Path<String>,
) -> Result<Json<ApiDataEnvelope<CommerceOrderPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = commerce_context(&iam);
    match state.service.get_order(&ctx, order_id.as_str()).await {
        Ok(item) => Ok(Json(build_data_envelope(item, request_id(&web)))),
        Err(service_error) => Err(error::map_service_error(service_error, trace_id)),
    }
}

pub async fn list_invoices(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CommerceAppState>,
    Query(query): Query<CommerceListQueryParams>,
) -> Result<Json<ApiListEnvelope<CommerceInvoicePayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = commerce_context(&iam);
    let list_query: CommerceListQuery = query.into();
    let offset = list_query.offset;
    let limit = list_query.limit;
    match state.service.list_invoices(&ctx, list_query).await {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            usize::try_from(offset).unwrap_or(0),
            usize::try_from(limit).unwrap_or(50),
            usize::try_from(total).unwrap_or(0),
            request_id(&web),
        ))),
        Err(service_error) => Err(error::map_service_error(service_error, trace_id)),
    }
}

pub async fn get_invoice(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CommerceAppState>,
    Path(invoice_id): Path<String>,
) -> Result<Json<ApiDataEnvelope<CommerceInvoicePayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = commerce_context(&iam);
    match state
        .service
        .get_invoice(&ctx, invoice_id.as_str())
        .await
    {
        Ok(item) => Ok(Json(build_data_envelope(item, request_id(&web)))),
        Err(service_error) => Err(error::map_service_error(service_error, trace_id)),
    }
}

pub async fn list_payments(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CommerceAppState>,
    Query(query): Query<CommerceListQueryParams>,
) -> Result<Json<ApiListEnvelope<CommercePaymentPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = commerce_context(&iam);
    let list_query: CommerceListQuery = query.into();
    let offset = list_query.offset;
    let limit = list_query.limit;
    match state.service.list_payments(&ctx, list_query).await {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            usize::try_from(offset).unwrap_or(0),
            usize::try_from(limit).unwrap_or(50),
            usize::try_from(total).unwrap_or(0),
            request_id(&web),
        ))),
        Err(service_error) => Err(error::map_service_error(service_error, trace_id)),
    }
}

pub async fn create_payment(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CommerceAppState>,
    Json(body): Json<CreatePaymentBody>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<CommercePaymentPayload>>), error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = commerce_context(&iam);
    match state.service.create_payment(&ctx, body.into()).await {
        Ok(item) => Ok((
            StatusCode::CREATED,
            Json(build_data_envelope(item, request_id(&web))),
        )),
        Err(service_error) => Err(error::map_service_error(service_error, trace_id)),
    }
}

pub async fn get_payment(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CommerceAppState>,
    Path(payment_id): Path<String>,
) -> Result<Json<ApiDataEnvelope<CommercePaymentPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = commerce_context(&iam);
    match state
        .service
        .get_payment(&ctx, payment_id.as_str())
        .await
    {
        Ok(item) => Ok(Json(build_data_envelope(item, request_id(&web)))),
        Err(service_error) => Err(error::map_service_error(service_error, trace_id)),
    }
}
