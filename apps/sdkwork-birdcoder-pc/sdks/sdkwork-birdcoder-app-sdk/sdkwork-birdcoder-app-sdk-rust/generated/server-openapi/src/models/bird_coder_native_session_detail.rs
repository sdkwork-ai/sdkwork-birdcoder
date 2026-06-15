use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderNativeSessionMessage, BirdCoderNativeSessionSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderNativeSessionDetail {
    pub summary: BirdCoderNativeSessionSummary,

    pub messages: Vec<BirdCoderNativeSessionMessage>,
}
