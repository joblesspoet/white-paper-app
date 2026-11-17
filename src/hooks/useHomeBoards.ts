import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

import { useBoards, type Board } from '../board-context';
import { parseClassroomDeepLink } from '../classroom/protocol';
import type { BoardSummary } from '../components/BoardCard';
import type { ImportModalState } from '../components/ImportBoardModal';
import { importErrorMessage } from '../export/backup';
import { pickBackupFile } from '../export/backup-store';
import { useMonetization } from '../monetization/monetization-context';
import type { BoardBackground, BoardOrientation, BoardStyle } from '../persistence/schema';
import { usePreferences } from '../settings/preferences-context';
import { triggerHapticFeedback } from '../utils/haptics';

export type BoardOptionsMode = 'menu' | 'rename' | 'delete';

export function useHomeBoards() {
  const router = useRouter();
  const { preferences } = usePreferences();
  const {
    limits,
    canCreateAnotherBoard,
    openPaywall,
    requestRewardedUnlock,
  } = useMonetization();
  const {
    boards,
    createBoard,
    duplicateBoard,
    deleteBoard,
    updateTitle,
    ready,
    storageError,
    refreshBoards,
  } = useBoards();

  const [searchQuery, setSearchQuery] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinInitialCode, setJoinInitialCode] = useState<string | null>(null);
  const [importState, setImportState] = useState<ImportModalState>({ status: 'closed' });

  const [canvasBackground, setCanvasBackground] = useState<BoardBackground>(
    preferences.canvasBackground,
  );
  const [canvasStyle, setCanvasStyle] = useState<BoardStyle>(preferences.canvasStyle);
  const [orientation, setOrientation] = useState<BoardOrientation>('portrait');

  const [menuBoard, setMenuBoard] = useState<BoardSummary | null>(null);
  const [menuMode, setMenuMode] = useState<BoardOptionsMode>('menu');
  const [renameDraft, setRenameDraft] = useState('');
  const [busyDuplicate, setBusyDuplicate] = useState(false);

  const showSearchBar = boards.length > 5 || searchQuery.trim().length > 0;

  const filteredBoards = useMemo<Board[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return boards;
    return boards.filter((board) => board.title.toLowerCase().includes(query));
  }, [boards, searchQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const openJoinModal = useCallback((code?: string | null) => {
    setJoinInitialCode(code ?? null);
    setJoinModalVisible(true);
  }, []);

  const closeJoinModal = useCallback(() => {
    setJoinModalVisible(false);
  }, []);

  const handleJoinClass = useCallback(
    (params: { roomCode: string; displayName: string; projectorMode: boolean }) => {
      setJoinModalVisible(false);
      router.push({
        pathname: '/editor',
        params: {
          liveRole: 'student',
          roomCode: params.roomCode,
          displayName: params.displayName,
          projectorMode: params.projectorMode ? '1' : '0',
        },
      });
    },
    [router],
  );

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      const code = parseClassroomDeepLink(url);
      if (code) openJoinModal(code);
    };
    void Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => sub.remove();
  }, [openJoinModal]);

  const openBoard = useCallback(
    (boardId: string) => {
      router.push({ pathname: '/editor', params: { boardId } });
    },
    [router],
  );

  const openSettings = useCallback(() => {
    router.push('/settings');
  }, [router]);

  const createBoardNow = useCallback(
    (settings?: {
      background: BoardBackground;
      style: BoardStyle;
      orientation: BoardOrientation;
    }) => {
      void triggerHapticFeedback('impact', preferences.haptics);
      const defaultSettings = {
        background: preferences.canvasBackground,
        style: preferences.canvasStyle,
        orientation: 'portrait' as const,
      };
      const resolvedSettings = settings ?? defaultSettings;
      const check = canCreateAnotherBoard(boards.length);
      if (!check.allowed) {
        if (limits.rewardedAd24hUnlockSupported) {
          requestRewardedUnlock('extra_board', () => {
            const board = createBoard(resolvedSettings);
            router.push({ pathname: '/editor', params: { boardId: board.id } });
          });
        } else {
          openPaywall({
            reason: 'board_limit',
            currentCount: check.currentCount,
            maxBoards: check.maxBoards ?? 15,
          });
        }
        return;
      }
      const board = createBoard(resolvedSettings);
      router.push({ pathname: '/editor', params: { boardId: board.id } });
    },
    [
      boards.length,
      canCreateAnotherBoard,
      createBoard,
      limits.rewardedAd24hUnlockSupported,
      openPaywall,
      preferences.canvasBackground,
      preferences.canvasStyle,
      preferences.haptics,
      requestRewardedUnlock,
      router,
    ],
  );

  const openCustomize = useCallback(() => {
    void triggerHapticFeedback('selection', preferences.haptics);
    setCanvasBackground(preferences.canvasBackground);
    setCanvasStyle(preferences.canvasStyle);
    setOrientation('portrait');
    setSheetVisible(true);
  }, [preferences.canvasBackground, preferences.canvasStyle, preferences.haptics]);

  const closeCustomize = useCallback(() => {
    setSheetVisible(false);
  }, []);

  const createCustomizedBoard = useCallback(() => {
    setSheetVisible(false);
    createBoardNow({ background: canvasBackground, style: canvasStyle, orientation });
  }, [canvasBackground, canvasStyle, createBoardNow, orientation]);

  const startImport = useCallback(async () => {
    void triggerHapticFeedback('selection', preferences.haptics);
    try {
      const picked = await pickBackupFile();
      if (picked.canceled) return;
      setImportState({
        status: 'ready',
        plan: picked.plan,
        backup: picked.backup,
        warnings: picked.warnings,
        size: picked.size,
      });
    } catch (error) {
      setImportState({
        status: 'error',
        message: importErrorMessage(error),
      });
    }
  }, [preferences.haptics]);

  const closeImport = useCallback(() => {
    setImportState({ status: 'closed' });
  }, []);

  const handleImported = useCallback(
    (boardId: string) => {
      setImportState({ status: 'closed' });
      void refreshBoards();
      router.push({ pathname: '/editor', params: { boardId } });
    },
    [refreshBoards, router],
  );

  const openBoardMenu = useCallback(
    (board: BoardSummary) => {
      void triggerHapticFeedback('selection', preferences.haptics);
      setMenuBoard(board);
      setMenuMode('menu');
      setRenameDraft(board.title);
    },
    [preferences.haptics],
  );

  const closeBoardMenu = useCallback(() => {
    if (busyDuplicate) return;
    setMenuBoard(null);
    setMenuMode('menu');
  }, [busyDuplicate]);

  const startRenameBoard = useCallback(() => {
    if (!menuBoard) return;
    setRenameDraft(menuBoard.title);
    setMenuMode('rename');
  }, [menuBoard]);

  const submitRenameBoard = useCallback(() => {
    if (!menuBoard) return;
    const trimmed = renameDraft.trim();
    updateTitle(menuBoard.id, trimmed.length > 0 ? trimmed : 'Untitled board');
    void triggerHapticFeedback('selection', preferences.haptics);
    setMenuBoard(null);
    setMenuMode('menu');
  }, [menuBoard, preferences.haptics, renameDraft, updateTitle]);

  const handleDuplicateBoard = useCallback(async () => {
    if (!menuBoard || busyDuplicate) return;
    const check = canCreateAnotherBoard(boards.length);
    if (!check.allowed) {
      setMenuBoard(null);
      setMenuMode('menu');
      if (limits.rewardedAd24hUnlockSupported) {
        requestRewardedUnlock('extra_board');
      } else {
        openPaywall({
          reason: 'board_limit',
          currentCount: check.currentCount,
          maxBoards: check.maxBoards ?? 15,
        });
      }
      return;
    }
    setBusyDuplicate(true);
    try {
      const copy = await duplicateBoard(menuBoard.id);
      if (copy) {
        void triggerHapticFeedback('impact', preferences.haptics);
      }
      setMenuBoard(null);
      setMenuMode('menu');
    } finally {
      setBusyDuplicate(false);
    }
  }, [
    boards.length,
    busyDuplicate,
    canCreateAnotherBoard,
    duplicateBoard,
    limits.rewardedAd24hUnlockSupported,
    menuBoard,
    openPaywall,
    preferences.haptics,
    requestRewardedUnlock,
  ]);

  const startDeleteBoard = useCallback(() => {
    void triggerHapticFeedback('warning', preferences.haptics);
    setMenuMode('delete');
  }, [preferences.haptics]);

  const backToBoardMenu = useCallback(() => {
    setMenuMode('menu');
  }, []);

  const confirmDeleteBoard = useCallback(() => {
    if (!menuBoard) return;
    deleteBoard(menuBoard.id);
    void triggerHapticFeedback('impact', preferences.haptics);
    setMenuBoard(null);
    setMenuMode('menu');
  }, [deleteBoard, menuBoard, preferences.haptics]);

  return {
    boards,
    filteredBoards,
    ready,
    storageError,
    showSearchBar,
    searchQuery,
    setSearchQuery,
    clearSearch,
    sheetVisible,
    openCustomize,
    closeCustomize,
    canvasBackground,
    setCanvasBackground,
    canvasStyle,
    setCanvasStyle,
    orientation,
    setOrientation,
    createBoardNow,
    createCustomizedBoard,
    joinModalVisible,
    joinInitialCode,
    openJoinModal,
    closeJoinModal,
    handleJoinClass,
    importState,
    startImport,
    closeImport,
    handleImported,
    openBoard,
    openSettings,
    menuBoard,
    menuMode,
    renameDraft,
    setRenameDraft,
    busyDuplicate,
    openBoardMenu,
    closeBoardMenu,
    startRenameBoard,
    submitRenameBoard,
    handleDuplicateBoard,
    startDeleteBoard,
    backToBoardMenu,
    confirmDeleteBoard,
  };
}
