use uuid::Uuid;

use sdkwork_birdcoder_commerce_quota::{parse_numeric_tenant_id, parse_numeric_user_id};
use sdkwork_utils_rust::{is_blank, trim as trim_string};

use crate::context::CommerceContext;
use crate::domain::models::{
    CommerceInvoicePayload, CommerceListQuery, CommerceOrderPayload, CommercePaymentPayload,
    ConfirmPaymentCommand, CreateOrderCommand, CreatePaymentCommand,
};
use crate::error::CommerceError;

const DEFAULT_LIST_LIMIT: i64 = 20;
const MAX_LIST_LIMIT: i64 = 200;
const DEFAULT_CURRENCY: &str = "USD";
const ORDER_STATUS_PENDING: &str = "pending";
const ORDER_STATUS_PAID: &str = "paid";
const PAYMENT_STATUS_PENDING: &str = "pending";
const PAYMENT_STATUS_PAID: &str = "paid";
const INVOICE_STATUS_ISSUED: &str = "issued";
const ORDER_NO_PREFIX: &str = "BCO-";
const PAYMENT_NO_PREFIX: &str = "BCP-";
const INVOICE_NO_PREFIX: &str = "BCI-";

#[async_trait::async_trait]
pub trait CommerceRepository: Send + Sync {
    async fn list_orders(
        &self,
        tenant_id: i64,
        user_id: i64,
        query: &CommerceListQuery,
    ) -> Result<(Vec<CommerceOrderPayload>, i64), String>;

    async fn find_order(
        &self,
        tenant_id: i64,
        user_id: i64,
        order_id: i64,
    ) -> Result<Option<CommerceOrderPayload>, String>;

    async fn create_order(
        &self,
        tenant_id: i64,
        user_id: i64,
        order: &CommerceOrderPayload,
    ) -> Result<CommerceOrderPayload, String>;

    async fn list_invoices(
        &self,
        tenant_id: i64,
        user_id: i64,
        query: &CommerceListQuery,
    ) -> Result<(Vec<CommerceInvoicePayload>, i64), String>;

    async fn find_invoice(
        &self,
        tenant_id: i64,
        user_id: i64,
        invoice_id: i64,
    ) -> Result<Option<CommerceInvoicePayload>, String>;

    async fn list_payments(
        &self,
        tenant_id: i64,
        user_id: i64,
        query: &CommerceListQuery,
    ) -> Result<(Vec<CommercePaymentPayload>, i64), String>;

    async fn find_payment(
        &self,
        tenant_id: i64,
        user_id: i64,
        payment_id: i64,
    ) -> Result<Option<CommercePaymentPayload>, String>;

    async fn create_pending_payment(
        &self,
        tenant_id: i64,
        user_id: i64,
        payment: &CommercePaymentPayload,
        order_id: i64,
    ) -> Result<CommercePaymentPayload, String>;

    async fn settle_payment(
        &self,
        tenant_id: i64,
        user_id: i64,
        payment: &CommercePaymentPayload,
        invoice: &CommerceInvoicePayload,
        order_id: i64,
        paid_at: &str,
    ) -> Result<CommercePaymentPayload, String>;

    async fn finalize_pending_payment(
        &self,
        tenant_id: i64,
        user_id: i64,
        payment_id: i64,
        channel_transaction_id: &str,
        invoice: &CommerceInvoicePayload,
        order_id: i64,
        paid_at: &str,
    ) -> Result<CommercePaymentPayload, String>;
}

#[derive(Clone)]
pub struct CommerceService<R: CommerceRepository> {
    repository: R,
}

impl<R: CommerceRepository> CommerceService<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub async fn list_orders(
        &self,
        ctx: &CommerceContext,
        query: CommerceListQuery,
    ) -> Result<(Vec<CommerceOrderPayload>, i64), CommerceError> {
        let (tenant_id, user_id) = resolve_scope(ctx)?;
        let normalized = normalize_list_query(query);
        self.repository
            .list_orders(tenant_id, user_id, &normalized)
            .await
            .map_err(CommerceError::Repository)
    }

    pub async fn get_order(
        &self,
        ctx: &CommerceContext,
        order_id: &str,
    ) -> Result<CommerceOrderPayload, CommerceError> {
        let (tenant_id, user_id) = resolve_scope(ctx)?;
        let normalized_id = parse_resource_id(order_id, "orderId")?;
        self.repository
            .find_order(tenant_id, user_id, normalized_id)
            .await
            .map_err(CommerceError::Repository)?
            .ok_or_else(|| {
                CommerceError::NotFound(format!("Order \"{order_id}\" was not found."))
            })
    }

    pub async fn create_order(
        &self,
        ctx: &CommerceContext,
        command: CreateOrderCommand,
    ) -> Result<CommerceOrderPayload, CommerceError> {
        let (tenant_id, user_id) = resolve_scope(ctx)?;
        let package_id = normalize_required(&command.package_id)
            .ok_or_else(|| CommerceError::InvalidInput("packageId is required.".to_string()))?;
        let amount = normalize_required(&command.amount)
            .ok_or_else(|| CommerceError::InvalidInput("amount is required.".to_string()))?;
        if amount.parse::<f64>().is_err() {
            return Err(CommerceError::InvalidInput(
                "amount must be a numeric value.".to_string(),
            ));
        }
        let currency = command
            .currency
            .as_deref()
            .map(trim_string)
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| DEFAULT_CURRENCY.to_string());
        let metadata = command
            .metadata
            .as_deref()
            .map(trim_string)
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "{}".to_string());
        let now = now_iso();
        let order = CommerceOrderPayload {
            id: String::new(),
            workspace_id: command
                .workspace_id
                .as_deref()
                .map(trim_string)
                .filter(|value| !value.is_empty()),
            order_no: format!("{ORDER_NO_PREFIX}{}", Uuid::new_v4()),
            user_id: user_id.to_string(),
            package_id,
            amount,
            currency,
            status: ORDER_STATUS_PENDING.to_string(),
            paid_at: None,
            refund_at: None,
            metadata,
            created_at: now.clone(),
            updated_at: now,
        };
        self.repository
            .create_order(tenant_id, user_id, &order)
            .await
            .map_err(CommerceError::Repository)
    }

    pub async fn list_invoices(
        &self,
        ctx: &CommerceContext,
        query: CommerceListQuery,
    ) -> Result<(Vec<CommerceInvoicePayload>, i64), CommerceError> {
        let (tenant_id, user_id) = resolve_scope(ctx)?;
        let normalized = normalize_list_query(query);
        self.repository
            .list_invoices(tenant_id, user_id, &normalized)
            .await
            .map_err(CommerceError::Repository)
    }

    pub async fn get_invoice(
        &self,
        ctx: &CommerceContext,
        invoice_id: &str,
    ) -> Result<CommerceInvoicePayload, CommerceError> {
        let (tenant_id, user_id) = resolve_scope(ctx)?;
        let normalized_id = parse_resource_id(invoice_id, "invoiceId")?;
        self.repository
            .find_invoice(tenant_id, user_id, normalized_id)
            .await
            .map_err(CommerceError::Repository)?
            .ok_or_else(|| {
                CommerceError::NotFound(format!("Invoice \"{invoice_id}\" was not found."))
            })
    }

    pub async fn list_payments(
        &self,
        ctx: &CommerceContext,
        query: CommerceListQuery,
    ) -> Result<(Vec<CommercePaymentPayload>, i64), CommerceError> {
        let (tenant_id, user_id) = resolve_scope(ctx)?;
        let normalized = normalize_list_query(query);
        self.repository
            .list_payments(tenant_id, user_id, &normalized)
            .await
            .map_err(CommerceError::Repository)
    }

    pub async fn get_payment(
        &self,
        ctx: &CommerceContext,
        payment_id: &str,
    ) -> Result<CommercePaymentPayload, CommerceError> {
        let (tenant_id, user_id) = resolve_scope(ctx)?;
        let normalized_id = parse_resource_id(payment_id, "paymentId")?;
        self.repository
            .find_payment(tenant_id, user_id, normalized_id)
            .await
            .map_err(CommerceError::Repository)?
            .ok_or_else(|| {
                CommerceError::NotFound(format!("Payment \"{payment_id}\" was not found."))
            })
    }

    pub async fn create_payment(
        &self,
        ctx: &CommerceContext,
        command: CreatePaymentCommand,
    ) -> Result<CommercePaymentPayload, CommerceError> {
        let (tenant_id, user_id) = resolve_scope(ctx)?;
        let order_id = parse_resource_id(&command.order_id, "orderId")?;
        let channel = normalize_required(&command.channel)
            .ok_or_else(|| CommerceError::InvalidInput("channel is required.".to_string()))?;
        let order = self
            .repository
            .find_order(tenant_id, user_id, order_id)
            .await
            .map_err(CommerceError::Repository)?
            .ok_or_else(|| {
                CommerceError::NotFound(format!("Order \"{}\" was not found.", command.order_id))
            })?;
        if order.user_id != user_id.to_string() {
            return Err(CommerceError::Forbidden(
                "Order is not owned by the current user.".to_string(),
            ));
        }
        if order.status == ORDER_STATUS_PAID {
            return Err(CommerceError::Conflict(
                "Order is already paid.".to_string(),
            ));
        }
        if order.status != ORDER_STATUS_PENDING {
            return Err(CommerceError::Conflict(format!(
                "Order status \"{}\" cannot accept payment.",
                order.status
            )));
        }
        let amount = command
            .amount
            .as_deref()
            .map(trim_string)
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| order.amount.clone());
        if amount.parse::<f64>().is_err() {
            return Err(CommerceError::InvalidInput(
                "amount must be a numeric value.".to_string(),
            ));
        }
        let metadata = command
            .metadata
            .as_deref()
            .map(trim_string)
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "{}".to_string());
        let now = now_iso();
        let channel_transaction_id = command
            .channel_transaction_id
            .as_deref()
            .map(trim_string)
            .filter(|value| !value.is_empty());
        let has_gateway_confirmation = channel_transaction_id.is_some();
        let payment = CommercePaymentPayload {
            id: String::new(),
            payment_no: format!("{PAYMENT_NO_PREFIX}{}", Uuid::new_v4()),
            order_id: order.id.clone(),
            user_id: user_id.to_string(),
            channel,
            channel_transaction_id,
            amount: amount.clone(),
            status: if has_gateway_confirmation {
                PAYMENT_STATUS_PAID.to_string()
            } else {
                PAYMENT_STATUS_PENDING.to_string()
            },
            paid_at: if has_gateway_confirmation {
                Some(now.clone())
            } else {
                None
            },
            refund_at: None,
            metadata,
            created_at: now.clone(),
            updated_at: now.clone(),
        };
        if has_gateway_confirmation {
            let invoice = CommerceInvoicePayload {
                id: String::new(),
                invoice_no: format!("{INVOICE_NO_PREFIX}{}", Uuid::new_v4()),
                order_id: order.id.clone(),
                user_id: user_id.to_string(),
                amount: amount.clone(),
                tax: "0".to_string(),
                status: INVOICE_STATUS_ISSUED.to_string(),
                issued_at: Some(now.clone()),
                pdf_url: None,
                created_at: now.clone(),
                updated_at: now.clone(),
            };
            self.repository
                .settle_payment(tenant_id, user_id, &payment, &invoice, order_id, &now)
                .await
                .map_err(CommerceError::Repository)
        } else {
            self.repository
                .create_pending_payment(tenant_id, user_id, &payment, order_id)
                .await
                .map_err(CommerceError::Repository)
        }
    }

    pub async fn confirm_payment(
        &self,
        ctx: &CommerceContext,
        payment_id: &str,
        command: ConfirmPaymentCommand,
    ) -> Result<CommercePaymentPayload, CommerceError> {
        let (tenant_id, user_id) = resolve_scope(ctx)?;
        let channel_transaction_id = normalize_required(&command.channel_transaction_id).ok_or_else(|| {
            CommerceError::InvalidInput("channelTransactionId is required.".to_string())
        })?;
        let payment_id_num = parse_resource_id(payment_id, "paymentId")?;
        let payment = self
            .repository
            .find_payment(tenant_id, user_id, payment_id_num)
            .await
            .map_err(CommerceError::Repository)?
            .ok_or_else(|| {
                CommerceError::NotFound(format!("Payment \"{payment_id}\" was not found."))
            })?;
        if payment.status == PAYMENT_STATUS_PAID {
            return Err(CommerceError::Conflict(
                "Payment is already settled.".to_string(),
            ));
        }
        if payment.status != PAYMENT_STATUS_PENDING {
            return Err(CommerceError::Conflict(format!(
                "Payment status \"{}\" cannot be confirmed.",
                payment.status
            )));
        }
        let order_id = parse_resource_id(&payment.order_id, "orderId")?;
        let order = self
            .repository
            .find_order(tenant_id, user_id, order_id)
            .await
            .map_err(CommerceError::Repository)?
            .ok_or_else(|| {
                CommerceError::NotFound(format!("Order \"{}\" was not found.", payment.order_id))
            })?;
        if order.status == ORDER_STATUS_PAID {
            return Err(CommerceError::Conflict(
                "Order is already paid.".to_string(),
            ));
        }
        if order.status != ORDER_STATUS_PENDING {
            return Err(CommerceError::Conflict(format!(
                "Order status \"{}\" cannot accept payment confirmation.",
                order.status
            )));
        }
        let now = now_iso();
        let invoice = CommerceInvoicePayload {
            id: String::new(),
            invoice_no: format!("{INVOICE_NO_PREFIX}{}", Uuid::new_v4()),
            order_id: order.id.clone(),
            user_id: user_id.to_string(),
            amount: payment.amount.clone(),
            tax: "0".to_string(),
            status: INVOICE_STATUS_ISSUED.to_string(),
            issued_at: Some(now.clone()),
            pdf_url: None,
            created_at: now.clone(),
            updated_at: now.clone(),
        };
        self.repository
            .finalize_pending_payment(
                tenant_id,
                user_id,
                payment_id_num,
                channel_transaction_id.as_str(),
                &invoice,
                order_id,
                &now,
            )
            .await
            .map_err(CommerceError::Repository)
    }
}

fn resolve_scope(ctx: &CommerceContext) -> Result<(i64, i64), CommerceError> {
    let tenant_id = parse_numeric_tenant_id(&ctx.tenant_id).map_err(|_| {
        CommerceError::InvalidInput("a valid tenant scope is required.".to_string())
    })?;
    let user_id = parse_numeric_user_id(&ctx.user_id).map_err(|_| {
        CommerceError::InvalidInput("a valid user scope is required.".to_string())
    })?;
    Ok((tenant_id, user_id))
}

fn normalize_list_query(query: CommerceListQuery) -> CommerceListQuery {
    let offset = query.offset.max(0);
    let limit = if query.limit <= 0 {
        DEFAULT_LIST_LIMIT
    } else {
        query.limit.min(MAX_LIST_LIMIT)
    };
    CommerceListQuery { offset, limit }
}

fn normalize_required(value: &str) -> Option<String> {
    if is_blank(Some(value)) {
        None
    } else {
        Some(trim_string(value))
    }
}

fn parse_resource_id(value: &str, field: &str) -> Result<i64, CommerceError> {
    let normalized = normalize_required(value)
        .ok_or_else(|| CommerceError::InvalidInput(format!("{field} is required.")))?;
    normalized
        .parse::<i64>()
        .map_err(|_| CommerceError::InvalidInput(format!("{field} must be a numeric id.")))
}

fn now_iso() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Iso8601::DEFAULT)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicI64, Ordering};
    use tokio::sync::Mutex;

    struct MemoryCommerceRepository {
        next_id: AtomicI64,
        orders: Mutex<Vec<CommerceOrderPayload>>,
        invoices: Mutex<Vec<CommerceInvoicePayload>>,
        payments: Mutex<Vec<CommercePaymentPayload>>,
    }

    impl MemoryCommerceRepository {
        fn new() -> Self {
            Self {
                next_id: AtomicI64::new(1),
                orders: Mutex::new(Vec::new()),
                invoices: Mutex::new(Vec::new()),
                payments: Mutex::new(Vec::new()),
            }
        }

        fn next(&self) -> i64 {
            self.next_id.fetch_add(1, Ordering::SeqCst)
        }
    }

    #[async_trait::async_trait]
    impl CommerceRepository for MemoryCommerceRepository {
        async fn list_orders(
            &self,
            _tenant_id: i64,
            user_id: i64,
            query: &CommerceListQuery,
        ) -> Result<(Vec<CommerceOrderPayload>, i64), String> {
            let orders = self.orders.lock().await;
            let items: Vec<_> = orders
                .iter()
                .filter(|order| order.user_id == user_id.to_string())
                .cloned()
                .collect();
            let total = items.len() as i64;
            let start = usize::try_from(query.offset).unwrap_or(0);
            let end = start.saturating_add(usize::try_from(query.limit).unwrap_or(50));
            Ok((
                items.into_iter().skip(start).take(end.saturating_sub(start)).collect(),
                total,
            ))
        }

        async fn find_order(
            &self,
            _tenant_id: i64,
            user_id: i64,
            order_id: i64,
        ) -> Result<Option<CommerceOrderPayload>, String> {
            Ok(self
                .orders
                .lock()
                .await
                .iter()
                .find(|order| order.id == order_id.to_string() && order.user_id == user_id.to_string())
                .cloned())
        }

        async fn create_order(
            &self,
            _tenant_id: i64,
            user_id: i64,
            order: &CommerceOrderPayload,
        ) -> Result<CommerceOrderPayload, String> {
            let mut created = order.clone();
            created.id = self.next().to_string();
            created.user_id = user_id.to_string();
            self.orders.lock().await.push(created.clone());
            Ok(created)
        }

        async fn list_invoices(
            &self,
            _tenant_id: i64,
            user_id: i64,
            query: &CommerceListQuery,
        ) -> Result<(Vec<CommerceInvoicePayload>, i64), String> {
            let invoices = self.invoices.lock().await;
            let items: Vec<_> = invoices
                .iter()
                .filter(|invoice| invoice.user_id == user_id.to_string())
                .cloned()
                .collect();
            let total = items.len() as i64;
            let start = usize::try_from(query.offset).unwrap_or(0);
            let end = start.saturating_add(usize::try_from(query.limit).unwrap_or(50));
            Ok((
                items.into_iter().skip(start).take(end.saturating_sub(start)).collect(),
                total,
            ))
        }

        async fn find_invoice(
            &self,
            _tenant_id: i64,
            user_id: i64,
            invoice_id: i64,
        ) -> Result<Option<CommerceInvoicePayload>, String> {
            Ok(self
                .invoices
                .lock()
                .await
                .iter()
                .find(|invoice| {
                    invoice.id == invoice_id.to_string() && invoice.user_id == user_id.to_string()
                })
                .cloned())
        }

        async fn list_payments(
            &self,
            _tenant_id: i64,
            user_id: i64,
            query: &CommerceListQuery,
        ) -> Result<(Vec<CommercePaymentPayload>, i64), String> {
            let payments = self.payments.lock().await;
            let items: Vec<_> = payments
                .iter()
                .filter(|payment| payment.user_id == user_id.to_string())
                .cloned()
                .collect();
            let total = items.len() as i64;
            let start = usize::try_from(query.offset).unwrap_or(0);
            let end = start.saturating_add(usize::try_from(query.limit).unwrap_or(50));
            Ok((
                items.into_iter().skip(start).take(end.saturating_sub(start)).collect(),
                total,
            ))
        }

        async fn find_payment(
            &self,
            _tenant_id: i64,
            user_id: i64,
            payment_id: i64,
        ) -> Result<Option<CommercePaymentPayload>, String> {
            Ok(self
                .payments
                .lock()
                .await
                .iter()
                .find(|payment| {
                    payment.id == payment_id.to_string() && payment.user_id == user_id.to_string()
                })
                .cloned())
        }

        async fn create_pending_payment(
            &self,
            _tenant_id: i64,
            user_id: i64,
            payment: &CommercePaymentPayload,
            _order_id: i64,
        ) -> Result<CommercePaymentPayload, String> {
            let mut created = payment.clone();
            created.id = self.next().to_string();
            created.user_id = user_id.to_string();
            self.payments.lock().await.push(created.clone());
            Ok(created)
        }

        async fn settle_payment(
            &self,
            _tenant_id: i64,
            user_id: i64,
            payment: &CommercePaymentPayload,
            invoice: &CommerceInvoicePayload,
            order_id: i64,
            paid_at: &str,
        ) -> Result<CommercePaymentPayload, String> {
            let mut created = payment.clone();
            created.id = self.next().to_string();
            created.user_id = user_id.to_string();
            self.payments.lock().await.push(created.clone());

            let mut invoice_created = invoice.clone();
            invoice_created.id = self.next().to_string();
            invoice_created.user_id = user_id.to_string();
            self.invoices.lock().await.push(invoice_created);

            let mut orders = self.orders.lock().await;
            if let Some(order) = orders
                .iter_mut()
                .find(|order| order.id == order_id.to_string())
            {
                order.status = ORDER_STATUS_PAID.to_string();
                order.paid_at = Some(paid_at.to_string());
                order.updated_at = paid_at.to_string();
            }
            Ok(created)
        }

        async fn finalize_pending_payment(
            &self,
            _tenant_id: i64,
            user_id: i64,
            payment_id: i64,
            channel_transaction_id: &str,
            invoice: &CommerceInvoicePayload,
            order_id: i64,
            paid_at: &str,
        ) -> Result<CommercePaymentPayload, String> {
            let mut payments = self.payments.lock().await;
            let payment = payments
                .iter_mut()
                .find(|entry| {
                    entry.id == payment_id.to_string() && entry.user_id == user_id.to_string()
                })
                .ok_or_else(|| "payment not found".to_string())?;
            if payment.status != PAYMENT_STATUS_PENDING {
                return Err("payment is not pending".to_string());
            }
            payment.status = PAYMENT_STATUS_PAID.to_string();
            payment.channel_transaction_id = Some(channel_transaction_id.to_string());
            payment.paid_at = Some(paid_at.to_string());
            payment.updated_at = paid_at.to_string();
            let settled = payment.clone();
            drop(payments);

            let mut invoice_created = invoice.clone();
            invoice_created.id = self.next().to_string();
            invoice_created.user_id = user_id.to_string();
            self.invoices.lock().await.push(invoice_created);

            let mut orders = self.orders.lock().await;
            if let Some(order) = orders
                .iter_mut()
                .find(|order| order.id == order_id.to_string())
            {
                order.status = ORDER_STATUS_PAID.to_string();
                order.paid_at = Some(paid_at.to_string());
                order.updated_at = paid_at.to_string();
            }
            Ok(settled)
        }
    }

    fn owner_context() -> CommerceContext {
        CommerceContext {
            tenant_id: "100001".to_string(),
            user_id: "42".to_string(),
        }
    }

    #[tokio::test]
    async fn create_order_starts_pending_with_order_no_prefix() {
        let service = CommerceService::new(MemoryCommerceRepository::new());
        let order = service
            .create_order(
                &owner_context(),
                CreateOrderCommand {
                    package_id: "pkg-basic".to_string(),
                    amount: "9.99".to_string(),
                    currency: None,
                    workspace_id: None,
                    metadata: None,
                },
            )
            .await
            .expect("order should be created");
        assert!(order.order_no.starts_with(ORDER_NO_PREFIX));
        assert_eq!(order.status, ORDER_STATUS_PENDING);
    }

    #[tokio::test]
    async fn create_payment_without_gateway_confirmation_stays_pending() {
        let service = CommerceService::new(MemoryCommerceRepository::new());
        let order = service
            .create_order(
                &owner_context(),
                CreateOrderCommand {
                    package_id: "pkg-basic".to_string(),
                    amount: "19.99".to_string(),
                    currency: None,
                    workspace_id: None,
                    metadata: None,
                },
            )
            .await
            .expect("order should be created");
        let payment = service
            .create_payment(
                &owner_context(),
                CreatePaymentCommand {
                    order_id: order.id.clone(),
                    channel: "card".to_string(),
                    amount: None,
                    channel_transaction_id: None,
                    metadata: None,
                },
            )
            .await
            .expect("pending payment should be created");
        assert_eq!(payment.status, PAYMENT_STATUS_PENDING);
        assert!(payment.paid_at.is_none());

        let open_order = service
            .get_order(&owner_context(), &order.id)
            .await
            .expect("order should exist");
        assert_eq!(open_order.status, ORDER_STATUS_PENDING);

        let (invoices, total) = service
            .list_invoices(&owner_context(), CommerceListQuery::default())
            .await
            .expect("invoices should list");
        assert_eq!(total, 0);
        assert!(invoices.is_empty());
    }

    #[tokio::test]
    async fn create_payment_settles_order_and_issues_invoice() {
        let service = CommerceService::new(MemoryCommerceRepository::new());
        let order = service
            .create_order(
                &owner_context(),
                CreateOrderCommand {
                    package_id: "pkg-basic".to_string(),
                    amount: "19.99".to_string(),
                    currency: None,
                    workspace_id: None,
                    metadata: None,
                },
            )
            .await
            .expect("order should be created");
        let payment = service
            .create_payment(
                &owner_context(),
                CreatePaymentCommand {
                    order_id: order.id.clone(),
                    channel: "card".to_string(),
                    amount: None,
                    channel_transaction_id: Some("gw_txn_123".to_string()),
                    metadata: None,
                },
            )
            .await
            .expect("payment should settle");
        assert!(payment.payment_no.starts_with(PAYMENT_NO_PREFIX));
        assert_eq!(payment.status, PAYMENT_STATUS_PAID);

        let settled = service
            .get_order(&owner_context(), &order.id)
            .await
            .expect("order should exist");
        assert_eq!(settled.status, ORDER_STATUS_PAID);

        let (invoices, total) = service
            .list_invoices(&owner_context(), CommerceListQuery::default())
            .await
            .expect("invoices should list");
        assert_eq!(total, 1);
        assert!(invoices[0].invoice_no.starts_with(INVOICE_NO_PREFIX));
        assert_eq!(invoices[0].status, INVOICE_STATUS_ISSUED);
    }

    #[tokio::test]
    async fn confirm_payment_settles_pending_payment_and_order() {
        let service = CommerceService::new(MemoryCommerceRepository::new());
        let order = service
            .create_order(
                &owner_context(),
                CreateOrderCommand {
                    package_id: "pkg-basic".to_string(),
                    amount: "19.99".to_string(),
                    currency: None,
                    workspace_id: None,
                    metadata: None,
                },
            )
            .await
            .expect("order should be created");
        let pending = service
            .create_payment(
                &owner_context(),
                CreatePaymentCommand {
                    order_id: order.id.clone(),
                    channel: "card".to_string(),
                    amount: None,
                    channel_transaction_id: None,
                    metadata: None,
                },
            )
            .await
            .expect("pending payment should be created");
        let settled = service
            .confirm_payment(
                &owner_context(),
                pending.id.as_str(),
                ConfirmPaymentCommand {
                    channel_transaction_id: "gw_txn_confirm_456".to_string(),
                },
            )
            .await
            .expect("payment should be confirmed");
        assert_eq!(settled.status, PAYMENT_STATUS_PAID);
        assert_eq!(
            settled.channel_transaction_id.as_deref(),
            Some("gw_txn_confirm_456")
        );

        let paid_order = service
            .get_order(&owner_context(), &order.id)
            .await
            .expect("order should exist");
        assert_eq!(paid_order.status, ORDER_STATUS_PAID);

        let (invoices, total) = service
            .list_invoices(&owner_context(), CommerceListQuery::default())
            .await
            .expect("invoices should list");
        assert_eq!(total, 1);
        assert_eq!(invoices[0].order_id, order.id);
    }
}
