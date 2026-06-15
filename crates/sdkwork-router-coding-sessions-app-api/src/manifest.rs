use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteManifestEntry {
    pub method: String,
    pub path: String,
    pub operation_id: String,
    pub summary: String,
}

pub fn intelligence_app_api_routes() -> Vec<RouteManifestEntry> {
    vec![
        RouteManifestEntry {
            method: "GET".into(),
            path: "/intelligence/coding-sessions".into(),
            operation_id: "listCodingSessions".into(),
            summary: "List coding sessions".into(),
        },
        RouteManifestEntry {
            method: "GET".into(),
            path: "/intelligence/coding-sessions/:session_id".into(),
            operation_id: "getCodingSession".into(),
            summary: "Get a coding session by ID".into(),
        },
        RouteManifestEntry {
            method: "POST".into(),
            path: "/intelligence/coding-sessions".into(),
            operation_id: "createCodingSession".into(),
            summary: "Create a new coding session".into(),
        },
        RouteManifestEntry {
            method: "PATCH".into(),
            path: "/intelligence/coding-sessions/:session_id".into(),
            operation_id: "updateCodingSession".into(),
            summary: "Update an existing coding session".into(),
        },
        RouteManifestEntry {
            method: "DELETE".into(),
            path: "/intelligence/coding-sessions/:session_id".into(),
            operation_id: "deleteCodingSession".into(),
            summary: "Delete a coding session".into(),
        },
        RouteManifestEntry {
            method: "POST".into(),
            path: "/intelligence/coding-sessions/:session_id/fork".into(),
            operation_id: "forkCodingSession".into(),
            summary: "Fork a coding session".into(),
        },
        RouteManifestEntry {
            method: "POST".into(),
            path: "/intelligence/coding-sessions/:session_id/turns".into(),
            operation_id: "createCodingSessionTurn".into(),
            summary: "Create a new turn in a coding session".into(),
        },
        RouteManifestEntry {
            method: "GET".into(),
            path: "/intelligence/coding-sessions/:session_id/events".into(),
            operation_id: "listCodingSessionEvents".into(),
            summary: "List events for a coding session".into(),
        },
        RouteManifestEntry {
            method: "GET".into(),
            path: "/intelligence/coding-sessions/:session_id/artifacts".into(),
            operation_id: "listCodingSessionArtifacts".into(),
            summary: "List artifacts for a coding session".into(),
        },
        RouteManifestEntry {
            method: "GET".into(),
            path: "/intelligence/coding-sessions/:session_id/checkpoints".into(),
            operation_id: "listCodingSessionCheckpoints".into(),
            summary: "List checkpoints for a coding session".into(),
        },
        RouteManifestEntry {
            method: "POST".into(),
            path: "/intelligence/coding-sessions/:session_id/checkpoints/:checkpoint_id/approval"
                .into(),
            operation_id: "submitApprovalDecision".into(),
            summary: "Submit an approval decision for a checkpoint".into(),
        },
        RouteManifestEntry {
            method: "POST".into(),
            path: "/intelligence/coding-sessions/:session_id/questions/:question_id/answer".into(),
            operation_id: "submitUserQuestionAnswer".into(),
            summary: "Submit an answer to a user question".into(),
        },
    ]
}
