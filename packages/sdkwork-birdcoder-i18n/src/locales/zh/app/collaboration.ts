import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('app/collaboration', {
  "app": {
    "shareProject": "分享项目",
    "accessLevel": "访问级别",
    "private": "私有",
    "publicLink": "公开链接",
    "inviteCollaborators": "邀请协作者",
    "emailPlaceholder": "电子邮件地址...",
    "invite": "邀请",
    "done": "完成",
    "publishUnavailable": "发布功能暂不可用",
    "publishUnavailableTitle": "需要接入 runtime-backed 发布流程",
    "publishUnavailableDesc": "当前工作区尚未接通真实发布链路，在接入 runtime-backed 发布流程之前无法从界面执行发布。",
    "createNewBranch": "创建新分支",
    "branchName": "分支名称",
    "branchNamePlaceholder": "例如 feature/new-login",
    "createBranch": "创建分支",
    "commitChanges": "提交更改",
    "commitMessage": "提交信息",
    "commitMessagePlaceholder": "更新登录组件...",
    "commit": "提交",
    "pushToRemote": "推送到远程",
    "pushToRemoteDesc": "将您提交的更改推送到远程仓库。",
    "push": "推送"
  }
});
