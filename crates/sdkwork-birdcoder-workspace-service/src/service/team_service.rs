use std::sync::Arc;

use sdkwork_utils_rust::is_blank;

use crate::context::WorkspaceContext;
use crate::domain::results::{TeamMemberPayload, TeamPayload};
use crate::error::WorkspaceError;
use crate::ports::repository::WorkspaceRepository;
use crate::ports::team::TeamRepository;

#[derive(Clone)]
pub struct TeamService {
    team_repository: Arc<dyn TeamRepository>,
    workspace_repository: Arc<dyn WorkspaceRepository>,
}

impl TeamService {
    pub fn new(
        team_repository: Arc<dyn TeamRepository>,
        workspace_repository: Arc<dyn WorkspaceRepository>,
    ) -> Self {
        Self {
            team_repository,
            workspace_repository,
        }
    }

    pub async fn list_teams(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: Option<&str>,
        user_id: Option<&str>,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<TeamPayload>, usize), WorkspaceError> {
        if let Some(workspace_id) = workspace_id {
            if is_blank(Some(workspace_id)) {
                return Err(WorkspaceError::InvalidInput(
                    "workspaceId is invalid.".to_owned(),
                ));
            }
            self.workspace_repository
                .ensure_workspace_access(ctx, workspace_id)
                .await?;
        }

        self.team_repository
            .list_teams(ctx, workspace_id, user_id, offset, limit)
            .await
    }

    pub async fn list_team_members(
        &self,
        ctx: &WorkspaceContext,
        team_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<TeamMemberPayload>, usize), WorkspaceError> {
        if is_blank(Some(team_id)) {
            return Err(WorkspaceError::InvalidInput("teamId is required.".to_owned()));
        }

        self.team_repository
            .list_team_members(ctx, team_id, offset, limit)
            .await
    }
}
