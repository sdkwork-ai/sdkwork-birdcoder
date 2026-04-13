import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { globalEventBus } from '../utils/EventBus';
import { useToast } from '../contexts/ToastProvider';

export function useCodingSessionActions(
  currentProjectId: string | undefined,
  createCodingSession: (projectId: string, name: string) => Promise<any>,
  onCodingSessionCreated: (codingSessionId: string) => void,
) {
  const { t } = useTranslation();
  const { addToast } = useToast();

  useEffect(() => {
    const handleCreateNewCodingSession = async () => {
      if (!currentProjectId) {
        addToast(t('thread.selectProjectFirst'), 'error');
        return;
      }
      try {
        const newCodingSession = await createCodingSession(
          currentProjectId,
          t('app.menu.newThread'),
        );
        onCodingSessionCreated(newCodingSession.id);
        addToast(t('thread.createdSuccessfully'), 'success');
        setTimeout(() => {
          globalEventBus.emit('focusChatInput');
        }, 100);
      } catch (error) {
        console.error('Failed to create coding session', error);
        addToast(t('thread.failedToCreate'), 'error');
      }
    };

    const unsubscribe = globalEventBus.on(
      'createNewCodingSession',
      handleCreateNewCodingSession,
    );
    return () => {
      unsubscribe();
    };
  }, [currentProjectId, createCodingSession, onCodingSessionCreated, addToast, t]);
}
