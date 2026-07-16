use std::fmt;
use std::io::{self, Read, Write};

use sdkwork_birdcoder_codeengine::{CodeEngineTurnRequestRecord, CodeEngineTurnResultRecord};

pub const MAX_KERNEL_TURN_REQUEST_BYTES: usize = 2 * 1024 * 1024;
pub const MAX_KERNEL_TURN_RESPONSE_BYTES: usize = 4 * 1024 * 1024;

const MAX_KERNEL_TURN_ASSISTANT_CONTENT_BYTES: usize = 2 * 1024 * 1024;
const KERNEL_TURN_READ_CHUNK_BYTES: usize = 8 * 1024;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum KernelTurnIoError {
    AllocationFailed,
    HostBootstrapFailed,
    InvalidRequest,
    OutputWriteFailed,
    RequestReadFailed,
    RequestTooLarge,
    ResponseSerializationFailed,
    ResponseTooLarge,
    TurnExecutionFailed,
}

impl fmt::Display for KernelTurnIoError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::AllocationFailed => "kernel turn memory budget exhausted",
            Self::HostBootstrapFailed => "kernel turn runtime initialization failed",
            Self::InvalidRequest => "kernel turn request is invalid",
            Self::OutputWriteFailed => "kernel turn response write failed",
            Self::RequestReadFailed => "kernel turn request read failed",
            Self::RequestTooLarge => "kernel turn request exceeds maximum size",
            Self::ResponseSerializationFailed => "kernel turn response serialization failed",
            Self::ResponseTooLarge => "kernel turn response exceeds maximum size",
            Self::TurnExecutionFailed => "kernel turn execution failed",
        };
        formatter.write_str(message)
    }
}

impl std::error::Error for KernelTurnIoError {}

pub fn read_bounded_turn_request<R: Read>(
    reader: R,
) -> Result<CodeEngineTurnRequestRecord, KernelTurnIoError> {
    let read_limit = u64::try_from(MAX_KERNEL_TURN_REQUEST_BYTES)
        .ok()
        .and_then(|value| value.checked_add(1))
        .ok_or(KernelTurnIoError::RequestTooLarge)?;
    let mut reader = reader.take(read_limit);
    let mut bytes = Vec::new();
    let mut chunk = [0_u8; KERNEL_TURN_READ_CHUNK_BYTES];

    loop {
        let read = reader
            .read(&mut chunk)
            .map_err(|_| KernelTurnIoError::RequestReadFailed)?;
        if read == 0 {
            break;
        }

        let next_len = bytes
            .len()
            .checked_add(read)
            .ok_or(KernelTurnIoError::RequestTooLarge)?;
        if next_len > MAX_KERNEL_TURN_REQUEST_BYTES {
            return Err(KernelTurnIoError::RequestTooLarge);
        }
        bytes
            .try_reserve_exact(read)
            .map_err(|_| KernelTurnIoError::AllocationFailed)?;
        bytes.extend_from_slice(&chunk[..read]);
    }

    serde_json::from_slice(&bytes).map_err(|_| KernelTurnIoError::InvalidRequest)
}

pub fn serialize_bounded_turn_result(
    result: &CodeEngineTurnResultRecord,
) -> Result<Vec<u8>, KernelTurnIoError> {
    if result.assistant_content.len() > MAX_KERNEL_TURN_ASSISTANT_CONTENT_BYTES {
        return Err(KernelTurnIoError::ResponseTooLarge);
    }

    let mut buffer = BoundedOutputBuffer::new(MAX_KERNEL_TURN_RESPONSE_BYTES);
    let serialization_result = serde_json::to_writer(&mut buffer, result);
    if buffer.limit_exceeded {
        return Err(KernelTurnIoError::ResponseTooLarge);
    }
    if buffer.allocation_failed {
        return Err(KernelTurnIoError::AllocationFailed);
    }
    serialization_result.map_err(|_| KernelTurnIoError::ResponseSerializationFailed)?;
    Ok(buffer.into_inner())
}

struct BoundedOutputBuffer {
    allocation_failed: bool,
    bytes: Vec<u8>,
    limit_exceeded: bool,
    maximum_bytes: usize,
}

impl BoundedOutputBuffer {
    fn new(maximum_bytes: usize) -> Self {
        Self {
            allocation_failed: false,
            bytes: Vec::new(),
            limit_exceeded: false,
            maximum_bytes,
        }
    }

    fn into_inner(self) -> Vec<u8> {
        self.bytes
    }
}

impl Write for BoundedOutputBuffer {
    fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
        let next_len = self
            .bytes
            .len()
            .checked_add(buffer.len())
            .ok_or_else(|| io::Error::other("kernel turn response length overflow"))?;
        if next_len > self.maximum_bytes {
            self.limit_exceeded = true;
            return Err(io::Error::other(
                "kernel turn response exceeds maximum size",
            ));
        }
        if self.bytes.try_reserve_exact(buffer.len()).is_err() {
            self.allocation_failed = true;
            return Err(io::Error::other("kernel turn response allocation failed"));
        }
        self.bytes.extend_from_slice(buffer);
        Ok(buffer.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use sdkwork_birdcoder_codeengine::CodeEngineTurnResultRecord;

    use super::*;

    fn valid_request_json() -> Vec<u8> {
        br#"{
            "engineId": "codex",
            "modelId": "gpt-5-codex",
            "requestKind": "user_message",
            "inputSummary": "hello",
            "config": {
                "ephemeral": false,
                "fullAuto": false,
                "skipGitRepoCheck": false
            }
        }"#
        .to_vec()
    }

    #[test]
    fn reads_a_valid_request_within_the_transport_budget() {
        let request = read_bounded_turn_request(Cursor::new(valid_request_json()))
            .expect("parse bounded kernel turn request");

        assert_eq!(request.engine_id, "codex");
        assert_eq!(request.input_summary, "hello");
    }

    #[test]
    fn rejects_request_larger_than_the_transport_budget_before_json_parsing() {
        let oversized = vec![b' '; MAX_KERNEL_TURN_REQUEST_BYTES + 1];

        assert!(matches!(
            read_bounded_turn_request(Cursor::new(oversized)),
            Err(KernelTurnIoError::RequestTooLarge)
        ));
    }

    #[test]
    fn serializes_a_complete_bounded_response_before_stdout_is_written() {
        let bytes = serialize_bounded_turn_result(&CodeEngineTurnResultRecord {
            assistant_content: "bounded reply".to_owned(),
            native_session_id: Some("session-1".to_owned()),
            commands: None,
            stream_deltas: vec!["bounded ".to_owned(), "reply".to_owned()],
        })
        .expect("serialize bounded kernel turn response");

        let value: serde_json::Value = serde_json::from_slice(&bytes).expect("parse response JSON");
        assert_eq!(value["assistantContent"], "bounded reply");
    }

    #[test]
    fn rejects_a_response_larger_than_the_wire_budget_without_returning_partial_json() {
        let oversized = CodeEngineTurnResultRecord {
            assistant_content: "x".repeat(MAX_KERNEL_TURN_RESPONSE_BYTES + 1),
            native_session_id: None,
            commands: None,
            stream_deltas: Vec::new(),
        };

        assert_eq!(
            serialize_bounded_turn_result(&oversized),
            Err(KernelTurnIoError::ResponseTooLarge)
        );
    }
}
