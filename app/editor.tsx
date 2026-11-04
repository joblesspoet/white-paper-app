import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useBoards } from '../src/board-context';
import { Pressable, StyleSheet, Text, TextInput, useColorScheme, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronRightIcon, MoreIcon } from '../src/components/icons';
import { CanvasViewport } from '../src/components/CanvasViewport';
import { colors, darkColors, radii, spacing, touchTarget, typography } from '../src/theme';

export default function BoardEditorScreen() {
  const router = useRouter();
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { boards, updateTitle } = useBoards();
  const board = boards.find((item) => item.id === boardId);
  const [title, setTitle] = useState(board?.title ?? 'Untitled board');
  useEffect(() => { if (board) setTitle(board.title); }, [board]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const theme = useColorScheme() === 'dark' ? darkColors : colors;
  const tablet = width >= 768;
  const [drawingEnabled, setDrawingEnabled] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to boards" onPress={() => router.back()} style={styles.iconButton}>
          <ChevronRightIcon color={theme.foreground} />
        </Pressable>
        <TextInput accessibilityLabel="Board title" value={title} onChangeText={(value) => { setTitle(value); if (boardId) updateTitle(boardId, value); }} style={[styles.title, { color: theme.foreground }]} />
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Undo" style={styles.action}><Text style={[styles.actionText, { color: theme.foreground }]}>↶</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Redo" style={styles.action}><Text style={[styles.actionText, { color: theme.foreground }]}>↷</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="More board options" style={styles.iconButton}><MoreIcon color={theme.foreground} /></Pressable>
        </View>
      </View>

      <View style={styles.workspace}>
        {tablet && <ToolRail theme={theme} onPenPress={() => setDrawingEnabled((value) => !value)} />}
        <View style={[styles.canvas, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <CanvasViewport dark={useColorScheme() === 'dark'} drawingEnabled={drawingEnabled} />
          <View pointerEvents="none" style={styles.canvasGuidance}>
            <Text style={[styles.canvasTitle, { color: theme.foreground }]}>Your canvas is ready</Text>
            <Text style={[styles.canvasBody, { color: theme.foreground }]}>Use the tools below to start creating.</Text>
          </View>
        </View>
      </View>

      {!tablet && <ToolDock theme={theme} bottom={insets.bottom} onPenPress={() => setDrawingEnabled((value) => !value)} />}
    </View>
  );
}

function ToolRail({ theme, onPenPress }: { theme: { foreground: string; border: string }; onPenPress: () => void }) {
  return <View style={[styles.rail, { borderRightColor: theme.border }]}><Tool theme={theme} label="Select" icon="↖" /><Tool theme={theme} label="Pen" icon="✎" onPress={onPenPress} /><Tool theme={theme} label="Text" icon="T" /><Tool theme={theme} label="Shape" icon="□" /></View>;
}
function ToolDock({ theme, bottom, onPenPress }: { theme: { foreground: string; surface: string; border: string }; bottom: number; onPenPress: () => void }) {
  return <View style={[styles.dock, { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: Math.max(spacing.sm, bottom) }]}><Tool theme={theme} label="Select" icon="↖" /><Tool theme={theme} label="Pen" icon="✎" onPress={onPenPress} /><Tool theme={theme} label="Text" icon="T" /><Tool theme={theme} label="Shape" icon="□" /></View>;
}
function Tool({ theme, label, icon, onPress }: { theme: { foreground: string }; label: string; icon: string; onPress?: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.tool, pressed && styles.toolPressed]}><Text style={[styles.toolIcon, { color: theme.foreground }]}>{icon}</Text><Text style={[styles.toolLabel, { color: theme.foreground }]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, borderBottomWidth: 1, gap: spacing.sm },
  iconButton: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '180deg' }] },
  title: { flex: 1, ...typography.bodyStrong, paddingVertical: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center' },
  action: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 28 },
  workspace: { flex: 1, flexDirection: 'row' },
  rail: { width: 80, borderRightWidth: 1, alignItems: 'center', paddingTop: spacing.md, gap: spacing.sm },
  canvas: { flex: 1, margin: spacing.md, borderWidth: 1, borderRadius: radii.md, overflow: 'hidden' },
  canvasGuidance: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  canvasTitle: { ...typography.subtitle },
  canvasBody: { ...typography.body, opacity: 0.7 },
  dock: { minHeight: 76, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, paddingTop: spacing.sm },
  tool: { minWidth: touchTarget, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  toolIcon: { fontSize: 22, lineHeight: 26 },
  toolLabel: { ...typography.caption },
  toolPressed: { opacity: 0.65 },
});
