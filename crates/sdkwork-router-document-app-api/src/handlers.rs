use axum::extract::Query;
use axum::Json;

use crate::mapper::request::DocumentListQuery;

pub async fn list_documents(
    Query(query): Query<DocumentListQuery>,
) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "todo",
        "items": [],
        "projectId": query.project_id,
    }))
}
