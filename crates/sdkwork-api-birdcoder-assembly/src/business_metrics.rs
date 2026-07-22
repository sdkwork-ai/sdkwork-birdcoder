//! Bounded BirdCoder HTTP metrics for the coding-workbench API.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

const LATENCY_BUCKETS_SECONDS: &[f64] = &[
    0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
];
const MAX_LABEL_SERIES_PER_METRIC: usize = 2_048;
const OVERFLOW_LABELS: &str = "overflow=\"true\"";

#[derive(Default)]
struct HistogramStats {
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
        let mut stats = self.stats.lock().expect("metrics histogram mutex");
        let labels = bounded_labels(&stats, labels);
        stats.entry(labels).or_default().observe(value_seconds);
    }

    fn render(&self, name: &str, help: &str) -> String {
        let stats = self.stats.lock().expect("metrics histogram mutex");
        if stats.is_empty() {
            return String::new();
        }
        let mut output = format!("# HELP {name} {help}\n# TYPE {name} histogram\n");
        for (labels, stat) in stats.iter() {
            for (index, upper) in LATENCY_BUCKETS_SECONDS.iter().enumerate() {
                output.push_str(&format!(
                    "{name}_bucket{{{labels},le=\"{upper}\"}} {}\n",
                    stat.buckets.get(index).copied().unwrap_or_default()
                ));
            }
            output.push_str(&format!(
                "{name}_bucket{{{labels},le=\"+Inf\"}} {}\n{name}_count{{{labels}}} {}\n{name}_sum{{{labels}}} {}\n",
                stat.count, stat.count, stat.sum
            ));
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
        let mut counts = self.counts.lock().expect("metrics counter mutex");
        let labels = bounded_labels(&counts, labels);
        *counts.entry(labels).or_default() += 1;
    }

    fn render(&self, name: &str, help: &str) -> String {
        let counts = self.counts.lock().expect("metrics counter mutex");
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

fn request_labels(method: &str, route: &str, status: u16) -> String {
    format!(
        "method=\"{}\",route=\"{}\",status=\"{}\"",
        escape_label(method),
        escape_label(route),
        status
    )
}

#[derive(Default)]
pub struct BusinessMetricsRegistry {
    api_request_total: LabeledCounter,
    api_request_duration_seconds: LabeledHistogram,
}

impl BusinessMetricsRegistry {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    pub fn record_api_request(&self, method: &str, route: &str, status: u16, duration: Duration) {
        let labels = request_labels(method, route, status);
        self.api_request_total.inc(&labels);
        self.api_request_duration_seconds
            .observe(&labels, duration.as_secs_f64());
    }

    pub fn render_prometheus(&self) -> String {
        let mut output = self.api_request_total.render(
            "birdcoder_workbench_api_request_total",
            "Total BirdCoder workbench API requests by method, route, and status.",
        );
        output.push_str(&self.api_request_duration_seconds.render(
            "birdcoder_workbench_api_request_duration_seconds",
            "BirdCoder workbench API request latency in seconds.",
        ));
        output
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn records_only_workbench_http_dimensions() {
        let registry = BusinessMetricsRegistry::default();
        registry.record_api_request(
            "GET",
            "/app/v3/api/projects/{projectId}",
            200,
            Duration::from_millis(40),
        );
        let rendered = registry.render_prometheus();
        assert!(rendered.contains("birdcoder_workbench_api_request_total"));
        assert!(rendered.contains("route=\"/app/v3/api/projects/{projectId}\""));
        assert!(!rendered.contains("coding_session"));
    }

    #[test]
    fn caps_metric_label_cardinality() {
        let counter = LabeledCounter::default();
        for index in 0..=MAX_LABEL_SERIES_PER_METRIC {
            counter.inc(&format!("series=\"{index}\""));
        }
        let counts = counter.counts.lock().expect("counter lock");
        assert_eq!(counts.len(), MAX_LABEL_SERIES_PER_METRIC);
        assert_eq!(counts.get(OVERFLOW_LABELS), Some(&2));
    }
}
