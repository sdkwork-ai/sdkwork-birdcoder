import { defineLocaleModule } from '../resource.ts';

export default defineLocaleModule('auth', {
  auth: {
    scanToLogin: '扫码即可登录',
    qrInstructionLine1: '打开移动端应用并扫描二维码',
    qrInstructionLine2: '即可安全登录到你的工作区。',
    signInTitle: '登录 SDKWork',
    createAccountTitle: '创建账户',
    nameLabel: '姓名',
    emailLabel: '邮箱',
    passwordLabel: '密码',
    namePlaceholder: '输入你的姓名',
    emailPlaceholder: '输入你的邮箱',
    passwordPlaceholder: '输入你的密码',
    createPasswordPlaceholder: '创建密码',
    signIn: '登录',
    signUp: '注册',
    forgotPassword: '忘记密码？',
    alreadyHaveAccount: '已有账户？登录',
    createAccountCta: '创建账户',
    orContinueWith: '或使用以下方式继续',
    continueWithGithub: '使用 GitHub 继续',
    continueWithGoogle: '使用 Google 继续',
    continueWithWeChat: '使用微信继续',
  },
});
