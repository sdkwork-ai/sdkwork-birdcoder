use std::sync::atomic::{AtomicI64, AtomicU64, Ordering};

static ACTIVE_SSE_CONNECTIONS: AtomicI64 = AtomicI64::new(0);
static ACTIVE_WEBSOCKET_CONNECTIONS: AtomicI64 = AtomicI64::new(0);
static PUBLISH_FAILURES: AtomicU64 = AtomicU64::new(0);
static REPLAY_REQUESTS: AtomicU64 = AtomicU64::new(0);
static REPLAY_EVENTS: AtomicU64 = AtomicU64::new(0);
static REPLAY_FAILURES: AtomicU64 = AtomicU64::new(0);
static LAG_RECOVERIES: AtomicU64 = AtomicU64::new(0);
static SEQUENCE_GAP_RECOVERIES: AtomicU64 = AtomicU64::new(0);

pub(crate) fn connection_opened(websocket: bool) {
    if websocket {
        ACTIVE_WEBSOCKET_CONNECTIONS.fetch_add(1, Ordering::Relaxed);
    } else {
        ACTIVE_SSE_CONNECTIONS.fetch_add(1, Ordering::Relaxed);
    }
}

pub(crate) fn connection_closed(websocket: bool) {
    if websocket {
        ACTIVE_WEBSOCKET_CONNECTIONS.fetch_sub(1, Ordering::Relaxed);
    } else {
        ACTIVE_SSE_CONNECTIONS.fetch_sub(1, Ordering::Relaxed);
    }
}

pub(crate) fn record_publish_failure() {
    PUBLISH_FAILURES.fetch_add(1, Ordering::Relaxed);
}

pub(crate) fn record_replay_request() {
    REPLAY_REQUESTS.fetch_add(1, Ordering::Relaxed);
}

pub(crate) fn record_replay_events(count: usize) {
    REPLAY_EVENTS.fetch_add(count as u64, Ordering::Relaxed);
}

pub(crate) fn record_replay_failure() {
    REPLAY_FAILURES.fetch_add(1, Ordering::Relaxed);
}

pub(crate) fn record_lag_recovery() {
    LAG_RECOVERIES.fetch_add(1, Ordering::Relaxed);
}

pub(crate) fn record_sequence_gap_recovery() {
    SEQUENCE_GAP_RECOVERIES.fetch_add(1, Ordering::Relaxed);
}

pub fn render_workspace_realtime_metrics() -> String {
    format!(
        "# HELP birdcoder_realtime_active_connections Active realtime connections by transport.\n\
         # TYPE birdcoder_realtime_active_connections gauge\n\
         birdcoder_realtime_active_connections{{transport=\"sse\"}} {}\n\
         birdcoder_realtime_active_connections{{transport=\"websocket\"}} {}\n\
         # HELP birdcoder_realtime_publish_failures_total Workspace realtime hub publish failures.\n\
         # TYPE birdcoder_realtime_publish_failures_total counter\n\
         birdcoder_realtime_publish_failures_total {}\n\
         # HELP birdcoder_realtime_replay_requests_total Durable coding-session replay page requests.\n\
         # TYPE birdcoder_realtime_replay_requests_total counter\n\
         birdcoder_realtime_replay_requests_total {}\n\
         # HELP birdcoder_realtime_replay_events_total Durable coding-session events replayed.\n\
         # TYPE birdcoder_realtime_replay_events_total counter\n\
         birdcoder_realtime_replay_events_total {}\n\
         # HELP birdcoder_realtime_replay_failures_total Durable coding-session replay failures.\n\
         # TYPE birdcoder_realtime_replay_failures_total counter\n\
         birdcoder_realtime_replay_failures_total {}\n\
         # HELP birdcoder_realtime_lag_recoveries_total Broadcast lag recoveries through durable replay.\n\
         # TYPE birdcoder_realtime_lag_recoveries_total counter\n\
         birdcoder_realtime_lag_recoveries_total {}\n\
         # HELP birdcoder_realtime_sequence_gap_recoveries_total Sequence-gap recoveries through durable replay.\n\
         # TYPE birdcoder_realtime_sequence_gap_recoveries_total counter\n\
         birdcoder_realtime_sequence_gap_recoveries_total {}\n",
        ACTIVE_SSE_CONNECTIONS.load(Ordering::Relaxed),
        ACTIVE_WEBSOCKET_CONNECTIONS.load(Ordering::Relaxed),
        PUBLISH_FAILURES.load(Ordering::Relaxed),
        REPLAY_REQUESTS.load(Ordering::Relaxed),
        REPLAY_EVENTS.load(Ordering::Relaxed),
        REPLAY_FAILURES.load(Ordering::Relaxed),
        LAG_RECOVERIES.load(Ordering::Relaxed),
        SEQUENCE_GAP_RECOVERIES.load(Ordering::Relaxed),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_bounded_realtime_metric_series() {
        let rendered = render_workspace_realtime_metrics();
        assert!(rendered.contains("transport=\"sse\""));
        assert!(rendered.contains("transport=\"websocket\""));
        assert!(rendered.contains("birdcoder_realtime_replay_failures_total"));
    }
}
