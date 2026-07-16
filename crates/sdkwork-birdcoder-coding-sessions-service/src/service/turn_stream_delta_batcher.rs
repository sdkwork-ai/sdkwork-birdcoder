use crate::ports::provider::CodeEngineTurnStreamEvent;

const TURN_STREAM_DELTA_BATCH_MAX_EVENTS: usize = 32;
const TURN_STREAM_DELTA_BATCH_MAX_UTF8_BYTES: usize = 16 * 1024;

/// Coalesces only deltas that are already waiting behind the first received
/// delta. This removes persistence write amplification under backlog without
/// adding a timer or another await to the first-delta path.
pub(super) struct TurnStreamDeltaBatcher {
    receiver: tokio::sync::mpsc::Receiver<CodeEngineTurnStreamEvent>,
    pending: Option<QueuedTurnStreamDelta>,
}

struct QueuedTurnStreamDelta {
    content_delta: String,
    offset: usize,
}

impl QueuedTurnStreamDelta {
    fn new(event: CodeEngineTurnStreamEvent) -> Self {
        Self {
            content_delta: event.content_delta,
            offset: 0,
        }
    }

    fn remaining(&self) -> &str {
        &self.content_delta[self.offset..]
    }
}

impl TurnStreamDeltaBatcher {
    pub(super) fn new(receiver: tokio::sync::mpsc::Receiver<CodeEngineTurnStreamEvent>) -> Self {
        Self {
            receiver,
            pending: None,
        }
    }

    pub(super) async fn recv(&mut self) -> Option<CodeEngineTurnStreamEvent> {
        let first = match self.pending.take() {
            Some(event) => event,
            None => QueuedTurnStreamDelta::new(self.receiver.recv().await?),
        };
        Some(self.coalesce_ready(first))
    }

    pub(super) fn try_recv(
        &mut self,
    ) -> Result<CodeEngineTurnStreamEvent, tokio::sync::mpsc::error::TryRecvError> {
        let first = match self.pending.take() {
            Some(event) => event,
            None => QueuedTurnStreamDelta::new(self.receiver.try_recv()?),
        };
        Ok(self.coalesce_ready(first))
    }

    fn coalesce_ready(&mut self, first: QueuedTurnStreamDelta) -> CodeEngineTurnStreamEvent {
        let mut content_delta = String::with_capacity(
            first
                .remaining()
                .len()
                .min(TURN_STREAM_DELTA_BATCH_MAX_UTF8_BYTES),
        );
        let mut source_event_count = 0;
        let mut candidate = first;

        loop {
            let remaining_bytes =
                TURN_STREAM_DELTA_BATCH_MAX_UTF8_BYTES.saturating_sub(content_delta.len());
            if candidate.remaining().len() <= remaining_bytes {
                content_delta.push_str(candidate.remaining());
                source_event_count += 1;
            } else {
                let split_at = utf8_prefix_boundary(candidate.remaining(), remaining_bytes);
                if split_at > 0 {
                    content_delta.push_str(&candidate.remaining()[..split_at]);
                    candidate.offset += split_at;
                    source_event_count += 1;
                }
                self.pending = Some(candidate);
                break;
            }

            if source_event_count >= TURN_STREAM_DELTA_BATCH_MAX_EVENTS
                || content_delta.len() >= TURN_STREAM_DELTA_BATCH_MAX_UTF8_BYTES
            {
                break;
            }

            candidate = match self.receiver.try_recv() {
                Ok(event) => QueuedTurnStreamDelta::new(event),
                Err(_) => break,
            };
        }

        debug_assert!(source_event_count <= TURN_STREAM_DELTA_BATCH_MAX_EVENTS);
        debug_assert!(content_delta.len() <= TURN_STREAM_DELTA_BATCH_MAX_UTF8_BYTES);
        CodeEngineTurnStreamEvent::assistant_delta(content_delta)
    }
}

fn utf8_prefix_boundary(value: &str, max_bytes: usize) -> usize {
    let mut boundary = value.len().min(max_bytes);
    while boundary > 0 && !value.is_char_boundary(boundary) {
        boundary -= 1;
    }
    boundary
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;

    #[tokio::test]
    async fn coalesces_ready_deltas_without_changing_content_order() {
        let (sender, receiver) = tokio::sync::mpsc::channel(8);
        for delta in ["Hello", " ", "\u{4e16}\u{754c}", "!"] {
            sender
                .send(CodeEngineTurnStreamEvent::assistant_delta(delta.to_owned()))
                .await
                .expect("queue ready provider delta");
        }
        drop(sender);

        let mut batcher = TurnStreamDeltaBatcher::new(receiver);
        let batch = batcher.recv().await.expect("receive coalesced delta");

        assert_eq!(batch.content_delta, "Hello \u{4e16}\u{754c}!");
        assert!(batcher.recv().await.is_none());
    }

    #[tokio::test]
    async fn does_not_wait_for_a_future_delta() {
        let (sender, receiver) = tokio::sync::mpsc::channel(2);
        sender
            .send(CodeEngineTurnStreamEvent::assistant_delta(
                "first".to_owned(),
            ))
            .await
            .expect("queue first provider delta");
        let mut batcher = TurnStreamDeltaBatcher::new(receiver);

        let first = tokio::time::timeout(Duration::from_millis(100), batcher.recv())
            .await
            .expect("an available first delta must not wait for another chunk")
            .expect("receive first provider delta");
        assert_eq!(first.content_delta, "first");

        sender
            .send(CodeEngineTurnStreamEvent::assistant_delta(
                "second".to_owned(),
            ))
            .await
            .expect("queue later provider delta");
        drop(sender);
        assert_eq!(
            batcher
                .recv()
                .await
                .expect("receive later provider delta")
                .content_delta,
            "second"
        );
        assert!(batcher.recv().await.is_none());
    }

    #[tokio::test]
    async fn enforces_source_event_count_limit() {
        let (sender, receiver) = tokio::sync::mpsc::channel(TURN_STREAM_DELTA_BATCH_MAX_EVENTS + 2);
        let deltas = (0..TURN_STREAM_DELTA_BATCH_MAX_EVENTS + 2)
            .map(|index| format!("[{index}]"))
            .collect::<Vec<_>>();
        for delta in &deltas {
            sender
                .send(CodeEngineTurnStreamEvent::assistant_delta(delta.clone()))
                .await
                .expect("queue provider delta");
        }
        drop(sender);

        let mut batcher = TurnStreamDeltaBatcher::new(receiver);
        let first = batcher.recv().await.expect("receive bounded first batch");
        let second = batcher.recv().await.expect("receive remaining batch");

        assert_eq!(
            first.content_delta,
            deltas[..TURN_STREAM_DELTA_BATCH_MAX_EVENTS].concat()
        );
        assert_eq!(
            second.content_delta,
            deltas[TURN_STREAM_DELTA_BATCH_MAX_EVENTS..].concat()
        );
        assert!(batcher.recv().await.is_none());
    }

    #[tokio::test]
    async fn splits_oversized_deltas_on_utf8_boundaries() {
        let original =
            "ab\u{754c}\u{1f642}".repeat(TURN_STREAM_DELTA_BATCH_MAX_UTF8_BYTES / 4 + 17);
        let (sender, receiver) = tokio::sync::mpsc::channel(1);
        sender
            .send(CodeEngineTurnStreamEvent::assistant_delta(original.clone()))
            .await
            .expect("queue oversized provider delta");
        drop(sender);

        let mut batcher = TurnStreamDeltaBatcher::new(receiver);
        let mut reconstructed = String::new();
        let mut batch_count = 0;
        while let Some(batch) = batcher.recv().await {
            assert!(
                batch.content_delta.len() <= TURN_STREAM_DELTA_BATCH_MAX_UTF8_BYTES,
                "every durable realtime frame must respect the UTF-8 byte limit"
            );
            reconstructed.push_str(&batch.content_delta);
            batch_count += 1;
        }

        assert!(
            batch_count > 1,
            "the oversized provider delta must be split"
        );
        assert_eq!(reconstructed, original);
    }

    #[tokio::test]
    async fn drains_deltas_before_terminal_and_interaction_handoff() {
        let (sender, receiver) = tokio::sync::mpsc::channel(4);
        for delta in ["before ", "terminal"] {
            sender
                .send(CodeEngineTurnStreamEvent::assistant_delta(delta.to_owned()))
                .await
                .expect("queue provider delta");
        }
        drop(sender);

        let mut batcher = TurnStreamDeltaBatcher::new(receiver);
        let mut observed = Vec::new();
        while let Ok(batch) = batcher.try_recv() {
            observed.push(("message.delta", batch.content_delta));
        }
        observed.push(("approval.requested", "approval".to_owned()));
        observed.push(("turn.completed", "completed".to_owned()));

        assert_eq!(
            observed,
            vec![
                ("message.delta", "before terminal".to_owned()),
                ("approval.requested", "approval".to_owned()),
                ("turn.completed", "completed".to_owned()),
            ]
        );
    }
}
