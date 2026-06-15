use axum::Json;

pub async fn get_current_membership() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "todo" }))
}

pub async fn list_membership_package_groups() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "todo", "items": [] }))
}
