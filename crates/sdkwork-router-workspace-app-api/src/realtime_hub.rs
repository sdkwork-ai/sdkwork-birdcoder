use std::collections::HashMap;
use std::sync::Arc;

use serde_json::json;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

const REALTIME_CHANNEL_CAPACITY: usize = 256;

#[derive(Clone)]
pub struct WorkspaceRealtimeHub {
    channels: Arc<RwLock<HashMap<String, broadcast::Sender<String>>>>,
}

impl WorkspaceRealtimeHub {
    pub fn new() -> Self {
        Self {
            channels: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn subscribe(&self, workspace_id: &str) -> broadcast::Receiver<String> {
        let mut channels = self.channels.write().await;
        if let Some(sender) = channels.get(workspace_id) {
            return sender.subscribe();
        }

        let (sender, receiver) = broadcast::channel(REALTIME_CHANNEL_CAPACITY);
        channels.insert(workspace_id.to_string(), sender);
        receiver
    }

    pub async fn publish(&self, workspace_id: &str, message: &str) {
        let channels = self.channels.read().await;
        if let Some(sender) = channels.get(workspace_id) {
            let _ = sender.send(message.to_string());
        }
    }
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
