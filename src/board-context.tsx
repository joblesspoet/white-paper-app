import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { BoardSummary } from './components/BoardCard';
import type { PersistenceDatabase } from './persistence/database';
import { storageErrorMessage } from './persistence/errors';
import { getLocalDatabase } from './persistence/expo-store';
import {
  insertBoard,
  listBoards,
  updateBoardSettings,
  updateBoardTitle,
  type BoardRecord,
} from './persistence/repository';
import { DEFAULT_BOARD_SETTINGS, type BoardSettings } from './persistence/schema';
import { enqueuePersistenceWrite } from './persistence/write-queue';

export type Board = BoardSummary & {
  createdAt: string;
  settings: BoardSettings;
};

type BoardContextValue = {
  boards: Board[];
  /** False until the first local read finishes, so Home does not flash empty. */
  ready: boolean;
  storageError: string | null;
  createBoard: (settings?: BoardSettings) => Board;
  updateTitle: (id: string, title: string) => void;
  updateSettings: (id: string, settings: BoardSettings) => void;
  /** Refresh the home card after an editor autosave without a database read. */
  touchBoard: (id: string, objectCount: number) => void;
  getBoard: (id: string) => Board | undefined;
  refreshBoards: () => Promise<void>;
  clearStorageError: () => void;
  resetBoards: () => void;
};

const BoardContext = createContext<BoardContextValue | null>(null);

function newBoardId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Short, human card label from the persisted ISO timestamp. */
export function formatBoardUpdatedAt(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 'Just now';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const date = new Date(then);
  return `${date.toLocaleString(undefined, { month: 'short' })} ${date.getDate()}`;
}

function toBoard(record: BoardRecord): Board {
  return {
    id: record.id,
    title: record.title,
    createdAt: record.createdAt,
    updatedAt: formatBoardUpdatedAt(record.updatedAt),
    objectCount: record.objectCount,
    settings: record.settings,
  };
}

/** Persisted rows win over a stale in-memory copy; unsaved boards are kept. */
function mergeBoards(current: Board[], loaded: Board[]): Board[] {
  if (current.length === 0) return loaded;
  const loadedById = new Map(loaded.map((board) => [board.id, board]));
  const currentIds = new Set(current.map((board) => board.id));
  return [
    ...current.map((board) => loadedById.get(board.id) ?? board),
    ...loaded.filter((board) => !currentIds.has(board.id)),
  ];
}

export function BoardProvider({ children }: { children: ReactNode }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const mounted = useRef(true);

  const runWrite = useCallback((task: (database: PersistenceDatabase) => Promise<void>) => {
    void enqueuePersistenceWrite(async () => {
      const database = await getLocalDatabase();
      await task(database);
      if (mounted.current) setStorageError(null);
    }).catch((error: unknown) => {
      if (mounted.current) setStorageError(storageErrorMessage(error));
    });
  }, []);

  const refreshBoards = useCallback(async () => {
    try {
      const database = await getLocalDatabase();
      const records = await listBoards(database);
      if (!mounted.current) return;
      setBoards((current) => mergeBoards(current, records.map(toBoard)));
      setStorageError(null);
    } catch (error) {
      if (mounted.current) setStorageError(storageErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    (async () => {
      try {
        const database = await getLocalDatabase();
        const records = await listBoards(database);
        if (cancelled) return;
        setBoards((current) => mergeBoards(current, records.map(toBoard)));
        setStorageError(null);
      } catch (error) {
        if (!cancelled) setStorageError(storageErrorMessage(error));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, []);

  const createBoard = useCallback((settings: BoardSettings = DEFAULT_BOARD_SETTINGS): Board => {
    const createdAt = new Date().toISOString();
    const board: Board = {
      id: newBoardId(),
      title: 'Untitled board',
      createdAt,
      updatedAt: 'Just now',
      objectCount: 0,
      settings: { ...settings },
    };
    setBoards((current) => [board, ...current]);
    runWrite((database) =>
      insertBoard(database, {
        id: board.id,
        title: board.title,
        settings: board.settings,
        createdAt,
      }),
    );
    return board;
  }, [runWrite]);

  const updateTitle = useCallback((id: string, title: string) => {
    const next = title.trim().length > 0 ? title : 'Untitled board';
    setBoards((current) =>
      current.map((board) =>
        board.id === id ? { ...board, title: next, updatedAt: 'Just now' } : board,
      ),
    );
    runWrite((database) => updateBoardTitle(database, id, next));
  }, [runWrite]);

  const updateSettings = useCallback((id: string, settings: BoardSettings) => {
    setBoards((current) =>
      current.map((board) =>
        board.id === id ? { ...board, settings: { ...settings }, updatedAt: 'Just now' } : board,
      ),
    );
    runWrite((database) => updateBoardSettings(database, id, settings));
  }, [runWrite]);

  const touchBoard = useCallback((id: string, objectCount: number) => {
    setBoards((current) =>
      current.map((board) =>
        board.id === id ? { ...board, objectCount, updatedAt: 'Just now' } : board,
      ),
    );
  }, []);

  const getBoard = useCallback(
    (id: string) => boards.find((board) => board.id === id),
    [boards],
  );
  const clearStorageError = useCallback(() => setStorageError(null), []);
  const resetBoards = useCallback(() => setBoards([]), []);

  const value = useMemo<BoardContextValue>(
    () => ({
      boards,
      ready,
      storageError,
      createBoard,
      updateTitle,
      updateSettings,
      touchBoard,
      getBoard,
      refreshBoards,
      clearStorageError,
      resetBoards,
    }),
    [
      boards,
      ready,
      storageError,
      createBoard,
      updateTitle,
      updateSettings,
      touchBoard,
      getBoard,
      refreshBoards,
      clearStorageError,
      resetBoards,
    ],
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

export function useBoards() {
  const context = useContext(BoardContext);
  if (!context) throw new Error('useBoards must be used inside BoardProvider');
  return context;
}
