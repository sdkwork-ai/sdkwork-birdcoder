# User VIP Account Java Entity Parity Design

## Goal

Make BirdCoder's user-center, VIP, and account standards strictly match `spring-ai-plus-business-entity` for canonical table names, column names, and local/remote integration boundaries. This is a new application standard, so compatibility columns and BirdCoder-only canonical table fields are not allowed.

## Architecture

Java entities are the source of truth for canonical persistence. BirdCoder keeps only thin app-specific adapters and projections, while reusable auth/user/VIP/account behavior belongs in `sdkwork-appbase`. In this sandboxed session `apps/sdkwork-appbase` is read-only, so BirdCoder will enforce the shared standard with executable contracts and keep its local Rust runtime schema aligned with Java entity tables.

Remote app business capability continues to use `spring-ai-plus-app-api` generated SDKs or the approved appbase wrappers. BirdCoder must not introduce raw HTTP, local SDK forks, duplicate DTO shims, or manual auth-header assembly for app business. Local-only embedded SQLite remains a switchable runtime mode, but its tables must be Java-entity-shaped.

## Canonical Tables

The first strict parity scope covers:

- User and tenant: `plus_tenant`, `plus_user`, `plus_oauth_account`.
- Account: `plus_account`, `plus_account_history`, `plus_account_exchange_config`, `plus_ledger_bridge`.
- VIP: `plus_vip_user`, `plus_vip_level`, `plus_vip_benefit`, `plus_vip_level_benefit`, `plus_vip_pack_group`, `plus_vip_pack`, `plus_vip_recharge_method`, `plus_vip_recharge_pack`, `plus_vip_recharge`, `plus_vip_point_change`, `plus_vip_benefit_usage`.

Common columns from `PlusBaseEntity` are `id`, `uuid`, `tenant_id`, `organization_id`, `data_scope`, `created_at`, `updated_at`, and `version`. `tenant_id`, `organization_id`, and `data_scope` follow `PlusTenantSupportEntity` and are non-null in canonical local tables; local shared scope uses `0` for tenant and organization IDs, and `data_scope` follows Java `PlusDataScopeConverter` physical storage as integer values with `PRIVATE = 1`. BirdCoder's previous `is_deleted` local soft-delete column may remain for local runtime housekeeping, but it is not treated as a Java canonical field. Java `v` is represented as `version` in BirdCoder data contracts because the existing BirdCoder standard already exposes `version`.

## Projection Rule

Fields such as `vip_level_name`, `monthly_credits`, and `seat_limit` are not columns on Java `PlusVipUser`, so they must not be part of the canonical `plus_vip_user` table. UI and API views may derive display names, pack titles, seat counts, and included points from `plus_vip_level`, `plus_vip_pack`, wallet/VIP API responses, or app-specific projections.

## Testing

The contract test must fail if BirdCoder reintroduces non-Java canonical VIP columns or omits Java account/VIP tables. The Rust schema, TypeScript data definitions, and OpenAPI/user-center payloads must be checked together so local-native, app-api-hub, and external-hub modes do not drift.
