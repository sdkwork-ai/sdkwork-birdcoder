//! BirdCoder business metrics registry.
//!
//! Mirrors the hand-rolled `HttpMetricsRegistry` style from `sdkwork-web-core`
//! so business metrics render through the same `/metrics` endpoint without
//! pulling in an external `prometheus` crate. Metric names follow the
//! `birdcoder_*` convention and are exposed alongside the framework's
//! `sdkwork_*` HTTP metrics.

use std::collections::HashMap;
use std::sync::atomic::{AtomicI64, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// Default Prometheus latency histogram buckets (seconds). Matches the
/// OpenTelemetry default duration bucket layout for HTTP/RPC latency.
const LATENCY_BUCKETS_SECONDS: &[f64] = &[
    0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
];
const MAX_LABEL_SERIES_PER_METRIC: usize = 2_048;
const OVERFLOW_LABELS: &str = "overflow=\"true\"";

#[derive(Default)]
struct HistogramStats {
    /// Cumulative bucket counts aligned with `LATENCY_BUCKETS_SECONDS`.
    buckets: Vec<u64>,
    count: u64,
    sum: f64,
}

impl HistogramStats {
    fn observe(&mut self, value_seconds: f64) {
        self.count += 1;
        self.sum += value_seconds;
        if self.buckets.len() != LATENCY_BUCKETS_SECONDS.len() {
            self.buckets.resize(LATENCY_BUCKETS_SECONDS.len(), 0);
        }
        for (index, upper) in LATENCY_BUCKETS_SECONDS.iter().enumerate() {
            if value_seconds <= *upper {
                self.buckets[index] += 1;
            }
        }
    }
}

#[derive(Default)]
struct LabeledHistogram {
    stats: Mutex<HashMap<String, HistogramStats>>,
}

impl LabeledHistogram {
    fn observe(&self, labels: &str, value_seconds: f64) {
        let mut stats = self.stats.lock().expect("business metrics histogram mutex");
        let labels = bounded_labels(&stats, labels);
        stats.entry(labels).or_default().observe(value_seconds);
    }

    fn render(&self, name: &str, help: &str) -> String {
        let stats = self.stats.lock().expect("business metrics histogram mutex");
        if stats.is_empty() {
            return String::new();
        }
        let mut output = format!("# HELP {name} {help}\n# TYPE {name} histogram\n");
        for (labels, stat) in stats.iter() {
            let count = stat.count;
            let sum = stat.sum;
            for (index, upper) in LATENCY_BUCKETS_SECONDS.iter().enumerate() {
                output.push_str(&format!(
                    "{name}_bucket{{{labels},le=\"{upper}\"}} {}\n",
                    stat.buckets.get(index).copied().unwrap_or(0)
                ));
            }
            output.push_str(&format!("{name}_bucket{{{labels},le=\"+Inf\"}} {count}\n"));
            output.push_str(&format!("{name}_count{{{labels}}} {count}\n"));
            output.push_str(&format!("{name}_sum{{{labels}}} {sum}\n"));
        }
        output
    }
}

#[derive(Default)]
struct LabeledCounter {
    counts: Mutex<HashMap<String, u64>>,
}

impl LabeledCounter {
    fn inc(&self, labels: &str) {
        let mut counts = self.counts.lock().expect("business metrics counter mutex");
        let labels = bounded_labels(&counts, labels);
        *counts.entry(labels).or_insert(0) += 1;
    }

    fn render(&self, name: &str, help: &str) -> String {
        let counts = self.counts.lock().expect("business metrics counter mutex");
        if counts.is_empty() {
            return String::new();
        }
        let mut output = format!("# HELP {name} {help}\n# TYPE {name} counter\n");
        for (labels, count) in counts.iter() {
            output.push_str(&format!("{name}{{{labels}}} {count}\n"));
        }
        output
    }
}

fn bounded_labels<T>(series: &HashMap<String, T>, labels: &str) -> String {
    if series.contains_key(labels) || series.len() < MAX_LABEL_SERIES_PER_METRIC - 1 {
        labels.to_owned()
    } else {
        OVERFLOW_LABELS.to_owned()
    }
}

fn escape_label(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Label set builder mirroring `HttpMetricsRegistry` key formatting.
pub struct MetricLabels;

impl MetricLabels {
    pub fn engine(engine: &str) -> String {
        format!("engine=\"{}\"", escape_label(engine))
    }

    pub fn engine_token(engine: &str, token_kind: &str) -> String {
        format!(
            "engine=\"{}\",type=\"{}\"",
            escape_label(engine),
            escape_label(token_kind)
        )
    }

    pub fn api_request(method: &str, route: &str, status: u16) -> String {
        format!(
            "method=\"{}\",route=\"{}\",status=\"{}\"",
            escape_label(method),
            escape_label(route),
            status
        )
    }
}

/// Process-wide registry for BirdCoder business metrics.
///
/// Counters and histograms are registered globally and rendered through the
/// `/metrics` endpoint. The registry is cheap to clone via `Arc`.
#[derive(Default)]
pub struct BusinessMetricsRegistry {
    coding_session_total: AtomicU64,
    turn_total: LabeledCounter,
    session_duration_seconds: LabeledHistogram,
    turn_duration_seconds: LabeledHistogram,
    token_usage_total: LabeledCounter,
    active_sessions: AtomicI64,
    api_request_total: LabeledCounter,
    api_request_duration_seconds: LabeledHistogram,
}

impl BusinessMetricsRegistry {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    /// Records a coding session creation. Increments the session counter and
    /// the active session gauge.
    pub fn record_coding_session_started(&self, engine: &str) {
        self.coding_session_total.fetch_add(1, Ordering::Relaxed);
        self.active_sessions.fetch_add(1, Ordering::Relaxed);
        // Touch the engine-labeled turn counter so the series is declared even
        // before a turn completes.
        self.turn_total.inc(&MetricLabels::engine(engine));
    }

    /// Records a completed coding session duration and decrements the active
    /// session gauge.
    pub fn record_coding_session_completed(&self, duration: Duration) {
        self.active_sessions.fetch_sub(1, Ordering::Relaxed);
        self.session_duration_seconds
            .observe("", duration.as_secs_f64());
    }

    /// Records a completed turn for `engine`, including its latency.
    pub fn record_turn_completed(&self, engine: &str, duration: Duration) {
        let labels = MetricLabels::engine(engine);
        self.turn_total.inc(&labels);
        self.turn_duration_seconds
            .observe(&labels, duration.as_secs_f64());
    }

    /// Records token consumption for `engine` and `token_kind` (`input`/`output`).
    pub fn record_token_usage(&self, engine: &str, token_kind: &str, count: u64) {
        let labels = MetricLabels::engine_token(engine, token_kind);
        let mut counts = self
            .token_usage_total
            .counts
            .lock()
            .expect("business metrics counter mutex");
        let labels = bounded_labels(&counts, &labels);
        *counts.entry(labels).or_insert(0) += count;
    }

    /// Sets the current active session gauge (use when reconciling from a
    /// store-of-truth instead of incrementally tracking start/complete).
    pub fn set_active_sessions(&self, count: i64) {
        self.active_sessions.store(count, Ordering::Relaxed);
    }

    /// Records an API request: total counter plus latency histogram, keyed by
    /// `method`, route template, and `status`.
    pub fn record_api_request(&self, method: &str, route: &str, status: u16, duration: Duration) {
        let labels = MetricLabels::api_request(method, route, status);
        self.api_request_total.inc(&labels);
        self.api_request_duration_seconds
            .observe(&labels, duration.as_secs_f64());
    }

    /// Renders all business metrics in Prometheus text exposition format.
    pub fn render_prometheus(&self) -> String {
        let mut output = format!(
            "# HELP birdcoder_coding_session_total Total coding sessions created.\n\
             # TYPE birdcoder_coding_session_total counter\n\
             birdcoder_coding_session_total {}\n",
            self.coding_session_total.load(Ordering::Relaxed)
        );
        output.push_str(&self.turn_total.render(
            "birdcoder_coding_session_turn_total",
            "Total coding session turns by engine.",
        ));
        output.push_str(&self.session_duration_seconds.render(
            "birdcoder_coding_session_duration_seconds",
            "Coding session duration in seconds.",
        ));
        output.push_str(&self.turn_duration_seconds.render(
            "birdcoder_turn_duration_seconds",
            "Turn execution latency in seconds.",
        ));
        output.push_str(&self.token_usage_total.render(
            "birdcoder_token_usage_total",
            "Token consumption by engine and type.",
        ));
        output.push_str(&format!(
            "# HELP birdcoder_active_sessions Currently active coding sessions.\n\
             # TYPE birdcoder_active_sessions gauge\n\
             birdcoder_active_sessions {}\n",
            self.active_sessions.load(Ordering::Relaxed)
        ));
        output.push_str(&self.api_request_total.render(
            "birdcoder_api_request_total",
            "Total API requests by method, path, and status.",
        ));
        output.push_str(&self.api_request_duration_seconds.render(
            "birdcoder_api_request_duration_seconds",
            "API request latency in seconds.",
        ));
        output
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_start_increments_total_and_active_sessions() {
        let registry = BusinessMetricsRegistry::default();
        registry.record_coding_session_started("codex");
        registry.record_coding_session_started("claude-code");
        let rendered = registry.render_prometheus();
        assert!(rendered.contains("birdcoder_coding_session_total 2"));
        assert!(rendered.contains("birdcoder_active_sessions 2"));
        assert!(rendered.contains("birdcoder_coding_session_turn_total{engine=\"codex\"} 1"));
        assert!(rendered.contains("engine=\"claude-code\""));
    }

    #[test]
    fn session_completed_records_duration_and_decrements_gauge() {
        let registry = BusinessMetricsRegistry::default();
        registry.record_coding_session_started("gemini");
        registry.record_coding_session_completed(Duration::from_millis(750));
        let rendered = registry.render_prometheus();
        assert!(rendered.contains("birdcoder_active_sessions 0"));
        assert!(rendered.contains("birdcoder_coding_session_duration_seconds_count{} 1"));
        // Rust f64 Display formats 1.0 as "1" (no trailing ".0"); aligned with
        // the prometheus crate's standard rendering (le="1", not le="1.0").
        assert!(rendered.contains("birdcoder_coding_session_duration_seconds_bucket{,le=\"1\"} 1"));
        assert!(
            rendered.contains("birdcoder_coding_session_duration_seconds_bucket{,le=\"+Inf\"} 1")
        );
    }

    #[test]
    fn turn_completed_records_counter_and_histogram() {
        let registry = BusinessMetricsRegistry::default();
        registry.record_turn_completed("opencode", Duration::from_millis(120));
        registry.record_turn_completed("opencode", Duration::from_millis(20));
        let rendered = registry.render_prometheus();
        assert!(rendered.contains("birdcoder_coding_session_turn_total{engine=\"opencode\"} 2"));
        assert!(rendered.contains("birdcoder_turn_duration_seconds_count{engine=\"opencode\"} 2"));
        assert!(rendered
            .contains("birdcoder_turn_duration_seconds_bucket{engine=\"opencode\",le=\"0.25\"} 2"));
    }

    #[test]
    fn token_usage_accumulates_by_engine_and_type() {
        let registry = BusinessMetricsRegistry::default();
        registry.record_token_usage("codex", "input", 1200);
        registry.record_token_usage("codex", "input", 300);
        registry.record_token_usage("codex", "output", 450);
        let rendered = registry.render_prometheus();
        assert!(
            rendered.contains("birdcoder_token_usage_total{engine=\"codex\",type=\"input\"} 1500")
        );
        assert!(
            rendered.contains("birdcoder_token_usage_total{engine=\"codex\",type=\"output\"} 450")
        );
    }

    #[test]
    fn api_request_records_counter_and_histogram() {
        let registry = BusinessMetricsRegistry::default();
        registry.record_api_request(
            "GET",
            "/app/v3/api/intelligence/coding_sessions",
            200,
            Duration::from_millis(40),
        );
        registry.record_api_request(
            "POST",
            "/app/v3/api/intelligence/coding_sessions",
            500,
            Duration::from_millis(3000),
        );
        let rendered = registry.render_prometheus();
        assert!(rendered.contains("birdcoder_api_request_total{method=\"GET\",route=\"/app/v3/api/intelligence/coding_sessions\",status=\"200\"} 1"));
        assert!(rendered.contains("birdcoder_api_request_duration_seconds_count{method=\"POST\",route=\"/app/v3/api/intelligence/coding_sessions\",status=\"500\"} 1"));
        assert!(rendered.contains("birdcoder_api_request_duration_seconds_bucket{method=\"GET\",route=\"/app/v3/api/intelligence/coding_sessions\",status=\"200\",le=\"0.05\"} 1"));
    }

    #[test]
    fn caps_metric_label_series_and_aggregates_overflow() {
        let counter = LabeledCounter::default();
        for index in 0..=MAX_LABEL_SERIES_PER_METRIC {
            counter.inc(&format!("series=\"{index}\""));
        }

        let counts = counter.counts.lock().expect("counter lock");
        assert_eq!(counts.len(), MAX_LABEL_SERIES_PER_METRIC);
        assert_eq!(counts.get(OVERFLOW_LABELS), Some(&2));
    }

    #[test]
    fn set_active_sessions_overwrites_gauge() {
        let registry = BusinessMetricsRegistry::default();
        registry.set_active_sessions(42);
        assert!(registry
            .render_prometheus()
            .contains("birdcoder_active_sessions 42"));
    }

    #[test]
    fn label_values_escape_quotes_and_backslashes() {
        let registry = BusinessMetricsRegistry::default();
        registry.record_token_usage("eng\"ine", "in\\put", 1);
        let rendered = registry.render_prometheus();
        assert!(rendered.contains("engine=\"eng\\\"ine\",type=\"in\\\\put\""));
    }
}
