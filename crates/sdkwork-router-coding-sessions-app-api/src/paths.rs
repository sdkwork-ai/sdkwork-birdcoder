pub const SESSIONS: &str = "/app/v3/api/intelligence/coding-sessions";
pub const SESSION: &str = "/app/v3/api/intelligence/coding-sessions/{session_id}";
pub const SESSION_FORK: &str = "/app/v3/api/intelligence/coding-sessions/{session_id}/fork";
pub const SESSION_TURNS: &str = "/app/v3/api/intelligence/coding-sessions/{session_id}/turns";
pub const SESSION_EVENTS: &str = "/app/v3/api/intelligence/coding-sessions/{session_id}/events";
pub const SESSION_ARTIFACTS: &str = "/app/v3/api/intelligence/coding-sessions/{session_id}/artifacts";
pub const SESSION_CHECKPOINTS: &str = "/app/v3/api/intelligence/coding-sessions/{session_id}/checkpoints";
pub const APPROVAL_DECISION: &str =
    "/app/v3/api/intelligence/coding-sessions/{session_id}/checkpoints/{checkpoint_id}/approval";
pub const USER_QUESTION_ANSWER: &str =
    "/app/v3/api/intelligence/coding-sessions/{session_id}/questions/{question_id}/answer";
