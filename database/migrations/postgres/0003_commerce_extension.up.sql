-- sdkwork:migration
-- id: 0003_commerce_extension
-- engine: postgres
-- module: birdcoder
-- purpose: Add commerce order/invoice/payment/usage_metering/api_key/notification tables
-- reversible: true
-- transactional: true
-- lock: lightweight
-- contract_version: 1.0.0

-- ============================================================
-- commerce_order (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS commerce_order (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    workspace_id TEXT NULL,
    order_no TEXT NOT NULL,
    user_id BIGINT NOT NULL,
    package_id TEXT NOT NULL,
    amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL,
    paid_at TIMESTAMPTZ NULL,
    refund_at TIMESTAMPTZ NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_commerce_order_tenant_order_no
ON commerce_order(tenant_id, order_no);

CREATE INDEX IF NOT EXISTS idx_commerce_order_tenant_user_created
ON commerce_order(tenant_id, user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_commerce_order_tenant_status_created
ON commerce_order(tenant_id, status, created_at);

-- ============================================================
-- commerce_invoice (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS commerce_invoice (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    invoice_no TEXT NOT NULL,
    order_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    tax NUMERIC(18,4) NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    issued_at TIMESTAMPTZ NULL,
    pdf_url TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_commerce_invoice_tenant_invoice_no
ON commerce_invoice(tenant_id, invoice_no);

CREATE INDEX IF NOT EXISTS idx_commerce_invoice_tenant_user_created
ON commerce_invoice(tenant_id, user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_commerce_invoice_tenant_status_created
ON commerce_invoice(tenant_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_commerce_invoice_tenant_order_id
ON commerce_invoice(tenant_id, order_id);

-- ============================================================
-- commerce_payment (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS commerce_payment (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    payment_no TEXT NOT NULL,
    order_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    channel TEXT NOT NULL,
    channel_transaction_id TEXT NULL,
    amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    paid_at TIMESTAMPTZ NULL,
    refund_at TIMESTAMPTZ NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_commerce_payment_tenant_payment_no
ON commerce_payment(tenant_id, payment_no);

CREATE INDEX IF NOT EXISTS idx_commerce_payment_tenant_user_created
ON commerce_payment(tenant_id, user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_commerce_payment_tenant_status_created
ON commerce_payment(tenant_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_commerce_payment_tenant_order_id
ON commerce_payment(tenant_id, order_id);

-- ============================================================
-- commerce_usage_metering (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS commerce_usage_metering (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    workspace_id TEXT NULL,
    user_id BIGINT NOT NULL,
    metric_type TEXT NOT NULL,
    metric_value NUMERIC(20,4) NOT NULL DEFAULT 0,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_commerce_usage_metering_tenant_user_created
ON commerce_usage_metering(tenant_id, user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_commerce_usage_metering_tenant_metric_period
ON commerce_usage_metering(tenant_id, metric_type, period_start);

-- ============================================================
-- commerce_api_key (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS commerce_api_key (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    workspace_id TEXT NULL,
    key_id TEXT NOT NULL,
    user_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    prefix TEXT NOT NULL,
    scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL,
    last_used_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NULL,
    revoked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_commerce_api_key_tenant_key_id
ON commerce_api_key(tenant_id, key_id);

CREATE INDEX IF NOT EXISTS idx_commerce_api_key_tenant_user_created
ON commerce_api_key(tenant_id, user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_commerce_api_key_tenant_status_created
ON commerce_api_key(tenant_id, status, created_at);

-- ============================================================
-- commerce_notification (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS commerce_notification (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    workspace_id TEXT NULL,
    user_id BIGINT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL,
    read_at TIMESTAMPTZ NULL,
    sent_at TIMESTAMPTZ NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_commerce_notification_tenant_user_created
ON commerce_notification(tenant_id, user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_commerce_notification_tenant_status_created
ON commerce_notification(tenant_id, status, created_at);
