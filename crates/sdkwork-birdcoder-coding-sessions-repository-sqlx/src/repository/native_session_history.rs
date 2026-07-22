use std::collections::{BTreeMap, BTreeSet};

use sdkwork_birdcoder_coding_sessions_service::domain::models::{
    NativeSessionHistoryReconciliationInput, ReconciledCodingSessionEventInput,
    ReconciledCodingSessionMessageInput,
};
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
use sdkwork_birdcoder_coding_sessions_service::event_payload::normalize_projection_overlay_message_content;
use sdkwork_birdcoder_sqlx_repository_pool::dialect::{
    numbered_placeholders, IS_NOT_DELETED, SET_SOFT_DELETED,
};
use sdkwork_utils_rust::is_blank;
use sqlx::{AnyPool, Row, Transaction};
use time::OffsetDateTime;

use crate::db::columns;
use crate::db::rows::{EventRow, MessageRow, SessionRow};
use crate::error::{map_sqlx_error, RepositoryError};
use crate::mapper::row_mapper;
use crate::repository::row_projection;
use crate::repository::sqlx_helpers::SessionOwnerScope;

const PROVIDER_MESSAGE_ID_PREFIX: &str = "provider-history:message:";
const PROVIDER_EVENT_ID_PREFIX: &str = "provider-history:event:";
const PROVIDER_HISTORY_REFRESHED_AT: &str = "providerHistoryRefreshedAt";
const PROVIDER_HISTORY_REFRESH_REVISION: &str = "providerHistoryRefreshRevision";
const PROVIDER_HISTORY_REFRESH_LEASE_SECONDS: i64 = 10;
const MESSAGE_EQUIVALENCE_WINDOW_MS: i64 = 5 * 60 * 1000;

#[derive(Clone)]
struct LocalMessage {
    id: String,
    turn_id: Option<String>,
    role: String,
    content: String,
    created_at: String,
}

#[derive(Clone)]
struct LocalEvent {
    turn_id: Option<String>,
    kind: String,
    sequence: usize,
    payload: BTreeMap<String, serde_json::Value>,
    created_at: String,
}

#[derive(Clone, Copy, Eq, PartialEq)]
enum LocalMessageProjectionKind {
    Message,
    CompletedEvent,
    DeltaAggregate,
}

struct LocalMessageProjection {
    kind: LocalMessageProjectionKind,
    logical_message_id: Option<String>,
    turn_id: Option<String>,
    role: String,
    content: String,
    created_at: Vec<String>,
}

struct LocalLogicalMessageEvidence {
    projections: Vec<LocalMessageProjection>,
}

struct SessionTranscriptState {
    updated_at: String,
    last_turn_at: Option<String>,
    transcript_updated_at: Option<String>,
}

struct SerializedMessageFields {
    metadata_json: String,
    tool_calls_json: Option<String>,
    file_changes_json: Option<String>,
    commands_json: Option<String>,
    task_progress_json: Option<String>,
    timestamp_ms: Option<i64>,
}

struct RuntimeReconciliationUpdate<'a> {
    owner: SessionOwnerScope,
    session_id: &'a str,
    runtime_id: &'a str,
    source_revision: &'a str,
    engine_id: &'a str,
    native_session_id: &'a str,
    metadata: &'a serde_json::Map<String, serde_json::Value>,
    now: &'a str,
    revision_changed: bool,
}

pub(crate) async fn refresh_required(
    pool: &AnyPool,
    is_postgres: bool,
    owner: SessionOwnerScope,
    session_id: &str,
    engine_id: &str,
    native_session_id: &str,
    source_revision: &str,
) -> Result<bool, CodingSessionError> {
    validate_binding(engine_id, native_session_id, source_revision)?;
    ensure_bound_session(pool, owner, session_id, engine_id, native_session_id).await?;

    let runtime_id = discovery_runtime_id(session_id);
    let metadata_projection = if is_postgres {
        format!("CAST({} AS TEXT)", columns::runtime::METADATA_JSON)
    } else {
        columns::runtime::METADATA_JSON.to_owned()
    };
    let sql = numbered_placeholders(&format!(
        "SELECT {} AS source_revision, {metadata_projection} AS metadata_json FROM {} \
         WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} = ? \
         AND {} = ? AND {IS_NOT_DELETED}",
        columns::runtime::NATIVE_TURN_CONTAINER_ID,
        columns::runtime::TABLE,
        columns::runtime::ID,
        columns::runtime::CODING_SESSION_ID,
        columns::runtime::TENANT_ID,
        columns::runtime::USER_ID,
        columns::runtime::ENGINE_ID,
        columns::runtime::NATIVE_SESSION_ID,
        columns::runtime::TRANSPORT_KIND,
    ));
    let row = map_sqlx_error(
        sqlx::query(&sql)
            .bind(&runtime_id)
            .bind(session_id)
            .bind(owner.tenant_id)
            .bind(owner.user_id)
            .bind(engine_id)
            .bind(native_session_id)
            .bind("provider-native")
            .fetch_optional(pool)
            .await,
    )?;
    let Some(row) = row else {
        return Ok(true);
    };

    let stored_revision = map_sqlx_error(row.try_get::<Option<String>, _>("source_revision"))?;
    let metadata_json = map_sqlx_error(row.try_get::<String, _>("metadata_json"))?;
    let metadata = parse_metadata_object(&metadata_json)?;
    if stored_revision.is_none()
        || metadata
            .get(PROVIDER_HISTORY_REFRESH_REVISION)
            .and_then(serde_json::Value::as_str)
            != Some(source_revision)
    {
        return Ok(true);
    }
    let Some(refreshed_at) = metadata
        .get(PROVIDER_HISTORY_REFRESHED_AT)
        .and_then(serde_json::Value::as_str)
        .and_then(parse_timestamp)
    else {
        return Ok(true);
    };
    let now = OffsetDateTime::now_utc();
    let lease_expired = refreshed_at
        < now - time::Duration::seconds(PROVIDER_HISTORY_REFRESH_LEASE_SECONDS)
        || refreshed_at > now + time::Duration::seconds(PROVIDER_HISTORY_REFRESH_LEASE_SECONDS);
    Ok(lease_expired)
}

pub(crate) async fn reconcile(
    pool: &AnyPool,
    is_postgres: bool,
    owner: SessionOwnerScope,
    session_id: &str,
    input: &NativeSessionHistoryReconciliationInput,
) -> Result<(), CodingSessionError> {
    validate_input(input)?;
    let now = now_iso();
    let runtime_id = discovery_runtime_id(session_id);
    let mut tx = map_sqlx_error(pool.begin().await)?;

    lock_bound_session(
        &mut tx,
        owner,
        session_id,
        &input.engine_id,
        &input.native_session_id,
    )
    .await?;
    let session_transcript =
        load_session_transcript_state(&mut tx, is_postgres, owner, session_id).await?;
    let (stored_revision, mut runtime_metadata) = load_bound_runtime_state(
        &mut tx,
        is_postgres,
        owner,
        session_id,
        &runtime_id,
        &input.engine_id,
        &input.native_session_id,
    )
    .await?;
    let refresh_revision = later_timestamp(&input.source_revision, &input.refresh_revision);
    if stored_revision
        .as_deref()
        .is_some_and(|revision| revision_is_older(&input.source_revision, revision))
    {
        runtime_metadata.insert(
            PROVIDER_HISTORY_REFRESHED_AT.to_owned(),
            serde_json::Value::String(now.clone()),
        );
        runtime_metadata.insert(
            PROVIDER_HISTORY_REFRESH_REVISION.to_owned(),
            serde_json::Value::String(refresh_revision),
        );
        update_runtime_reconciliation_state(
            &mut tx,
            is_postgres,
            RuntimeReconciliationUpdate {
                owner,
                session_id,
                runtime_id: &runtime_id,
                source_revision: stored_revision.as_deref().expect("checked stored revision"),
                engine_id: &input.engine_id,
                native_session_id: &input.native_session_id,
                metadata: &runtime_metadata,
                now: &now,
                revision_changed: false,
            },
        )
        .await?;
        map_sqlx_error(tx.commit().await)?;
        return Ok(());
    }
    let revision_changed = stored_revision.as_deref() != Some(input.source_revision.as_str());

    let local_messages = load_local_messages(&mut tx, is_postgres, owner, session_id).await?;
    let local_events = load_local_events(&mut tx, is_postgres, owner, session_id).await?;
    let desired_message_ids = desired_provider_message_ids(input, &local_messages, &local_events);
    let desired_event_ids = input
        .events
        .iter()
        .filter(|event| desired_message_ids.contains(&event.message_id))
        .map(|event| event.id.clone())
        .collect::<BTreeSet<_>>();

    for message in input
        .messages
        .iter()
        .filter(|message| desired_message_ids.contains(&message.id))
    {
        upsert_message(&mut tx, is_postgres, owner, session_id, message).await?;
    }
    for event in input
        .events
        .iter()
        .filter(|event| desired_event_ids.contains(&event.id))
    {
        upsert_event(&mut tx, is_postgres, owner, session_id, &runtime_id, event).await?;
    }

    soft_delete_missing_provider_rows(
        &mut tx,
        owner,
        session_id,
        &desired_message_ids,
        &desired_event_ids,
        &now,
    )
    .await?;
    update_session_transcript(
        &mut tx,
        is_postgres,
        owner,
        session_id,
        &session_transcript,
        &input.source_revision,
        latest_provider_message_timestamp(input),
    )
    .await?;

    runtime_metadata.insert(
        PROVIDER_HISTORY_REFRESHED_AT.to_owned(),
        serde_json::Value::String(now.clone()),
    );
    runtime_metadata.insert(
        PROVIDER_HISTORY_REFRESH_REVISION.to_owned(),
        serde_json::Value::String(refresh_revision),
    );
    update_runtime_reconciliation_state(
        &mut tx,
        is_postgres,
        RuntimeReconciliationUpdate {
            owner,
            session_id,
            runtime_id: &runtime_id,
            source_revision: &input.source_revision,
            engine_id: &input.engine_id,
            native_session_id: &input.native_session_id,
            metadata: &runtime_metadata,
            now: &now,
            revision_changed,
        },
    )
    .await?;

    map_sqlx_error(tx.commit().await)?;
    Ok(())
}

async fn load_session_transcript_state(
    tx: &mut Transaction<'_, sqlx::Any>,
    is_postgres: bool,
    owner: SessionOwnerScope,
    session_id: &str,
) -> Result<SessionTranscriptState, CodingSessionError> {
    let projection = row_projection::session(is_postgres, "");
    let sql = numbered_placeholders(&format!(
        "SELECT {projection} FROM {} WHERE {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED}",
        columns::session::TABLE,
        columns::session::ID,
        columns::session::TENANT_ID,
        columns::session::USER_ID,
    ));
    let row = map_sqlx_error(
        sqlx::query(&sql)
            .bind(session_id)
            .bind(owner.tenant_id)
            .bind(owner.user_id)
            .fetch_one(&mut **tx)
            .await,
    )?;
    let row = map_sqlx_error(SessionRow::from_row(&row))?;
    Ok(SessionTranscriptState {
        updated_at: row.updated_at,
        last_turn_at: row.last_turn_at,
        transcript_updated_at: row.transcript_updated_at,
    })
}

fn validate_binding(
    engine_id: &str,
    native_session_id: &str,
    source_revision: &str,
) -> Result<(), CodingSessionError> {
    if is_blank(Some(engine_id))
        || is_blank(Some(native_session_id))
        || is_blank(Some(source_revision))
    {
        return Err(CodingSessionError::InvalidInput(
            "engine_id, native_session_id, and source_revision are required for provider history"
                .to_owned(),
        ));
    }
    Ok(())
}

fn validate_input(
    input: &NativeSessionHistoryReconciliationInput,
) -> Result<(), CodingSessionError> {
    validate_binding(
        &input.engine_id,
        &input.native_session_id,
        &input.source_revision,
    )?;
    if is_blank(Some(input.refresh_revision.as_str())) {
        return Err(CodingSessionError::InvalidInput(
            "refresh_revision is required for provider history".to_owned(),
        ));
    }
    let mut message_ids = BTreeSet::new();
    for message in &input.messages {
        if !message.id.starts_with(PROVIDER_MESSAGE_ID_PREFIX)
            || !message_ids.insert(message.id.as_str())
        {
            return Err(CodingSessionError::InvalidInput(
                "provider history message ids must be unique server-owned namespaced ids"
                    .to_owned(),
            ));
        }
    }
    let mut event_ids = BTreeSet::new();
    for event in &input.events {
        let payload_message_id = event
            .payload
            .get("messageId")
            .and_then(serde_json::Value::as_str);
        if !event.id.starts_with(PROVIDER_EVENT_ID_PREFIX)
            || !event_ids.insert(event.id.as_str())
            || !message_ids.contains(event.message_id.as_str())
            || payload_message_id != Some(event.message_id.as_str())
        {
            return Err(CodingSessionError::InvalidInput(
                "provider history events must have unique namespaced ids and reference one imported message"
                    .to_owned(),
            ));
        }
    }
    Ok(())
}

async fn ensure_bound_session(
    pool: &AnyPool,
    owner: SessionOwnerScope,
    session_id: &str,
    engine_id: &str,
    native_session_id: &str,
) -> Result<(), CodingSessionError> {
    let sql = numbered_placeholders(&format!(
        "SELECT 1 FROM {} s WHERE s.{} = ? AND s.{} = ? AND s.{} = ? AND s.{} = ? \
         AND s.{} = ? AND s.{IS_NOT_DELETED} AND EXISTS (SELECT 1 FROM studio_workspace w \
         WHERE CAST(w.id AS TEXT) = s.{} AND w.tenant_id = ? AND w.{IS_NOT_DELETED})",
        columns::session::TABLE,
        columns::session::ID,
        columns::session::TENANT_ID,
        columns::session::USER_ID,
        columns::session::ENGINE_ID,
        columns::session::NATIVE_SESSION_ID,
        columns::session::WORKSPACE_ID,
    ));
    let exists = map_sqlx_error(
        sqlx::query_scalar::<sqlx::Any, i64>(&sql)
            .bind(session_id)
            .bind(owner.tenant_id)
            .bind(owner.user_id)
            .bind(engine_id)
            .bind(native_session_id)
            .bind(owner.tenant_id)
            .fetch_optional(pool)
            .await,
    )?;
    if exists.is_none() {
        return Err(RepositoryError::NotFound(format!(
            "provider-backed session {session_id} not found"
        ))
        .into());
    }
    Ok(())
}

async fn lock_bound_session(
    tx: &mut Transaction<'_, sqlx::Any>,
    owner: SessionOwnerScope,
    session_id: &str,
    engine_id: &str,
    native_session_id: &str,
) -> Result<(), CodingSessionError> {
    let sql = numbered_placeholders(&format!(
        "UPDATE {} SET {} = {} WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} = ? \
         AND {IS_NOT_DELETED} AND EXISTS (SELECT 1 FROM studio_workspace w \
         WHERE CAST(w.id AS TEXT) = {}.{} AND w.tenant_id = ? AND w.{IS_NOT_DELETED})",
        columns::session::TABLE,
        columns::session::VERSION,
        columns::session::VERSION,
        columns::session::ID,
        columns::session::TENANT_ID,
        columns::session::USER_ID,
        columns::session::ENGINE_ID,
        columns::session::NATIVE_SESSION_ID,
        columns::session::TABLE,
        columns::session::WORKSPACE_ID,
    ));
    let result = sqlx::query(&sql)
        .bind(session_id)
        .bind(owner.tenant_id)
        .bind(owner.user_id)
        .bind(engine_id)
        .bind(native_session_id)
        .bind(owner.tenant_id)
        .execute(&mut **tx)
        .await
        .map_err(|error| RepositoryError::Update(error.to_string()))?;
    if result.rows_affected() != 1 {
        return Err(RepositoryError::NotFound(format!(
            "provider-backed session {session_id} not found"
        ))
        .into());
    }
    Ok(())
}

async fn load_bound_runtime_state(
    tx: &mut Transaction<'_, sqlx::Any>,
    is_postgres: bool,
    owner: SessionOwnerScope,
    session_id: &str,
    runtime_id: &str,
    engine_id: &str,
    native_session_id: &str,
) -> Result<(Option<String>, serde_json::Map<String, serde_json::Value>), CodingSessionError> {
    let metadata_projection = if is_postgres {
        format!("CAST({} AS TEXT)", columns::runtime::METADATA_JSON)
    } else {
        columns::runtime::METADATA_JSON.to_owned()
    };
    let sql = numbered_placeholders(&format!(
        "SELECT {} AS source_revision, {metadata_projection} AS metadata_json FROM {} \
         WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} = ? \
         AND {} = ? AND {IS_NOT_DELETED}",
        columns::runtime::NATIVE_TURN_CONTAINER_ID,
        columns::runtime::TABLE,
        columns::runtime::ID,
        columns::runtime::CODING_SESSION_ID,
        columns::runtime::TENANT_ID,
        columns::runtime::USER_ID,
        columns::runtime::ENGINE_ID,
        columns::runtime::NATIVE_SESSION_ID,
        columns::runtime::TRANSPORT_KIND,
    ));
    let row = map_sqlx_error(
        sqlx::query(&sql)
            .bind(runtime_id)
            .bind(session_id)
            .bind(owner.tenant_id)
            .bind(owner.user_id)
            .bind(engine_id)
            .bind(native_session_id)
            .bind("provider-native")
            .fetch_optional(&mut **tx)
            .await,
    )?
    .ok_or_else(|| {
        CodingSessionError::Conflict(format!(
            "provider runtime binding for session {session_id} is missing or changed"
        ))
    })?;
    let revision = map_sqlx_error(row.try_get::<Option<String>, _>("source_revision"))?;
    let metadata_json = map_sqlx_error(row.try_get::<String, _>("metadata_json"))?;
    Ok((revision, parse_metadata_object(&metadata_json)?))
}

async fn load_local_messages(
    tx: &mut Transaction<'_, sqlx::Any>,
    is_postgres: bool,
    owner: SessionOwnerScope,
    session_id: &str,
) -> Result<Vec<LocalMessage>, CodingSessionError> {
    let projection = row_projection::message(is_postgres, "m");
    let sql = numbered_placeholders(&format!(
        "SELECT {projection} FROM {} m WHERE m.{} = ? AND m.{} = ? AND m.{} = ? \
         AND m.{} NOT LIKE ? AND m.{IS_NOT_DELETED} ORDER BY m.{} ASC, m.{} ASC",
        columns::message::TABLE,
        columns::message::TENANT_ID,
        columns::message::USER_ID,
        columns::message::CODING_SESSION_ID,
        columns::message::ID,
        columns::message::CREATED_AT,
        columns::message::ID,
    ));
    let rows = map_sqlx_error(
        sqlx::query(&sql)
            .bind(owner.tenant_id)
            .bind(owner.user_id)
            .bind(session_id)
            .bind(format!("{PROVIDER_MESSAGE_ID_PREFIX}%"))
            .fetch_all(&mut **tx)
            .await,
    )?;
    rows.iter()
        .map(|row| {
            let row = map_sqlx_error(MessageRow::from_row(row))?;
            Ok(LocalMessage {
                id: row.id,
                turn_id: row.turn_id,
                role: row.role,
                content: row.content,
                created_at: row.created_at,
            })
        })
        .collect()
}

async fn load_local_events(
    tx: &mut Transaction<'_, sqlx::Any>,
    is_postgres: bool,
    owner: SessionOwnerScope,
    session_id: &str,
) -> Result<Vec<LocalEvent>, CodingSessionError> {
    let projection = row_projection::event(is_postgres, "e");
    let sql = numbered_placeholders(&format!(
        "SELECT {projection} FROM {} e WHERE e.{} = ? AND e.{} = ? AND e.{} = ? \
         AND e.{} NOT LIKE ? AND e.{IS_NOT_DELETED} \
         AND e.{} IN ('message.completed', 'message.delta') ORDER BY e.{} ASC",
        columns::event::TABLE,
        columns::event::TENANT_ID,
        columns::event::USER_ID,
        columns::event::CODING_SESSION_ID,
        columns::event::ID,
        columns::event::EVENT_KIND,
        columns::event::SEQUENCE_NO,
    ));
    let rows = map_sqlx_error(
        sqlx::query(&sql)
            .bind(owner.tenant_id)
            .bind(owner.user_id)
            .bind(session_id)
            .bind(format!("{PROVIDER_EVENT_ID_PREFIX}%"))
            .fetch_all(&mut **tx)
            .await,
    )?;
    rows.iter()
        .map(|row| {
            let event = row_mapper::event_row_to_payload(map_sqlx_error(EventRow::from_row(row))?);
            Ok(LocalEvent {
                turn_id: event.turn_id,
                kind: event.kind,
                sequence: event.sequence,
                payload: event.payload,
                created_at: event.created_at,
            })
        })
        .collect()
}

fn desired_provider_message_ids(
    input: &NativeSessionHistoryReconciliationInput,
    local_messages: &[LocalMessage],
    local_events: &[LocalEvent],
) -> BTreeSet<String> {
    let local_evidence = build_local_logical_message_evidence(local_messages, local_events);
    let mut consumed_evidence = vec![false; local_evidence.len()];
    let mut desired_message_ids = BTreeSet::new();

    for message in &input.messages {
        let provider_events = input
            .events
            .iter()
            .filter(|event| event.message_id == message.id)
            .collect::<Vec<_>>();
        let equivalent_evidence = local_evidence
            .iter()
            .enumerate()
            .find(|(index, evidence)| {
                !consumed_evidence[*index]
                    && provider_message_matches_local_evidence(
                        message,
                        provider_events.as_slice(),
                        evidence,
                    )
            })
            .map(|(index, _)| index);
        if let Some(index) = equivalent_evidence {
            consumed_evidence[index] = true;
        } else {
            desired_message_ids.insert(message.id.clone());
        }
    }

    desired_message_ids
}

fn build_local_logical_message_evidence(
    local_messages: &[LocalMessage],
    local_events: &[LocalEvent],
) -> Vec<LocalLogicalMessageEvidence> {
    let mut evidence = Vec::new();
    for message in local_messages {
        attach_local_projection(
            &mut evidence,
            LocalMessageProjection {
                kind: LocalMessageProjectionKind::Message,
                logical_message_id: normalize_optional_string(Some(message.id.as_str())),
                turn_id: normalize_optional_string(message.turn_id.as_deref()),
                role: message.role.clone(),
                content: message.content.clone(),
                created_at: vec![message.created_at.clone()],
            },
        );
    }
    for event in local_events
        .iter()
        .filter(|event| event.kind == "message.completed")
    {
        let Some(role) = payload_string(&event.payload, "role") else {
            continue;
        };
        let Some(content) = payload_message_content(&event.payload) else {
            continue;
        };
        attach_local_projection(
            &mut evidence,
            LocalMessageProjection {
                kind: LocalMessageProjectionKind::CompletedEvent,
                logical_message_id: normalize_optional_string(payload_string(
                    &event.payload,
                    "messageId",
                )),
                turn_id: normalize_optional_string(event.turn_id.as_deref()),
                role: role.to_owned(),
                content: content.to_owned(),
                created_at: vec![event.created_at.clone()],
            },
        );
    }
    for projection in aggregate_local_delta_projections(local_events) {
        attach_local_projection(&mut evidence, projection);
    }
    evidence
}

fn attach_local_projection(
    evidence: &mut Vec<LocalLogicalMessageEvidence>,
    projection: LocalMessageProjection,
) {
    let exact_identity_match = projection
        .logical_message_id
        .as_deref()
        .and_then(|message_id| {
            evidence.iter().position(|candidate| {
                candidate.projections.iter().any(|candidate_projection| {
                    candidate_projection.logical_message_id.as_deref() == Some(message_id)
                })
            })
        });
    let fallback_match = exact_identity_match.or_else(|| {
        evidence.iter().position(|candidate| {
            !candidate
                .projections
                .iter()
                .any(|candidate_projection| candidate_projection.kind == projection.kind)
                && candidate.projections.iter().any(|candidate_projection| {
                    local_projections_are_equivalent(candidate_projection, &projection)
                })
        })
    });
    if let Some(index) = fallback_match {
        evidence[index].projections.push(projection);
    } else {
        evidence.push(LocalLogicalMessageEvidence {
            projections: vec![projection],
        });
    }
}

fn aggregate_local_delta_projections(local_events: &[LocalEvent]) -> Vec<LocalMessageProjection> {
    let mut aggregates =
        BTreeMap::<(String, String, Option<String>), (usize, String, Vec<String>)>::new();
    for event in local_events
        .iter()
        .filter(|event| event.kind == "message.delta")
    {
        let Some(turn_id) = normalize_optional_string(event.turn_id.as_deref()) else {
            continue;
        };
        let Some(role) = payload_string(&event.payload, "role") else {
            continue;
        };
        let Some(delta) = payload_message_content(&event.payload) else {
            continue;
        };
        let logical_message_id =
            normalize_optional_string(payload_string(&event.payload, "messageId"));
        let aggregate = aggregates
            .entry((
                turn_id,
                role.trim().to_ascii_lowercase(),
                logical_message_id,
            ))
            .or_insert_with(|| (event.sequence, String::new(), Vec::new()));
        aggregate.0 = aggregate.0.min(event.sequence);
        aggregate.1.push_str(delta);
        aggregate.2.push(event.created_at.clone());
    }

    let mut projections = aggregates
        .into_iter()
        .map(
            |((turn_id, role, logical_message_id), (sequence, content, created_at))| {
                (
                    sequence,
                    LocalMessageProjection {
                        kind: LocalMessageProjectionKind::DeltaAggregate,
                        logical_message_id,
                        turn_id: Some(turn_id),
                        role,
                        content,
                        created_at,
                    },
                )
            },
        )
        .collect::<Vec<_>>();
    projections.sort_by_key(|(sequence, _)| *sequence);
    projections
        .into_iter()
        .map(|(_, projection)| projection)
        .collect()
}

fn local_projections_are_equivalent(
    left: &LocalMessageProjection,
    right: &LocalMessageProjection,
) -> bool {
    roles_equal(&left.role, &right.role)
        && contents_equal(&left.content, &right.content)
        && (same_turn(left.turn_id.as_deref(), right.turn_id.as_deref())
            || timestamps_overlap(left.created_at.as_slice(), right.created_at.as_slice()))
}

fn provider_message_matches_local_evidence(
    provider: &ReconciledCodingSessionMessageInput,
    provider_events: &[&ReconciledCodingSessionEventInput],
    local: &LocalLogicalMessageEvidence,
) -> bool {
    local
        .projections
        .iter()
        .any(|projection| match projection.kind {
            LocalMessageProjectionKind::Message => {
                roles_equal(&provider.role, &projection.role)
                    && contents_equal(&provider.content, &projection.content)
                    && (same_turn(provider.turn_id.as_deref(), projection.turn_id.as_deref())
                        || projection.created_at.iter().any(|created_at| {
                            timestamps_are_near(&provider.created_at, created_at)
                        }))
            }
            LocalMessageProjectionKind::CompletedEvent
            | LocalMessageProjectionKind::DeltaAggregate => provider_events
                .iter()
                .any(|event| provider_event_matches_local_projection(event, projection)),
        })
}

fn provider_event_matches_local_projection(
    provider: &ReconciledCodingSessionEventInput,
    local: &LocalMessageProjection,
) -> bool {
    let Some(provider_role) = payload_string(&provider.payload, "role") else {
        return false;
    };
    let Some(provider_content) = payload_message_content(&provider.payload) else {
        return false;
    };
    roles_equal(provider_role, &local.role)
        && contents_equal(provider_content, &local.content)
        && (same_turn(provider.turn_id.as_deref(), local.turn_id.as_deref())
            || local
                .created_at
                .iter()
                .any(|created_at| timestamps_are_near(&provider.created_at, created_at)))
}

async fn upsert_message(
    tx: &mut Transaction<'_, sqlx::Any>,
    is_postgres: bool,
    owner: SessionOwnerScope,
    session_id: &str,
    input: &ReconciledCodingSessionMessageInput,
) -> Result<(), CodingSessionError> {
    let serialized = SerializedMessageFields {
        metadata_json: serde_json::to_string(&input.metadata)
            .map_err(|error| RepositoryError::Mapping(error.to_string()))?,
        tool_calls_json: optional_json(&input.tool_calls)?,
        file_changes_json: optional_json(&input.file_changes)?,
        commands_json: optional_json(&input.commands)?,
        task_progress_json: optional_json(&input.task_progress)?,
        timestamp_ms: parse_timestamp(&input.created_at)
            .map(|timestamp| (timestamp.unix_timestamp_nanos() / 1_000_000) as i64),
    };

    let projection = row_projection::message(is_postgres, "");
    let select_sql = numbered_placeholders(&format!(
        "SELECT {projection}, {} AS owner_tenant_id, {} AS owner_user_id FROM {} WHERE {} = ?",
        columns::message::TENANT_ID,
        columns::message::USER_ID,
        columns::message::TABLE,
        columns::message::ID,
    ));
    let existing = map_sqlx_error(
        sqlx::query(&select_sql)
            .bind(&input.id)
            .fetch_optional(&mut **tx)
            .await,
    )?;
    if let Some(row) = existing {
        ensure_stored_row_scope(&row, owner, session_id, "message", &input.id)?;
        let row = map_sqlx_error(MessageRow::from_row(&row))?;
        if message_row_matches(&row, input, &serialized)? {
            return Ok(());
        }
        let timestamp_expression = timestamp_expression(is_postgres);
        let json_expression = json_expression(is_postgres);
        let sql = numbered_placeholders(&format!(
            "UPDATE {} SET {} = {timestamp_expression}, {} = {timestamp_expression}, \
             {} = {} + 1, {} = FALSE, {} = ?, {} = ?, {} = ?, {} = {json_expression}, \
             {} = ?, {} = NULL, {} = {json_expression}, {} = ?, {} = {json_expression}, \
             {} = {json_expression}, {} = {json_expression} WHERE {} = ? AND {} = ? AND {} = ? AND {} = ?",
            columns::message::TABLE,
            columns::message::CREATED_AT,
            columns::message::UPDATED_AT,
            columns::message::VERSION,
            columns::message::VERSION,
            columns::message::IS_DELETED,
            columns::message::TURN_ID,
            columns::message::ROLE,
            columns::message::CONTENT,
            columns::message::METADATA_JSON,
            columns::message::TIMESTAMP_MS,
            columns::message::NAME,
            columns::message::TOOL_CALLS_JSON,
            columns::message::TOOL_CALL_ID,
            columns::message::FILE_CHANGES_JSON,
            columns::message::COMMANDS_JSON,
            columns::message::TASK_PROGRESS_JSON,
            columns::message::ID,
            columns::message::TENANT_ID,
            columns::message::USER_ID,
            columns::message::CODING_SESSION_ID,
        ));
        sqlx::query(&sql)
            .bind(&input.created_at)
            .bind(&input.created_at)
            .bind(&input.turn_id)
            .bind(&input.role)
            .bind(&input.content)
            .bind(&serialized.metadata_json)
            .bind(serialized.timestamp_ms)
            .bind(&serialized.tool_calls_json)
            .bind(&input.tool_call_id)
            .bind(&serialized.file_changes_json)
            .bind(&serialized.commands_json)
            .bind(&serialized.task_progress_json)
            .bind(&input.id)
            .bind(owner.tenant_id)
            .bind(owner.user_id)
            .bind(session_id)
            .execute(&mut **tx)
            .await
            .map_err(|error| RepositoryError::Update(error.to_string()))?;
        return Ok(());
    }

    let timestamp_expression = timestamp_expression(is_postgres);
    let json_expression = json_expression(is_postgres);
    let sql = numbered_placeholders(&format!(
        "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
         VALUES (?, {timestamp_expression}, {timestamp_expression}, 0, FALSE, ?, ?, ?, ?, ?, ?, \
                 {json_expression}, ?, NULL, {json_expression}, ?, {json_expression}, {json_expression}, {json_expression})",
        columns::message::TABLE,
        columns::message::ID,
        columns::message::CREATED_AT,
        columns::message::UPDATED_AT,
        columns::message::VERSION,
        columns::message::IS_DELETED,
        columns::message::TENANT_ID,
        columns::message::USER_ID,
        columns::message::CODING_SESSION_ID,
        columns::message::TURN_ID,
        columns::message::ROLE,
        columns::message::CONTENT,
        columns::message::METADATA_JSON,
        columns::message::TIMESTAMP_MS,
        columns::message::NAME,
        columns::message::TOOL_CALLS_JSON,
        columns::message::TOOL_CALL_ID,
        columns::message::FILE_CHANGES_JSON,
        columns::message::COMMANDS_JSON,
        columns::message::TASK_PROGRESS_JSON,
    ));
    sqlx::query(&sql)
        .bind(&input.id)
        .bind(&input.created_at)
        .bind(&input.created_at)
        .bind(owner.tenant_id)
        .bind(owner.user_id)
        .bind(session_id)
        .bind(&input.turn_id)
        .bind(&input.role)
        .bind(&input.content)
        .bind(&serialized.metadata_json)
        .bind(serialized.timestamp_ms)
        .bind(&serialized.tool_calls_json)
        .bind(&input.tool_call_id)
        .bind(&serialized.file_changes_json)
        .bind(&serialized.commands_json)
        .bind(&serialized.task_progress_json)
        .execute(&mut **tx)
        .await
        .map_err(|error| RepositoryError::Insert(error.to_string()))?;
    Ok(())
}

async fn upsert_event(
    tx: &mut Transaction<'_, sqlx::Any>,
    is_postgres: bool,
    owner: SessionOwnerScope,
    session_id: &str,
    runtime_id: &str,
    input: &ReconciledCodingSessionEventInput,
) -> Result<(), CodingSessionError> {
    let payload_json = serde_json::to_string(&input.payload)
        .map_err(|error| RepositoryError::Mapping(error.to_string()))?;
    let projection = row_projection::event(is_postgres, "");
    let select_sql = numbered_placeholders(&format!(
        "SELECT {projection}, {} AS owner_tenant_id, {} AS owner_user_id FROM {} WHERE {} = ?",
        columns::event::TENANT_ID,
        columns::event::USER_ID,
        columns::event::TABLE,
        columns::event::ID,
    ));
    let existing = map_sqlx_error(
        sqlx::query(&select_sql)
            .bind(&input.id)
            .fetch_optional(&mut **tx)
            .await,
    )?;
    if let Some(row) = existing {
        ensure_stored_row_scope(&row, owner, session_id, "event", &input.id)?;
        let row = map_sqlx_error(EventRow::from_row(&row))?;
        if event_row_matches(&row, input, runtime_id, &payload_json)? {
            return Ok(());
        }
        let timestamp_expression = timestamp_expression(is_postgres);
        let json_expression = json_expression(is_postgres);
        let sql = numbered_placeholders(&format!(
            "UPDATE {} SET {} = {timestamp_expression}, {} = {timestamp_expression}, \
             {} = {} + 1, {} = FALSE, {} = ?, {} = ?, {} = ?, {} = {json_expression} \
             WHERE {} = ? AND {} = ? AND {} = ? AND {} = ?",
            columns::event::TABLE,
            columns::event::CREATED_AT,
            columns::event::UPDATED_AT,
            columns::event::VERSION,
            columns::event::VERSION,
            columns::event::IS_DELETED,
            columns::event::TURN_ID,
            columns::event::RUNTIME_ID,
            columns::event::EVENT_KIND,
            columns::event::PAYLOAD_JSON,
            columns::event::ID,
            columns::event::TENANT_ID,
            columns::event::USER_ID,
            columns::event::CODING_SESSION_ID,
        ));
        sqlx::query(&sql)
            .bind(&input.created_at)
            .bind(&input.created_at)
            .bind(&input.turn_id)
            .bind(runtime_id)
            .bind(&input.kind)
            .bind(&payload_json)
            .bind(&input.id)
            .bind(owner.tenant_id)
            .bind(owner.user_id)
            .bind(session_id)
            .execute(&mut **tx)
            .await
            .map_err(|error| RepositoryError::Update(error.to_string()))?;
        return Ok(());
    }

    let sequence = next_event_sequence(tx, owner, session_id).await?;
    let timestamp_expression = timestamp_expression(is_postgres);
    let json_expression = json_expression(is_postgres);
    let sql = numbered_placeholders(&format!(
        "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
         VALUES (?, {timestamp_expression}, {timestamp_expression}, 0, FALSE, ?, ?, ?, ?, ?, ?, ?, {json_expression})",
        columns::event::TABLE,
        columns::event::ID,
        columns::event::CREATED_AT,
        columns::event::UPDATED_AT,
        columns::event::VERSION,
        columns::event::IS_DELETED,
        columns::event::TENANT_ID,
        columns::event::USER_ID,
        columns::event::CODING_SESSION_ID,
        columns::event::TURN_ID,
        columns::event::RUNTIME_ID,
        columns::event::EVENT_KIND,
        columns::event::SEQUENCE_NO,
        columns::event::PAYLOAD_JSON,
    ));
    sqlx::query(&sql)
        .bind(&input.id)
        .bind(&input.created_at)
        .bind(&input.created_at)
        .bind(owner.tenant_id)
        .bind(owner.user_id)
        .bind(session_id)
        .bind(&input.turn_id)
        .bind(runtime_id)
        .bind(&input.kind)
        .bind(sequence)
        .bind(&payload_json)
        .execute(&mut **tx)
        .await
        .map_err(|error| RepositoryError::Insert(error.to_string()))?;
    Ok(())
}

async fn next_event_sequence(
    tx: &mut Transaction<'_, sqlx::Any>,
    owner: SessionOwnerScope,
    session_id: &str,
) -> Result<i64, CodingSessionError> {
    let sql = numbered_placeholders(&format!(
        "SELECT COALESCE(MAX({}), 0) FROM {} WHERE {} = ? AND {} = ? AND {} = ?",
        columns::event::SEQUENCE_NO,
        columns::event::TABLE,
        columns::event::TENANT_ID,
        columns::event::USER_ID,
        columns::event::CODING_SESSION_ID,
    ));
    let max_sequence = map_sqlx_error(
        sqlx::query_scalar::<sqlx::Any, i64>(&sql)
            .bind(owner.tenant_id)
            .bind(owner.user_id)
            .bind(session_id)
            .fetch_one(&mut **tx)
            .await,
    )?;
    max_sequence.checked_add(1).ok_or_else(|| {
        CodingSessionError::Conflict(format!(
            "event sequence space is exhausted for session {session_id}"
        ))
    })
}

async fn soft_delete_missing_provider_rows(
    tx: &mut Transaction<'_, sqlx::Any>,
    owner: SessionOwnerScope,
    session_id: &str,
    desired_message_ids: &BTreeSet<String>,
    desired_event_ids: &BTreeSet<String>,
    now: &str,
) -> Result<(), CodingSessionError> {
    soft_delete_missing_rows(
        tx,
        columns::message::TABLE,
        PROVIDER_MESSAGE_ID_PREFIX,
        owner,
        session_id,
        desired_message_ids,
        now,
    )
    .await?;
    soft_delete_missing_rows(
        tx,
        columns::event::TABLE,
        PROVIDER_EVENT_ID_PREFIX,
        owner,
        session_id,
        desired_event_ids,
        now,
    )
    .await
}

async fn soft_delete_missing_rows(
    tx: &mut Transaction<'_, sqlx::Any>,
    table: &str,
    prefix: &str,
    owner: SessionOwnerScope,
    session_id: &str,
    desired_ids: &BTreeSet<String>,
    now: &str,
) -> Result<(), CodingSessionError> {
    let select_sql = numbered_placeholders(&format!(
        "SELECT id FROM {table} WHERE tenant_id = ? AND user_id = ? AND coding_session_id = ? \
         AND id LIKE ? AND {IS_NOT_DELETED}"
    ));
    let ids = map_sqlx_error(
        sqlx::query_scalar::<sqlx::Any, String>(&select_sql)
            .bind(owner.tenant_id)
            .bind(owner.user_id)
            .bind(session_id)
            .bind(format!("{prefix}%"))
            .fetch_all(&mut **tx)
            .await,
    )?;
    let timestamp_expression = timestamp_expression(transaction_is_postgres(tx));
    let update_sql = numbered_placeholders(&format!(
        "UPDATE {table} SET {SET_SOFT_DELETED}, updated_at = {timestamp_expression}, \
         version = version + 1 WHERE id = ? AND tenant_id = ? AND user_id = ? \
         AND coding_session_id = ? AND id LIKE ? AND {IS_NOT_DELETED}"
    ));
    for id in ids.into_iter().filter(|id| !desired_ids.contains(id)) {
        sqlx::query(&update_sql)
            .bind(now)
            .bind(&id)
            .bind(owner.tenant_id)
            .bind(owner.user_id)
            .bind(session_id)
            .bind(format!("{prefix}%"))
            .execute(&mut **tx)
            .await
            .map_err(|error| RepositoryError::Update(error.to_string()))?;
    }
    Ok(())
}

async fn update_session_transcript(
    tx: &mut Transaction<'_, sqlx::Any>,
    is_postgres: bool,
    owner: SessionOwnerScope,
    session_id: &str,
    current: &SessionTranscriptState,
    source_revision: &str,
    last_turn_at: Option<&str>,
) -> Result<(), CodingSessionError> {
    let transcript_updated_at = later_optional_timestamp(
        current.transcript_updated_at.as_deref(),
        Some(source_revision),
    )
    .unwrap_or_else(|| source_revision.to_owned());
    let updated_at = later_timestamp(current.updated_at.as_str(), source_revision);
    let last_turn_at = later_optional_timestamp(
        current.last_turn_at.as_deref(),
        last_turn_at.or(Some(source_revision)),
    )
    .unwrap_or_else(|| source_revision.to_owned());
    if timestamps_equal(
        &transcript_updated_at,
        current.transcript_updated_at.as_deref().unwrap_or(""),
    ) && timestamps_equal(&updated_at, &current.updated_at)
        && current
            .last_turn_at
            .as_deref()
            .is_some_and(|current_last_turn_at| {
                timestamps_equal(&last_turn_at, current_last_turn_at)
            })
    {
        return Ok(());
    }
    let timestamp_expression = timestamp_expression(is_postgres);
    let sql = numbered_placeholders(&format!(
        "UPDATE {} SET {} = {timestamp_expression}, {} = {timestamp_expression}, \
         {} = {timestamp_expression}, {} = {} + 1 WHERE {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED}",
        columns::session::TABLE,
        columns::session::TRANSCRIPT_UPDATED_AT,
        columns::session::UPDATED_AT,
        columns::session::LAST_TURN_AT,
        columns::session::VERSION,
        columns::session::VERSION,
        columns::session::ID,
        columns::session::TENANT_ID,
        columns::session::USER_ID,
    ));
    let result = sqlx::query(&sql)
        .bind(&transcript_updated_at)
        .bind(&updated_at)
        .bind(&last_turn_at)
        .bind(session_id)
        .bind(owner.tenant_id)
        .bind(owner.user_id)
        .execute(&mut **tx)
        .await
        .map_err(|error| RepositoryError::Update(error.to_string()))?;
    if result.rows_affected() != 1 {
        return Err(RepositoryError::NotFound(format!("session {session_id} not found")).into());
    }
    Ok(())
}

async fn update_runtime_reconciliation_state(
    tx: &mut Transaction<'_, sqlx::Any>,
    is_postgres: bool,
    update: RuntimeReconciliationUpdate<'_>,
) -> Result<(), CodingSessionError> {
    let metadata_json = serde_json::to_string(update.metadata)
        .map_err(|error| RepositoryError::Mapping(error.to_string()))?;
    let timestamp_expression = timestamp_expression(is_postgres);
    let json_expression = json_expression(is_postgres);
    let version_assignment = if update.revision_changed {
        format!(
            "{} = {} + 1",
            columns::runtime::VERSION,
            columns::runtime::VERSION
        )
    } else {
        format!(
            "{} = {}",
            columns::runtime::VERSION,
            columns::runtime::VERSION
        )
    };
    let sql = numbered_placeholders(&format!(
        "UPDATE {} SET {} = ?, {} = {json_expression}, {} = {timestamp_expression}, \
         {version_assignment} WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} = ? \
         AND {} = ? AND {} = ? AND {IS_NOT_DELETED}",
        columns::runtime::TABLE,
        columns::runtime::NATIVE_TURN_CONTAINER_ID,
        columns::runtime::METADATA_JSON,
        columns::runtime::UPDATED_AT,
        columns::runtime::ID,
        columns::runtime::CODING_SESSION_ID,
        columns::runtime::TENANT_ID,
        columns::runtime::USER_ID,
        columns::runtime::ENGINE_ID,
        columns::runtime::NATIVE_SESSION_ID,
        columns::runtime::TRANSPORT_KIND,
    ));
    let result = sqlx::query(&sql)
        .bind(update.source_revision)
        .bind(&metadata_json)
        .bind(update.now)
        .bind(update.runtime_id)
        .bind(update.session_id)
        .bind(update.owner.tenant_id)
        .bind(update.owner.user_id)
        .bind(update.engine_id)
        .bind(update.native_session_id)
        .bind("provider-native")
        .execute(&mut **tx)
        .await
        .map_err(|error| RepositoryError::Update(error.to_string()))?;
    if result.rows_affected() != 1 {
        return Err(CodingSessionError::Conflict(format!(
            "provider runtime binding for session {} changed during reconciliation",
            update.session_id
        )));
    }
    Ok(())
}

fn ensure_stored_row_scope(
    row: &sqlx::any::AnyRow,
    owner: SessionOwnerScope,
    session_id: &str,
    kind: &str,
    id: &str,
) -> Result<(), CodingSessionError> {
    let tenant_id = map_sqlx_error(row.try_get::<i64, _>("owner_tenant_id"))?;
    let user_id = map_sqlx_error(row.try_get::<i64, _>("owner_user_id"))?;
    let stored_session_id =
        map_sqlx_error(row.try_get::<String, _>(columns::message::CODING_SESSION_ID))?;
    if tenant_id != owner.tenant_id || user_id != owner.user_id || stored_session_id != session_id {
        return Err(CodingSessionError::Conflict(format!(
            "provider history {kind} id {id} belongs to another owner or session"
        )));
    }
    Ok(())
}

fn message_row_matches(
    row: &MessageRow,
    input: &ReconciledCodingSessionMessageInput,
    serialized: &SerializedMessageFields,
) -> Result<bool, CodingSessionError> {
    Ok(row.is_deleted == 0
        && timestamps_equal(&row.created_at, &input.created_at)
        && row.turn_id == input.turn_id
        && row.role == input.role
        && row.content == input.content
        && json_equal(
            Some(row.metadata_json.as_str()),
            Some(serialized.metadata_json.as_str()),
        )?
        && row.timestamp_ms == serialized.timestamp_ms
        && json_equal(
            row.tool_calls_json.as_deref(),
            serialized.tool_calls_json.as_deref(),
        )?
        && row.tool_call_id == input.tool_call_id
        && json_equal(
            row.file_changes_json.as_deref(),
            serialized.file_changes_json.as_deref(),
        )?
        && json_equal(
            row.commands_json.as_deref(),
            serialized.commands_json.as_deref(),
        )?
        && json_equal(
            row.task_progress_json.as_deref(),
            serialized.task_progress_json.as_deref(),
        )?)
}

fn event_row_matches(
    row: &EventRow,
    input: &ReconciledCodingSessionEventInput,
    runtime_id: &str,
    payload_json: &str,
) -> Result<bool, CodingSessionError> {
    Ok(row.is_deleted == 0
        && timestamps_equal(&row.created_at, &input.created_at)
        && row.turn_id == input.turn_id
        && row.runtime_id.as_deref() == Some(runtime_id)
        && row.event_kind == input.kind
        && json_equal(Some(row.payload_json.as_str()), Some(payload_json))?)
}

fn json_equal(left: Option<&str>, right: Option<&str>) -> Result<bool, CodingSessionError> {
    match (left, right) {
        (None, None) => Ok(true),
        (Some(left), Some(right)) => {
            let left = serde_json::from_str::<serde_json::Value>(left).map_err(|error| {
                CodingSessionError::Conflict(format!(
                    "stored provider history JSON is malformed: {error}"
                ))
            })?;
            let right = serde_json::from_str::<serde_json::Value>(right)
                .map_err(|error| RepositoryError::Mapping(error.to_string()))?;
            Ok(left == right)
        }
        _ => Ok(false),
    }
}

fn optional_json<T: serde::Serialize>(
    value: &Option<T>,
) -> Result<Option<String>, CodingSessionError> {
    value
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|error| RepositoryError::Mapping(error.to_string()).into())
}

fn parse_metadata_object(
    value: &str,
) -> Result<serde_json::Map<String, serde_json::Value>, CodingSessionError> {
    serde_json::from_str::<serde_json::Value>(value)
        .map_err(|error| {
            CodingSessionError::Conflict(format!("provider runtime metadata is malformed: {error}"))
        })?
        .as_object()
        .cloned()
        .ok_or_else(|| {
            CodingSessionError::Conflict(
                "provider runtime metadata must remain a JSON object".to_owned(),
            )
        })
}

fn payload_string<'a>(
    payload: &'a BTreeMap<String, serde_json::Value>,
    field: &str,
) -> Option<&'a str> {
    payload.get(field).and_then(serde_json::Value::as_str)
}

fn payload_message_content(payload: &BTreeMap<String, serde_json::Value>) -> Option<&str> {
    payload_string(payload, "content").or_else(|| payload_string(payload, "contentDelta"))
}

fn normalize_optional_string(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn roles_equal(left: &str, right: &str) -> bool {
    left.trim().eq_ignore_ascii_case(right.trim())
}

fn contents_equal(left: &str, right: &str) -> bool {
    normalize_projection_overlay_message_content(left)
        .zip(normalize_projection_overlay_message_content(right))
        .is_some_and(|(left, right)| left == right)
}

fn same_turn(left: Option<&str>, right: Option<&str>) -> bool {
    left.map(str::trim)
        .filter(|value| !value.is_empty())
        .zip(right.map(str::trim).filter(|value| !value.is_empty()))
        .is_some_and(|(left, right)| left == right)
}

fn timestamps_are_near(left: &str, right: &str) -> bool {
    parse_timestamp(left)
        .zip(parse_timestamp(right))
        .is_some_and(|(left, right)| {
            let left_ms = left.unix_timestamp_nanos() / 1_000_000;
            let right_ms = right.unix_timestamp_nanos() / 1_000_000;
            (left_ms - right_ms).abs() <= i128::from(MESSAGE_EQUIVALENCE_WINDOW_MS)
        })
}

fn timestamps_overlap(left: &[String], right: &[String]) -> bool {
    left.iter()
        .any(|left| right.iter().any(|right| timestamps_are_near(left, right)))
}

fn timestamps_equal(left: &str, right: &str) -> bool {
    parse_timestamp(left)
        .zip(parse_timestamp(right))
        .map(|(left, right)| left == right)
        .unwrap_or_else(|| left == right)
}

fn later_timestamp(left: &str, right: &str) -> String {
    match (parse_timestamp(left), parse_timestamp(right)) {
        (Some(left_timestamp), Some(right_timestamp)) if left_timestamp > right_timestamp => {
            left.to_owned()
        }
        _ => right.to_owned(),
    }
}

fn later_optional_timestamp(left: Option<&str>, right: Option<&str>) -> Option<String> {
    match (left, right) {
        (Some(left), Some(right)) => Some(later_timestamp(left, right)),
        (Some(left), None) => Some(left.to_owned()),
        (None, Some(right)) => Some(right.to_owned()),
        (None, None) => None,
    }
}

fn revision_is_older(incoming: &str, stored: &str) -> bool {
    parse_timestamp(incoming)
        .zip(parse_timestamp(stored))
        .is_some_and(|(incoming, stored)| incoming < stored)
}

fn parse_timestamp(value: &str) -> Option<OffsetDateTime> {
    OffsetDateTime::parse(
        value.trim(),
        &time::format_description::well_known::Iso8601::DEFAULT,
    )
    .ok()
}

fn latest_provider_message_timestamp(
    input: &NativeSessionHistoryReconciliationInput,
) -> Option<&str> {
    input
        .messages
        .iter()
        .max_by_key(|message| parse_timestamp(&message.created_at))
        .map(|message| message.created_at.as_str())
}

fn now_iso() -> String {
    OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Iso8601::DEFAULT)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_owned())
}

fn discovery_runtime_id(session_id: &str) -> String {
    format!("{session_id}:native-discovery-runtime")
}

fn transaction_is_postgres(tx: &mut Transaction<'_, sqlx::Any>) -> bool {
    tx.as_mut()
        .backend_name()
        .eq_ignore_ascii_case("PostgreSQL")
}

fn timestamp_expression(is_postgres: bool) -> &'static str {
    if is_postgres {
        "CAST(? AS TIMESTAMPTZ)"
    } else {
        "?"
    }
}

fn json_expression(is_postgres: bool) -> &'static str {
    if is_postgres {
        "CAST(? AS JSONB)"
    } else {
        "?"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn namespaced_provider_ids_are_required() {
        let input = NativeSessionHistoryReconciliationInput {
            engine_id: "codex".to_owned(),
            native_session_id: "native-1".to_owned(),
            refresh_revision: "2026-07-22T00:00:00Z".to_owned(),
            source_revision: "2026-07-22T00:00:00Z".to_owned(),
            messages: vec![ReconciledCodingSessionMessageInput {
                id: "not-namespaced".to_owned(),
                turn_id: None,
                role: "assistant".to_owned(),
                content: "done".to_owned(),
                metadata: BTreeMap::new(),
                tool_calls: None,
                tool_call_id: None,
                file_changes: None,
                commands: None,
                task_progress: None,
                created_at: "2026-07-22T00:00:00Z".to_owned(),
            }],
            events: Vec::new(),
        };
        assert!(validate_input(&input).is_err());
    }
}
