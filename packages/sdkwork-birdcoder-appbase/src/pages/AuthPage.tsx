import { useState } from 'react';
import { Chrome, Github, MessageCircle, Minus, QrCode, Square, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@sdkwork/birdcoder-commons';
import { Button } from '@sdkwork/birdcoder-ui';

export function AuthPage() {
  const { t } = useTranslation();
  const {
    authConfig,
    exchangeUserCenterSession,
    login,
    register,
    user,
  } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supportsLocalCredentials = authConfig?.supportsLocalCredentials ?? true;
  const supportsSessionExchange = authConfig?.supportsSessionExchange ?? false;
  const resolvedExternalProviderKey = authConfig?.providerKey?.trim() || 'external';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      if (!supportsLocalCredentials && supportsSessionExchange) {
        await exchangeUserCenterSession({
          email,
          name: name.trim() || undefined,
          providerKey: resolvedExternalProviderKey,
          subject: `${resolvedExternalProviderKey}:${email.trim().toLowerCase()}`,
        });
      } else if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthLogin = async (provider: string) => {
    setIsSubmitting(true);
    try {
      if (!supportsSessionExchange) {
        throw new Error('Current user center provider does not support third-party session exchange.');
      }

      const normalizedEmail = email.trim() || `${provider}.${Date.now()}@sdkwork-external.local`;
      await exchangeUserCenterSession({
        email: normalizedEmail,
        name: name.trim() || undefined,
        providerKey: resolvedExternalProviderKey,
        subject: `${provider}:${normalizedEmail.toLowerCase()}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e0e11] text-gray-100 p-4 font-sans relative">
      <div className="absolute top-0 right-0 h-10 flex items-center pr-2 z-50">
        <button className="h-full px-3 hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex items-center justify-center rounded-md">
          <Minus size={14} />
        </button>
        <button className="h-full px-3 hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex items-center justify-center rounded-md">
          <Square size={12} />
        </button>
        <button className="h-full px-3 hover:bg-red-500 text-gray-400 hover:text-white transition-colors flex items-center justify-center rounded-md">
          <X size={14} />
        </button>
      </div>

      <div className="w-full max-w-5xl bg-[#18181b] rounded-2xl border border-white/5 shadow-2xl flex overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className="hidden md:flex flex-col items-center justify-center w-1/2 bg-[#0e0e11] p-12 border-r border-white/5">
          <div className="mb-8 text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-blue-400 mb-3">
              sdkwork-appbase identity
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-white mb-2">
              SDKWork BirdCoder
            </h2>
            <p className="text-gray-400 text-sm max-w-xs">
              Unified auth, account, and membership architecture aligned to sdkwork-appbase capability standards.
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-inner mb-8">
            <div className="w-48 h-48 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-200">
              <QrCode size={120} className="text-gray-800" />
            </div>
          </div>

          <div className="text-center text-sm text-gray-500">
            <p>{t('auth.qrInstructionLine1')}</p>
            <p className="mt-1">{t('auth.qrInstructionLine2')}</p>
          </div>
        </div>

        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-[#18181b]">
          <h2 className="text-2xl font-semibold tracking-tight mb-2 text-center text-gray-100">
            {!supportsLocalCredentials
              ? 'Connect Identity Provider'
              : isLogin
                ? t('auth.signInTitle')
                : t('auth.createAccountTitle')}
          </h2>
          <p className="text-center text-sm text-gray-400 mb-6">
            {!supportsLocalCredentials && supportsSessionExchange
              ? `This deployment uses the "${resolvedExternalProviderKey}" user-center provider. Sessions are exchanged through the BirdCoder server API.`
              : 'Identity and session entry are standardized through the BirdCoder appbase bridge.'}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-6">
            {!supportsLocalCredentials || !isLogin ? (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                  {!supportsLocalCredentials ? 'Display name' : t('auth.nameLabel')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
                  placeholder={t('auth.namePlaceholder')}
                />
              </div>
            ) : null}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                {t('auth.emailLabel')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
                placeholder={t('auth.emailPlaceholder')}
              />
            </div>
            {supportsLocalCredentials ? (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                  {t('auth.passwordLabel')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
                  placeholder={isLogin ? t('auth.passwordPlaceholder') : t('auth.createPasswordPlaceholder')}
                />
              </div>
            ) : null}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 bg-white text-black hover:bg-gray-200 font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              {isSubmitting
                ? 'Applying identity workflow...'
                : !supportsLocalCredentials
                  ? 'Exchange Server Session'
                  : isLogin
                    ? t('auth.signIn')
                    : t('auth.signUp')}
            </Button>

            {supportsLocalCredentials ? (
              <div className="flex justify-between text-sm text-gray-400 mt-2">
                {isLogin ? (
                  <>
                    <button type="button" className="hover:text-white transition-colors">
                      {t('auth.forgotPassword')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLogin(false)}
                      className="hover:text-white transition-colors"
                    >
                      {t('auth.createAccountCta')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsLogin(true)}
                    className="hover:text-white transition-colors w-full text-center"
                  >
                    {t('auth.alreadyHaveAccount')}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-center text-gray-500 mt-2">
                The server keeps the authoritative session and returns the bound identity after exchange.
              </p>
            )}
          </form>

          {supportsSessionExchange ? (
            <>
              <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-white/10" />
                <span className="flex-shrink-0 mx-4 text-gray-500 text-xs uppercase tracking-wider font-medium">
                  {t('auth.orContinueWith')}
                </span>
                <div className="flex-grow border-t border-white/10" />
              </div>

              <div className="flex flex-col gap-3 mt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleOAuthLogin('github')}
                  className="w-full flex items-center justify-center gap-3 bg-white/[0.03] hover:bg-white/5 border border-white/10 text-gray-300 hover:text-white py-2.5 rounded-lg transition-colors text-sm font-medium disabled:opacity-60"
                >
                  <Github size={18} />
                  <span>{t('auth.continueWithGithub')}</span>
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleOAuthLogin('google')}
                  className="w-full flex items-center justify-center gap-3 bg-white/[0.03] hover:bg-white/5 border border-white/10 text-gray-300 hover:text-white py-2.5 rounded-lg transition-colors text-sm font-medium disabled:opacity-60"
                >
                  <Chrome size={18} />
                  <span>{t('auth.continueWithGoogle')}</span>
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleOAuthLogin('wechat')}
                  className="w-full flex items-center justify-center gap-3 bg-white/[0.03] hover:bg-white/5 border border-white/10 text-gray-300 hover:text-white py-2.5 rounded-lg transition-colors text-sm font-medium disabled:opacity-60"
                >
                  <MessageCircle size={18} className="text-[#07C160]" />
                  <span>{t('auth.continueWithWeChat')}</span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
