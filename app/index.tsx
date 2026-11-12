import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '../src/components/AppButton';
import { BoardCard, BoardSummary } from '../src/components/BoardCard';
import { BoardIcon, PlusIcon, SettingsIcon } from '../src/components/icons';
import { ImportBoardModal, type ImportModalState } from '../src/components/ImportBoardModal';
import { importErrorMessage } from '../src/export/backup';
import { pickBackupFile } from '../src/export/backup-store';
import { colors, darkColors, radii, spacing, touchTarget, typography } from '../src/theme';
import { homeStyles as styles } from '../src/screens/home.styles';
import { useBoards } from '../src/board-context';
import { usePreferences } from '../src/settings/preferences-context';

const initialBoards: BoardSummary[] = [];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme, isDark, preferences } = usePreferences();
  const { boards, createBoard, ready, storageError, refreshBoards } = useBoards();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [importState, setImportState] = useState<ImportModalState>({ status: 'closed' });
  const [canvasBackground, setCanvasBackground] = useState<'light' | 'dark'>(preferences.canvasBackground);
  const [canvasStyle, setCanvasStyle] = useState<'blank' | 'dots'>(preferences.canvasStyle);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const columns = width >= 768 ? 4 : 2;
  const horizontalPadding = width >= 768 ? spacing.xl : spacing.lg;
  const contentStyle = useMemo(() => ({ paddingHorizontal: horizontalPadding, paddingBottom: spacing.xl + insets.bottom }), [horizontalPadding, insets.bottom]);

  const createBoardNow = useCallback((settings?: { background: 'light' | 'dark'; style: 'blank' | 'dots'; orientation: 'portrait' | 'landscape' }) => {
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
    <BoardCard board={item} onPress={() => router.push({ pathname: '/editor', params: { boardId: item.id } })} onMenuPress={() => undefined} />
  ), [router]);

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

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
        <View>
          <Text style={[styles.wordmark, { color: theme.foreground }]}>FlowCanvas</Text>
          <Text style={[styles.subtitle, { color: theme.primary }]}>Your ideas, in motion.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => router.push('/settings')} style={styles.iconButton}>
          <SettingsIcon color={theme.foreground} />
        </Pressable>
      </View>

      {storageError && (
        <View
          accessibilityRole="alert"
          style={[styles.storageBanner, { borderColor: theme.border, backgroundColor: theme.muted }]}
        >
          <Text style={[styles.storageBannerText, { color: theme.destructive }]}>
            Local storage: {storageError} Boards stay usable in memory, and the next change retries the save.
          </Text>
        </View>
      )}

      <FlatList
        key={columns}
        data={boards}
        numColumns={columns}
        renderItem={renderBoard}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={boards.length > 0 ? styles.row : undefined}
        contentContainerStyle={contentStyle}
        ListHeaderComponent={<View><AppButton label="New board" accessibilityHint="Creates a blank board and opens it" onPress={() => createBoardNow()} /><Pressable accessibilityRole="button" accessibilityLabel="Customize new board" onPress={openCustomize} style={styles.customizeLink}><Text style={[styles.customizeLinkText, { color: theme.primary }]}>Customize</Text></Pressable></View>}
        ListHeaderComponentStyle={styles.listHeader}
        ListEmptyComponent={
          !ready ? (
            <View style={styles.loading}>
              <ActivityIndicator color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.foreground }]}>Opening your boards…</Text>
            </View>
          ) : (
            <View style={[styles.empty, { borderColor: theme.border, backgroundColor: theme.muted }]}>
              <View style={[styles.emptyIcon, { backgroundColor: isDark ? theme.darkSurface : colors.background }]}><BoardIcon size={44} color={theme.primary} /></View>
              <Text style={[styles.emptyTitle, { color: theme.foreground }]}>Start with a blank canvas</Text>
              <Text style={[styles.emptyBody, { color: theme.foreground }]}>Capture thoughts, sketch ideas, and turn them into something useful.</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Create your first board" onPress={() => createBoardNow()} style={[styles.emptyButton, { backgroundColor: theme.accent }]}>
                <PlusIcon />
                <Text style={styles.emptyButtonText}>Create your first board</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Import a board" onPress={() => { void startImport(); }} style={styles.import}>
                <Text style={[styles.importText, { color: theme.primary }]}>Import a board</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={boards.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Import a board" onPress={() => { void startImport(); }} style={styles.import}><Text style={[styles.importText, { color: theme.primary }]}>Import a board</Text></Pressable> : undefined}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />

      <Modal transparent visible={sheetVisible} animationType="slide" onRequestClose={() => setSheetVisible(false)}>
        <Pressable style={sheetStyles.scrim} onPress={() => setSheetVisible(false)}>
          <Pressable style={[sheetStyles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + spacing.md }]} onPress={() => undefined}>
            <View style={[sheetStyles.grabber, { backgroundColor: theme.border }]} />
            <Text style={[sheetStyles.title, { color: theme.foreground }]}>Customize your board</Text>
            <Text style={[sheetStyles.body, { color: theme.foreground }]}>Choose a canvas style before you start.</Text>
            <Text style={[sheetStyles.label, { color: theme.foreground }]}>Canvas background</Text>
            <View style={sheetStyles.choiceRow}>
              <Choice label="Light" active={canvasBackground === 'light'} onPress={() => setCanvasBackground('light')} theme={theme} />
              <Choice label="Dark" active={canvasBackground === 'dark'} onPress={() => setCanvasBackground('dark')} theme={theme} />
            </View>
            <AppButton label="Create board" onPress={createCustomizedBoard} />
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel customization" onPress={() => setSheetVisible(false)} style={sheetStyles.cancel}><Text style={[sheetStyles.link, { color: theme.primary }]}>Cancel</Text></Pressable>
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
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={onPress} style={[sheetStyles.choice, { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.muted : theme.surface }]}><Text style={[typography.bodyStrong, { color: theme.foreground }]}>{label}</Text></Pressable>;
}

const sheetStyles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000055' },
  sheet: { padding: spacing.lg, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, gap: spacing.md },
  grabber: { width: 44, height: 4, borderRadius: 2, alignSelf: 'center' },
  title: { ...typography.title }, body: { ...typography.body, opacity: 0.75 }, label: { ...typography.bodyStrong, marginTop: spacing.sm },
  choiceRow: { flexDirection: 'row', gap: spacing.sm }, choice: { flex: 1, minHeight: touchTarget, borderWidth: 2, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  cancel: { minHeight: touchTarget, alignItems: 'center', justifyContent: 'center' }, link: { ...typography.bodyStrong },
});
