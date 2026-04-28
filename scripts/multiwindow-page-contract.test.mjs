import assert from 'node:assert/strict';
import fs from 'node:fs';

const universalChatSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx', import.meta.url),
  'utf8',
);
const uiIndexSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/index.ts', import.meta.url),
  'utf8',
);
const useProjectsSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useProjects.ts', import.meta.url),
  'utf8',
);
const pagePath = new URL(
  '../packages/sdkwork-birdcoder-multiwindow/src/pages/MultiWindowProgrammingPage.tsx',
  import.meta.url,
);
const headerPath = new URL(
  '../packages/sdkwork-birdcoder-multiwindow/src/components/MultiWindowHeader.tsx',
  import.meta.url,
);
const gridPath = new URL(
  '../packages/sdkwork-birdcoder-multiwindow/src/components/MultiWindowGrid.tsx',
  import.meta.url,
);
const panePath = new URL(
  '../packages/sdkwork-birdcoder-multiwindow/src/components/MultiWindowPane.tsx',
  import.meta.url,
);
const sessionPickerPath = new URL(
  '../packages/sdkwork-birdcoder-multiwindow/src/components/MultiWindowSessionPicker.tsx',
  import.meta.url,
);
const configurationFormPath = new URL(
  '../packages/sdkwork-birdcoder-multiwindow/src/components/MultiWindowPaneConfigurationForm.tsx',
  import.meta.url,
);
const addFlowRuntimePath = new URL(
  '../packages/sdkwork-birdcoder-multiwindow/src/runtime/multiWindowAddFlow.ts',
  import.meta.url,
);
const dispatchabilityRuntimePath = new URL(
  '../packages/sdkwork-birdcoder-multiwindow/src/runtime/multiWindowDispatchability.ts',
  import.meta.url,
);
const settingsPath = new URL(
  '../packages/sdkwork-birdcoder-multiwindow/src/components/MultiWindowPaneSettings.tsx',
  import.meta.url,
);
const composerPath = new URL(
  '../packages/sdkwork-birdcoder-multiwindow/src/components/MultiWindowComposer.tsx',
  import.meta.url,
);

for (const requiredPath of [
  pagePath,
  headerPath,
  gridPath,
  panePath,
  sessionPickerPath,
  configurationFormPath,
  addFlowRuntimePath,
  dispatchabilityRuntimePath,
  settingsPath,
  composerPath,
]) {
  assert.ok(
    fs.existsSync(requiredPath),
    `Expected multi-window component file to exist: ${requiredPath.pathname}`,
  );
}

const pageSource = fs.readFileSync(pagePath, 'utf8');
const headerSource = fs.readFileSync(headerPath, 'utf8');
const gridSource = fs.readFileSync(gridPath, 'utf8');
const paneSource = fs.readFileSync(panePath, 'utf8');
const sessionPickerSource = fs.readFileSync(sessionPickerPath, 'utf8');
const configurationFormSource = fs.readFileSync(configurationFormPath, 'utf8');
const addFlowRuntimeSource = fs.readFileSync(addFlowRuntimePath, 'utf8');
const dispatchabilityRuntimeSource = fs.readFileSync(dispatchabilityRuntimePath, 'utf8');
const settingsSource = fs.readFileSync(settingsPath, 'utf8');
const composerSource = fs.readFileSync(composerPath, 'utf8');

assert.match(
  universalChatSource,
  /hideComposer\?: boolean;/,
  'UniversalChat must support transcript-only embedding through hideComposer.',
);

assert.match(
  pageSource,
  /useProjects\(workspaceId, \{\s*isActive: isVisible,\s*\}\)/,
  'Multi-window page must reuse the shared workbench project/session inventory.',
);

assert.match(
  pageSource,
  /dispatchMultiWindowPrompt\(/,
  'Multi-window page must use the shared concurrent dispatch runtime.',
);
assert.match(
  pageSource,
  /try \{[\s\S]*const result = await dispatchMultiWindowPrompt\([\s\S]*\} catch \(error\) \{[\s\S]*setDispatchState\('failed'\)[\s\S]*\} finally \{[\s\S]*setIsDispatching\(false\)/,
  'Multi-window page must always converge unexpected dispatch failures to a failed batch and release the running state.',
);

assert.match(
  pageSource,
  /sendMessage\(/,
  'Multi-window panes must send real instructions to bound coding sessions.',
);

assert.match(
  pageSource,
  /buildMultiWindowMessageMetadata\(/,
  'Multi-window broadcast must attach the pane model and parameter configuration to message metadata.',
);

assert.match(
  pageSource,
  /buildMultiWindowPaneDispatchPrompt\(/,
  'Multi-window broadcast must compile each pane prompt with its execution profile before sending.',
);

assert.match(
  pageSource,
  /dispatchPromptProfile\.prompt[\s\S]*executionProfile: dispatchPromptProfile\.executionProfile/,
  'Multi-window broadcast must send the compiled prompt and persist the same execution profile in metadata.',
);

assert.match(
  pageSource,
  /resolveMultiWindowPaneSessionProvisioningStatus\(/,
  'Multi-window broadcast must compare pane model configuration against the bound session before dispatch.',
);

assert.match(
  pageSource,
  /requiresSessionProvisioning:/,
  'Multi-window dispatch targets must be able to create a correctly configured session before sending.',
);

assert.match(
  pageSource,
  /createCodingSession\([\s\S]*buildMultiWindowProvisionedSessionTitle\([\s\S]*engineId: pane\.selectedEngineId[\s\S]*modelId: pane\.selectedModelId/,
  'Multi-window panes must create new sessions with their selected engine/model when the existing session does not match.',
);

assert.match(
  pageSource,
  /readMultiWindowWorkspaceState\(/,
  'Multi-window page must restore workspace-scoped pane layout and configuration.',
);

assert.match(
  pageSource,
  /writeMultiWindowWorkspaceState\(/,
  'Multi-window page must persist workspace-scoped pane layout and configuration.',
);
assert.doesNotMatch(
  pageSource,
  /buildInitialMultiWindowPaneConfigs/,
  'Multi-window page must not auto-select sessions from the current project; users must manually add windows.',
);
assert.match(
  pageSource,
  /DEFAULT_MULTI_WINDOW_ACTIVE_WINDOW_COUNT/,
  'Multi-window page must default to an empty manual-add window set.',
);
assert.match(
  pageSource,
  /handleCloseWindow/,
  'Multi-window page must support closing individual windows.',
);
const addWindowHandlerMatch = pageSource.match(
  /const handleAddWindow = useCallback\(\(\) => \{([\s\S]*?)\}, \[[^\]]*\]\);/,
);
assert.ok(
  addWindowHandlerMatch,
  'Multi-window page must keep manual add behavior inside handleAddWindow.',
);
assert.doesNotMatch(
  addWindowHandlerMatch[1],
  /setWindowCount\(/,
  'Clicking add window must open session selection first instead of immediately activating an empty pane.',
);
assert.match(
  addWindowHandlerMatch[1],
  /setSessionPickerPaneId\(targetPane\.id\)/,
  'Clicking add window must open the session picker for the next inactive pane.',
);
assert.match(
  pageSource,
  /activateSelectedPickerPane/,
  'Selecting or creating a session must be the step that activates the pending multi-window pane.',
);
assert.match(
  addFlowRuntimeSource,
  /export function resolveNextMultiWindowAddWindowCount/,
  'Multi-window add-window count progression must live in a pure runtime helper instead of page-local arithmetic.',
);
assert.match(
  addFlowRuntimeSource,
  /export function buildMultiWindowPendingAddProgress/,
  'Multi-window batch add progress must live in a pure runtime helper so page and tests share the same rules.',
);
assert.match(
  dispatchabilityRuntimeSource,
  /export function resolveMultiWindowPaneDispatchability/,
  'Pane dispatchability must live in a pure runtime helper instead of page-local UI logic.',
);
assert.match(
  dispatchabilityRuntimeSource,
  /export function countMultiWindowDispatchablePanes/,
  'Dispatchable pane counting must live in a pure runtime helper instead of page-local UI logic.',
);
assert.match(
  dispatchabilityRuntimeSource,
  /export function resolveMultiWindowComposerDisabledReason/,
  'Composer disabled reason selection must live in a pure runtime helper instead of page-local UI logic.',
);
assert.match(
  pageSource,
  /resolveNextMultiWindowAddWindowCount\(windowCount\)/,
  'The page must use the standard add-flow helper when adding one more window.',
);
assert.match(
  pageSource,
  /const sessionPickerAddProgress = useMemo\([\s\S]*buildMultiWindowPendingAddProgress\(/,
  'The page must derive pending batch-add progress through the standard add-flow helper.',
);
assert.match(
  pageSource,
  /const handleStopPendingAddSequence = useCallback\(\(\) => \{[\s\S]*setPendingWindowCountTarget\(null\)/,
  'The page must let users stop a multi-window batch add sequence after the current pane.',
);
assert.match(
  pageSource,
  /addProgress=\{sessionPickerAddProgress\}[\s\S]*onStopPendingAddSequence=\{handleStopPendingAddSequence\}/,
  'The page must pass batch-add progress and stop control into the session picker.',
);
assert.match(
  pageSource,
  /onClosePane=\{handleCloseWindow\}/,
  'Multi-window page must wire pane close actions into the grid.',
);

assert.match(
  useProjectsSource,
  /interface BirdCoderSendMessageOptions[\s\S]*metadata\?: Record<string, unknown>/,
  'Shared sendMessage must accept standard metadata so product modules can attach typed execution context.',
);

assert.match(
  headerSource,
  /MULTI_WINDOW_LAYOUT_COUNTS\.map/,
  'Multi-window header must expose the canonical 2/3/4/6/8 window count controls.',
);
assert.doesNotMatch(
  headerSource,
  /PanelsTopLeft/,
  'Multi-window header must not spend vertical space on the redundant multi-window title icon.',
);
assert.doesNotMatch(
  headerSource,
  /multiWindow\.title/,
  'Multi-window header must not render a redundant left-side title when the sidebar already names the mode.',
);
assert.match(
  headerSource,
  /px-3 py-2/,
  'Multi-window header must use compact vertical padding so panes keep more usable height.',
);
assert.match(
  headerSource,
  /disabled=\{windowCount >= MAX_MULTI_WINDOW_PANES\}/,
  'Multi-window header must disable manual add once the maximum pane count is visible.',
);

assert.match(
  headerSource,
  /onSetAllPaneModes\('chat'\)[\s\S]*onSetAllPaneModes\('preview'\)/,
  'Multi-window header must switch every pane into conversation or preview mode.',
);
assert.match(
  headerSource,
  /dispatchablePaneCount: number/,
  'Multi-window header must receive dispatchable pane count as a first-class readiness metric.',
);
assert.match(
  headerSource,
  /multiWindow\.readyWindowCount[\s\S]*dispatchablePaneCount[\s\S]*windowCount/,
  'Multi-window header must show ready window count beside global controls.',
);

assert.match(
  composerSource,
  /data-testid="multiwindow-bottom-composer"/,
  'Multi-window page must keep one bottom composer for broadcasting prompts to all windows.',
);
assert.match(
  composerSource,
  /disabledReason\?: string/,
  'Multi-window composer must accept a concrete disabled reason from the page.',
);
assert.match(
  composerSource,
  /disabledReason[\s\S]*text-amber-200/,
  'Multi-window composer must surface disabled readiness reasons near the input instead of failing silently.',
);
assert.match(
  uiIndexSource,
  /UniversalChatComposerChrome/,
  'The UI package must export the shared UniversalChat composer chrome used by Code and multi-window surfaces.',
);
assert.match(
  universalChatSource,
  /<UniversalChatComposerChrome[\s\S]*onResize=\{handleComposerResize\}/,
  'Code view UniversalChat must render through the shared composer chrome.',
);
assert.match(
  composerSource,
  /UniversalChatComposerChrome/,
  'Multi-window bottom composer must reuse the Code view chat composer chrome instead of owning a separate chat box frame.',
);
assert.doesNotMatch(
  composerSource,
  /RadioTower/,
  'Multi-window bottom composer must not use the old broadcast-specific input frame icon.',
);
assert.match(
  gridSource,
  /multiWindow\.emptyTitle[\s\S]*onAddWindow/,
  'Multi-window grid must render an empty state that lets users manually add the first window.',
);
assert.match(
  gridSource,
  /dispatchResultsByPaneId: ReadonlyMap<string, MultiWindowDispatchPaneResult>/,
  'Multi-window grid must receive standard pane dispatch results instead of flattening observability into status strings.',
);
assert.match(
  gridSource,
  /retryableFailedPaneIds: ReadonlySet<string>/,
  'Multi-window grid must receive the retryable failed pane id set for pane-local retry controls.',
);
assert.match(
  gridSource,
  /paneDispatchabilityByPaneId: ReadonlyMap<string, MultiWindowPaneDispatchability>/,
  'Multi-window grid must receive pane dispatchability as a standard runtime model.',
);
assert.match(
  gridSource,
  /dispatchResult=\{dispatchResultsByPaneId\.get\(pane\.id\)\}/,
  'Multi-window grid must pass each pane its complete dispatch result for status, timing, and error observability.',
);
assert.match(
  gridSource,
  /dispatchability=\{paneDispatchabilityByPaneId\.get\(pane\.id\)\}/,
  'Multi-window grid must pass each pane its dispatchability for readiness explanation.',
);
assert.match(
  gridSource,
  /canRetryPane=\{retryableFailedPaneIds\.has\(pane\.id\)\}/,
  'Multi-window grid must mark only retryable failed panes with pane-local retry affordances.',
);
assert.match(
  gridSource,
  /onRetryPane=\{\(\) => onRetryPane\(pane\.id\)\}/,
  'Multi-window grid must wire pane-local retry callbacks by pane id.',
);
assert.match(
  composerSource,
  /MultiWindowDispatchBatchSummary/,
  'Multi-window composer must consume the standard batch summary instead of owning a parallel summary model.',
);
assert.match(
  composerSource,
  /multiWindow\.durationSummary[\s\S]*multiWindow\.concurrencySummary/,
  'Multi-window composer must surface batch duration and concurrency summary for high-concurrency observability.',
);
assert.match(
  pageSource,
  /const \[dispatchSummary, setDispatchSummary\]/,
  'Multi-window page must keep the standard batch summary as first-class dispatch state.',
);
assert.match(
  pageSource,
  /setDispatchSummary\(result\.summary\)/,
  'Multi-window page must reconcile the runtime batch summary after each broadcast.',
);
assert.match(
  pageSource,
  /collectFailedMultiWindowDispatchPaneIds\(/,
  'Multi-window page must use the shared failed-pane retry selector instead of ad hoc status filtering.',
);
assert.match(
  pageSource,
  /const \[lastBroadcastPrompt, setLastBroadcastPrompt\]/,
  'Multi-window page must preserve the last broadcast prompt so failed windows can be retried without rewriting the instruction.',
);
assert.match(
  pageSource,
  /const \[lastBroadcastPrompt, setLastBroadcastPrompt\][\s\S]*handleRetryPanePrompt[\s\S]*targetPaneIds: \[paneId\]/,
  'Multi-window page must support retrying one failed pane from the pane itself using the last broadcast prompt.',
);
assert.match(
  pageSource,
  /const retryableFailedPaneIds = useMemo\([\s\S]*new Set\(visibleRetryFailedPaneIds\)/,
  'Multi-window page must expose a visible retryable pane id set for per-pane retry controls.',
);
assert.match(
  pageSource,
  /const visiblePaneDispatchabilityInputs = useMemo\([\s\S]*pane[\s\S]*binding: bindingsByPaneId\.get\(pane\.id\)\?\.codingSession/,
  'Multi-window page must build standard pane dispatchability inputs from visible panes and bindings.',
);
assert.match(
  pageSource,
  /const paneDispatchabilityByPaneId = useMemo\([\s\S]*resolveMultiWindowPaneDispatchability\(/,
  'Multi-window page must derive pane dispatchability through the standard runtime helper.',
);
assert.match(
  pageSource,
  /countMultiWindowDispatchablePanes\(visiblePaneDispatchabilityInputs\)/,
  'Multi-window page must compute ready window count through the standard runtime helper.',
);
assert.match(
  pageSource,
  /resolveMultiWindowComposerDisabledReason\([\s\S]*dispatchablePaneCount: visibleDispatchablePaneCount/,
  'Multi-window page must resolve composer disabled reason through the standard runtime helper.',
);
assert.match(
  pageSource,
  /const composerDisabledReasonText = composerDisabledReason[\s\S]*multiWindow\.broadcastDisabledReason\.\$\{composerDisabledReason\}/,
  'Multi-window page must translate standard composer disabled reason codes at the UI boundary.',
);
assert.match(
  pageSource,
  /disabled=\{Boolean\(composerDisabledReasonText\)\}/,
  'Multi-window composer must be disabled from the page-level dispatchability reason, not only from raw window count.',
);
assert.match(
  pageSource,
  /disabledReason=\{composerDisabledReasonText\}/,
  'Multi-window page must pass the concrete disabled reason into the shared bottom composer.',
);
assert.match(
  pageSource,
  /dispatchablePaneCount=\{visibleDispatchablePaneCount\}/,
  'Multi-window page must pass dispatchable pane count into the compact header for readiness visibility.',
);
assert.match(
  pageSource,
  /paneDispatchabilityByPaneId=\{paneDispatchabilityByPaneId\}/,
  'Multi-window page must pass pane dispatchability into the grid for pane-level readiness visibility.',
);
assert.match(
  pageSource,
  /onRetryPane=\{handleRetryPanePrompt\}/,
  'Multi-window page must wire per-pane retry into the grid.',
);
assert.match(
  pageSource,
  /handleRetryFailedPrompt/,
  'Multi-window page must expose a retry-failed action for partial high-concurrency batches.',
);
assert.match(
  pageSource,
  /activeDispatchBatchIdRef/,
  'Multi-window page must keep an active batch id ref so stale high-concurrency results cannot overwrite newer UI state.',
);
assert.match(
  pageSource,
  /activeDispatchAbortControllerRef/,
  'Multi-window page must own an AbortController ref for cancelling obsolete multi-window batches.',
);
assert.match(
  pageSource,
  /cancelActiveDispatchBatch\(/,
  'Multi-window page must cancel the active batch during workspace lifecycle resets.',
);
assert.match(
  pageSource,
  /isActiveDispatchBatch\(/,
  'Multi-window page must guard async pane and batch reconciliation behind the active batch id.',
);
assert.match(
  pageSource,
  /signal: dispatchAbortController\.signal/,
  'Multi-window page must pass the active AbortSignal into the shared concurrent dispatch runtime.',
);
assert.match(
  pageSource,
  /handleCancelDispatch/,
  'Multi-window page must expose a user-triggered cancel action for the active high-concurrency batch.',
);
assert.match(
  pageSource,
  /onCancelDispatch=\{handleCancelDispatch\}/,
  'Multi-window page must wire the manual cancel action into the bottom composer.',
);
assert.match(
  pageSource,
  /dispatchSummary=\{dispatchSummary\}/,
  'Multi-window page must pass the runtime batch summary to the bottom composer.',
);
assert.match(
  composerSource,
  /onRetryFailed/,
  'Multi-window composer must expose the retry-failed action near the batch summary.',
);
assert.match(
  composerSource,
  /multiWindow\.retryFailed/,
  'Multi-window composer must label failed-pane retry with a localized command.',
);
assert.match(
  composerSource,
  /onCancelDispatch/,
  'Multi-window composer must expose a manual cancel action while a batch is running.',
);
assert.match(
  composerSource,
  /multiWindow\.cancelDispatch/,
  'Multi-window composer must label manual batch cancellation with a localized command.',
);

assert.match(
  paneSource,
  /<UniversalChat[\s\S]*hideComposer=\{true\}/,
  'Each multi-window pane must reuse UniversalChat as a transcript-only shared message surface.',
);

assert.match(
  paneSource,
  /resolveMultiWindowPaneSessionProvisioningStatus\(/,
  'Each multi-window pane must surface whether its selected model configuration needs a new backing session.',
);

assert.match(
  paneSource,
  /multiWindow\.autoProvisionSession/,
  'Each multi-window pane must tell users when the next broadcast will create a matching session.',
);

assert.match(
  paneSource,
  /data-testid="multiwindow-preview-frame"/,
  'Each pane must provide a preview surface for web/page-building comparison.',
);
assert.match(
  paneSource,
  /resolveMultiWindowPaneAutoPreviewUrl\(messages\)/,
  'Each pane must derive an automatic preview URL from its session messages.',
);
assert.match(
  paneSource,
  /manualPreviewUrl !== 'about:blank'[\s\S]*autoPreviewUrl[\s\S]*previewUrl/,
  'Manual preview URLs must override automatically detected session preview URLs.',
);
assert.match(
  paneSource,
  /hasAutoPreviewUrl[\s\S]*multiWindow\.autoPreviewUrl/,
  'Each pane must visibly identify when its preview URL was auto-detected from the session transcript.',
);
assert.match(
  paneSource,
  /hasAutoPreviewUrl[\s\S]*onChange\(\{ \.\.\.pane, previewUrl: autoPreviewUrl/,
  'Each pane must let users lock an automatically detected preview URL into the manual preview URL field.',
);
assert.match(
  paneSource,
  /hasManualPreviewOverride[\s\S]*onChange\(\{ \.\.\.pane, previewUrl: 'about:blank' \}\)/,
  'Each pane must let users clear a manual preview URL override and return to automatic preview detection.',
);
assert.match(
  paneSource,
  /dispatchResult\?: MultiWindowDispatchPaneResult/,
  'Each pane must receive the standard dispatch result for pane-local execution observability.',
);
assert.match(
  paneSource,
  /canRetryPane\?: boolean/,
  'Each pane must receive an explicit retryability flag so failed windows can be retried without guessing from UI text.',
);
assert.match(
  paneSource,
  /dispatchability\?: MultiWindowPaneDispatchability/,
  'Each pane must receive standard dispatchability so it can explain readiness before broadcast.',
);
assert.match(
  paneSource,
  /dispatchability\.status === 'not-dispatchable'[\s\S]*multiWindow\.paneDispatchabilityReason/,
  'Each pane must surface why a window cannot receive broadcasts before the user sends a prompt.',
);
assert.match(
  paneSource,
  /multiWindow\.paneDuration[\s\S]*dispatchResult\.durationMs/,
  'Each pane must show its own dispatch duration after a broadcast batch.',
);
assert.match(
  paneSource,
  /canRetryPane[\s\S]*onRetryPane\(\)[\s\S]*multiWindow\.retryPane/,
  'Each failed pane must expose a pane-local retry action.',
);
assert.match(
  paneSource,
  /onClose\(\)[\s\S]*multiWindow\.closeWindow/,
  'Each pane must expose a close action for removing a window from the comparison set.',
);

assert.match(
  sessionPickerSource,
  /const \[sessionSearchQuery, setSessionSearchQuery\]/,
  'The multi-window session picker must provide a search box so users can quickly locate a session.',
);
assert.match(
  sessionPickerSource,
  /filteredCodingSessions/,
  'The multi-window session picker must filter sessions by title, model, engine, status, and id.',
);
assert.match(
  sessionPickerSource,
  /formatBirdCoderSessionDisplayTime\(/,
  'The multi-window session picker must show recent activity so similar session titles can be distinguished.',
);
assert.match(
  sessionPickerSource,
  /codingSession\.engineId[\s\S]*codingSession\.modelId/,
  'The multi-window session picker must show engine and model metadata for every session.',
);
assert.match(
  sessionPickerSource,
  /codingSession\.messages\.length/,
  'The multi-window session picker must show message count metadata for every session.',
);
assert.match(
  sessionPickerSource,
  /formatShortSessionId\(codingSession\.id\)/,
  'The multi-window session picker must expose a short session id for disambiguating similar sessions.',
);
assert.match(
  sessionPickerSource,
  /type SessionPickerMode = 'select' \| 'create'/,
  'The multi-window session picker must model selecting an existing session and creating a new session as explicit modes.',
);
assert.match(
  sessionPickerSource,
  /interface MultiWindowSessionPickerAddProgress/,
  'The multi-window session picker must model pending batch-add progress explicitly.',
);
assert.match(
  sessionPickerSource,
  /addProgress\?: MultiWindowSessionPickerAddProgress \| null/,
  'The multi-window session picker must receive optional pending batch-add progress.',
);
assert.match(
  sessionPickerSource,
  /onStopPendingAddSequence\?: \(\) => void/,
  'The multi-window session picker must receive a control for ending a pending batch-add sequence.',
);
assert.match(
  sessionPickerSource,
  /addProgress[\s\S]*multiWindow\.addProgress[\s\S]*currentWindowNumber[\s\S]*targetWindowCount/,
  'The session picker must explain which window in the requested batch is being configured.',
);
assert.match(
  sessionPickerSource,
  /addProgress[\s\S]*multiWindow\.stopAfterCurrentWindow[\s\S]*onStopPendingAddSequence\(\)/,
  'The session picker must let users stop after configuring the current pending window.',
);
assert.match(
  sessionPickerSource,
  /const \[sessionPickerMode, setSessionPickerMode\] = useState<SessionPickerMode>\('select'\)/,
  'The multi-window session picker must default to selecting an existing session while exposing a direct create flow.',
);
assert.match(
  sessionPickerSource,
  /multiWindow\.selectExistingSession[\s\S]*multiWindow\.createSessionAndAdd/,
  'The multi-window session picker must label both existing-session selection and direct create-and-add paths.',
);
assert.match(
  sessionPickerSource,
  /sessionPickerMode === 'create'[\s\S]*onCreateSession\(activeProjectId\)/,
  'The direct create mode must create a new session for the active project and add it to the pending window.',
);
assert.match(
  sessionPickerSource,
  /multiWindow\.createFirstSessionAndAdd/,
  'Projects without sessions must show a primary create-first-session-and-add action.',
);
assert.doesNotMatch(
  sessionPickerSource,
  /multiWindow\.createFirstSessionAndAdd[\s\S]*onClick=\{\(\) => onCreateSession\(activeProjectId\)\}/,
  'The empty-project create-first action must not bypass the new-session configuration step.',
);
assert.match(
  sessionPickerSource,
  /multiWindow\.createFirstSessionAndAdd[\s\S]*onClick=\{\(\) => setSessionPickerMode\('create'\)\}/,
  'The empty-project create-first action must open the configured create flow before creating the session.',
);
assert.match(
  sessionPickerSource,
  /pane: MultiWindowPaneConfig[\s\S]*preferences: WorkbenchPreferences[\s\S]*onPaneChange: \(pane: MultiWindowPaneConfig\) => void/,
  'The multi-window session picker must receive the pending pane configuration so new sessions can be configured before creation.',
);
assert.match(
  sessionPickerSource,
  /sessionPickerMode === 'create'[\s\S]*<MultiWindowPaneConfigurationForm[\s\S]*pane=\{pane\}[\s\S]*preferences=\{preferences\}[\s\S]*onChange=\{onPaneChange\}/,
  'The direct create mode must expose the shared pane configuration form before creating and adding a session.',
);
assert.match(
  pageSource,
  /<MultiWindowSessionPicker[\s\S]*pane=\{selectedPickerPane\}[\s\S]*preferences=\{preferences\}[\s\S]*onPaneChange=\{handlePaneChange\}/,
  'The multi-window page must wire pending pane configuration changes from the picker before session creation.',
);
assert.match(
  pageSource,
  /const handleCreateSessionForPane = useCallback\(async \(nextProjectId: string\)[\s\S]*createCodingSession\([\s\S]*engineId: selectedPickerPane\.selectedEngineId[\s\S]*modelId: selectedPickerPane\.selectedModelId[\s\S]*activateSelectedPickerPane\(selectedPickerPane\.id\)/,
  'Creating a session from the picker must create it with the pane model configuration and activate the pending window.',
);

assert.match(
  settingsSource,
  /MultiWindowPaneConfigurationForm/,
  'Each pane settings surface must use the shared pane configuration form.',
);

assert.match(
  sessionPickerSource,
  /multiWindow\.newSessionConfiguration/,
  'The direct create flow must label pane configuration as part of new-session creation.',
);

assert.match(
  configurationFormSource,
  /temperature[\s\S]*topP[\s\S]*maxOutputTokens/,
  'The shared pane configuration form must include model parameter configuration.',
);

assert.match(
  configurationFormSource,
  /selectedEngineId[\s\S]*selectedModelId[\s\S]*mode/,
  'The shared pane configuration form must support per-window engine, model, and mode configuration.',
);

assert.match(
  configurationFormSource,
  /checked=\{pane\.enabled\}[\s\S]*enabled: event\.target\.checked/,
  'The shared pane configuration form must expose an enable switch so windows can be kept visible but excluded from broadcasts.',
);

console.log('multi-window page contract passed.');
