// ── Engine runtime profile ───────────────────────────────────────────

#[derive(Clone, Debug)]
pub struct AuthoritativeEngineRuntimeProfile {
    pub transport_kind: String,
    pub capability_snapshot_json: String,
}
