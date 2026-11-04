import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, Text, useColorScheme, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '../src/components/AppButton';
import { BoardCard, BoardSummary } from '../src/components/BoardCard';
import { BoardIcon, PlusIcon, SettingsIcon } from '../src/components/icons';
import { colors, darkColors, spacing } from '../src/theme';
import { homeStyles as styles } from '../src/screens/home.styles';

const initialBoards: BoardSummary[] = [];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? darkColors : colors;
  const [boards, setBoards] = useState(initialBoards);
  const columns = width >= 768 ? 4 : 2;
  const horizontalPadding = width >= 768 ? spacing.xl : spacing.lg;
  const contentStyle = useMemo(() => ({ paddingHorizontal: horizontalPadding, paddingBottom: spacing.xl + insets.bottom }), [horizontalPadding, insets.bottom]);

  const createBoard = useCallback(() => {
    const board = { id: String(Date.now()), title: 'Untitled board', updatedAt: 'Just now', objectCount: 0 };
    setBoards((current) => [board, ...current]);
    router.push('/editor');
  }, [router]);

  const renderBoard = useCallback(({ item }: { item: BoardSummary }) => (
    <BoardCard board={item} onPress={() => router.push('/editor')} onMenuPress={() => undefined} />
  ), [router]);

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

      <FlatList
        key={columns}
        data={boards}
        numColumns={columns}
        renderItem={renderBoard}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={boards.length > 0 ? styles.row : undefined}
        contentContainerStyle={contentStyle}
        ListHeaderComponent={<AppButton label="New board" accessibilityHint="Creates a blank board and opens it" onPress={createBoard} />}
        ListHeaderComponentStyle={styles.listHeader}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: theme.border, backgroundColor: theme.muted }]}>
            <View style={[styles.emptyIcon, { backgroundColor: isDark ? theme.darkSurface : colors.background }]}><BoardIcon size={44} color={theme.primary} /></View>
            <Text style={[styles.emptyTitle, { color: theme.foreground }]}>Start with a blank canvas</Text>
            <Text style={[styles.emptyBody, { color: theme.foreground }]}>Capture thoughts, sketch ideas, and turn them into something useful.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Create your first board" onPress={createBoard} style={[styles.emptyButton, { backgroundColor: theme.accent }]}>
              <PlusIcon />
              <Text style={styles.emptyButtonText}>Create your first board</Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={boards.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Import a board" style={styles.import}><Text style={[styles.importText, { color: theme.primary }]}>Import a board</Text></Pressable> : undefined}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />
    </SafeAreaView>
  );
}
