use super::results::CodingSessionEventPayload;

#[derive(Clone, Debug)]
pub struct ProjectionMutationEvent<T> {
    pub payload: T,
    pub event: CodingSessionEventPayload,
}
