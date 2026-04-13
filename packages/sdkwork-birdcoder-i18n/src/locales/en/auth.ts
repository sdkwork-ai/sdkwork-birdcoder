import { defineLocaleModule } from '../resource.ts';

export default defineLocaleModule('auth', {
  auth: {
    scanToLogin: 'Scan to log in instantly',
    qrInstructionLine1: 'Open the mobile app and scan the QR code',
    qrInstructionLine2: 'to securely sign in to your workspace.',
    signInTitle: 'Sign In to SDKWork',
    createAccountTitle: 'Create an Account',
    nameLabel: 'Name',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    namePlaceholder: 'Enter your name',
    emailPlaceholder: 'Enter your email',
    passwordPlaceholder: 'Enter your password',
    createPasswordPlaceholder: 'Create a password',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    forgotPassword: 'Forgot Password?',
    alreadyHaveAccount: 'Already have an account? Sign In',
    createAccountCta: 'Create Account',
    orContinueWith: 'Or continue with',
    continueWithGithub: 'Continue with GitHub',
    continueWithGoogle: 'Continue with Google',
    continueWithWeChat: 'Continue with WeChat',
  },
});
