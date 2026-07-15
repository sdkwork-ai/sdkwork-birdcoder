pub const SESSIONS: &str = "/app/v3/api/intelligence/coding_sessions";
pub const SESSION: &str = "/app/v3/api/intelligence/coding_sessions/{sessionId}";
pub const SESSION_FORK: &str = "/app/v3/api/intelligence/coding_sessions/{sessionId}/fork";
pub const SESSION_TURNS: &str = "/app/v3/api/intelligence/coding_sessions/{sessionId}/turns";
pub const SESSION_MESSAGE: &str =
    "/app/v3/api/intelligence/coding_sessions/{sessionId}/messages/{messageId}";
pub const SESSION_EVENTS: &str = "/app/v3/api/intelligence/coding_sessions/{sessionId}/events";
pub const SESSION_ARTIFACTS: &str =
    "/app/v3/api/intelligence/coding_sessions/{sessionId}/artifacts";
pub const SESSION_CHECKPOINTS: &str =
    "/app/v3/api/intelligence/coding_sessions/{sessionId}/checkpoints";
pub const APPROVAL_DECISION: &str =
    "/app/v3/api/intelligence/coding_sessions/{sessionId}/checkpoints/{checkpointId}/approval";
pub const USER_QUESTION_ANSWER: &str =
    "/app/v3/api/intelligence/coding_sessions/{sessionId}/questions/{questionId}/answer";
