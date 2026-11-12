import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '../src/components/AppButton';
import { BoardCard, BoardSummary } from '../src/components/BoardCard';
import { BoardIcon, PlusIcon, SettingsIcon } from '../src/components/icons';
import { ImportBoardModal, type ImportModalState } from '../src/components/ImportBoardModal';
import { importErrorMessage } from '../src/export/backup';
import { pickBackupFile } from '../src/export/backup-store';
import { resolveHomeLayout } from '../src/responsive/layout';
import { colors, radii, spacing, touchTarget, typography } from '../src/theme';
import { homeStyles as styles } from '../src/screens/home.styles';
import { useBoards } from '../src/board-context';
import { BOARD_STYLE_OPTIONS, type BoardBackground, type BoardStyle } from '../src/persistence/schema';
import { usePreferences } from '../src/settings/preferences-context';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { theme, isDark, preferences } = usePreferences();
  const { boards, createBoard, ready, storageError, refreshBoards } = useBoards();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [importState, setImportState] = useState<ImportModalState>({ status: 'closed' });
  const [canvasBackground, setCanvasBackground] = useState<BoardBackground>(preferences.canvasBackground);
  const [canvasStyle, setCanvasStyle] = useState<BoardStyle>(preferences.canvasStyle);
  const [orientation] = useState<'portrait' | 'landscape'>('portrait');

  const layout = useMemo(
    () => resolveHomeLayout(width, height, insets),
    [width, height, insets],
  );
  const { columns, cardWidth, twoPane, sidebarWidth } = layout;
  const isCompactHeader = layout.profile.isCompactHeight;
  const isTabletPortrait = layout.profile.isTabletPortrait;

  const contentStyle = useMemo(
    () => ({
      paddingLeft: twoPane ? 0 : layout.paddingLeft,
      paddingRight: twoPane ? 0 : layout.paddingRight,
      paddingBottom: layout.paddingBottom,
    }),
    [layout.paddingBottom, layout.paddingLeft, layout.paddingRight, twoPane],
  );

  const createBoardNow = useCallback((settings?: { background: BoardBackground; style: BoardStyle; orientation: 'portrait' | 'landscape' }) => {
    const defaultSettings = {
      background: preferences.canvasBackground,
      style: preferences.canvasStyle,
      orientation: 'portrait' as const,
    };
    const board = createBoard(settings ?? defaultSettings);
    router.push({ pathname: '/editor', params: { boardId: board.id } });
  }, [createBoard, preferences.canvasBackground, preferences.canvasStyle, router]);

  const openCustomize = useCallback(() => {
    setCanvasBackground(preferences.canvasBackground);
    setCanvasStyle(preferences.canvasStyle);
    setSheetVisible(true);
  }, [preferences.canvasBackground, preferences.canvasStyle]);

  const createCustomizedBoard = useCallback(() => {
    setSheetVisible(false);
    createBoardNow({ background: canvasBackground, style: canvasStyle, orientation });
  }, [canvasBackground, canvasStyle, createBoardNow, orientation]);

  const renderBoard = useCallback(({ item }: { item: BoardSummary }) => (
    <BoardCard
      board={item}
      width={cardWidth}
      theme={theme}
      onPress={() => router.push({ pathname: '/editor', params: { boardId: item.id } })}
      onMenuPress={() => undefined}
    />
  ), [cardWidth, router, theme]);

  const startImport = useCallback(async () => {
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
  }, []);

  const emptyComponent = !ready ? (
    <View style={styles.loading}>
      <ActivityIndicator color={theme.primary} />
      <Text style={[styles.loadingText, { color: theme.foreground }]}>Opening your boards…</Text>
    </View>
  ) : (
    <View style={[styles.empty, { borderColor: theme.border, backgroundColor: theme.muted }]}>
      <View style={[styles.emptyIcon, { backgroundColor: isDark ? theme.darkSurface : colors.background }]}>
        <BoardIcon size={44} color={theme.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.foreground }]}>Start with a blank canvas</Text>
      <Text style={[styles.emptyBody, { color: theme.foreground }]}>
        Capture thoughts, sketch ideas, and turn them into something useful.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create your first board"
        onPress={() => createBoardNow()}
        style={[styles.emptyButton, { backgroundColor: theme.accent }]}
      >
        <PlusIcon />
        <Text style={styles.emptyButtonText}>Create your first board</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Import a board"
        onPress={() => { void startImport(); }}
        style={styles.import}
      >
        <Text style={[styles.importText, { color: theme.primary }]}>Import a board</Text>
      </Pressable>
    </View>
  );

  const listHeader = twoPane ? undefined : isTabletPortrait ? (
    <View style={styles.tabletActionRow}>
      <View style={styles.tabletPrimaryWrap}>
        <AppButton
          label="New board"
          accessibilityHint="Creates a blank board and opens it"
          onPress={() => createBoardNow()}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Customize new board"
        onPress={openCustomize}
        style={[styles.customizeLink, styles.customizeLinkInline, { borderColor: theme.border, backgroundColor: theme.surface }]}
      >
        <Text style={[styles.customizeLinkText, { color: theme.primary }]}>Customize</Text>
      </Pressable>
    </View>
  ) : (
    <View>
      <AppButton
        label="New board"
        accessibilityHint="Creates a blank board and opens it"
        onPress={() => createBoardNow()}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Customize new board"
        onPress={openCustomize}
        style={styles.customizeLink}
      >
        <Text style={[styles.customizeLinkText, { color: theme.primary }]}>Customize</Text>
      </Pressable>
    </View>
  );

  const boardList = (
    <FlatList
      key={`${columns}-${twoPane ? 'two' : 'one'}`}
      data={boards}
      numColumns={columns}
      renderItem={renderBoard}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={boards.length > 0 && columns > 1 ? styles.row : undefined}
      contentContainerStyle={contentStyle}
      ListHeaderComponent={listHeader}
      ListHeaderComponentStyle={!twoPane ? styles.listHeader : undefined}
      ListEmptyComponent={emptyComponent}
      ListFooterComponent={
        !twoPane && boards.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Import a board"
            onPress={() => { void startImport(); }}
            style={styles.import}
          >
            <Text style={[styles.importText, { color: theme.primary }]}>Import a board</Text>
          </Pressable>
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
    />
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top']}>
      <View
        style={[
          styles.header,
          isCompactHeader && styles.headerCompact,
          { paddingLeft: layout.paddingLeft, paddingRight: layout.paddingRight },
        ]}
      >
        <View style={styles.wordmarkWrap}>
          <Text style={[styles.wordmark, { color: theme.foreground }]}>FlowCanvas</Text>
          {!isCompactHeader && (
            <Text style={[styles.subtitle, { color: theme.primary }]}>Your ideas, in motion.</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={() => router.push('/settings')}
            style={[styles.iconButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
          >
            <SettingsIcon color={theme.foreground} />
          </Pressable>
        </View>
      </View>

      {storageError && (
        <View
          accessibilityRole="alert"
          style={[
            styles.storageBanner,
            {
              marginLeft: layout.paddingLeft,
              marginRight: layout.paddingRight,
              borderColor: theme.border,
              backgroundColor: theme.muted,
            },
          ]}
        >
          <Text style={[styles.storageBannerText, { color: theme.destructive }]}>
            Local storage: {storageError} Boards stay usable in memory, and the next change retries the save.
          </Text>
        </View>
      )}

      {twoPane ? (
        <View
          style={[
            styles.twoPaneBody,
            {
              paddingLeft: layout.paddingLeft,
              paddingRight: layout.paddingRight,
            },
          ]}
        >
          <View style={[styles.sidebar, { width: sidebarWidth, borderRightColor: theme.border }]}>
            <AppButton
              label="New board"
              accessibilityHint="Creates a blank board and opens it"
              onPress={() => createBoardNow()}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Customize new board"
              onPress={openCustomize}
              style={[styles.customizeLink, styles.customizeLinkInline, { borderColor: theme.border, backgroundColor: theme.surface }]}
            >
              <Text style={[styles.customizeLinkText, { color: theme.primary }]}>Customize</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Import a board"
              onPress={() => { void startImport(); }}
              style={[styles.customizeLink, styles.customizeLinkInline, { borderColor: theme.border, backgroundColor: theme.surface }]}
            >
              <Text style={[styles.customizeLinkText, { color: theme.primary }]}>Import a board</Text>
            </Pressable>
            <View style={[styles.sidebarCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Text style={[styles.sidebarMetaTitle, { color: theme.primary }]}>LOCAL WORKSPACE</Text>
              <Text style={[styles.sidebarMetaBody, { color: theme.foreground }]}>
                {boards.length} {boards.length === 1 ? 'board' : 'boards'} stored on this device.
              </Text>
            </View>
          </View>
          <View style={styles.gridPane}>{boardList}</View>
        </View>
      ) : (
        boardList
      )}

      <Modal
        transparent
        visible={sheetVisible}
        animationType={layout.customizeModalCentered ? 'fade' : 'slide'}
        statusBarTranslucent
        onRequestClose={() => setSheetVisible(false)}
      >
        <Pressable
          style={[
            sheetStyles.scrim,
            layout.customizeModalCentered && sheetStyles.scrimCentered,
          ]}
          onPress={() => setSheetVisible(false)}
        >
          <Pressable
            style={[
              sheetStyles.sheet,
              layout.customizeModalCentered
                ? [
                    sheetStyles.sheetModal,
                    {
                      maxWidth: layout.customizeModalMaxWidth,
                      borderColor: theme.border,
                    },
                  ]
                : { paddingBottom: insets.bottom + spacing.md, borderColor: theme.border },
              { backgroundColor: theme.surface },
            ]}
            onPress={() => undefined}
          >
            {!layout.customizeModalCentered && (
              <View style={[sheetStyles.grabber, { backgroundColor: theme.border }]} />
            )}
            <Text style={[sheetStyles.title, { color: theme.foreground }]}>Customize your board</Text>
            <Text style={[sheetStyles.body, { color: theme.foreground }]}>Choose a canvas style before you start.</Text>
            <Text style={[sheetStyles.label, { color: theme.foreground }]}>Canvas background</Text>
            <View style={sheetStyles.choiceRow}>
              <Choice label="Light" active={canvasBackground === 'light'} onPress={() => setCanvasBackground('light')} theme={theme} />
              <Choice label="White" active={canvasBackground === 'white'} onPress={() => setCanvasBackground('white')} theme={theme} />
              <Choice label="Dark" active={canvasBackground === 'dark'} onPress={() => setCanvasBackground('dark')} theme={theme} />
            </View>
            <Text style={[sheetStyles.label, { color: theme.foreground }]}>Canvas surface</Text>
            <View style={[sheetStyles.choiceRow, { flexWrap: 'wrap' }]}>
              {BOARD_STYLE_OPTIONS.map((opt) => (
                <Choice
                  key={opt.key}
                  label={opt.shortLabel}
                  active={canvasStyle === opt.key}
                  onPress={() => setCanvasStyle(opt.key)}
                  theme={theme}
                />
              ))}
            </View>
            <AppButton label="Create board" onPress={createCustomizedBoard} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel customization"
              onPress={() => setSheetVisible(false)}
              style={sheetStyles.cancel}
            >
              <Text style={[sheetStyles.link, { color: theme.primary }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ImportBoardModal
        state={importState}
        theme={theme}
        onClose={() => setImportState({ status: 'closed' })}
        onImported={(boardId) => {
          setImportState({ status: 'closed' });
          void refreshBoards();
          router.push({ pathname: '/editor', params: { boardId } });
        }}
      />
    </SafeAreaView>
  );
}

function Choice({ label, active, onPress, theme }: { label: string; active: boolean; onPress: () => void; theme: { primary: string; foreground: string; border: string; muted: string; surface: string } }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        sheetStyles.choice,
        {
          borderColor: active ? theme.primary : theme.border,
          backgroundColor: active ? theme.muted : theme.surface,
        },
      ]}
    >
      <Text style={[typography.bodyStrong, { color: theme.foreground }]}>{label}</Text>
    </Pressable>
  );
}

const sheetStyles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000055' },
  scrimCentered: { justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  sheet: {
    padding: spacing.lg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    gap: spacing.md,
  },
  sheetModal: {
    width: '100%',
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  grabber: { width: 44, height: 4, borderRadius: 2, alignSelf: 'center' },
  title: { ...typography.title },
  body: { ...typography.body, opacity: 0.75 },
  label: { ...typography.bodyStrong, marginTop: spacing.xs },
  choiceRow: { flexDirection: 'row', gap: spacing.sm },
  choice: {
    flex: 1,
    minHeight: touchTarget,
    borderWidth: 2,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { minHeight: touchTarget, alignItems: 'center', justifyContent: 'center' },
  link: { ...typography.bodyStrong },
});
