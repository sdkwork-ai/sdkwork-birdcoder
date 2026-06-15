pub mod membership {
    pub const TABLE: &str = "commerce_membership";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const OWNER_USER_ID: &str = "owner_user_id";
    pub const PLAN_ID: &str = "plan_id";
    pub const PLAN_NAME: &str = "plan_name";
    pub const STATUS: &str = "status";
    pub const STARTED_AT: &str = "started_at";
    pub const EXPIRES_AT: &str = "expires_at";
    pub const REMAINING_DAYS: &str = "remaining_days";
    pub const TOTAL_DAYS: &str = "total_days";
    pub const TOTAL_SPENT: &str = "total_spent";
    pub const POINTS: &str = "points";
    pub const GROWTH_VALUE: &str = "growth_value";
    pub const UPGRADE_GROWTH_VALUE: &str = "upgrade_growth_value";
}

pub mod membership_benefit {
    pub const TABLE: &str = "commerce_membership_benefit";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const MEMBERSHIP_ID: &str = "membership_id";
    pub const NAME: &str = "name";
    pub const BENEFIT_KEY: &str = "benefit_key";
    pub const BENEFIT_TYPE: &str = "benefit_type";
    pub const DESCRIPTION: &str = "description";
    pub const ICON: &str = "icon";
    pub const CLAIMED: &str = "claimed";
    pub const USAGE_LIMIT: &str = "usage_limit";
    pub const USED_COUNT: &str = "used_count";
}

pub mod package_group {
    pub const TABLE: &str = "commerce_membership_package_group";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const NAME: &str = "name";
    pub const DESCRIPTION: &str = "description";
    pub const SORT_WEIGHT: &str = "sort_weight";
}

pub mod membership_package {
    pub const TABLE: &str = "commerce_membership_package";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const GROUP_ID: &str = "group_id";
    pub const NAME: &str = "name";
    pub const DESCRIPTION: &str = "description";
    pub const PRICE: &str = "price";
    pub const ORIGINAL_PRICE: &str = "original_price";
    pub const POINT_AMOUNT: &str = "point_amount";
    pub const DURATION_DAYS: &str = "duration_days";
    pub const PLAN_NAME: &str = "plan_name";
    pub const SORT_WEIGHT: &str = "sort_weight";
    pub const RECOMMENDED: &str = "recommended";
}
