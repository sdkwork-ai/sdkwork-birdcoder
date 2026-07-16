use std::collections::HashMap;
use std::hash::Hash;
use std::sync::{Arc, Mutex as StdMutex, RwLock as StdRwLock};

use futures_util::StreamExt;
use redis::AsyncCommands;
use serde_json::json;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

use crate::realtime_config::{
    realtime_backend_from_env, resolve_redis_config, RealtimeBackendKind,
};
use crate::realtime_metrics::record_publish_failure;

const REALTIME_CHANNEL_CAPACITY: usize = 256;
pub const MAX_WORKSPACE_REALTIME_SUBSCRIBERS: usize = 64;
pub const MAX_WORKSPACE_REALTIME_CHANNELS: usize = 4_096;

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
enum WorkspaceRealtimeChannel {
    Public {
        tenant_id: String,
        workspace_id: String,
    },
    UserInventory {
        tenant_id: String,
        user_id: String,
        workspace_id: String,
    },
    Session {
        tenant_id: String,
        user_id: String,
        workspace_id: String,
        coding_session_id: String,
    },
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct WorkspaceRealtimeScope {
    tenant_id: String,
    workspace_id: String,
}

impl WorkspaceRealtimeChannel {
    fn public(tenant_id: &str, workspace_id: &str) -> Self {
        Self::Public {
            tenant_id: tenant_id.to_owned(),
            workspace_id: workspace_id.to_owned(),
        }
    }

    fn user_inventory(tenant_id: &str, user_id: &str, workspace_id: &str) -> Self {
        Self::UserInventory {
            tenant_id: tenant_id.to_owned(),
            user_id: user_id.to_owned(),
            workspace_id: workspace_id.to_owned(),
        }
    }

    fn session(
        tenant_id: &str,
        user_id: &str,
        workspace_id: &str,
        coding_session_id: &str,
    ) -> Self {
        Self::Session {
            tenant_id: tenant_id.to_owned(),
            user_id: user_id.to_owned(),
            workspace_id: workspace_id.to_owned(),
            coding_session_id: coding_session_id.to_owned(),
        }
    }

    fn workspace_scope(&self) -> WorkspaceRealtimeScope {
        match self {
            Self::Public {
                tenant_id,
                workspace_id,
            }
            | Self::UserInventory {
                tenant_id,
                workspace_id,
                ..
            }
            | Self::Session {
                tenant_id,
                workspace_id,
                ..
            } => WorkspaceRealtimeScope {
                tenant_id: tenant_id.clone(),
                workspace_id: workspace_id.clone(),
            },
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
enum RedisRealtimeChannelRoute {
    Active(WorkspaceRealtimeChannel),
    LegacyPublic,
}

type RealtimeChannels = HashMap<WorkspaceRealtimeChannel, broadcast::Sender<String>>;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RealtimeSubscriberLimitExceeded;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RealtimePublishError(pub String);

pub struct WorkspaceRealtimeSubscription {
    receiver: broadcast::Receiver<String>,
    _connection_permit: Arc<WorkspaceRealtimeConnectionPermit>,
}

impl WorkspaceRealtimeSubscription {
    pub async fn recv(&mut self) -> Result<String, broadcast::error::RecvError> {
        self.receiver.recv().await
    }
}

type WorkspaceRealtimeConnectionCounts = HashMap<WorkspaceRealtimeScope, usize>;

struct WorkspaceRealtimeConnectionPermit {
    counts: Arc<StdMutex<WorkspaceRealtimeConnectionCounts>>,
    scope: WorkspaceRealtimeScope,
}

impl Drop for WorkspaceRealtimeConnectionPermit {
    fn drop(&mut self) {
        let mut counts = self
            .counts
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let Some(count) = counts.get_mut(&self.scope) else {
            return;
        };
        *count = count.saturating_sub(1);
        if *count == 0 {
            counts.remove(&self.scope);
        }
    }
}

fn acquire_connection_permit(
    counts: &Arc<StdMutex<WorkspaceRealtimeConnectionCounts>>,
    scope: WorkspaceRealtimeScope,
) -> Result<Arc<WorkspaceRealtimeConnectionPermit>, RealtimeSubscriberLimitExceeded> {
    let mut locked = counts
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let count = locked.entry(scope.clone()).or_default();
    if *count >= MAX_WORKSPACE_REALTIME_SUBSCRIBERS {
        return Err(RealtimeSubscriberLimitExceeded);
    }
    *count += 1;
    drop(locked);
    Ok(Arc::new(WorkspaceRealtimeConnectionPermit {
        counts: counts.clone(),
        scope,
    }))
}

fn attach_connection_permit(
    receiver: broadcast::Receiver<String>,
    connection_permit: Arc<WorkspaceRealtimeConnectionPermit>,
) -> WorkspaceRealtimeSubscription {
    WorkspaceRealtimeSubscription {
        receiver,
        _connection_permit: connection_permit,
    }
}

impl std::fmt::Display for RealtimePublishError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.0.as_str())
    }
}

impl std::error::Error for RealtimePublishError {}

fn remove_inactive_channels<K>(channels: &mut HashMap<K, broadcast::Sender<String>>)
where
    K: Eq + Hash,
{
    channels.retain(|_, sender| sender.receiver_count() > 0);
}

fn ensure_subscription_capacity(
    channels: &RealtimeChannels,
    requested: &[&WorkspaceRealtimeChannel],
) -> Result<(), RealtimeSubscriberLimitExceeded> {
    if requested.iter().any(|channel| {
        channels
            .get(*channel)
            .is_some_and(|sender| sender.receiver_count() >= MAX_WORKSPACE_REALTIME_SUBSCRIBERS)
    }) {
        return Err(RealtimeSubscriberLimitExceeded);
    }
    let missing_channels = requested
        .iter()
        .filter(|channel| !channels.contains_key(**channel))
        .count();
    if channels.len().saturating_add(missing_channels) > MAX_WORKSPACE_REALTIME_CHANNELS {
        return Err(RealtimeSubscriberLimitExceeded);
    }
    Ok(())
}

fn subscribe_locked(
    channels: &mut RealtimeChannels,
    channel: WorkspaceRealtimeChannel,
) -> broadcast::Receiver<String> {
    if let Some(sender) = channels.get(&channel) {
        return sender.subscribe();
    }
    let (sender, receiver) = broadcast::channel(REALTIME_CHANNEL_CAPACITY);
    channels.insert(channel, sender);
    receiver
}

async fn subscribe_local_channel(
    channels: &RwLock<RealtimeChannels>,
    channel: WorkspaceRealtimeChannel,
) -> Result<broadcast::Receiver<String>, RealtimeSubscriberLimitExceeded> {
    let mut channels = channels.write().await;
    remove_inactive_channels(&mut channels);
    ensure_subscription_capacity(&channels, &[&channel])?;
    Ok(subscribe_locked(&mut channels, channel))
}

async fn subscribe_local_public_and_user_inventory(
    channels: &RwLock<RealtimeChannels>,
    public: WorkspaceRealtimeChannel,
    user_inventory: WorkspaceRealtimeChannel,
) -> Result<
    (broadcast::Receiver<String>, broadcast::Receiver<String>),
    RealtimeSubscriberLimitExceeded,
> {
    let mut channels = channels.write().await;
    remove_inactive_channels(&mut channels);
    ensure_subscription_capacity(&channels, &[&public, &user_inventory])?;
    let public_receiver = subscribe_locked(&mut channels, public);
    let user_inventory_receiver = subscribe_locked(&mut channels, user_inventory);
    Ok((public_receiver, user_inventory_receiver))
}

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
    channels: Arc<RwLock<RealtimeChannels>>,
    connection_counts: Arc<StdMutex<WorkspaceRealtimeConnectionCounts>>,
}

#[derive(Clone)]
struct RedisHub {
    publish_client: redis::Client,
    publish_state: Arc<StdRwLock<RedisPublishState>>,
    key_prefix: String,
    channels: Arc<RwLock<RealtimeChannels>>,
    connection_counts: Arc<StdMutex<WorkspaceRealtimeConnectionCounts>>,
}

struct RedisPublishState {
    connection: redis::aio::MultiplexedConnection,
    generation: u64,
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
        tenant_id: &str,
        workspace_id: &str,
    ) -> Result<WorkspaceRealtimeSubscription, RealtimeSubscriberLimitExceeded> {
        self.subscribe_channel(WorkspaceRealtimeChannel::public(tenant_id, workspace_id))
            .await
    }

    pub async fn subscribe_user_inventory(
        &self,
        tenant_id: &str,
        user_id: &str,
        workspace_id: &str,
    ) -> Result<WorkspaceRealtimeSubscription, RealtimeSubscriberLimitExceeded> {
        self.subscribe_channel(WorkspaceRealtimeChannel::user_inventory(
            tenant_id,
            user_id,
            workspace_id,
        ))
        .await
    }

    pub async fn subscribe_session(
        &self,
        tenant_id: &str,
        user_id: &str,
        workspace_id: &str,
        coding_session_id: &str,
    ) -> Result<WorkspaceRealtimeSubscription, RealtimeSubscriberLimitExceeded> {
        self.subscribe_channel(WorkspaceRealtimeChannel::session(
            tenant_id,
            user_id,
            workspace_id,
            coding_session_id,
        ))
        .await
    }

    pub async fn subscribe_public_and_user_inventory(
        &self,
        tenant_id: &str,
        user_id: &str,
        workspace_id: &str,
    ) -> Result<
        (WorkspaceRealtimeSubscription, WorkspaceRealtimeSubscription),
        RealtimeSubscriberLimitExceeded,
    > {
        let public = WorkspaceRealtimeChannel::public(tenant_id, workspace_id);
        let user_inventory =
            WorkspaceRealtimeChannel::user_inventory(tenant_id, user_id, workspace_id);
        match &self.backend {
            HubBackend::Memory(hub) => {
                hub.subscribe_public_and_user_inventory(public, user_inventory)
                    .await
            }
            HubBackend::Redis(hub) => {
                hub.subscribe_public_and_user_inventory(public, user_inventory)
                    .await
            }
        }
    }

    async fn subscribe_channel(
        &self,
        channel: WorkspaceRealtimeChannel,
    ) -> Result<WorkspaceRealtimeSubscription, RealtimeSubscriberLimitExceeded> {
        match &self.backend {
            HubBackend::Memory(hub) => hub.subscribe(channel).await,
            HubBackend::Redis(hub) => hub.subscribe(channel).await,
        }
    }

    pub async fn publish(
        &self,
        tenant_id: &str,
        workspace_id: &str,
        message: &str,
    ) -> Result<usize, RealtimePublishError> {
        self.publish_channel(
            &WorkspaceRealtimeChannel::public(tenant_id, workspace_id),
            message,
        )
        .await
    }

    pub async fn publish_user_inventory(
        &self,
        tenant_id: &str,
        user_id: &str,
        workspace_id: &str,
        message: &str,
    ) -> Result<usize, RealtimePublishError> {
        self.publish_channel(
            &WorkspaceRealtimeChannel::user_inventory(tenant_id, user_id, workspace_id),
            message,
        )
        .await
    }

    pub async fn publish_session(
        &self,
        tenant_id: &str,
        user_id: &str,
        workspace_id: &str,
        coding_session_id: &str,
        message: &str,
    ) -> Result<usize, RealtimePublishError> {
        self.publish_channel(
            &WorkspaceRealtimeChannel::session(tenant_id, user_id, workspace_id, coding_session_id),
            message,
        )
        .await
    }

    async fn publish_channel(
        &self,
        channel: &WorkspaceRealtimeChannel,
        message: &str,
    ) -> Result<usize, RealtimePublishError> {
        match &self.backend {
            HubBackend::Memory(hub) => hub.publish(channel, message).await,
            HubBackend::Redis(hub) => hub.publish(channel, message).await,
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
            connection_counts: Arc::new(StdMutex::new(HashMap::new())),
        }
    }

    async fn subscribe(
        &self,
        channel: WorkspaceRealtimeChannel,
    ) -> Result<WorkspaceRealtimeSubscription, RealtimeSubscriberLimitExceeded> {
        let connection_permit =
            acquire_connection_permit(&self.connection_counts, channel.workspace_scope())?;
        let receiver = subscribe_local_channel(&self.channels, channel).await?;
        Ok(attach_connection_permit(receiver, connection_permit))
    }

    async fn subscribe_public_and_user_inventory(
        &self,
        public: WorkspaceRealtimeChannel,
        user_inventory: WorkspaceRealtimeChannel,
    ) -> Result<
        (WorkspaceRealtimeSubscription, WorkspaceRealtimeSubscription),
        RealtimeSubscriberLimitExceeded,
    > {
        let connection_permit =
            acquire_connection_permit(&self.connection_counts, public.workspace_scope())?;
        let (public_receiver, user_inventory_receiver) =
            subscribe_local_public_and_user_inventory(&self.channels, public, user_inventory)
                .await?;
        Ok((
            attach_connection_permit(public_receiver, connection_permit.clone()),
            attach_connection_permit(user_inventory_receiver, connection_permit),
        ))
    }

    async fn publish(
        &self,
        channel: &WorkspaceRealtimeChannel,
        message: &str,
    ) -> Result<usize, RealtimePublishError> {
        let sender = self.channels.read().await.get(channel).cloned();
        Ok(sender
            .map(|sender| sender.send(message.to_owned()).unwrap_or(0))
            .unwrap_or(0))
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
        let mut publish_connection = publish_client
            .get_multiplexed_async_connection()
            .await
            .map_err(|error| {
                RealtimeHubBootstrapError::RedisConnect(format!(
                    "connect Redis for workspace realtime hub failed: {error}"
                ))
            })?;
        let _: String = redis::cmd("PING")
            .query_async(&mut publish_connection)
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
            publish_state: Arc::new(StdRwLock::new(RedisPublishState {
                connection: publish_connection,
                generation: 0,
            })),
            key_prefix: config.key_prefix,
            channels,
            connection_counts: Arc::new(StdMutex::new(HashMap::new())),
        })
    }

    async fn subscribe(
        &self,
        channel: WorkspaceRealtimeChannel,
    ) -> Result<WorkspaceRealtimeSubscription, RealtimeSubscriberLimitExceeded> {
        let connection_permit =
            acquire_connection_permit(&self.connection_counts, channel.workspace_scope())?;
        let receiver = subscribe_local_channel(&self.channels, channel).await?;
        Ok(attach_connection_permit(receiver, connection_permit))
    }

    async fn subscribe_public_and_user_inventory(
        &self,
        public: WorkspaceRealtimeChannel,
        user_inventory: WorkspaceRealtimeChannel,
    ) -> Result<
        (WorkspaceRealtimeSubscription, WorkspaceRealtimeSubscription),
        RealtimeSubscriberLimitExceeded,
    > {
        let connection_permit =
            acquire_connection_permit(&self.connection_counts, public.workspace_scope())?;
        let (public_receiver, user_inventory_receiver) =
            subscribe_local_public_and_user_inventory(&self.channels, public, user_inventory)
                .await?;
        Ok((
            attach_connection_permit(public_receiver, connection_permit.clone()),
            attach_connection_permit(user_inventory_receiver, connection_permit),
        ))
    }

    async fn publish(
        &self,
        realtime_channel: &WorkspaceRealtimeChannel,
        message: &str,
    ) -> Result<usize, RealtimePublishError> {
        let channel = redis_channel_name(&self.key_prefix, realtime_channel);
        let (mut connection, generation) = self.publish_connection_snapshot();
        match connection.publish(channel, message).await {
            Ok(receiver_count) => Ok(receiver_count),
            Err(publish_error) => {
                let refresh_error = self.refresh_publish_connection(generation).await.err();
                record_publish_failure();
                let refresh_context = refresh_error
                    .map(|error| format!("; Redis publish connection refresh failed: {error}"))
                    .unwrap_or_default();
                Err(RealtimePublishError(format!(
                    "publish workspace realtime event failed: {publish_error}{refresh_context}"
                )))
            }
        }
    }

    fn publish_connection_snapshot(&self) -> (redis::aio::MultiplexedConnection, u64) {
        let state = self
            .publish_state
            .read()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        (state.connection.clone(), state.generation)
    }

    async fn refresh_publish_connection(
        &self,
        failed_generation: u64,
    ) -> Result<(), redis::RedisError> {
        let mut replacement = self
            .publish_client
            .get_multiplexed_async_connection()
            .await?;
        let _: String = redis::cmd("PING").query_async(&mut replacement).await?;

        let mut state = self
            .publish_state
            .write()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if state.generation == failed_generation {
            state.connection = replacement;
            state.generation = state.generation.wrapping_add(1);
        }
        Ok(())
    }
}

fn spawn_redis_forwarder(
    client: redis::Client,
    key_prefix: String,
    channels: Arc<RwLock<RealtimeChannels>>,
) {
    tokio::spawn(async move {
        loop {
            let Ok(mut pubsub) = client.get_async_pubsub().await else {
                tracing::error!("workspace realtime hub failed to open Redis pub/sub connection");
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                continue;
            };

            let patterns = redis_patterns(&key_prefix);
            let mut subscribed = true;
            for pattern in &patterns {
                if pubsub.psubscribe(pattern).await.is_err() {
                    tracing::error!(
                        pattern = %pattern,
                        "workspace realtime hub failed to subscribe to Redis pattern"
                    );
                    subscribed = false;
                    break;
                }
            }
            if !subscribed {
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                continue;
            }

            let mut stream = pubsub.on_message();
            while let Some(message) = stream.next().await {
                let channel = message.get_channel_name();
                let Some(route) = realtime_channel_from_redis(channel, &key_prefix) else {
                    continue;
                };
                let RedisRealtimeChannelRoute::Active(realtime_channel) = route else {
                    // Pre-v1 public channels had no tenant scope. Recognize but
                    // fail closed so rolling deployment cannot re-open cross-tenant delivery.
                    continue;
                };
                let payload = message
                    .get_payload::<String>()
                    .unwrap_or_else(|_| String::new());
                if payload.is_empty() {
                    continue;
                }

                let sender = channels.read().await.get(&realtime_channel).cloned();
                if let Some(sender) = sender {
                    let _ = sender.send(payload);
                }
            }

            tracing::warn!("workspace realtime hub Redis forwarder disconnected; reconnecting");
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
    });
}

fn redis_channel_name(key_prefix: &str, channel: &WorkspaceRealtimeChannel) -> String {
    match channel {
        WorkspaceRealtimeChannel::Public {
            tenant_id,
            workspace_id,
        } => format!(
            "{key_prefix}:realtime:workspace:v1:{}:{}",
            encode_channel_component(tenant_id),
            encode_channel_component(workspace_id),
        ),
        WorkspaceRealtimeChannel::UserInventory {
            tenant_id,
            user_id,
            workspace_id,
        } => format!(
            "{key_prefix}:realtime:workspace-user-inventory:v1:{}:{}:{}",
            encode_channel_component(tenant_id),
            encode_channel_component(user_id),
            encode_channel_component(workspace_id),
        ),
        WorkspaceRealtimeChannel::Session {
            tenant_id,
            user_id,
            workspace_id,
            coding_session_id,
        } => format!(
            "{key_prefix}:realtime:workspace-session:v1:{}:{}:{}:{}",
            encode_channel_component(tenant_id),
            encode_channel_component(user_id),
            encode_channel_component(workspace_id),
            encode_channel_component(coding_session_id),
        ),
    }
}

fn redis_patterns(key_prefix: &str) -> [String; 3] {
    [
        format!("{key_prefix}:realtime:workspace:v1:*"),
        format!("{key_prefix}:realtime:workspace-user-inventory:v1:*"),
        format!("{key_prefix}:realtime:workspace-session:v1:*"),
    ]
}

fn encode_channel_component(value: &str) -> String {
    sdkwork_utils_rust::base64url_encode(value.as_bytes())
}

fn decode_channel_component(value: &str) -> Option<String> {
    let decoded = sdkwork_utils_rust::base64url_decode(value)?;
    let decoded = String::from_utf8(decoded).ok()?;
    (!sdkwork_utils_rust::is_blank(Some(&decoded))).then_some(decoded)
}

fn realtime_channel_from_redis(
    channel: &str,
    key_prefix: &str,
) -> Option<RedisRealtimeChannelRoute> {
    let session_prefix = format!("{key_prefix}:realtime:workspace-session:v1:");
    if let Some(encoded_scope) = channel.strip_prefix(&session_prefix) {
        let mut parts = encoded_scope.split(':');
        let tenant_id = decode_channel_component(parts.next()?)?;
        let user_id = decode_channel_component(parts.next()?)?;
        let workspace_id = decode_channel_component(parts.next()?)?;
        let coding_session_id = decode_channel_component(parts.next()?)?;
        if parts.next().is_some() {
            return None;
        }
        return Some(RedisRealtimeChannelRoute::Active(
            WorkspaceRealtimeChannel::Session {
                tenant_id,
                user_id,
                workspace_id,
                coding_session_id,
            },
        ));
    }

    let user_inventory_prefix = format!("{key_prefix}:realtime:workspace-user-inventory:v1:");
    if let Some(encoded_scope) = channel.strip_prefix(&user_inventory_prefix) {
        let mut parts = encoded_scope.split(':');
        let tenant_id = decode_channel_component(parts.next()?)?;
        let user_id = decode_channel_component(parts.next()?)?;
        let workspace_id = decode_channel_component(parts.next()?)?;
        if parts.next().is_some() {
            return None;
        }
        return Some(RedisRealtimeChannelRoute::Active(
            WorkspaceRealtimeChannel::UserInventory {
                tenant_id,
                user_id,
                workspace_id,
            },
        ));
    }

    let public_v1_prefix = format!("{key_prefix}:realtime:workspace:v1:");
    if let Some(encoded_scope) = channel.strip_prefix(&public_v1_prefix) {
        let mut parts = encoded_scope.split(':');
        let tenant_id = decode_channel_component(parts.next()?)?;
        let workspace_id = decode_channel_component(parts.next()?)?;
        if parts.next().is_some() {
            return None;
        }
        return Some(RedisRealtimeChannelRoute::Active(
            WorkspaceRealtimeChannel::Public {
                tenant_id,
                workspace_id,
            },
        ));
    }

    let legacy_public_prefix = format!("{key_prefix}:realtime:workspace:");
    let legacy_workspace_id = channel.strip_prefix(&legacy_public_prefix)?;
    (!sdkwork_utils_rust::is_blank(Some(legacy_workspace_id)))
        .then_some(RedisRealtimeChannelRoute::LegacyPublic)
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
                hub.subscribe("tenant-limit", workspace_id)
                    .await
                    .expect("subscribe within limit"),
            );
        }

        assert!(matches!(
            hub.subscribe("tenant-limit", workspace_id).await,
            Err(RealtimeSubscriberLimitExceeded)
        ));
    }

    #[tokio::test]
    async fn live_connection_limit_counts_connections_not_internal_receivers() {
        let hub = WorkspaceRealtimeHub::new();
        let mut connections = Vec::new();
        for _ in 0..MAX_WORKSPACE_REALTIME_SUBSCRIBERS {
            connections.push(
                hub.subscribe_public_and_user_inventory("tenant-1", "user-1", "workspace-1")
                    .await
                    .expect("subscribe live connection within limit"),
            );
        }

        assert_eq!(connections.len(), MAX_WORKSPACE_REALTIME_SUBSCRIBERS);
        assert!(matches!(
            hub.subscribe_public_and_user_inventory("tenant-1", "user-1", "workspace-1")
                .await,
            Err(RealtimeSubscriberLimitExceeded)
        ));
    }

    #[tokio::test]
    async fn workspace_connection_limit_accumulates_across_session_channels() {
        let hub = WorkspaceRealtimeHub::new();
        let mut connections = Vec::new();
        for index in 0..MAX_WORKSPACE_REALTIME_SUBSCRIBERS {
            connections.push(
                hub.subscribe_session(
                    "tenant-session-limit",
                    "user-1",
                    "workspace-session-limit",
                    &format!("session-{index}"),
                )
                .await
                .expect("subscribe session within workspace connection limit"),
            );
        }

        assert!(matches!(
            hub.subscribe_session(
                "tenant-session-limit",
                "user-2",
                "workspace-session-limit",
                "session-over-limit",
            )
            .await,
            Err(RealtimeSubscriberLimitExceeded)
        ));

        drop(connections.pop());
        let _replacement = hub
            .subscribe_session(
                "tenant-session-limit",
                "user-2",
                "workspace-session-limit",
                "session-after-release",
            )
            .await
            .expect("dropping a connection must release its workspace permit");
    }

    #[tokio::test]
    async fn cold_subscription_reclaims_channels_after_the_last_receiver_is_dropped() {
        let hub = WorkspaceRealtimeHub::new();
        let receiver = hub
            .subscribe("tenant-1", "workspace-expired")
            .await
            .expect("subscribe");
        drop(receiver);

        assert_eq!(
            hub.publish("tenant-1", "workspace-expired", "ignored")
                .await
                .expect("publish without subscribers"),
            0
        );
        let _active_receiver = hub
            .subscribe("tenant-1", "workspace-active")
            .await
            .expect("subscribe active workspace");

        let HubBackend::Memory(memory) = &hub.backend else {
            panic!("test hub must use memory backend");
        };
        let channels = memory.channels.read().await;
        assert!(!channels.contains_key(&WorkspaceRealtimeChannel::public(
            "tenant-1",
            "workspace-expired"
        )));
        assert!(channels.contains_key(&WorkspaceRealtimeChannel::public(
            "tenant-1",
            "workspace-active"
        )));
    }

    #[tokio::test]
    async fn publish_without_a_subscribed_channel_returns_zero_without_allocating_one() {
        let hub = WorkspaceRealtimeHub::new();

        assert_eq!(
            hub.publish("tenant-1", "workspace-missing", "ignored")
                .await
                .expect("publish without channel"),
            0
        );

        let HubBackend::Memory(memory) = &hub.backend else {
            panic!("test hub must use memory backend");
        };
        assert!(memory.channels.read().await.is_empty());
    }

    #[tokio::test]
    async fn concurrent_workspace_publishers_deliver_without_global_write_serialization() {
        let hub = WorkspaceRealtimeHub::new();
        let mut receivers = Vec::new();
        for index in 0..32 {
            let workspace_id = format!("workspace-{index}");
            receivers.push((
                workspace_id.clone(),
                hub.subscribe("tenant-1", &workspace_id)
                    .await
                    .expect("subscribe workspace"),
            ));
        }

        let mut publishers = tokio::task::JoinSet::new();
        for (workspace_id, _) in &receivers {
            let hub = hub.clone();
            let workspace_id = workspace_id.clone();
            publishers
                .spawn(async move { hub.publish("tenant-1", &workspace_id, &workspace_id).await });
        }
        tokio::time::timeout(std::time::Duration::from_secs(1), async {
            while let Some(result) = publishers.join_next().await {
                assert_eq!(result.expect("publisher task").expect("publish event"), 1);
            }
        })
        .await
        .expect("concurrent workspace publishes must complete");

        for (workspace_id, mut receiver) in receivers {
            assert_eq!(receiver.recv().await.expect("receive event"), workspace_id);
        }
    }

    #[test]
    fn tenant_public_redis_channel_round_trips_and_legacy_public_fails_closed() {
        let channel = WorkspaceRealtimeChannel::public("tenant-1", "ws-123");
        let redis_channel = redis_channel_name("birdcoder", &channel);
        assert_eq!(
            realtime_channel_from_redis(&redis_channel, "birdcoder"),
            Some(RedisRealtimeChannelRoute::Active(channel))
        );
        assert_eq!(
            realtime_channel_from_redis("birdcoder:realtime:workspace:ws-123", "birdcoder"),
            Some(RedisRealtimeChannelRoute::LegacyPublic)
        );
    }

    #[test]
    fn user_inventory_redis_channel_scope_round_trips_without_delimiter_collisions() {
        let channel = WorkspaceRealtimeChannel::user_inventory(
            "tenant:with:separator",
            "user/with spaces",
            "workspace:shared",
        );
        let redis_channel = redis_channel_name("birdcoder", &channel);

        assert!(redis_channel.starts_with("birdcoder:realtime:workspace-user-inventory:v1:"));
        assert_eq!(
            realtime_channel_from_redis(&redis_channel, "birdcoder"),
            Some(RedisRealtimeChannelRoute::Active(channel))
        );
        assert_eq!(
            realtime_channel_from_redis(
                "birdcoder:realtime:workspace-user-inventory:v1:not-base64:user:workspace",
                "birdcoder"
            ),
            None
        );
    }

    #[test]
    fn session_redis_channel_scope_round_trips_without_delimiter_collisions() {
        let channel = WorkspaceRealtimeChannel::session(
            "tenant:with:separator",
            "user/with spaces",
            "workspace:shared",
            "session:durable/1",
        );
        let redis_channel = redis_channel_name("birdcoder", &channel);

        assert!(redis_channel.starts_with("birdcoder:realtime:workspace-session:v1:"));
        assert_eq!(
            realtime_channel_from_redis(&redis_channel, "birdcoder"),
            Some(RedisRealtimeChannelRoute::Active(channel))
        );
        assert_eq!(
            realtime_channel_from_redis(
                "birdcoder:realtime:workspace-session:v1:not-base64:user:workspace:session",
                "birdcoder"
            ),
            None
        );
    }

    #[tokio::test]
    async fn user_inventory_events_are_isolated_by_tenant_and_user() {
        let hub = WorkspaceRealtimeHub::new();
        let mut owner = hub
            .subscribe_user_inventory("tenant-1", "user-1", "workspace-1")
            .await
            .expect("subscribe owner");
        let mut other_user = hub
            .subscribe_user_inventory("tenant-1", "user-2", "workspace-1")
            .await
            .expect("subscribe other user");
        let mut other_tenant = hub
            .subscribe_user_inventory("tenant-2", "user-1", "workspace-1")
            .await
            .expect("subscribe same user id in another tenant");
        let mut public = hub
            .subscribe("tenant-1", "workspace-1")
            .await
            .expect("subscribe public");
        let mut other_tenant_public = hub
            .subscribe("tenant-2", "workspace-1")
            .await
            .expect("subscribe same workspace id in another tenant");

        hub.publish_user_inventory("tenant-1", "user-1", "workspace-1", "inventory-summary")
            .await
            .expect("publish user inventory summary");

        assert_eq!(owner.recv().await.unwrap(), "inventory-summary");
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(20), other_user.recv())
                .await
                .is_err()
        );
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(20), other_tenant.recv())
                .await
                .is_err()
        );
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(20), public.recv())
                .await
                .is_err()
        );

        hub.publish("tenant-1", "workspace-1", "public-message")
            .await
            .expect("publish tenant public message");
        assert_eq!(public.recv().await.unwrap(), "public-message");
        assert!(tokio::time::timeout(
            std::time::Duration::from_millis(20),
            other_tenant_public.recv()
        )
        .await
        .is_err());
    }

    #[tokio::test]
    async fn durable_events_are_isolated_by_tenant_user_workspace_and_session() {
        let hub = WorkspaceRealtimeHub::new();
        let mut target = hub
            .subscribe_session("tenant-1", "user-1", "workspace-1", "session-1")
            .await
            .expect("subscribe target session");
        let mut other_session = hub
            .subscribe_session("tenant-1", "user-1", "workspace-1", "session-2")
            .await
            .expect("subscribe other session");
        let mut other_user = hub
            .subscribe_session("tenant-1", "user-2", "workspace-1", "session-1")
            .await
            .expect("subscribe other user session");
        let mut other_tenant = hub
            .subscribe_session("tenant-2", "user-1", "workspace-1", "session-1")
            .await
            .expect("subscribe other tenant session");
        let mut user_inventory = hub
            .subscribe_user_inventory("tenant-1", "user-1", "workspace-1")
            .await
            .expect("subscribe user inventory");
        let mut public = hub
            .subscribe("tenant-1", "workspace-1")
            .await
            .expect("subscribe public workspace");

        hub.publish_session(
            "tenant-1",
            "user-1",
            "workspace-1",
            "session-1",
            "durable-delta",
        )
        .await
        .expect("publish durable session event");

        assert_eq!(target.recv().await.unwrap(), "durable-delta");
        for receiver in [
            &mut other_session,
            &mut other_user,
            &mut other_tenant,
            &mut user_inventory,
            &mut public,
        ] {
            assert!(
                tokio::time::timeout(std::time::Duration::from_millis(20), receiver.recv())
                    .await
                    .is_err()
            );
        }
    }
}
