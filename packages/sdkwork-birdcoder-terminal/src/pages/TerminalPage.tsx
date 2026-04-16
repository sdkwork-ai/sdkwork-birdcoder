import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, ChevronDown, ChevronLeft, ChevronRight, Terminal as TerminalIcon, Settings, SplitSquareHorizontal } from 'lucide-react';
import {
  buildTerminalGovernanceDiagnosticBundle,
  buildTerminalGovernanceReleaseNoteTemplate,
  buildTerminalGovernanceRecoveryDescription,
  BUILTIN_TERMINAL_PROFILES,
  buildTerminalProfileBlockedMessage,
  buildTerminalLayoutStorageKey,
  buildTerminalSessionRecord,
  closeTerminalHostSession,
  getTerminalProfile,
  listTerminalCliProfileAvailability,
  listTerminalLaunchProfileOptions,
  getStoredJson,
  getWorkbenchCodeEngineKernel,
  globalEventBus,
  isTerminalCliProfileId,
  listStoredTerminalSessions,
  listStoredTerminalGovernanceAuditRecords,
  openTerminalHostSession,
  removeStoredTerminalSession,
  resolveTerminalGovernanceRecoveryAction,
  resolveTerminalProfileBlockedAction,
  resolveTerminalProfileLaunchPresentation,
  resolveTerminalProfileLaunchState,
  runTerminalHostSessionCommand,
  saveStoredTerminalSession,
  setStoredJson,
  useFileSystem,
  useToast,
  useWorkbenchPreferences,
} from '@sdkwork/birdcoder-commons';
import { useTranslation } from 'react-i18next';
import type {
  TerminalCommandRequest,
  TerminalCliProfileAvailability,
  TerminalGovernanceAuditRecord,
  TerminalHostSessionStatus,
  TerminalProfileId,
  TerminalSessionRecord,
} from '@sdkwork/birdcoder-commons';

interface TerminalTab {
  id: string;
  title: string;
  profileId: TerminalProfileId;
  cwd: string;
  history: (string | React.ReactNode)[];
  commandHistory: string[];
  historyIndex: number;
  status: TerminalHostSessionStatus;
  lastExitCode: number | null;
}

interface TerminalPageProps {
  terminalRequest?: TerminalCommandRequest;
  workspaceId?: string | null;
  projectId?: string | null;
}

interface PersistedTerminalTab {
  id: string;
  profileId: TerminalProfileId;
  cwd: string;
  history: string[];
  commandHistory: string[];
  historyIndex: number;
  status: TerminalHostSessionStatus;
  lastExitCode: number | null;
}

interface PersistedTerminalLayout {
  tabs: PersistedTerminalTab[];
  activeTabIds: string[];
  focusedPaneIndex: number;
}

const TERMINAL_LAYOUT_SCOPE = 'terminal';

const TERMINAL_PROFILE_ICONS: Record<TerminalProfileId, React.ReactNode> = {
  powershell: <TerminalIcon size={14} className="text-[#3b78ff]" />,
  cmd: <TerminalIcon size={14} className="text-gray-300" />,
  ubuntu: <TerminalIcon size={14} className="text-[#e95420]" />,
  bash: <TerminalIcon size={14} className="text-[#f14e32]" />,
  node: <TerminalIcon size={14} className="text-[#33bc33]" />,
  codex: <TerminalIcon size={14} className="text-[#007acc]" />,
  'claude-code': <TerminalIcon size={14} className="text-[#d97757]" />,
  gemini: <TerminalIcon size={14} className="text-[#1a73e8]" />,
  opencode: <TerminalIcon size={14} className="text-[#10a37f]" />,
};

const TERMINAL_LAUNCH_PROFILES = listTerminalLaunchProfileOptions();
const TERMINAL_SHELL_LAUNCH_PROFILES = TERMINAL_LAUNCH_PROFILES.filter(
  (profile) => profile.kind === 'shell',
);
const TERMINAL_CLI_LAUNCH_PROFILES = TERMINAL_LAUNCH_PROFILES.filter(
  (profile) => profile.kind === 'cli',
);

function getInitialTerminalHistory(profileId: TerminalProfileId, _title: string): string[] {
  if (isTerminalCliProfileId(profileId)) {
    const engine = getWorkbenchCodeEngineKernel(profileId);
    return [
      `Welcome to ${engine.label} CLI`,
      'Type "help" to see available commands.',
      '',
    ];
  }

  switch (profileId) {
    case 'powershell':
      return [
        'Windows PowerShell',
        'Copyright (C) Microsoft Corporation. All rights reserved.',
        '',
        'Install the latest PowerShell for new features and improvements! https://aka.ms/PSWindows',
        '',
      ];
    case 'cmd':
      return [
        'Microsoft Windows [Version 10.0.22631.3296]',
        '(c) Microsoft Corporation. All rights reserved.',
        '',
      ];
    case 'ubuntu':
      return [
        'Welcome to Ubuntu 22.04.3 LTS (GNU/Linux 5.15.133.1-microsoft-standard-WSL2 x86_64)',
        '',
        ' * Documentation:  https://help.ubuntu.com',
        ' * Management:     https://landscape.canonical.com',
        ' * Support:        https://ubuntu.com/advantage',
        '',
      ];
    case 'node':
      return [
        'Welcome to Node.js v20.11.0.',
        'Type ".help" for more information.',
      ];
    default:
      return [];
  }
}

function createTerminalTab(
  profileId: TerminalProfileId = 'powershell',
  overrides: Partial<TerminalTab> = {},
): TerminalTab {
  const profile =
    BUILTIN_TERMINAL_PROFILES.find((item) => item.id === profileId) ?? BUILTIN_TERMINAL_PROFILES[0];

  return {
    id: overrides.id ?? `t${Date.now()}`,
    title: overrides.title ?? profile.title,
    profileId,
    cwd: overrides.cwd ?? profile.defaultCwd,
    history: overrides.history ?? getInitialTerminalHistory(profileId, profile.title),
    commandHistory: overrides.commandHistory ?? [],
    historyIndex: overrides.historyIndex ?? 0,
    status: overrides.status ?? 'idle',
    lastExitCode: overrides.lastExitCode ?? null,
  };
}

function buildDefaultLayout(
  defaultProfileId: TerminalProfileId,
  defaultWorkingDirectory: string,
): PersistedTerminalLayout {
  const defaultTab = createTerminalTab(defaultProfileId, {
    id: 't1',
    cwd: defaultWorkingDirectory,
  });
  return {
    tabs: [
      {
        id: defaultTab.id,
        profileId: defaultTab.profileId,
        cwd: defaultTab.cwd,
        history: defaultTab.history.filter((line): line is string => typeof line === 'string'),
        commandHistory: [],
        historyIndex: 0,
        status: defaultTab.status,
        lastExitCode: defaultTab.lastExitCode,
      },
    ],
    activeTabIds: [defaultTab.id],
    focusedPaneIndex: 0,
  };
}

function restoreLayout(layout: PersistedTerminalLayout) {
  const restoredTabs =
    layout.tabs.length > 0
      ? layout.tabs.map((tab) =>
          createTerminalTab(tab.profileId, {
            id: tab.id,
            cwd: tab.cwd,
            history: tab.history,
            commandHistory: tab.commandHistory,
            historyIndex: tab.historyIndex,
            status: tab.status,
            lastExitCode: tab.lastExitCode,
          }),
        )
      : [createTerminalTab('powershell', { id: 't1' })];

  const restoredActiveTabIds =
    layout.activeTabIds.length > 0 ? layout.activeTabIds : [restoredTabs[0].id];
  const restoredFocusedPaneIndex = Math.min(
    layout.focusedPaneIndex,
    restoredActiveTabIds.length - 1,
  );

  return {
    tabs: restoredTabs,
    activeTabIds: restoredActiveTabIds,
    focusedPaneIndex: Math.max(restoredFocusedPaneIndex, 0),
    inputValues: Object.fromEntries(restoredTabs.map((tab) => [tab.id, ''])),
  };
}

const getPrefix = (profileId: string, cwd: string) => {
  switch (profileId) {
    case 'powershell': return `PS ${cwd}> `;
    case 'cmd': return `${cwd}> `;
    case 'ubuntu': return `developer@ubuntu:${cwd}$ `;
    case 'bash': return `developer@MINGW64 ${cwd} $ `;
    case 'node': return `> `;
    default: return `> `;
  }
};

const getPrefixColor = (profileId: string) => {
  switch (profileId) {
    case 'powershell': return 'text-[#16c60c]';
    case 'ubuntu': return 'text-[#8ae234]';
    case 'bash': return 'text-[#8ae234]';
    case 'node': return 'text-[#33bc33]';
    default: return 'text-[#cccccc]';
  }
};

export function TerminalPage({ terminalRequest, workspaceId, projectId }: TerminalPageProps) {
  const { t } = useTranslation();
  const { refreshFiles } = useFileSystem(projectId ?? '');
  const { preferences, updatePreferences, isHydrated: isWorkbenchHydrated } = useWorkbenchPreferences();
  const preferredProfile = getTerminalProfile(preferences.terminalProfileId);
  const terminalLayoutKey = buildTerminalLayoutStorageKey(projectId);
  const [tabs, setTabs] = useState<TerminalTab[]>([createTerminalTab('powershell', { id: 't1' })]);
  const [activeTabIds, setActiveTabIds] = useState<string[]>(['t1']);
  const [focusedPaneIndex, setFocusedPaneIndex] = useState<number>(0);
  const [inputValues, setInputValues] = useState<Record<string, string>>({ 't1': '' });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, tabId: string } | null>(null);
  const [isLayoutHydrated, setIsLayoutHydrated] = useState(false);
  const [recentSessions, setRecentSessions] = useState<TerminalSessionRecord[]>([]);
  const [recentGovernanceAudits, setRecentGovernanceAudits] = useState<
    TerminalGovernanceAuditRecord[]
  >([]);
  const [cliAvailabilityByProfileId, setCliAvailabilityByProfileId] = useState<
    Partial<Record<TerminalProfileId, TerminalCliProfileAvailability>>
  >({});
  const { addToast } = useToast();
  
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const terminalEndRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const persistedTabIdsRef = useRef<string[]>([]);
  const hostSessionIdsRef = useRef<string[]>([]);
  
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    setIsLayoutHydrated(false);
    persistedTabIdsRef.current = [];
  }, [terminalLayoutKey]);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 2);
    }
  };

  useEffect(() => {
    checkScroll();
    
    const container = scrollContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      checkScroll();
    });
    
    resizeObserver.observe(container);
    
    // Also observe children additions/removals
    const mutationObserver = new MutationObserver(() => {
      checkScroll();
    });
    
    mutationObserver.observe(container, { childList: true, subtree: true });

    window.addEventListener('resize', checkScroll);
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  useEffect(() => {
    if (!isWorkbenchHydrated || isLayoutHydrated) {
      return;
    }

    let isMounted = true;

    void getStoredJson<PersistedTerminalLayout>(
      TERMINAL_LAYOUT_SCOPE,
      terminalLayoutKey,
      buildDefaultLayout(preferredProfile.id, preferences.defaultWorkingDirectory),
    )
      .then((layout) => {
        if (!isMounted) {
          return;
        }

        const restored = restoreLayout(layout);
        setTabs(restored.tabs);
        setActiveTabIds(restored.activeTabIds);
        setFocusedPaneIndex(restored.focusedPaneIndex);
        setInputValues(restored.inputValues);
        setIsLayoutHydrated(true);
      })
      .catch(() => {
        if (isMounted) {
          setIsLayoutHydrated(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    isLayoutHydrated,
    isWorkbenchHydrated,
    preferences.defaultWorkingDirectory,
    preferredProfile.id,
    terminalLayoutKey,
  ]);

  useEffect(() => {
    if (!isLayoutHydrated) {
      return;
    }

    const nextLayout: PersistedTerminalLayout = {
      tabs: tabs.map((tab) => ({
        id: tab.id,
        profileId: tab.profileId,
        cwd: tab.cwd,
        history: tab.history.filter((line): line is string => typeof line === 'string'),
        commandHistory: [...tab.commandHistory],
        historyIndex: tab.historyIndex,
        status: tab.status,
        lastExitCode: tab.lastExitCode,
      })),
      activeTabIds: [...activeTabIds],
      focusedPaneIndex,
    };

    void setStoredJson(TERMINAL_LAYOUT_SCOPE, terminalLayoutKey, nextLayout);
  }, [tabs, activeTabIds, focusedPaneIndex, isLayoutHydrated, terminalLayoutKey]);

  useEffect(() => {
    if (!isLayoutHydrated) {
      return;
    }

    const removedTabIds = persistedTabIdsRef.current.filter(
      (tabId) => !tabs.some((tab) => tab.id === tabId),
    );
    persistedTabIdsRef.current = tabs.map((tab) => tab.id);

    void Promise.all([
      ...tabs.map((tab) =>
        saveStoredTerminalSession(
          buildTerminalSessionRecord(tab, Date.now(), {
            workspaceId,
            projectId,
          }),
        ),
      ),
      ...removedTabIds.map((tabId) => removeStoredTerminalSession(tabId)),
    ]);
  }, [isLayoutHydrated, projectId, tabs, workspaceId]);

  useEffect(() => {
    let isMounted = true;

    void listTerminalCliProfileAvailability()
      .then((entries) => {
        if (!isMounted) {
          return;
        }

        setCliAvailabilityByProfileId(
          Object.fromEntries(entries.map((entry) => [entry.profileId, entry])) as Partial<
            Record<TerminalProfileId, TerminalCliProfileAvailability>
          >,
        );
      })
      .catch(() => {
        if (isMounted) {
          setCliAvailabilityByProfileId({});
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLayoutHydrated || !window.__TAURI__) {
      return;
    }

    const removedSessionIds = hostSessionIdsRef.current.filter(
      (sessionId) => !tabs.some((tab) => tab.id === sessionId),
    );
    hostSessionIdsRef.current = tabs.map((tab) => tab.id);

    void Promise.all([
      ...tabs.map((tab) =>
        openTerminalHostSession({
          sessionId: tab.id,
          profileId: tab.profileId,
          title: tab.title,
          cwd: tab.cwd,
        }),
      ),
      ...removedSessionIds.map((sessionId) => closeTerminalHostSession(sessionId)),
    ]);
  }, [isLayoutHydrated, tabs]);

  useEffect(() => {
    if (!isLayoutHydrated) {
      return;
    }

    void listStoredTerminalSessions({
      projectId: projectId ?? null,
      includeGlobal: true,
      limit: 6,
    })
      .then((sessions) => {
        setRecentSessions(sessions);
      })
      .catch((error) => {
        console.error('Failed to load terminal sessions', error);
      });

    void listStoredTerminalGovernanceAuditRecords()
      .then((records) => {
        setRecentGovernanceAudits(
          records.filter((record) => record.approvalDecision === 'blocked').slice(0, 3),
        );
      })
      .catch((error) => {
        console.error('Failed to load terminal governance audits', error);
      });
  }, [isLayoutHydrated, projectId, tabs]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeTabElement = scrollContainerRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (activeTabElement) {
        const container = scrollContainerRef.current;
        const tabLeft = activeTabElement.offsetLeft;
        const tabRight = tabLeft + activeTabElement.offsetWidth;
        const containerLeft = container.scrollLeft;
        const containerRight = containerLeft + container.clientWidth;

        if (tabLeft < containerLeft) {
          container.scrollTo({ left: tabLeft - 20, behavior: 'smooth' });
        } else if (tabRight > containerRight) {
          container.scrollTo({ left: tabRight - container.clientWidth + 20, behavior: 'smooth' });
        }
      }
    }
  }, [activeTabIds, focusedPaneIndex]);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const amount = 200;
      scrollContainerRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
      setTimeout(checkScroll, 300);
    }
  };

  const scrollToBottom = (tabId: string) => {
    terminalEndRefs.current[tabId]?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    activeTabIds.forEach(id => scrollToBottom(id));
  }, [tabs, activeTabIds]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      setContextMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSplitTerminal = () => {
    if (activeTabIds.length >= 2) {
      addToast(t('terminal.maximumSplitPanes'), 'info');
      return;
    }
    
    const currentTab = tabs.find(t => t.id === activeTabIds[focusedPaneIndex]);
    const profile =
      BUILTIN_TERMINAL_PROFILES.find(p => p.id === currentTab?.profileId) ?? BUILTIN_TERMINAL_PROFILES[0];
    const newTab = createTerminalTab(profile.id, { cwd: currentTab?.cwd || profile.defaultCwd });

    setTabs(prev => [...prev, newTab]);
    setInputValues(prev => ({ ...prev, [newTab.id]: '' }));
    setActiveTabIds(prev => [...prev, newTab.id]);
    setFocusedPaneIndex(activeTabIds.length);
    addToast(t('terminal.terminalSplit'), 'success');
  };

  const handleAddTab = (
    profile = preferredProfile,
    overrides: Partial<TerminalTab> = {},
  ) => {
    const launchState = resolveTerminalProfileLaunchState(
      profile.id,
      cliAvailabilityByProfileId[profile.id],
    );

    if (!launchState.canLaunch) {
      const blockedAction = resolveTerminalProfileBlockedAction(
        profile.id,
        cliAvailabilityByProfileId[profile.id],
      );
      setIsDropdownOpen(false);
      addToast(
        buildTerminalProfileBlockedMessage(profile.id, {
          launchState,
          blockedAction,
        }) ?? 'Blocked terminal profile.',
        'error',
      );
      if (blockedAction.actionId === 'open-settings') {
        globalEventBus.emit('openSettings');
      }
      return false;
    }

    const newTab = createTerminalTab(profile.id, {
      cwd: overrides.cwd ?? preferences.defaultWorkingDirectory,
      ...overrides,
    });

    setTabs(prev => [...prev, newTab]);
    setInputValues(prev => ({ ...prev, [newTab.id]: '' }));
    updatePreferences({ terminalProfileId: profile.id });
    
    setActiveTabIds(prev => {
      const newIds = [...prev];
      newIds[focusedPaneIndex] = newTab.id;
      return newIds;
    });
    setIsDropdownOpen(false);
    addToast(t('terminal.openedNewTab', { title: profile.title }), 'success');
    return true;
  };

  const handleRestoreSession = (session: TerminalSessionRecord) => {
    const profile = getTerminalProfile(session.profileId);
    const restored = handleAddTab(profile, {
      title: session.title,
      cwd: session.cwd || preferences.defaultWorkingDirectory,
      history:
        session.recentOutput.length > 0
          ? session.recentOutput
          : getInitialTerminalHistory(session.profileId, session.title),
      commandHistory: session.commandHistory,
      historyIndex: session.commandHistory.length,
      status: session.status,
      lastExitCode: session.lastExitCode,
    });
    if (restored) {
      addToast(`Restored ${session.title}`, 'success');
    }
  };

  const copyVisibleGovernanceDiagnostics = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      addToast('Clipboard unavailable for terminal governance diagnostics', 'error');
      return;
    }

    const governanceBundle = buildTerminalGovernanceDiagnosticBundle(recentGovernanceAudits);

    try {
      await navigator.clipboard.writeText(governanceBundle.content);
      addToast(`Copied ${recentGovernanceAudits.length} governance diagnostics`, 'success');
    } catch (error) {
      console.error('Failed to copy terminal governance diagnostics', error);
      addToast('Failed to copy terminal governance diagnostics', 'error');
    }
  };

  const copyVisibleGovernanceReleaseNote = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      addToast('Clipboard unavailable for terminal governance release note', 'error');
      return;
    }

    const governanceReleaseNote = buildTerminalGovernanceReleaseNoteTemplate(
      recentGovernanceAudits,
    );

    try {
      await navigator.clipboard.writeText(governanceReleaseNote.content);
      addToast(`Copied ${recentGovernanceAudits.length} governance release note`, 'success');
    } catch (error) {
      console.error('Failed to copy terminal governance release note', error);
      addToast('Failed to copy terminal governance release note', 'error');
    }
  };

  useEffect(() => {
    const handleNewTerminal = () => {
      handleAddTab();
    };
    globalEventBus.on('splitTerminal', handleSplitTerminal);
    globalEventBus.on('newTerminal', handleNewTerminal);

    return () => {
      globalEventBus.off('splitTerminal', handleSplitTerminal);
      globalEventBus.off('newTerminal', handleNewTerminal);
    };
  }, [activeTabIds, focusedPaneIndex, tabs, handleAddTab]);

  const [processedTimestamp, setProcessedTimestamp] = useState<number>(0);

  useEffect(() => {
    if ((terminalRequest?.path || terminalRequest?.command) && terminalRequest.timestamp !== processedTimestamp) {
      setProcessedTimestamp(terminalRequest.timestamp);
      const targetTabId = activeTabIds[focusedPaneIndex];
      const targetTab = tabs.find(tab => tab.id === targetTabId);
      const requestedProfile = getTerminalProfile(terminalRequest.profileId ?? targetTab?.profileId ?? preferredProfile.id);
      const nextCwd = terminalRequest.path || targetTab?.cwd || '';
      setTabs(prev => prev.map(tab => {
        if (tab.id === targetTabId) {
          let newHistory = [...tab.history];
          let newCwd = tab.cwd;
          
          if (terminalRequest.path) {
            newCwd = terminalRequest.path;
            const cdCommand = `${getPrefix(tab.profileId, tab.cwd)}cd ${terminalRequest.path}`;
            if (newHistory[newHistory.length - 1] !== cdCommand) {
              newHistory.push(cdCommand);
            }
          }
          
          if (terminalRequest.command) {
            const cmd = `${getPrefix(tab.profileId, newCwd)}${terminalRequest.command}`;
            newHistory.push(cmd);
            newHistory.push(t('terminal.executing', { command: terminalRequest.command }));
          }
          
          return {
            ...tab,
            title: requestedProfile.title,
            profileId: requestedProfile.id,
            history: newHistory,
            cwd: newCwd,
          };
        }
        return tab;
      }));

      if (targetTab && terminalRequest.command) {
        void executeCommand(
          targetTabId,
          {
            ...targetTab,
            profileId: requestedProfile.id,
            title: requestedProfile.title,
            cwd: nextCwd,
          },
          terminalRequest.command,
        );
      }
    }
  }, [
    terminalRequest,
    activeTabIds,
    focusedPaneIndex,
    preferredProfile.id,
    processedTimestamp,
    tabs,
  ]);

  const handleCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== id);
      
      setActiveTabIds(prevIds => {
        let newIds = [...prevIds];
        const index = newIds.indexOf(id);
        if (index !== -1) {
          if (newTabs.length > 0) {
            newIds[index] = newTabs[newTabs.length - 1].id;
          } else {
            newIds.splice(index, 1);
          }
        }
        if (focusedPaneIndex >= newIds.length) {
          setFocusedPaneIndex(Math.max(0, newIds.length - 1));
        }
        return newIds;
      });
      
      if (newTabs.length === 0) {
        setTimeout(() => handleAddTab(preferredProfile), 0);
      }
      
      return newTabs;
    });
    setContextMenu(null);
    addToast(t('terminal.tabClosed'), 'info');
  };

  const handleCloseOtherTabs = (id: string) => {
    setTabs(prev => prev.filter(t => t.id === id));
    setActiveTabIds([id]);
    setFocusedPaneIndex(0);
    setContextMenu(null);
    addToast(t('terminal.otherTabsClosed'), 'info');
  };

  const handleCloseTabsToRight = (id: string) => {
    setTabs(prev => {
      const index = prev.findIndex(t => t.id === id);
      if (index === -1) return prev;
      const newTabs = prev.slice(0, index + 1);
      
      setActiveTabIds(prevIds => {
        const newIds = prevIds.filter(activeId => newTabs.some(t => t.id === activeId));
        if (newIds.length === 0) newIds.push(id);
        setFocusedPaneIndex(Math.min(focusedPaneIndex, newIds.length - 1));
        return newIds;
      });
      
      return newTabs;
    });
    setContextMenu(null);
    addToast(t('terminal.tabsToRightClosed'), 'info');
  };

  const handleDuplicateTab = (id: string) => {
    const tabToDuplicate = tabs.find(t => t.id === id);
    if (tabToDuplicate) {
      const profile =
        BUILTIN_TERMINAL_PROFILES.find(p => p.id === tabToDuplicate.profileId) ?? BUILTIN_TERMINAL_PROFILES[0];
      handleAddTab(profile, { cwd: tabToDuplicate.cwd });
    }
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    let x = e.clientX;
    let y = e.clientY;
    
    if (x + 224 > window.innerWidth) {
      x = window.innerWidth - 224 - 10;
    }
    if (y + 150 > window.innerHeight) {
      y = window.innerHeight - 150 - 10;
    }
    
    setContextMenu({ x, y, tabId: id });
  };

  const executeCommand = async (tabId: string, activeTab: TerminalTab, cmd: string) => {
    if (cmd === 'clear' || cmd === 'cls') {
      setTabs(prev =>
        prev.map(tab =>
          tab.id === tabId
            ? { ...tab, history: [], status: 'idle', lastExitCode: null }
            : tab,
        ),
      );
      return;
    }

    if (cmd.startsWith('cd ')) {
      setTabs(prev => prev.map(tab => {
        if (tab.id === tabId) {
          let newCwd = tab.cwd;
          const target = cmd.substring(3).trim();
          if (target === '..') {
            const parts = tab.cwd.split(/[/\\]/);
            if (parts.length > 1) {
              parts.pop();
              newCwd = parts.join(tab.cwd.includes('\\') ? '\\' : '/');
              if (newCwd.endsWith(':')) newCwd += '\\';
            }
          } else if (target === '~') {
            newCwd = tab.profileId === 'ubuntu' || tab.profileId === 'bash'
              ? '~/sdkwork-birdcoder'
              : 'C:\\Users\\Developer\\sdkwork-birdcoder';
          } else {
            const sep = tab.cwd.includes('\\') ? '\\' : '/';
            newCwd = tab.cwd.endsWith(sep) ? `${tab.cwd}${target}` : `${tab.cwd}${sep}${target}`;
          }
          return { ...tab, cwd: newCwd, status: 'idle' };
        }
        return tab;
      }));
      return;
    }

    if (window.__TAURI__) {
      setTabs(prev =>
        prev.map(tab =>
          tab.id === tabId ? { ...tab, status: 'running' } : tab,
        ),
      );

      try {
        const output = await runTerminalHostSessionCommand({
          sessionId: tabId,
          profileId: activeTab.profileId,
          title: activeTab.title,
          cwd: activeTab.cwd,
          command: cmd,
        });

        setTabs(prev => prev.map(tab => {
          if (tab.id === tabId) {
            const newHistory = [...tab.history];
            output.lines.forEach((line) => {
              newHistory.push(line.text);
            });
            return {
              ...tab,
              cwd: output.state.cwd,
              status: output.state.status,
              lastExitCode: output.state.lastExitCode,
              history: newHistory,
            };
          }
          return tab;
        }));

        if (cmd.startsWith('touch ') || cmd.startsWith('mkdir ') || cmd.startsWith('rm ') || cmd.startsWith('mv ') || cmd.startsWith('cp ')) {
          refreshFiles();
        }
      } catch (err) {
        setTabs(prev => prev.map(tab => {
          if (tab.id === tabId) {
            return {
              ...tab,
              status: 'error',
              lastExitCode: -1,
              history: [
                ...tab.history,
                t('terminal.error', { error: String(err) }),
              ],
            };
          }
          return tab;
        }));
      }
      return;
    }

    const shouldDelegateBrowserCommand =
      cmd.startsWith('touch ') ||
      cmd.startsWith('mkdir ') ||
      cmd.startsWith('rm ') ||
      cmd.startsWith('mv ') ||
      cmd.startsWith('cp ');

    if (shouldDelegateBrowserCommand) {
      setTabs(prev =>
        prev.map(tab =>
          tab.id === tabId ? { ...tab, status: 'running' } : tab,
        ),
      );

      try {
        const output = await runTerminalHostSessionCommand({
          sessionId: tabId,
          profileId: activeTab.profileId,
          title: activeTab.title,
          cwd: activeTab.cwd,
          command: cmd,
        });

        setTabs(prev => prev.map(tab => {
          if (tab.id === tabId) {
            const newHistory = [...tab.history];
            output.lines.forEach((line) => {
              newHistory.push(line.text);
            });
            return {
              ...tab,
              cwd: output.state.cwd,
              status: output.state.status,
              lastExitCode: output.state.lastExitCode,
              history: newHistory,
            };
          }
          return tab;
        }));
      } catch (err) {
        setTabs(prev => prev.map(tab => {
          if (tab.id === tabId) {
            return {
              ...tab,
              status: 'error',
              lastExitCode: -1,
              history: [
                ...tab.history,
                t('terminal.error', { error: String(err) }),
              ],
            };
          }
          return tab;
        }));
      }
      return;
    }

    setTabs(prev => prev.map(tab => {
      if (tab.id !== tabId) {
        return tab;
      }

      const newHistory = [...tab.history];
      if (cmd === 'ls' || cmd === 'dir') {
        if (tab.profileId === 'powershell' || tab.profileId === 'cmd') {
          newHistory.push(' Volume in drive C has no label.');
          newHistory.push(' Volume Serial Number is ABCD-1234');
          newHistory.push('');
          newHistory.push(` Directory of ${tab.cwd}`);
          newHistory.push('');
          newHistory.push('03/16/2026  01:29 PM    <DIR>          .');
          newHistory.push('03/16/2026  01:29 PM    <DIR>          ..');
          newHistory.push('03/16/2026  01:29 PM    <DIR>          src');
          newHistory.push('03/16/2026  01:29 PM    <DIR>          packages');
          newHistory.push('03/16/2026  01:29 PM               812 package.json');
        } else {
          newHistory.push(
            <div className="flex gap-4 mt-1 mb-1" key={`ls-${Date.now()}`}>
              <span className="text-[#3b78ff] font-bold">src</span>
              <span className="text-[#3b78ff] font-bold">packages</span>
              <span className="text-[#cccccc]">package.json</span>
              <span className="text-[#cccccc]">README.md</span>
              <span className="text-[#3b78ff] font-bold">node_modules</span>
            </div>
          );
        }
      } else if (cmd === 'pwd') {
        newHistory.push(tab.cwd);
      } else if (cmd === 'whoami') {
        newHistory.push(tab.profileId === 'ubuntu' || tab.profileId === 'bash' ? 'developer' : 'desktop-abc1234\\developer');
      } else if (cmd.startsWith('echo ')) {
        newHistory.push(cmd.substring(5));
      } else if (cmd === 'date') {
        newHistory.push(new Date().toString());
      } else if (tab.profileId === 'node') {
        if (cmd === '.help') {
          newHistory.push('.break    Sometimes you get stuck, this gets you out');
          newHistory.push('.clear    Alias for .break');
          newHistory.push('.editor   Enter editor mode');
          newHistory.push('.exit     Exit the REPL');
          newHistory.push('.help     Print this help message');
          newHistory.push('.load     Load JS from a file into the REPL session');
          newHistory.push('.save     Save all evaluated commands in this REPL session to a file');
        } else {
          newHistory.push(`Uncaught ReferenceError: ${cmd} is not defined`);
        }
      } else {
        newHistory.push(t('terminal.commandNotFound', { command: cmd }));
      }
        return {
          ...tab,
          history: newHistory,
          status: 'idle',
          lastExitCode: tab.profileId === 'node' || cmd === 'ls' || cmd === 'dir' || cmd === 'pwd' || cmd === 'whoami' || cmd.startsWith('echo ') || cmd === 'date'
            ? 0
            : 127,
      };
    }));
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, tabId: string) => {
    const activeTab = tabs.find(t => t.id === tabId);
    if (!activeTab) return;

    const currentInputValue = inputValues[tabId] || '';

    // Handle Ctrl+C
    if (e.ctrlKey && e.key === 'c') {
      if (window.getSelection()?.toString() === '') {
        setTabs(prev => prev.map(tab => {
          if (tab.id === tabId) {
            const newHistory = [...tab.history, (
              <div key={Date.now()} className="flex items-start">
                <span className={`shrink-0 ${getPrefixColor(tab.profileId)}`}>{getPrefix(tab.profileId, tab.cwd)}</span>
                <span className="ml-2 whitespace-pre-wrap">{currentInputValue}^C</span>
              </div>
            )];
            return { ...tab, history: newHistory };
          }
          return tab;
        }));
        setInputValues(prev => ({ ...prev, [tabId]: '' }));
        e.preventDefault();
      }
      return;
    }

    // Handle Ctrl+L (Clear)
    if (e.ctrlKey && e.key === 'l') {
      setTabs(prev => prev.map(tab => tab.id === tabId ? { ...tab, history: [] } : tab));
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter') {
      const cmd = currentInputValue.trim();
      setInputValues(prev => ({ ...prev, [tabId]: '' }));
      
      // 1. Update state immediately to show the command
      setTabs(prev => prev.map(tab => {
        if (tab.id === tabId) {
          const newHistory = [...tab.history, (
            <div key={Date.now()} className="flex items-start">
              <span className={`shrink-0 ${getPrefixColor(tab.profileId)}`}>
                {getPrefix(tab.profileId, tab.cwd)}
              </span>
              <span className="ml-2 whitespace-pre-wrap">{currentInputValue}</span>
            </div>
          )];
          const newCommandHistory = cmd ? [...tab.commandHistory, cmd] : tab.commandHistory;
          return { ...tab, history: newHistory, commandHistory: newCommandHistory, historyIndex: newCommandHistory.length };
        }
        return tab;
      }));

      if (!cmd) return;
      await executeCommand(tabId, activeTab, cmd);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeTab.commandHistory.length > 0 && activeTab.historyIndex > 0) {
        const newIndex = activeTab.historyIndex - 1;
        setInputValues(prev => ({ ...prev, [tabId]: activeTab.commandHistory[newIndex] }));
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, historyIndex: newIndex } : t));
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (activeTab.historyIndex < activeTab.commandHistory.length - 1) {
        const newIndex = activeTab.historyIndex + 1;
        setInputValues(prev => ({ ...prev, [tabId]: activeTab.commandHistory[newIndex] }));
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, historyIndex: newIndex } : t));
      } else if (activeTab.historyIndex === activeTab.commandHistory.length - 1) {
        const newIndex = activeTab.commandHistory.length;
        setInputValues(prev => ({ ...prev, [tabId]: '' }));
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, historyIndex: newIndex } : t));
      }
    }
  };

  const getTabIcon = (profileId: TerminalProfileId) => {
    return TERMINAL_PROFILE_ICONS[profileId] ?? <TerminalIcon size={14} className="text-gray-400 shrink-0" />;
  };

  const renderLaunchProfileItem = (profileId: TerminalProfileId) => {
    const profile =
      TERMINAL_LAUNCH_PROFILES.find((entry) => entry.id === profileId) ??
      TERMINAL_LAUNCH_PROFILES[0];
    const availability = profile.kind === 'cli' ? cliAvailabilityByProfileId[profile.id] : undefined;
    const presentation = resolveTerminalProfileLaunchPresentation(profile.id, availability);
    const statusLabel = presentation.statusLabel;
    const statusClassName =
      availability?.status === 'available'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
        : availability?.status === 'missing'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
          : 'border-white/10 bg-white/5 text-gray-400';
    const detailLabel = presentation.detailLabel;

    return (
      <div
        key={profile.id}
        className={`flex items-start justify-between gap-3 px-3 py-2 group rounded-md transition-colors ${
          presentation.canLaunch
            ? 'hover:bg-white/10 cursor-pointer'
            : 'cursor-not-allowed opacity-60'
        }`}
        onClick={() => handleAddTab(profile)}
        aria-disabled={!presentation.canLaunch}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5">{getTabIcon(profile.id)}</div>
          <div className="min-w-0">
            <div className="text-[13px] text-gray-200 group-hover:text-white truncate">
              {profile.title}
            </div>
            <div className="text-[11px] text-gray-500 truncate">{detailLabel}</div>
          </div>
        </div>
        <div
          className="flex items-center gap-2 shrink-0"
          title={profile.kind === 'cli' ? presentation.reason ?? detailLabel : undefined}
        >
          {profile.kind === 'cli' && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusClassName}`}
            >
              {statusLabel}
            </span>
          )}
          <span className="text-[11px] text-gray-500 shrink-0">{profile.shortcut}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0e0e11] text-gray-300 font-mono text-sm min-w-0">
      {/* Windows Terminal Style Tab Bar */}
      <div className="flex items-end bg-[#0e0e11] pt-1.5 px-2 border-b border-white/5 shrink-0 relative z-20 w-full overflow-hidden min-w-0">
        
        {canScrollLeft && (
          <button 
            className="flex items-center justify-center w-6 h-8 mb-[1px] text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors shrink-0 z-10"
            onClick={() => scrollTabs('left')}
          >
            <ChevronLeft size={14} />
          </button>
        )}

        <div 
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="flex items-end gap-[2px] overflow-x-auto shrink min-w-0 scroll-smooth relative [&::-webkit-scrollbar]:hidden" 
          style={{ scrollbarWidth: 'none' }}
        >
          {tabs.map((tab, idx) => {
            const isActive = activeTabIds.includes(tab.id);
            const isFocused = activeTabIds[focusedPaneIndex] === tab.id;
            return (
            <div 
              key={tab.id}
              data-active={isActive}
              title={tab.title}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              className={`group flex items-center gap-2 px-3 h-8 flex-1 min-w-[140px] max-w-[240px] rounded-t-md cursor-pointer select-none transition-colors relative shrink-0 ${
                isActive 
                  ? `bg-[#18181b] text-white z-10` 
                  : 'bg-transparent text-gray-400 hover:bg-white/5'
              }`}
              onClick={() => {
                setActiveTabIds(prev => {
                  const newIds = [...prev];
                  newIds[focusedPaneIndex] = tab.id;
                  return newIds;
                });
              }}
            >
              {isActive && <div className={`absolute top-0 left-0 right-0 h-[2px] rounded-t-md ${isFocused ? 'bg-[#60A5FA]' : 'bg-gray-600'}`} />}
              {isActive && <div className="absolute -bottom-px left-0 right-0 h-px bg-[#18181b] z-20" />}
              {getTabIcon(tab.profileId)}
              <span className="text-[12px] truncate flex-1">{tab.title}</span>
              <div 
                className={`flex items-center justify-center w-5 h-5 rounded hover:bg-white/10 transition-colors ${isActive ? 'text-gray-300 hover:text-white opacity-100' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}
                onClick={(e) => handleCloseTab(e, tab.id)}
              >
                <X size={14} />
              </div>
            </div>
          )})}
        </div>

        {canScrollRight && (
          <button 
            className="flex items-center justify-center w-6 h-8 mb-[1px] text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors shrink-0 z-10"
            onClick={() => scrollTabs('right')}
          >
            <ChevronRight size={14} />
          </button>
        )}

        {/* Add Tab & Dropdown Buttons */}
        <div className="relative flex items-center ml-1 mb-0.5 h-7 gap-0.5 shrink-0" ref={dropdownRef}>
          <button 
            className="flex items-center justify-center w-8 h-full rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:bg-white/10"
            onClick={() => handleAddTab(preferredProfile)}
            title={t('terminal.addTab')}
          >
            <Plus size={16} />
          </button>
          <button 
            className={`flex items-center justify-center w-6 h-full rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:bg-white/10 ${isDropdownOpen ? 'bg-white/10 text-white' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsDropdownOpen(!isDropdownOpen);
            }}
            title={t('terminal.openSpecificProfile')}
          >
            <ChevronDown size={14} />
          </button>

          {/* Windows Terminal Style Dropdown Menu */}
          {isDropdownOpen && (
            <div 
              className="absolute top-full right-0 mt-1 z-50 w-80 p-1.5 bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl animate-in fade-in zoom-in-95 duration-100 origin-top-right font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 pt-1 pb-1 text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-500">
                Shells
              </div>
              {TERMINAL_SHELL_LAUNCH_PROFILES.map((profile) => renderLaunchProfileItem(profile.id))}
              <div className="h-px bg-white/10 my-1.5 mx-2" />
              <div className="px-3 pt-1 pb-1 text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-500">
                AI CLI
              </div>
              {TERMINAL_CLI_LAUNCH_PROFILES.map((profile) => renderLaunchProfileItem(profile.id))}
              {recentSessions.length > 0 && (
                <>
                  <div className="h-px bg-white/10 my-1.5 mx-2" />
                  <div className="px-3 pt-1 pb-1 text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-500">
                    Recent Sessions
                  </div>
                  {recentSessions.map((session) => {
                    const availability = isTerminalCliProfileId(session.profileId)
                      ? cliAvailabilityByProfileId[session.profileId]
                      : undefined;
                    const presentation = resolveTerminalProfileLaunchPresentation(
                      session.profileId,
                      availability,
                    );

                    return (
                      <div
                        key={`recent-${session.id}`}
                        className={`px-3 py-2 group rounded-md transition-colors ${
                          presentation.canLaunch
                            ? 'hover:bg-white/10 cursor-pointer'
                            : 'cursor-not-allowed opacity-60'
                        }`}
                        onClick={() => handleRestoreSession(session)}
                        title={presentation.reason ?? undefined}
                        aria-disabled={!presentation.canLaunch}
                      >
                        <div className="flex items-center gap-3">
                          {getTabIcon(session.profileId)}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-[13px] text-gray-200 truncate group-hover:text-white">
                                {session.title}
                              </div>
                              {presentation.statusLabel && (
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                                  {presentation.statusLabel}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 truncate">
                              {presentation.canLaunch
                                ? session.cwd || 'Default workspace'
                                : presentation.detailLabel}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              {recentGovernanceAudits.length > 0 && (
                <>
                  <div className="h-px bg-white/10 my-1.5 mx-2" />
                  <div className="flex items-center justify-between gap-3 px-3 pt-1 pb-1">
                    <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-500">
                      Governance Recovery
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                        onClick={() => {
                          void copyVisibleGovernanceDiagnostics();
                        }}
                      >
                        Copy Diagnostics
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                        onClick={() => {
                          void copyVisibleGovernanceReleaseNote();
                        }}
                      >
                        Copy Release Note
                      </button>
                    </div>
                  </div>
                  {recentGovernanceAudits.map((record) => {
                    const recoveryAction = resolveTerminalGovernanceRecoveryAction(record);
                    return (
                      <div
                        key={`governance-${record.traceId}`}
                        className="px-3 py-2 rounded-md border border-white/5 bg-white/[0.03]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[13px] text-amber-200 truncate">
                              {record.command}
                            </div>
                            <div className="text-[11px] text-gray-500 whitespace-normal">
                              {buildTerminalGovernanceRecoveryDescription(record)}
                            </div>
                          </div>
                          {recoveryAction.actionLabel && (
                            <button
                              type="button"
                              className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                              onClick={() => {
                                setIsDropdownOpen(false);
                                globalEventBus.emit('openSettings');
                              }}
                            >
                              {recoveryAction.actionLabel}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              <div className="h-px bg-white/10 my-1.5 mx-2" />
              <div 
                className="flex items-center justify-between px-3 py-2 hover:bg-white/10 cursor-pointer group rounded-md transition-colors"
                onClick={() => { setIsDropdownOpen(false); handleSplitTerminal(); }}
              >
                <div className="flex items-center gap-3">
                  <SplitSquareHorizontal size={14} className="text-gray-400" />
                  <span className="text-[13px] text-gray-200 group-hover:text-white">{t('terminal.splitTerminal')}</span>
                </div>
                <span className="text-[11px] text-gray-500">Alt+Shift+D</span>
              </div>
              <div 
                className="flex items-center justify-between px-3 py-2 hover:bg-white/10 cursor-pointer group rounded-md transition-colors"
                onClick={() => { setIsDropdownOpen(false); globalEventBus.emit('openSettings'); }}
              >
                <div className="flex items-center gap-3">
                  <Settings size={14} className="text-gray-400" />
                  <span className="text-[13px] text-gray-200 group-hover:text-white">{t('terminal.settings')}</span>
                </div>
                <span className="text-[11px] text-gray-500">Ctrl+,</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50 w-48 p-1.5 bg-[#18181b]/95 backdrop-blur-2xl border border-white/10 rounded-lg shadow-2xl animate-in fade-in zoom-in-95 duration-100 origin-top-left font-sans"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="flex items-center px-3 py-2 hover:bg-white/10 cursor-pointer rounded-md transition-colors text-[13px] text-gray-200 hover:text-white"
            onClick={(e) => handleCloseTab(e, contextMenu.tabId)}
          >
            {t('terminal.closeTab')}
          </div>
          <div 
            className="flex items-center px-3 py-2 hover:bg-white/10 cursor-pointer rounded-md transition-colors text-[13px] text-gray-200 hover:text-white"
            onClick={() => handleCloseOtherTabs(contextMenu.tabId)}
          >
            {t('terminal.closeOtherTabs')}
          </div>
          <div 
            className="flex items-center px-3 py-2 hover:bg-white/10 cursor-pointer rounded-md transition-colors text-[13px] text-gray-200 hover:text-white"
            onClick={() => handleCloseTabsToRight(contextMenu.tabId)}
          >
            {t('terminal.closeTabsToRight')}
          </div>
          <div className="h-px bg-white/10 my-1 mx-2" />
          <div 
            className="flex items-center px-3 py-2 hover:bg-white/10 cursor-pointer rounded-md transition-colors text-[13px] text-gray-200 hover:text-white"
            onClick={() => handleDuplicateTab(contextMenu.tabId)}
          >
            {t('terminal.duplicateTab')}
          </div>
        </div>
      )}

      {/* Terminal Content - Split Panes */}
      <div className="flex-1 flex overflow-hidden">
        {activeTabIds.map((tabId, index) => {
          const tab = tabs.find(t => t.id === tabId);
          if (!tab) return null;
          
          return (
            <div 
              key={`${tabId}-${index}`}
              className={`flex-1 flex flex-col overflow-y-auto bg-[#18181b] text-[#cccccc] text-[14px] leading-relaxed [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#4b4b4b] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#6b6b6b] selection:bg-[#ffffff40] ${index > 0 ? 'border-l border-white/10' : ''}`}
              style={{ fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace" }}
              onClick={() => {
                setFocusedPaneIndex(index);
                inputRefs.current[tabId]?.focus();
              }}
            >
              <div className="flex-1 p-4">
                {tab.history.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap break-all">{line}</div>
                ))}
                <div className="flex items-start mt-1">
                  <span className={`shrink-0 ${getPrefixColor(tab.profileId)}`}>
                    {getPrefix(tab.profileId, tab.cwd)}
                  </span>
                  <input 
                    ref={el => { inputRefs.current[tabId] = el; }}
                    type="text"
                    value={inputValues[tabId] || ''}
                    onChange={e => setInputValues(prev => ({ ...prev, [tabId]: e.target.value }))}
                    onKeyDown={e => handleKeyDown(e, tabId)}
                    className="flex-1 bg-transparent outline-none text-white ml-2 caret-white"
                    autoFocus={index === focusedPaneIndex}
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
                <div ref={el => { terminalEndRefs.current[tabId] = el; }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
