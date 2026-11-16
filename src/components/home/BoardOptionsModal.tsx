import { memo } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { BoardOptionsMode } from '../../hooks/useHomeBoards';
import { colors, spacing, type ThemeColors } from '../../theme';
import type { BoardSummary } from '../BoardCard';
import { CloseIcon, DuplicateIcon, EditIcon, TrashIcon } from '../icons';
import { boardOptionsModalStyles as styles } from './BoardOptionsModal.styles';

type BoardOptionsModalProps = {
  board: BoardSummary | null;
  mode: BoardOptionsMode;
  renameDraft: string;
  busyDuplicate: boolean;
  centered: boolean;
  maxWidth: number;
  bottomInset: number;
  theme: ThemeColors;
  reducedMotion: boolean;
  onChangeRenameDraft: (text: string) => void;
  onStartRename: () => void;
  onSubmitRename: () => void;
  onDuplicate: () => void;
  onStartDelete: () => void;
  onConfirmDelete: () => void;
  onBackToMenu: () => void;
  onClose: () => void;
};

export const BoardOptionsModal = memo(function BoardOptionsModal({
  board,
  mode,
  renameDraft,
  busyDuplicate,
  centered,
  maxWidth,
  bottomInset,
  theme,
  reducedMotion,
  onChangeRenameDraft,
  onStartRename,
  onSubmitRename,
  onDuplicate,
  onStartDelete,
  onConfirmDelete,
  onBackToMenu,
  onClose,
}: BoardOptionsModalProps) {
  const visible = board !== null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType={reducedMotion ? 'none' : centered ? 'fade' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.scrim, centered && styles.scrimCentered]}
        onPress={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.keyboardWrap, centered && styles.keyboardWrapCentered]}
        >
          <Pressable
            style={[
              styles.sheet,
              centered
                ? [styles.sheetModal, { maxWidth, borderColor: theme.border }]
                : { paddingBottom: bottomInset + spacing.md, borderColor: theme.border },
              { backgroundColor: theme.surface },
            ]}
            onPress={() => undefined}
          >
            {!centered && <View style={[styles.grabber, { backgroundColor: theme.border }]} />}

            {board && mode === 'menu' && (
              <>
                <View style={styles.header}>
                  <View style={styles.titleWrap}>
                    <Text style={[styles.title, { color: theme.foreground }]} numberOfLines={1}>
                      {board.title}
                    </Text>
                    <Text style={[styles.meta, { color: theme.primary }]}>
                      {board.updatedAt} · {board.objectCount}{' '}
                      {board.objectCount === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close board options"
                    onPress={onClose}
                    style={styles.closeButton}
                  >
                    <CloseIcon size={20} color={theme.foreground} />
                  </Pressable>
                </View>

                <View
                  style={[
                    styles.actionCard,
                    { borderColor: theme.border, backgroundColor: theme.background },
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Rename board"
                    onPress={onStartRename}
                    style={({ pressed }) => [
                      styles.actionRow,
                      pressed && styles.actionPressed,
                    ]}
                  >
                    <EditIcon size={20} color={theme.primary} />
                    <Text style={[styles.actionText, { color: theme.foreground }]}>
                      Rename board
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Duplicate board"
                    disabled={busyDuplicate}
                    onPress={onDuplicate}
                    style={({ pressed }) => [
                      styles.actionRow,
                      styles.actionDivider,
                      { borderTopColor: theme.border },
                      pressed && styles.actionPressed,
                    ]}
                  >
                    <DuplicateIcon size={20} color={theme.primary} />
                    <Text style={[styles.actionText, { color: theme.foreground }]}>
                      {busyDuplicate ? 'Duplicating…' : 'Duplicate board'}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Delete board"
                    onPress={onStartDelete}
                    style={({ pressed }) => [
                      styles.actionRow,
                      styles.actionDivider,
                      { borderTopColor: theme.border },
                      pressed && styles.actionPressed,
                    ]}
                  >
                    <TrashIcon size={20} color={theme.destructive} />
                    <Text style={[styles.actionText, { color: theme.destructive }]}>
                      Delete board
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            {board && mode === 'rename' && (
              <>
                <View style={styles.header}>
                  <Text style={[styles.title, { color: theme.foreground }]}>Rename board</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close rename dialog"
                    onPress={onClose}
                    style={styles.closeButton}
                  >
                    <CloseIcon size={20} color={theme.foreground} />
                  </Pressable>
                </View>
                <TextInput
                  accessibilityLabel="Board title"
                  value={renameDraft}
                  onChangeText={onChangeRenameDraft}
                  placeholder="Untitled board"
                  placeholderTextColor={`${theme.foreground}66`}
                  autoFocus
                  selectTextOnFocus
                  returnKeyType="done"
                  onSubmitEditing={onSubmitRename}
                  style={[
                    styles.renameInput,
                    {
                      color: theme.foreground,
                      borderColor: theme.primary,
                      backgroundColor: theme.background,
                    },
                  ]}
                />
                <View style={styles.buttonRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancel rename"
                    onPress={onBackToMenu}
                    style={[
                      styles.secondaryButton,
                      { borderColor: theme.border, backgroundColor: theme.background },
                    ]}
                  >
                    <Text style={[styles.secondaryButtonText, { color: theme.foreground }]}>
                      Back
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Save board title"
                    onPress={onSubmitRename}
                    style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                  >
                    <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                      Save title
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            {board && mode === 'delete' && (
              <>
                <Text style={[styles.title, { color: theme.destructive }]}>Delete board?</Text>
                <Text style={[styles.deleteBody, { color: theme.foreground }]}>
                  “{board.title}” and all of its pages, strokes, and notes will be permanently
                  removed from this device.
                </Text>
                <View style={styles.deleteStack}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Confirm delete ${board.title}`}
                    onPress={onConfirmDelete}
                    style={({ pressed }) => [
                      styles.destructiveButton,
                      { backgroundColor: theme.destructive },
                      pressed && styles.actionPressed,
                    ]}
                  >
                    <Text style={[styles.destructiveText, { color: colors.onPrimary }]}>
                      Delete board
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancel delete"
                    onPress={onBackToMenu}
                    style={[
                      styles.cancelButton,
                      { borderColor: theme.border, backgroundColor: theme.background },
                    ]}
                  >
                    <Text style={[styles.secondaryButtonText, { color: theme.foreground }]}>
                      Cancel
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
});
