use crate::context::WorkspaceContext;
use crate::domain::results::{TeamMemberPayload, TeamPayload};
use crate::error::WorkspaceError;

#[async_trait::async_trait]
pub trait TeamRepository: Send + Sync {
    /// List teams with SQL-pushed `LIMIT`/`OFFSET` and a parallel
    /// `COUNT(*)` for the total. Aligns with `PAGINATION_SPEC.md` §2/§5.
    async fn list_teams(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: Option<&str>,
        user_id: Option<&str>,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<TeamPayload>, usize), WorkspaceError>;

    /// List team members with SQL-pushed `LIMIT`/`OFFSET` and a parallel
    /// `COUNT(*)` for the total.
    async fn list_team_members(
        &self,
        ctx: &WorkspaceContext,
        team_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<TeamMemberPayload>, usize), WorkspaceError>;
}
