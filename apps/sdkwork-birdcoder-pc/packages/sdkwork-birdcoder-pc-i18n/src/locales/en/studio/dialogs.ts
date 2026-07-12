import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('studio/dialogs', {
  "studio": {
    "shareProject": "Share Project",
    "accessLevel": "Access Level",
    "private": "Private",
    "publicLink": "Public Link",
    "publicLinkUnavailable": "Unavailable",
    "publicLinkUnavailableDesc": "No public access has been created for this project. It remains private; invite collaborators to grant access.",
    "inviteCollaborators": "Invite Collaborators",
    "emailAddress": "Email address...",
    "invite": "Invite",
    "done": "Done",
    "publishUnavailable": "Publishing unavailable",
    "publishUnavailableTitle": "Runtime-backed release flow required",
    "publishUnavailableDesc": "This workspace cannot publish until a runtime-backed release flow is wired.",
    "invitationSent": "Invitation sent"
  }
});
