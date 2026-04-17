import type {
  BirdCoderProjectCollaboratorSummary,
  BirdCoderUpsertProjectCollaboratorRequest,
  BirdCoderUpsertWorkspaceMemberRequest,
  BirdCoderWorkspaceMemberSummary,
} from '@sdkwork/birdcoder-types';

export interface ICollaborationService {
  listProjectCollaborators(projectId: string): Promise<BirdCoderProjectCollaboratorSummary[]>;
  listWorkspaceMembers(workspaceId: string): Promise<BirdCoderWorkspaceMemberSummary[]>;
  upsertProjectCollaborator(
    projectId: string,
    request: BirdCoderUpsertProjectCollaboratorRequest,
  ): Promise<BirdCoderProjectCollaboratorSummary>;
  upsertWorkspaceMember(
    workspaceId: string,
    request: BirdCoderUpsertWorkspaceMemberRequest,
  ): Promise<BirdCoderWorkspaceMemberSummary>;
}
