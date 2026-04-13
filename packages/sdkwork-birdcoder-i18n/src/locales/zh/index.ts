import settings from './settings.ts';
import terminal from './terminal.ts';
import common from './common.ts';
import commonExtra from './common-extra.ts';
import auth from './auth.ts';
import thread from './thread.ts';
import settingsExtra from './settings-extra.ts';
import chat from './chat.ts';
import appErrors from './app/errors.ts';
import appMenu from './app/menu.ts';
import appWorkspace from './app/workspace.ts';
import appSidebar from './app/sidebar.ts';
import appDialogs from './app/dialogs.ts';
import appCollaboration from './app/collaboration.ts';
import appTools from './app/tools.ts';
import codeSidebar from './code/sidebar.ts';
import codeTopBar from './code/topbar.ts';
import codeActions from './code/actions.ts';
import studioPreview from './studio/preview.ts';
import studioWorkspace from './studio/workspace.ts';
import studioActions from './studio/actions.ts';
import studioDialogs from './studio/dialogs.ts';
import { buildLocaleResource, type LocaleModule } from '../resource.ts';

export const zhModules = [
  settings,
  terminal,
  common,
  commonExtra,
  auth,
  thread,
  settingsExtra,
  chat,
  appErrors,
  appMenu,
  appWorkspace,
  appSidebar,
  appDialogs,
  appCollaboration,
  appTools,
  codeSidebar,
  codeTopBar,
  codeActions,
  studioPreview,
  studioWorkspace,
  studioActions,
  studioDialogs,
] as const satisfies readonly LocaleModule[];

export const zhTranslation = buildLocaleResource('zh', zhModules);

export default zhModules;
