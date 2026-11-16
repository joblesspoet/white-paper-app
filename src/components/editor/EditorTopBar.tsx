import { memo } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { colors, spacing, type ThemeColors } from '../../theme';
import {
  BroadcastIcon,
  ChevronRightIcon,
  GridIcon,
  MoreIcon,
  RedoIcon,
  UndoIcon,
} from '../icons';
import { editorTopBarStyles as styles } from './EditorTopBar.styles';

export type SaveStatus = 'saved' | 'saving' | 'error';

type EditorTopBarProps = {
  title: string;
  theme: ThemeColors;
  isDark: boolean;
  isTablet: boolean;
  topBarHeight: number;
  leftInset: number;
  rightInset: number;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  showPresenterButton: boolean;
  hidePrivatePreview: boolean;
  isStudentRoute: boolean;
  startingLiveClass: boolean;
  liveClassActive: boolean;
  hostSheetVisible: boolean;
  onBack: () => void;
  onChangeTitle: (value: string) => void;
  onFocusTitle: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onTogglePresenter: () => void;
  onOpenBoardStyle: () => void;
  onPressLiveClass: () => void;
  onOpenExportMenu: () => void;
};

export const EditorTopBar = memo(function EditorTopBar({
  title,
  theme,
  isDark,
  isTablet,
  topBarHeight,
  leftInset,
  rightInset,
  saveStatus,
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
  showPresenterButton,
  hidePrivatePreview,
  isStudentRoute,
  startingLiveClass,
  liveClassActive,
  hostSheetVisible,
  onBack,
  onChangeTitle,
  onFocusTitle,
  onUndo,
  onRedo,
  onTogglePresenter,
  onOpenBoardStyle,
  onPressLiveClass,
  onOpenExportMenu,
}: EditorTopBarProps) {
  const liveBusy = startingLiveClass && !liveClassActive;

  return (
    <View
      style={[
        styles.topBar,
        {
          minHeight: topBarHeight,
          borderBottomColor: theme.border,
          backgroundColor: theme.background,
          paddingLeft: spacing.sm + leftInset,
          paddingRight: spacing.sm + rightInset,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to boards"
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <ChevronRightIcon color={theme.foreground} />
      </Pressable>

      <View style={styles.titleWrap}>
        <TextInput
          accessibilityLabel="Board title"
          value={title}
          onChangeText={onChangeTitle}
          onFocus={onFocusTitle}
          style={[styles.title, { color: theme.foreground }]}
        />
        {isTablet && (
          <View
            style={[
              styles.savePill,
              {
                borderColor: saveStatus === 'error' ? theme.destructive : theme.border,
                backgroundColor: theme.surface,
              },
            ]}
          >
            <View
              style={[
                styles.saveDot,
                {
                  backgroundColor:
                    saveStatus === 'error'
                      ? theme.destructive
                      : saveStatus === 'saving'
                        ? theme.accent
                        : theme.primary,
                },
              ]}
            />
            <Text style={[styles.saveText, { color: theme.foreground }]}>
              {saveStatus === 'error'
                ? 'Save retry'
                : saveStatus === 'saving'
                  ? 'Saving…'
                  : 'Local SQLite'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Undo"
          accessibilityHint={
            canUndo
              ? undoLabel
                ? `Undo ${undoLabel}`
                : 'Reverts the last change'
              : 'Nothing to undo'
          }
          accessibilityState={{ disabled: !canUndo }}
          disabled={!canUndo}
          onPress={onUndo}
          style={({ pressed }) => [
            styles.action,
            !canUndo && styles.actionDisabled,
            pressed && styles.pressed,
          ]}
        >
          <UndoIcon size={22} color={theme.foreground} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Redo"
          accessibilityHint={
            canRedo
              ? redoLabel
                ? `Redo ${redoLabel}`
                : 'Reapplies the last undone change'
              : 'Nothing to redo'
          }
          accessibilityState={{ disabled: !canRedo }}
          disabled={!canRedo}
          onPress={onRedo}
          style={({ pressed }) => [
            styles.action,
            !canRedo && styles.actionDisabled,
            pressed && styles.pressed,
          ]}
        >
          <RedoIcon size={22} color={theme.foreground} />
        </Pressable>

        {showPresenterButton && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidePrivatePreview ? 'Show presenter notes' : 'Hide presenter notes'}
            accessibilityState={{ selected: hidePrivatePreview }}
            onPress={onTogglePresenter}
            style={({ pressed }) => [
              styles.presenterPill,
              {
                borderColor: hidePrivatePreview ? theme.primary : theme.border,
                backgroundColor: hidePrivatePreview ? theme.muted : theme.surface,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.presenterPillText,
                { color: hidePrivatePreview ? theme.primary : theme.foreground },
              ]}
            >
              {hidePrivatePreview ? 'Notes Off' : 'Presenter'}
            </Text>
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Board background style"
          onPress={onOpenBoardStyle}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <GridIcon size={20} color={theme.foreground} />
        </Pressable>

        {!isStudentRoute && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: liveBusy,
              busy: liveBusy,
            }}
            disabled={liveBusy}
            accessibilityLabel={
              liveBusy
                ? 'Starting live class'
                : liveClassActive
                  ? hostSheetVisible
                    ? 'Hide live classroom controls'
                    : 'Open live classroom controls'
                  : 'Start live class'
            }
            onPress={onPressLiveClass}
            style={({ pressed }) => [
              styles.liveButton,
              {
                borderColor: liveClassActive ? colors.destructive : theme.primary,
                backgroundColor: liveClassActive
                  ? isDark
                    ? 'rgba(127, 29, 29, 0.28)'
                    : '#FEE2E2'
                  : theme.surface,
                opacity: liveBusy ? 0.65 : 1,
              },
              pressed && styles.pressed,
            ]}
          >
            {liveBusy ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <BroadcastIcon
                size={16}
                color={liveClassActive ? colors.destructive : theme.primary}
              />
            )}
            <Text
              style={[
                styles.liveButtonText,
                { color: liveClassActive ? colors.destructive : theme.primary },
              ]}
            >
              Live
            </Text>
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Export and board options"
          onPress={onOpenExportMenu}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <MoreIcon color={theme.foreground} />
        </Pressable>
      </View>
    </View>
  );
});
