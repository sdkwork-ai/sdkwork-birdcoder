use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderEngineAccessLane};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderEngineAccessPlan {
    #[serde(rename = "primaryLaneId")]
    pub primary_lane_id: String,

    #[serde(rename = "fallbackLaneIds")]
    pub fallback_lane_ids: Vec<String>,

    pub lanes: Vec<BirdCoderEngineAccessLane>,
}
