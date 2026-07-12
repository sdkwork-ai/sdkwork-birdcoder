import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('studio/dialogs', {
  "studio": {
    "shareProject": "分享项目",
    "accessLevel": "访问级别",
    "private": "私有",
    "publicLink": "公开链接",
    "publicLinkUnavailable": "不可用",
    "publicLinkUnavailableDesc": "当前项目尚未创建公开访问权限，仍保持私有；如需共享，请邀请协作者。",
    "inviteCollaborators": "邀请协作者",
    "emailAddress": "邮箱地址...",
    "invite": "邀请",
    "done": "完成",
    "publishUnavailable": "发布功能暂不可用",
    "publishUnavailableTitle": "需要接入 runtime-backed 发布流程",
    "publishUnavailableDesc": "当前工作区尚未接通真实发布链路，在接入 runtime-backed 发布流程之前无法从界面执行发布。",
    "invitationSent": "邀请已发送"
  }
});
