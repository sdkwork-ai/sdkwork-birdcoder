-- sdkwork:migration
-- id: 0003_commerce_extension
-- engine: sqlite
-- module: birdcoder
-- purpose: Drop commerce order/invoice/payment/usage_metering/api_key/notification tables
-- reversible: true
-- transactional: true
-- lock: lightweight
-- contract_version: 1.0.0

DROP TABLE IF EXISTS commerce_notification;
DROP TABLE IF EXISTS commerce_api_key;
DROP TABLE IF EXISTS commerce_usage_metering;
DROP TABLE IF EXISTS commerce_payment;
DROP TABLE IF EXISTS commerce_invoice;
DROP TABLE IF EXISTS commerce_order;
