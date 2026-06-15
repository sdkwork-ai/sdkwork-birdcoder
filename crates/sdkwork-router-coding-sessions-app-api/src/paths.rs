pub const SESSIONS: &str = "/intelligence/coding-sessions";
pub const SESSION: &str = "/intelligence/coding-sessions/{session_id}";
pub const SESSION_FORK: &str = "/intelligence/coding-sessions/{session_id}/fork";
pub const SESSION_TURNS: &str = "/intelligence/coding-sessions/{session_id}/turns";
pub const SESSION_EVENTS: &str = "/intelligence/coding-sessions/{session_id}/events";
pub const SESSION_ARTIFACTS: &str = "/intelligence/coding-sessions/{session_id}/artifacts";
pub const SESSION_CHECKPOINTS: &str = "/intelligence/coding-sessions/{session_id}/checkpoints";
pub const APPROVAL_DECISION: &str =
    "/intelligence/coding-sessions/{session_id}/checkpoints/{checkpoint_id}/approval";
pub const USER_QUESTION_ANSWER: &str =
    "/intelligence/coding-sessions/{session_id}/questions/{question_id}/answer";

