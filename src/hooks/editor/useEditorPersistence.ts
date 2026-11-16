import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  type CanvasDocument,
  type DocumentAction,
  type ImageObject,
} from '../../canvas/document';
import type { Viewport } from '../../canvas/viewport';
import type { SaveStatus } from '../../components/editor/EditorTopBar';
import { storageErrorMessage } from '../../persistence/errors';
import { getLocalDatabase } from '../../persistence/expo-store';
import {
  createPage,
  deletePage,
  duplicatePage,
  listBoardPages,
  loadBoardDocument,
  renamePage,
  reorderPages,
  saveBoardDocument,
  saveBoardViewport,
  type BoardPageRecord,
} from '../../persistence/repository';
import { enqueuePersistenceWrite } from '../../persistence/write-queue';

const AUTOSAVE_DELAY = 700;
const VIEWPORT_SAVE_DELAY = 900;

export function sameViewport(left: Viewport, right: Viewport): boolean {
  return (
    Math.abs(left.x - right.x) < 0.5 &&
    Math.abs(left.y - right.y) < 0.5 &&
    Math.abs(left.scale - right.scale) < 0.001
  );
}

type UseEditorPersistenceArgs = {
  boardId?: string;
  initialDefaultViewport: Viewport;
  document: CanvasDocument;
  viewport: Viewport;
  viewportLive: React.MutableRefObject<Viewport>;
  dispatch: React.Dispatch<DocumentAction>;
  touchBoard: (id: string, objectCount: number) => void;
  setInitialViewport: React.Dispatch<React.SetStateAction<Viewport>>;
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
  commitEditing: () => void;
  setSelectedObjectIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedInkIds: React.Dispatch<React.SetStateAction<string[]>>;
  setActiveTool: (tool: 'select') => void;
  onBeforePageSwitch?: (
    targetPage: BoardPageRecord,
    targetIndex: number,
    nextViewport: Viewport,
  ) => void;
};

export function useEditorPersistence({
  boardId,
  initialDefaultViewport,
  document,
  viewport,
  viewportLive,
  dispatch,
  touchBoard,
  setInitialViewport,
  setViewport,
  commitEditing,
  setSelectedObjectIds,
  setSelectedInkIds,
  setActiveTool,
  onBeforePageSwitch,
}: UseEditorPersistenceArgs) {
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [pages, setPages] = useState<BoardPageRecord[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);

  const activePageIdRef = useRef<string | null>(null);
  const documentRef = useRef<CanvasDocument>(document);
  documentRef.current = document;
  const hydratedRef = useRef(false);
  const lastSavedDocument = useRef<CanvasDocument | null>(null);
  const savedViewport = useRef<Viewport | null>(null);
  const documentSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enqueueWrite = useCallback((task: () => Promise<void>) => {
    setSaveStatus('saving');
    void enqueuePersistenceWrite(task).catch((error: unknown) => {
      setStorageError(storageErrorMessage(error));
      setSaveStatus('error');
    });
  }, []);

  const persistDocument = useCallback(
    (snapshot: CanvasDocument, nextViewport: Viewport, pageIdOverride?: string | null) => {
      if (!boardId) return;
      const targetPageId = pageIdOverride ?? activePageIdRef.current ?? undefined;
      enqueueWrite(async () => {
        const database = await getLocalDatabase();
        await saveBoardDocument(database, boardId, snapshot, nextViewport, undefined, targetPageId);
        if (targetPageId === activePageIdRef.current) {
          lastSavedDocument.current = snapshot;
          savedViewport.current = nextViewport;
        }
        setStorageError(null);
        setSaveStatus('saved');
        touchBoard(boardId, snapshot.strokes.length + snapshot.objects.length);
      });
    },
    [boardId, enqueueWrite, touchBoard],
  );

  const flushPendingSaves = useCallback(() => {
    if (!boardId || !hydratedRef.current) return;
    if (documentSaveTimer.current) {
      clearTimeout(documentSaveTimer.current);
      documentSaveTimer.current = null;
    }
    if (viewportSaveTimer.current) {
      clearTimeout(viewportSaveTimer.current);
      viewportSaveTimer.current = null;
    }
    const snapshot = documentRef.current;
    const currentViewport = viewportLive.current;
    const targetPageId = activePageIdRef.current ?? undefined;
    const documentDirty = lastSavedDocument.current !== snapshot;
    const viewportDirty =
      !savedViewport.current || !sameViewport(savedViewport.current, currentViewport);
    if (!documentDirty && !viewportDirty) return;

    enqueueWrite(async () => {
      const database = await getLocalDatabase();
      if (documentDirty) {
        await saveBoardDocument(
          database,
          boardId,
          snapshot,
          currentViewport,
          undefined,
          targetPageId,
        );
        if (targetPageId === activePageIdRef.current) {
          lastSavedDocument.current = snapshot;
          savedViewport.current = currentViewport;
        }
        touchBoard(boardId, snapshot.strokes.length + snapshot.objects.length);
      } else {
        await saveBoardViewport(database, boardId, currentViewport, targetPageId);
        if (targetPageId === activePageIdRef.current) {
          savedViewport.current = currentViewport;
        }
      }
      setStorageError(null);
      setSaveStatus('saved');
    });
  }, [boardId, enqueueWrite, touchBoard, viewportLive]);

  const scheduleViewportSave = useCallback(
    (next: Viewport) => {
      if (!boardId || !hydratedRef.current) return;
      if (savedViewport.current && sameViewport(savedViewport.current, next)) return;
      if (viewportSaveTimer.current) clearTimeout(viewportSaveTimer.current);
      viewportSaveTimer.current = setTimeout(() => {
        viewportSaveTimer.current = null;
        const currentViewport = viewportLive.current;
        const targetPageId = activePageIdRef.current ?? undefined;
        if (!boardId || !hydratedRef.current) return;
        if (savedViewport.current && sameViewport(savedViewport.current, currentViewport)) return;
        enqueueWrite(async () => {
          const database = await getLocalDatabase();
          await saveBoardViewport(database, boardId, currentViewport, targetPageId);
          if (targetPageId === activePageIdRef.current) {
            savedViewport.current = currentViewport;
          }
          setStorageError(null);
          setSaveStatus('saved');
        });
      }, VIEWPORT_SAVE_DELAY);
    },
    [boardId, enqueueWrite, viewportLive],
  );

  // Hydrate pages on board mount
  useEffect(() => {
    let cancelled = false;
    hydratedRef.current = false;
    setHydrated(false);
    if (!boardId) {
      hydratedRef.current = true;
      lastSavedDocument.current = documentRef.current;
      setHydrated(true);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const database = await getLocalDatabase();
        let loadedPages = await listBoardPages(database, boardId);
        if (loadedPages.length === 0) {
          const snapshot = await loadBoardDocument(database, boardId);
          loadedPages = [
            {
              id: snapshot.pageId ?? `${boardId}:page:0`,
              boardId,
              name: 'Page 1',
              orderIndex: 0,
              document: snapshot.document,
              viewport: snapshot.viewport,
              backgroundAssetId: null,
              createdAt: '',
              updatedAt: '',
            },
          ];
        }
        if (cancelled) return;
        const firstPage = loadedPages[0];
        setPages(loadedPages);
        activePageIdRef.current = firstPage.id;
        setActivePageId(firstPage.id);
        dispatch({ type: 'hydrate', document: firstPage.document });
        lastSavedDocument.current = firstPage.document;
        const saved = firstPage.viewport ?? initialDefaultViewport;
        viewportLive.current = saved;
        savedViewport.current = saved;
        setInitialViewport(saved);
        setViewport(saved);
        setStorageError(null);
        setSaveStatus('saved');
      } catch (error) {
        if (cancelled) return;
        setStorageError(storageErrorMessage(error));
        setSaveStatus('error');
        lastSavedDocument.current = documentRef.current;
        savedViewport.current = viewportLive.current;
      } finally {
        if (!cancelled) {
          hydratedRef.current = true;
          setHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boardId, dispatch, initialDefaultViewport, setInitialViewport, setViewport, viewportLive]);

  // Debounced document autosave
  useEffect(() => {
    if (!hydrated || !boardId) return;
    if (lastSavedDocument.current === document) return;
    setSaveStatus('saving');
    if (documentSaveTimer.current) clearTimeout(documentSaveTimer.current);
    documentSaveTimer.current = setTimeout(() => {
      documentSaveTimer.current = null;
      persistDocument(documentRef.current, viewportLive.current);
    }, AUTOSAVE_DELAY);
    return () => {
      if (documentSaveTimer.current) {
        clearTimeout(documentSaveTimer.current);
        documentSaveTimer.current = null;
      }
    };
  }, [document, hydrated, boardId, persistDocument, viewportLive]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        flushPendingSaves();
      }
    });
    return () => sub.remove();
  }, [flushPendingSaves]);

  useEffect(() => () => flushPendingSaves(), [flushPendingSaves]);

  const activePageIndex = useMemo(() => {
    if (!activePageId || pages.length === 0) return 0;
    const found = pages.findIndex((page) => page.id === activePageId);
    return found >= 0 ? found : 0;
  }, [activePageId, pages]);

  const switchToPage = useCallback(
    (targetPageId: string, overridePages?: readonly BoardPageRecord[]) => {
      const sourcePages = overridePages ?? pages;
      if (targetPageId === activePageIdRef.current) return;
      const targetIndex = sourcePages.findIndex((p) => p.id === targetPageId);
      if (targetIndex < 0) return;
      const target = sourcePages[targetIndex];

      commitEditing();
      flushPendingSaves();

      const outgoingId = activePageIdRef.current;
      const outgoingDoc = documentRef.current;
      const outgoingViewport = viewportLive.current;

      setPages((prev) =>
        (overridePages ? [...overridePages] : prev).map((p) =>
          p.id === outgoingId ? { ...p, document: outgoingDoc, viewport: outgoingViewport } : p,
        ),
      );

      activePageIdRef.current = target.id;
      setActivePageId(target.id);
      setSelectedObjectIds([]);
      setSelectedInkIds([]);
      dispatch({ type: 'hydrate', document: target.document });
      lastSavedDocument.current = target.document;
      const nextViewport = target.viewport ?? initialDefaultViewport;
      onBeforePageSwitch?.(target, targetIndex, nextViewport);
      viewportLive.current = nextViewport;
      savedViewport.current = nextViewport;
      setInitialViewport(nextViewport);
      setViewport(nextViewport);
    },
    [
      commitEditing,
      dispatch,
      flushPendingSaves,
      initialDefaultViewport,
      onBeforePageSwitch,
      pages,
      setInitialViewport,
      setSelectedInkIds,
      setSelectedObjectIds,
      setViewport,
      viewportLive,
    ],
  );

  const handlePrevPage = useCallback(() => {
    if (activePageIndex <= 0) return;
    const target = pages[activePageIndex - 1];
    if (target) switchToPage(target.id);
  }, [activePageIndex, pages, switchToPage]);

  const handleNextPage = useCallback(() => {
    if (activePageIndex >= pages.length - 1) return;
    const target = pages[activePageIndex + 1];
    if (target) switchToPage(target.id);
  }, [activePageIndex, pages, switchToPage]);

  const handleAddPage = useCallback(async () => {
    if (!boardId) return;
    commitEditing();
    flushPendingSaves();
    try {
      const database = await getLocalDatabase();
      const created = await createPage(database, boardId, {
        insertAtIndex: activePageIndex + 1,
      });
      const updatedPages = await listBoardPages(database, boardId);
      setPages(updatedPages);
      switchToPage(created.id, updatedPages);
    } catch (error) {
      setStorageError(storageErrorMessage(error));
    }
  }, [activePageIndex, boardId, commitEditing, flushPendingSaves, switchToPage]);

  const handleDuplicatePage = useCallback(
    async (pageId: string) => {
      if (!boardId) return;
      commitEditing();
      flushPendingSaves();
      try {
        const database = await getLocalDatabase();
        const created = await duplicatePage(database, boardId, pageId);
        const updatedPages = await listBoardPages(database, boardId);
        setPages(updatedPages);
        switchToPage(created.id, updatedPages);
      } catch (error) {
        setStorageError(storageErrorMessage(error));
      }
    },
    [boardId, commitEditing, flushPendingSaves, switchToPage],
  );

  const handleRenamePage = useCallback(
    async (pageId: string, name: string) => {
      if (!boardId) return;
      try {
        const database = await getLocalDatabase();
        await renamePage(database, boardId, pageId, name);
        setPages((prev) =>
          prev.map((p) => (p.id === pageId ? { ...p, name: name.trim() || 'Page' } : p)),
        );
      } catch (error) {
        setStorageError(storageErrorMessage(error));
      }
    },
    [boardId],
  );

  const handleMovePage = useCallback(
    async (pageId: string, direction: -1 | 1) => {
      if (!boardId) return;
      const index = pages.findIndex((p) => p.id === pageId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= pages.length) return;
      const nextOrder = [...pages];
      const [moved] = nextOrder.splice(index, 1);
      nextOrder.splice(targetIndex, 0, moved);
      const reindexed = nextOrder.map((p, idx) => ({ ...p, orderIndex: idx }));
      setPages(reindexed);
      try {
        const database = await getLocalDatabase();
        await reorderPages(
          database,
          boardId,
          reindexed.map((p) => p.id),
        );
      } catch (error) {
        setStorageError(storageErrorMessage(error));
      }
    },
    [boardId, pages],
  );

  const handleDeletePage = useCallback(
    async (pageId: string) => {
      if (!boardId || pages.length <= 1) return;
      commitEditing();
      flushPendingSaves();
      try {
        const database = await getLocalDatabase();
        const result = await deletePage(database, boardId, pageId);
        setPages(result.remainingPages);
        if (activePageIdRef.current === pageId && result.remainingPages.length > 0) {
          switchToPage(result.remainingPages[0].id, result.remainingPages);
        }
      } catch (error) {
        setStorageError(storageErrorMessage(error));
      }
    },
    [boardId, commitEditing, flushPendingSaves, pages.length, switchToPage],
  );

  const handleImportedPdfPages = useCallback(
    async (createdPages: BoardPageRecord[]) => {
      if (!boardId || createdPages.length === 0) return;
      try {
        const database = await getLocalDatabase();
        const updatedPages = await listBoardPages(database, boardId);
        setPages(updatedPages);
        switchToPage(createdPages[0].id, updatedPages);
      } catch (error) {
        setStorageError(storageErrorMessage(error));
      }
    },
    [boardId, switchToPage],
  );

  const activeBackgroundPdfObject = useMemo(() => {
    const activePage = pages[activePageIndex];
    return (
      document.objects.find(
        (obj): obj is ImageObject =>
          obj.type === 'image' &&
          (obj.id.startsWith('pdf-bg-') ||
            (Boolean(activePage?.backgroundAssetId) &&
              obj.assetId === activePage?.backgroundAssetId)),
      ) ?? null
    );
  }, [activePageIndex, document.objects, pages]);

  const handleToggleBackgroundLock = useCallback(() => {
    if (!activeBackgroundPdfObject) return;
    const nextLocked = !activeBackgroundPdfObject.locked;
    dispatch({
      type: 'command',
      command: {
        type: 'object.update',
        id: activeBackgroundPdfObject.id,
        locked: nextLocked,
      },
    });
    if (nextLocked) {
      setSelectedObjectIds((prev) => prev.filter((id) => id !== activeBackgroundPdfObject.id));
    } else {
      setActiveTool('select');
      setSelectedObjectIds([activeBackgroundPdfObject.id]);
    }
  }, [activeBackgroundPdfObject, dispatch, setActiveTool, setSelectedObjectIds]);

  const exportPages = useMemo(() => {
    const currentId = activePageIdRef.current;
    return pages.map((page) =>
      page.id === currentId
        ? {
            id: page.id,
            name: page.name,
            orderIndex: page.orderIndex,
            document,
            viewport,
            backgroundAssetId: page.backgroundAssetId,
          }
        : {
            id: page.id,
            name: page.name,
            orderIndex: page.orderIndex,
            document: page.document,
            viewport: page.viewport,
            backgroundAssetId: page.backgroundAssetId,
          },
    );
  }, [document, pages, viewport]);

  return {
    hydrated,
    storageError,
    saveStatus,
    pages,
    activePageId,
    activePageIdRef,
    activePageIndex,
    activeBackgroundPdfObject,
    exportPages,
    documentRef,
    flushPendingSaves,
    scheduleViewportSave,
    switchToPage,
    handlePrevPage,
    handleNextPage,
    handleAddPage,
    handleDuplicatePage,
    handleRenamePage,
    handleMovePage,
    handleDeletePage,
    handleImportedPdfPages,
    handleToggleBackgroundLock,
  };
}
