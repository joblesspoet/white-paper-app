import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { BoardSummary } from './components/BoardCard';

export type Board = BoardSummary & { createdAt: string; settings: { background: 'light' | 'dark'; orientation: 'landscape' | 'portrait' } };
type BoardContextValue = { boards: Board[]; createBoard: (settings?: Board['settings']) => Board; updateTitle: (id: string, title: string) => void };
const BoardContext = createContext<BoardContextValue | null>(null);
export function BoardProvider({ children }: { children: ReactNode }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const value = useMemo<BoardContextValue>(() => ({
    boards,
    createBoard: (settings = { background: 'light', orientation: 'landscape' }) => {
      const now = new Date().toISOString();
      const board: Board = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, title: 'Untitled board', updatedAt: 'Just now', objectCount: 0, createdAt: now, settings };
      setBoards((current) => [board, ...current]);
      return board;
    },
    updateTitle: (id, title) => setBoards((current) => current.map((board) => board.id === id ? { ...board, title: title || 'Untitled board', updatedAt: 'Just now' } : board)),
  }), [boards]);
  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}
export function useBoards() { const context = useContext(BoardContext); if (!context) throw new Error('useBoards must be used inside BoardProvider'); return context; }
