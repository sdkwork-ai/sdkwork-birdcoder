import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('app/collaboration', {
  "app": {
    "shareProject": "Share Project",
    "accessLevel": "Access Level",
    "private": "Private",
    "publicLink": "Public Link",
    "publicLinkUnavailable": "Unavailable",
    "publicLinkUnavailableDesc": "No public access has been created for this project. It remains private; invite collaborators to grant access.",
    "inviteCollaborators": "Invite Collaborators",
    "emailPlaceholder": "Email address...",
    "invite": "Invite",
    "done": "Done",
    "publishUnavailable": "Publishing unavailable",
    "publishUnavailableTitle": "Runtime-backed release flow required",
    "publishUnavailableDesc": "This workspace cannot publish until a runtime-backed release flow is wired.",
    "createNewBranch": "Create New Branch",
    "branchName": "Branch Name",
    "branchNamePlaceholder": "e.g. feature/new-login",
    "createBranch": "Create Branch",
    "commitChanges": "Commit Changes",
    "commitMessage": "Commit Message",
    "commitMessagePlaceholder": "Update login component...",
    "commit": "Commit",
    "pushToRemote": "Push to Remote",
    "pushToRemoteDesc": "Push your committed changes to the remote repository.",
    "push": "Push"
  }
});
