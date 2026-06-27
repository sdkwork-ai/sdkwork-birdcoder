-- sdkwork:migration
-- id: 0003_commerce_extension
-- engine: sqlite
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    workspace_id TEXT NULL,
    order_no TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    package_id TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL,
    paid_at TEXT NULL,
    refund_at TEXT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT NULL
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    invoice_no TEXT NOT NULL,
    order_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    tax NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    issued_at TEXT NULL,
    pdf_url TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT NULL
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    payment_no TEXT NOT NULL,
    order_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    channel TEXT NOT NULL,
    channel_transaction_id TEXT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    paid_at TEXT NULL,
    refund_at TEXT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT NULL
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    workspace_id TEXT NULL,
    user_id INTEGER NOT NULL,
    metric_type TEXT NOT NULL,
    metric_value NUMERIC NOT NULL DEFAULT 0,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_commerce_usage_metering_tenant_user_created
ON commerce_usage_metering(tenant_id, user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_commerce_usage_metering_tenant_metric_period
ON commerce_usage_metering(tenant_id, metric_type, period_start);

-- ============================================================
-- commerce_api_key (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS commerce_api_key (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    workspace_id TEXT NULL,
    key_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    prefix TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL,
    last_used_at TEXT NULL,
    expires_at TEXT NULL,
    revoked_at TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT NULL
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    workspace_id TEXT NULL,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL,
    read_at TEXT NULL,
    sent_at TEXT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_commerce_notification_tenant_user_created
ON commerce_notification(tenant_id, user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_commerce_notification_tenant_status_created
ON commerce_notification(tenant_id, status, created_at);
