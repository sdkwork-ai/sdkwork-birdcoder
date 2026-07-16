use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderSetProjectRuntimeLocationPreferenceRequest {
    #[serde(rename = "runtimeLocationId")]
    pub runtime_location_id: String,
}
