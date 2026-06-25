use crate::context::WorkspaceContext;
use crate::domain::results::{TeamMemberPayload, TeamPayload};
use crate::error::WorkspaceError;

#[async_trait::async_trait]
pub trait TeamRepository: Send + Sync {
    async fn list_teams(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: Option<&str>,
        user_id: Option<&str>,
    ) -> Result<Vec<TeamPayload>, WorkspaceError>;

    async fn list_team_members(
        &self,
        ctx: &WorkspaceContext,
        team_id: &str,
    ) -> Result<Vec<TeamMemberPayload>, WorkspaceError>;
}
