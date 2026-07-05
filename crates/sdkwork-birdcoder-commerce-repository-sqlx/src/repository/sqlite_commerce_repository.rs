use sqlx::{AnyPool, Row};

use sdkwork_birdcoder_commerce_service::domain::models::{
    CommerceInvoicePayload, CommerceListQuery, CommerceOrderPayload, CommercePaymentPayload,
};
use sdkwork_birdcoder_commerce_service::service::commerce_service::CommerceRepository;

#[derive(Clone)]
pub struct SqliteCommerceRepository {
    pool: AnyPool,
}

impl SqliteCommerceRepository {
    pub fn new(pool: AnyPool) -> Self {
        Self { pool }
    }

    fn numeric_to_string(value: &sqlx::any::AnyRow, column: &str) -> Result<String, sqlx::Error> {
        if let Ok(text) = value.try_get::<String, _>(column) {
            return Ok(text);
        }
        if let Ok(number) = value.try_get::<i64, _>(column) {
            return Ok(number.to_string());
        }
        if let Ok(number) = value.try_get::<f64, _>(column) {
            return Ok(number.to_string());
        }
        value.try_get(column)
    }

    fn map_order_row(row: &sqlx::any::AnyRow) -> Result<CommerceOrderPayload, sqlx::Error> {
        Ok(CommerceOrderPayload {
            id: Self::numeric_to_string(row, "id")?,
            workspace_id: row.try_get("workspace_id").ok(),
            order_no: row.try_get("order_no")?,
            user_id: Self::numeric_to_string(row, "user_id")?,
            package_id: row.try_get("package_id")?,
            amount: Self::numeric_to_string(row, "amount")?,
            currency: row.try_get("currency")?,
            status: row.try_get("status")?,
            paid_at: row.try_get("paid_at").ok(),
            refund_at: row.try_get("refund_at").ok(),
            metadata: row.try_get("metadata")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }

    fn map_invoice_row(row: &sqlx::any::AnyRow) -> Result<CommerceInvoicePayload, sqlx::Error> {
        Ok(CommerceInvoicePayload {
            id: Self::numeric_to_string(row, "id")?,
            invoice_no: row.try_get("invoice_no")?,
            order_id: Self::numeric_to_string(row, "order_id")?,
            user_id: Self::numeric_to_string(row, "user_id")?,
            amount: Self::numeric_to_string(row, "amount")?,
            tax: Self::numeric_to_string(row, "tax")?,
            status: row.try_get("status")?,
            issued_at: row.try_get("issued_at").ok(),
            pdf_url: row.try_get("pdf_url").ok(),
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }

    fn map_payment_row(row: &sqlx::any::AnyRow) -> Result<CommercePaymentPayload, sqlx::Error> {
        Ok(CommercePaymentPayload {
            id: Self::numeric_to_string(row, "id")?,
            payment_no: row.try_get("payment_no")?,
            order_id: Self::numeric_to_string(row, "order_id")?,
            user_id: Self::numeric_to_string(row, "user_id")?,
            channel: row.try_get("channel")?,
            channel_transaction_id: row.try_get("channel_transaction_id").ok(),
            amount: Self::numeric_to_string(row, "amount")?,
            status: row.try_get("status")?,
            paid_at: row.try_get("paid_at").ok(),
            refund_at: row.try_get("refund_at").ok(),
            metadata: row.try_get("metadata")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}

#[async_trait::async_trait]
impl CommerceRepository for SqliteCommerceRepository {
    async fn list_orders(
        &self,
        tenant_id: i64,
        user_id: i64,
        query: &CommerceListQuery,
    ) -> Result<(Vec<CommerceOrderPayload>, i64), String> {
        let count_row = sqlx::query(
            "SELECT COUNT(*) AS total FROM commerce_order \
             WHERE tenant_id = ?1 AND user_id = ?2 AND deleted_at IS NULL",
        )
        .bind(tenant_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        let total: i64 = count_row.try_get("total").map_err(|e| e.to_string())?;

        let rows = sqlx::query(
            "SELECT id, workspace_id, order_no, user_id, package_id, amount, currency, status, \
             paid_at, refund_at, metadata, created_at, updated_at \
             FROM commerce_order \
             WHERE tenant_id = ?1 AND user_id = ?2 AND deleted_at IS NULL \
             ORDER BY created_at DESC LIMIT ?3 OFFSET ?4",
        )
        .bind(tenant_id)
        .bind(user_id)
        .bind(query.limit)
        .bind(query.offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let items = rows
            .iter()
            .map(Self::map_order_row)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok((items, total))
    }

    async fn find_order(
        &self,
        tenant_id: i64,
        user_id: i64,
        order_id: i64,
    ) -> Result<Option<CommerceOrderPayload>, String> {
        let row = sqlx::query(
            "SELECT id, workspace_id, order_no, user_id, package_id, amount, currency, status, \
             paid_at, refund_at, metadata, created_at, updated_at \
             FROM commerce_order \
             WHERE id = ?1 AND tenant_id = ?2 AND user_id = ?3 AND deleted_at IS NULL",
        )
        .bind(order_id)
        .bind(tenant_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        row.as_ref()
            .map(Self::map_order_row)
            .transpose()
            .map_err(|e| e.to_string())
    }

    async fn create_order(
        &self,
        tenant_id: i64,
        user_id: i64,
        order: &CommerceOrderPayload,
    ) -> Result<CommerceOrderPayload, String> {
        let result = sqlx::query(
            "INSERT INTO commerce_order \
             (tenant_id, workspace_id, order_no, user_id, package_id, amount, currency, status, \
             paid_at, refund_at, metadata, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        )
        .bind(tenant_id)
        .bind(&order.workspace_id)
        .bind(&order.order_no)
        .bind(user_id)
        .bind(&order.package_id)
        .bind(&order.amount)
        .bind(&order.currency)
        .bind(&order.status)
        .bind(&order.paid_at)
        .bind(&order.refund_at)
        .bind(&order.metadata)
        .bind(&order.created_at)
        .bind(&order.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let id = result
            .last_insert_id()
            .ok_or_else(|| "created order id unavailable".to_string())?;
        self.find_order(tenant_id, user_id, id)
            .await?
            .ok_or_else(|| "created order could not be loaded".to_string())
    }

    async fn list_invoices(
        &self,
        tenant_id: i64,
        user_id: i64,
        query: &CommerceListQuery,
    ) -> Result<(Vec<CommerceInvoicePayload>, i64), String> {
        let count_row = sqlx::query(
            "SELECT COUNT(*) AS total FROM commerce_invoice \
             WHERE tenant_id = ?1 AND user_id = ?2 AND deleted_at IS NULL",
        )
        .bind(tenant_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        let total: i64 = count_row.try_get("total").map_err(|e| e.to_string())?;

        let rows = sqlx::query(
            "SELECT id, invoice_no, order_id, user_id, amount, tax, status, issued_at, pdf_url, \
             created_at, updated_at \
             FROM commerce_invoice \
             WHERE tenant_id = ?1 AND user_id = ?2 AND deleted_at IS NULL \
             ORDER BY created_at DESC LIMIT ?3 OFFSET ?4",
        )
        .bind(tenant_id)
        .bind(user_id)
        .bind(query.limit)
        .bind(query.offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let items = rows
            .iter()
            .map(Self::map_invoice_row)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok((items, total))
    }

    async fn find_invoice(
        &self,
        tenant_id: i64,
        user_id: i64,
        invoice_id: i64,
    ) -> Result<Option<CommerceInvoicePayload>, String> {
        let row = sqlx::query(
            "SELECT id, invoice_no, order_id, user_id, amount, tax, status, issued_at, pdf_url, \
             created_at, updated_at \
             FROM commerce_invoice \
             WHERE id = ?1 AND tenant_id = ?2 AND user_id = ?3 AND deleted_at IS NULL",
        )
        .bind(invoice_id)
        .bind(tenant_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        row.as_ref()
            .map(Self::map_invoice_row)
            .transpose()
            .map_err(|e| e.to_string())
    }

    async fn list_payments(
        &self,
        tenant_id: i64,
        user_id: i64,
        query: &CommerceListQuery,
    ) -> Result<(Vec<CommercePaymentPayload>, i64), String> {
        let count_row = sqlx::query(
            "SELECT COUNT(*) AS total FROM commerce_payment \
             WHERE tenant_id = ?1 AND user_id = ?2 AND deleted_at IS NULL",
        )
        .bind(tenant_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        let total: i64 = count_row.try_get("total").map_err(|e| e.to_string())?;

        let rows = sqlx::query(
            "SELECT id, payment_no, order_id, user_id, channel, channel_transaction_id, amount, \
             status, paid_at, refund_at, metadata, created_at, updated_at \
             FROM commerce_payment \
             WHERE tenant_id = ?1 AND user_id = ?2 AND deleted_at IS NULL \
             ORDER BY created_at DESC LIMIT ?3 OFFSET ?4",
        )
        .bind(tenant_id)
        .bind(user_id)
        .bind(query.limit)
        .bind(query.offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let items = rows
            .iter()
            .map(Self::map_payment_row)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok((items, total))
    }

    async fn find_payment(
        &self,
        tenant_id: i64,
        user_id: i64,
        payment_id: i64,
    ) -> Result<Option<CommercePaymentPayload>, String> {
        let row = sqlx::query(
            "SELECT id, payment_no, order_id, user_id, channel, channel_transaction_id, amount, \
             status, paid_at, refund_at, metadata, created_at, updated_at \
             FROM commerce_payment \
             WHERE id = ?1 AND tenant_id = ?2 AND user_id = ?3 AND deleted_at IS NULL",
        )
        .bind(payment_id)
        .bind(tenant_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        row.as_ref()
            .map(Self::map_payment_row)
            .transpose()
            .map_err(|e| e.to_string())
    }

    async fn settle_payment(
        &self,
        tenant_id: i64,
        user_id: i64,
        payment: &CommercePaymentPayload,
        invoice: &CommerceInvoicePayload,
        order_id: i64,
        paid_at: &str,
    ) -> Result<CommercePaymentPayload, String> {
        let mut tx = self.pool.begin().await.map_err(|e| e.to_string())?;

        sqlx::query(
            "INSERT INTO commerce_payment \
             (tenant_id, payment_no, order_id, user_id, channel, channel_transaction_id, amount, \
             status, paid_at, refund_at, metadata, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        )
        .bind(tenant_id)
        .bind(&payment.payment_no)
        .bind(order_id)
        .bind(user_id)
        .bind(&payment.channel)
        .bind(&payment.channel_transaction_id)
        .bind(&payment.amount)
        .bind(&payment.status)
        .bind(&payment.paid_at)
        .bind(&payment.refund_at)
        .bind(&payment.metadata)
        .bind(&payment.created_at)
        .bind(&payment.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        let payment_id = sqlx::query("SELECT last_insert_rowid() AS id")
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| e.to_string())?
            .try_get::<i64, _>("id")
            .map_err(|e| e.to_string())?;

        sqlx::query(
            "UPDATE commerce_order SET status = 'paid', paid_at = ?1, updated_at = ?2 \
             WHERE id = ?3 AND tenant_id = ?4 AND user_id = ?5 AND deleted_at IS NULL",
        )
        .bind(paid_at)
        .bind(paid_at)
        .bind(order_id)
        .bind(tenant_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        sqlx::query(
            "INSERT INTO commerce_invoice \
             (tenant_id, invoice_no, order_id, user_id, amount, tax, status, issued_at, pdf_url, \
             created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        )
        .bind(tenant_id)
        .bind(&invoice.invoice_no)
        .bind(order_id)
        .bind(user_id)
        .bind(&invoice.amount)
        .bind(&invoice.tax)
        .bind(&invoice.status)
        .bind(&invoice.issued_at)
        .bind(&invoice.pdf_url)
        .bind(&invoice.created_at)
        .bind(&invoice.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        tx.commit().await.map_err(|e| e.to_string())?;

        self.find_payment(tenant_id, user_id, payment_id)
            .await?
            .ok_or_else(|| "settled payment could not be loaded".to_string())
    }
}
