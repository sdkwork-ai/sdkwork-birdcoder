import settings from './settings.ts';
import terminal from './terminal.ts';
import common from './common.ts';
import commonExtra from './common-extra.ts';
import auth from './auth.ts';
import settingsExtra from './settings-extra.ts';
import settingsEngine from './settings-engine.ts';
import chat from './chat.ts';
import multiWindow from './multiwindow.ts';
import appErrors from './app/errors.ts';
import appBootstrap from './app/bootstrap.ts';
import appMenu from './app/menu.ts';
import appWorkspace from './app/workspace.ts';
import appSidebar from './app/sidebar.ts';
import appDialogs from './app/dialogs.ts';
import appGit from './app/git.ts';
import appTools from './app/tools.ts';
import codeSidebar from './code/sidebar.ts';
import codeTopBar from './code/topbar.ts';
import codeActions from './code/actions.ts';
import codeMobileProgramming from './code/mobile-programming.ts';
import studioPreview from './studio/preview.ts';
import studioWorkspace from './studio/workspace.ts';
import studioActions from './studio/actions.ts';
import uiContentPreview from './ui/content-preview.ts';
import userTokenPlanCommerce from './user/token-plan/commerce.ts';
import { buildLocaleResource, type LocaleModule } from '../resource.ts';

export const zhModules = [
  settings,
  terminal,
  common,
  commonExtra,
  auth,
  settingsExtra,
  settingsEngine,
  chat,
  multiWindow,
  appErrors,
  appBootstrap,
  appMenu,
  appWorkspace,
  appSidebar,
  appDialogs,
  appGit,
  appTools,
  codeSidebar,
  codeTopBar,
  codeActions,
  codeMobileProgramming,
  studioPreview,
  studioWorkspace,
  studioActions,
  uiContentPreview,
  userTokenPlanCommerce,
] as const satisfies readonly LocaleModule[];

export const zhTranslation = buildLocaleResource('zh', zhModules);

export default zhModules;
