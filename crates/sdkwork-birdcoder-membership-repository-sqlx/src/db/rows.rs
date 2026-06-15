use rusqlite::Row;

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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            owner_user_id: row.get("owner_user_id")?,
            plan_id: row.get("plan_id")?,
            plan_name: row.get("plan_name")?,
            status: row.get("status")?,
            started_at: row.get("started_at")?,
            expires_at: row.get("expires_at")?,
            remaining_days: row.get("remaining_days")?,
            total_days: row.get("total_days")?,
            total_spent: row.get("total_spent")?,
            points: row.get("points")?,
            growth_value: row.get("growth_value")?,
            upgrade_growth_value: row.get("upgrade_growth_value")?,
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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            membership_id: row.get("membership_id")?,
            name: row.get("name")?,
            benefit_key: row.get("benefit_key")?,
            benefit_type: row.get("benefit_type")?,
            description: row.get("description")?,
            icon: row.get("icon")?,
            claimed: row.get("claimed")?,
            usage_limit: row.get("usage_limit")?,
            used_count: row.get("used_count")?,
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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            name: row.get("name")?,
            description: row.get("description")?,
            sort_weight: row.get("sort_weight")?,
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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            group_id: row.get("group_id")?,
            name: row.get("name")?,
            description: row.get("description")?,
            price: row.get("price")?,
            original_price: row.get("original_price")?,
            point_amount: row.get("point_amount")?,
            duration_days: row.get("duration_days")?,
            plan_name: row.get("plan_name")?,
            sort_weight: row.get("sort_weight")?,
            recommended: row.get("recommended")?,
        })
    }
}
