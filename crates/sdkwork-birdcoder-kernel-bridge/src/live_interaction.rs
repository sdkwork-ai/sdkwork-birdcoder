//! Live interaction routing (approval / user-question) through the kernel bridge boundary.
//!
//! Agent-side reply execution is owned by sdkwork-kernel; BirdCoder routes product
//! `coding_session` approval/question IDs to the engine transport layer here.

use sdkwork_birdcoder_codeengine::{
    reject_opencode_question_request, reply_opencode_permission_request,
    reply_opencode_question_request, CodeEngineApprovalDecisionRecord,
    CodeEngineUserQuestionAnswerRecord,
};

pub fn submit_approval_decision(
    engine_id: &str,
    decision: &CodeEngineApprovalDecisionRecord,
) -> Result<(), String> {
    match engine_id {
        "opencode" => {
            reply_opencode_permission_request(
                decision.approval_id.as_str(),
                decision.decision.as_str(),
                decision.reason.as_deref(),
            )
        }
        other => Err(format!(
            "engineId \"{other}\" does not support live approval replies through kernel bridge yet."
        )),
    }
}

pub fn submit_user_question_answer(
    engine_id: &str,
    answer: &CodeEngineUserQuestionAnswerRecord,
) -> Result<(), String> {
    match engine_id {
        "opencode" => {
            if answer.rejected {
                return reject_opencode_question_request(answer.question_id.as_str());
            }
            reply_opencode_question_request(
                answer.question_id.as_str(),
                answer.answer.as_str(),
                answer.option_label.as_deref(),
            )
        }
        other => Err(format!(
            "engineId \"{other}\" does not support live user-question replies through kernel bridge yet."
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unsupported_engine_returns_clear_error_for_approval() {
        let err = submit_approval_decision(
            "codex",
            &CodeEngineApprovalDecisionRecord {
                approval_id: "perm-1".to_string(),
                decision: "approve".to_string(),
                ..Default::default()
            },
        )
        .expect_err("codex should not support live approval yet");
        assert!(err.contains("codex"));
    }

    #[test]
    fn unsupported_engine_returns_clear_error_for_question() {
        let err = submit_user_question_answer(
            "claude-code",
            &CodeEngineUserQuestionAnswerRecord {
                question_id: "q-1".to_string(),
                answer: "yes".to_string(),
                rejected: false,
                ..Default::default()
            },
        )
        .expect_err("claude-code should not support live question yet");
        assert!(err.contains("claude-code"));
    }
}
