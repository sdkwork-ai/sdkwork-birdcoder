use sqlx::Row;

#[derive(Clone, Debug)]
pub struct MembershipRow {
    pub id: String,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub owner_user_id: String,
    pub plan_id: Option<String>,
    pub plan_name: String,
    pub status: String,
    pub started_at: Option<String>,
    pub expires_at: Option<String>,
    pub remaining_days: String,
    pub total_days: String,
    pub total_spent: String,
    pub points: String,
    pub growth_value: String,
    pub upgrade_growth_value: String,
}

impl MembershipRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row.try_get("is_deleted")?,
            owner_user_id: row.try_get("owner_user_id")?,
            plan_id: row.try_get("plan_id")?,
            plan_name: row.try_get("plan_name")?,
            status: row.try_get("status")?,
            started_at: row.try_get("started_at")?,
            expires_at: row.try_get("expires_at")?,
            remaining_days: row.try_get("remaining_days")?,
            total_days: row.try_get("total_days")?,
            total_spent: row.try_get("total_spent")?,
            points: row.try_get("points")?,
            growth_value: row.try_get("growth_value")?,
            upgrade_growth_value: row.try_get("upgrade_growth_value")?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct MembershipBenefitRow {
    pub id: String,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub membership_id: String,
    pub name: String,
    pub benefit_key: Option<String>,
    pub benefit_type: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub claimed: i64,
    pub usage_limit: Option<String>,
    pub used_count: Option<String>,
}

impl MembershipBenefitRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row.try_get("is_deleted")?,
            membership_id: row.try_get("membership_id")?,
            name: row.try_get("name")?,
            benefit_key: row.try_get("benefit_key")?,
            benefit_type: row.try_get("benefit_type")?,
            description: row.try_get("description")?,
            icon: row.try_get("icon")?,
            claimed: row.try_get("claimed")?,
            usage_limit: row.try_get("usage_limit")?,
            used_count: row.try_get("used_count")?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct PackageGroupRow {
    pub id: String,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub name: String,
    pub description: Option<String>,
    pub sort_weight: String,
}

impl PackageGroupRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row.try_get("is_deleted")?,
            name: row.try_get("name")?,
            description: row.try_get("description")?,
            sort_weight: row.try_get("sort_weight")?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct MembershipPackageRow {
    pub id: String,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub group_id: String,
    pub name: String,
    pub description: Option<String>,
    pub price: String,
    pub original_price: Option<String>,
    pub point_amount: String,
    pub duration_days: String,
    pub plan_name: Option<String>,
    pub sort_weight: String,
    pub recommended: i64,
}

impl MembershipPackageRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row.try_get("is_deleted")?,
            group_id: row.try_get("group_id")?,
            name: row.try_get("name")?,
            description: row.try_get("description")?,
            price: row.try_get("price")?,
            original_price: row.try_get("original_price")?,
            point_amount: row.try_get("point_amount")?,
            duration_days: row.try_get("duration_days")?,
            plan_name: row.try_get("plan_name")?,
            sort_weight: row.try_get("sort_weight")?,
            recommended: row.try_get("recommended")?,
        })
    }
}
