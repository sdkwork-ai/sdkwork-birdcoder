use std::collections::HashMap;
use std::sync::Arc;

use futures_util::StreamExt;
use redis::AsyncCommands;
use serde_json::json;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

use crate::realtime_config::{realtime_backend_from_env, resolve_redis_config, RealtimeBackendKind};

const REALTIME_CHANNEL_CAPACITY: usize = 256;
pub const MAX_WORKSPACE_REALTIME_SUBSCRIBERS: usize = 64;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RealtimeSubscriberLimitExceeded;

#[derive(Debug)]
pub enum RealtimeHubBootstrapError {
    RedisRequired(String),
    RedisConnect(String),
}

impl std::fmt::Display for RealtimeHubBootstrapError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::RedisRequired(message) | Self::RedisConnect(message) => f.write_str(message),
        }
    }
}

impl std::error::Error for RealtimeHubBootstrapError {}

#[derive(Clone)]
enum HubBackend {
    Memory(MemoryHub),
    Redis(RedisHub),
}

#[derive(Clone)]
struct MemoryHub {
    channels: Arc<RwLock<HashMap<String, broadcast::Sender<String>>>>,
}

#[derive(Clone)]
struct RedisHub {
    publish_client: redis::Client,
    key_prefix: String,
    channels: Arc<RwLock<HashMap<String, broadcast::Sender<String>>>>,
}

#[derive(Clone)]
pub struct WorkspaceRealtimeHub {
    backend: HubBackend,
}

impl WorkspaceRealtimeHub {
    pub fn new() -> Self {
        Self {
            backend: HubBackend::Memory(MemoryHub::new()),
        }
    }

    pub async fn bootstrap() -> Result<Self, RealtimeHubBootstrapError> {
        match realtime_backend_from_env() {
            RealtimeBackendKind::Memory => Ok(Self::new()),
            RealtimeBackendKind::Redis => RedisHub::connect().await.map(|hub| Self {
                backend: HubBackend::Redis(hub),
            }),
        }
    }

    pub async fn subscribe(
        &self,
        workspace_id: &str,
    ) -> Result<broadcast::Receiver<String>, RealtimeSubscriberLimitExceeded> {
        match &self.backend {
            HubBackend::Memory(hub) => hub.subscribe(workspace_id).await,
            HubBackend::Redis(hub) => hub.subscribe(workspace_id).await,
        }
    }

    pub async fn publish(&self, workspace_id: &str, message: &str) {
        match &self.backend {
            HubBackend::Memory(hub) => hub.publish(workspace_id, message).await,
            HubBackend::Redis(hub) => hub.publish(workspace_id, message).await,
        }
    }
}

impl Default for WorkspaceRealtimeHub {
    fn default() -> Self {
        Self::new()
    }
}

impl MemoryHub {
    fn new() -> Self {
        Self {
            channels: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    async fn subscribe(
        &self,
        workspace_id: &str,
    ) -> Result<broadcast::Receiver<String>, RealtimeSubscriberLimitExceeded> {
        let mut channels = self.channels.write().await;
        if let Some(sender) = channels.get(workspace_id) {
            if sender.receiver_count() >= MAX_WORKSPACE_REALTIME_SUBSCRIBERS {
                return Err(RealtimeSubscriberLimitExceeded);
            }
            return Ok(sender.subscribe());
        }

        let (sender, receiver) = broadcast::channel(REALTIME_CHANNEL_CAPACITY);
        channels.insert(workspace_id.to_string(), sender);
        Ok(receiver)
    }

    async fn publish(&self, workspace_id: &str, message: &str) {
        let channels = self.channels.read().await;
        if let Some(sender) = channels.get(workspace_id) {
            let _ = sender.send(message.to_string());
        }
    }
}

impl RedisHub {
    async fn connect() -> Result<Self, RealtimeHubBootstrapError> {
        let config = resolve_redis_config().map_err(|error| {
            RealtimeHubBootstrapError::RedisRequired(format!(
                "SDKWORK_BIRDCODER realtime backend requires Redis configuration: {error}"
            ))
        })?;
        let publish_client = redis::Client::open(config.url.as_str()).map_err(|error| {
            RealtimeHubBootstrapError::RedisConnect(format!(
                "create Redis client for workspace realtime hub failed: {error}"
            ))
        })?;
        let mut probe = publish_client.get_multiplexed_async_connection().await.map_err(
            |error| {
                RealtimeHubBootstrapError::RedisConnect(format!(
                    "connect Redis for workspace realtime hub failed: {error}"
                ))
            },
        )?;
        let _: String = redis::cmd("PING")
            .query_async(&mut probe)
            .await
            .map_err(|error| {
                RealtimeHubBootstrapError::RedisConnect(format!(
                    "Redis ping for workspace realtime hub failed: {error}"
                ))
            })?;

        let channels = Arc::new(RwLock::new(HashMap::new()));
        spawn_redis_forwarder(
            publish_client.clone(),
            config.key_prefix.clone(),
            channels.clone(),
        );

        tracing::info!(
            key_prefix = %config.key_prefix,
            "workspace realtime hub using Redis pub/sub backend"
        );

        Ok(Self {
            publish_client,
            key_prefix: config.key_prefix,
            channels,
        })
    }

    async fn subscribe(
        &self,
        workspace_id: &str,
    ) -> Result<broadcast::Receiver<String>, RealtimeSubscriberLimitExceeded> {
        let mut channels = self.channels.write().await;
        if let Some(sender) = channels.get(workspace_id) {
            if sender.receiver_count() >= MAX_WORKSPACE_REALTIME_SUBSCRIBERS {
                return Err(RealtimeSubscriberLimitExceeded);
            }
            return Ok(sender.subscribe());
        }

        let (sender, receiver) = broadcast::channel(REALTIME_CHANNEL_CAPACITY);
        channels.insert(workspace_id.to_string(), sender);
        Ok(receiver)
    }

    async fn publish(&self, workspace_id: &str, message: &str) {
        let channel = redis_channel_name(&self.key_prefix, workspace_id);
        if let Ok(mut connection) = self.publish_client.get_multiplexed_async_connection().await {
            let _: Result<(), redis::RedisError> = connection.publish(channel, message).await;
        }
    }
}

fn spawn_redis_forwarder(
    client: redis::Client,
    key_prefix: String,
    channels: Arc<RwLock<HashMap<String, broadcast::Sender<String>>>>,
) {
    tokio::spawn(async move {
        loop {
            let Ok(mut pubsub) = client.get_async_pubsub().await else {
                tracing::error!("workspace realtime hub failed to open Redis pub/sub connection");
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                continue;
            };

            let pattern = redis_pattern(&key_prefix);
            if pubsub.psubscribe(pattern.clone()).await.is_err() {
                tracing::error!(
                    pattern = %pattern,
                    "workspace realtime hub failed to subscribe to Redis pattern"
                );
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                continue;
            }

            let mut stream = pubsub.on_message();
            while let Some(message) = stream.next().await {
                let channel = message.get_channel_name();
                let Some(workspace_id) = workspace_id_from_channel(channel, &key_prefix) else {
                    continue;
                };
                let payload = message
                    .get_payload::<String>()
                    .unwrap_or_else(|_| String::new());
                if payload.is_empty() {
                    continue;
                }

                let channels = channels.read().await;
                if let Some(sender) = channels.get(workspace_id) {
                    let _ = sender.send(payload);
                }
            }

            tracing::warn!("workspace realtime hub Redis forwarder disconnected; reconnecting");
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
    });
}

fn redis_channel_name(key_prefix: &str, workspace_id: &str) -> String {
    format!("{key_prefix}:realtime:workspace:{workspace_id}")
}

fn redis_pattern(key_prefix: &str) -> String {
    format!("{key_prefix}:realtime:workspace:*")
}

fn workspace_id_from_channel<'a>(channel: &'a str, key_prefix: &str) -> Option<&'a str> {
    let prefix = format!("{key_prefix}:realtime:workspace:");
    channel.strip_prefix(&prefix)
}

pub fn build_workspace_ready_message(workspace_id: &str, user_id: &str) -> String {
    json!({
        "kind": "ready",
        "workspaceId": workspace_id,
        "userId": user_id,
        "connectedAt": current_rfc3339_timestamp(),
    })
    .to_string()
}

pub fn current_rfc3339_timestamp() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

pub fn new_workspace_realtime_event_id() -> String {
    Uuid::new_v4().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn rejects_subscribers_above_workspace_limit() {
        let hub = WorkspaceRealtimeHub::new();
        let workspace_id = "workspace-subscriber-limit";
        let mut receivers = Vec::new();
        for _ in 0..MAX_WORKSPACE_REALTIME_SUBSCRIBERS {
            receivers.push(
                hub.subscribe(workspace_id)
                    .await
                    .expect("subscribe within limit"),
            );
        }

        assert!(matches!(
            hub.subscribe(workspace_id).await,
            Err(RealtimeSubscriberLimitExceeded)
        ));
    }

    #[test]
    fn parses_workspace_id_from_redis_channel() {
        assert_eq!(
            workspace_id_from_channel("birdcoder:realtime:workspace:ws-123", "birdcoder"),
            Some("ws-123")
        );
    }
}
