use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderEngineAccessLane {
    #[serde(rename = "laneId")]
    pub lane_id: String,

    pub label: String,

    #[serde(rename = "strategyKind")]
    pub strategy_kind: String,

    #[serde(rename = "runtimeOwner")]
    pub runtime_owner: String,

    #[serde(rename = "bridgeProtocol")]
    pub bridge_protocol: String,

    #[serde(rename = "transportKind")]
    pub transport_kind: String,

    pub status: String,

    #[serde(rename = "enabledByDefault")]
    pub enabled_by_default: bool,

    #[serde(rename = "hostModes")]
    pub host_modes: Vec<String>,

    pub description: String,
}
