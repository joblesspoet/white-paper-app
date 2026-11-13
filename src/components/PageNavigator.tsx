import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BoardPageRecord } from '../persistence/repository';
import { resolveFlowModalLayout } from '../responsive/layout';
import { spacing, type ThemeColors } from '../theme';
import { AppButton } from './AppButton';
import { pageNavigatorStyles as styles } from './PageNavigator.styles';

type PageNavigatorPillProps = {
  theme: ThemeColors;
  currentIndex: number;
  totalPages: number;
  compact?: boolean;
  canDeleteCurrentPage?: boolean;
  hasBackgroundImage?: boolean;
  isBackgroundLocked?: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddPage: () => void;
  onDeleteCurrentPage?: () => void;
  onToggleBackgroundLock?: () => void;
  onOpenSorter: () => void;
};

export const PageNavigatorPill = React.memo(function PageNavigatorPill({
  theme,
  currentIndex,
  totalPages,
  compact = false,
  canDeleteCurrentPage = false,
  hasBackgroundImage = false,
  isBackgroundLocked = true,
  onPrevPage,
  onNextPage,
  onAddPage,
  onDeleteCurrentPage,
  onToggleBackgroundLock,
  onOpenSorter,
}: PageNavigatorPillProps) {
  const safeTotal = Math.max(1, totalPages);
  const safeIndex = Math.max(0, Math.min(safeTotal - 1, currentIndex));
  const hasPrev = safeIndex > 0;
  const hasNext = safeIndex < safeTotal - 1;

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous page"
        accessibilityState={{ disabled: !hasPrev }}
        disabled={!hasPrev}
        onPress={onPrevPage}
        style={[styles.pillButton, !hasPrev && styles.pillButtonDisabled]}
      >
        <Text style={[styles.pillGlyph, { color: theme.foreground }]}>‹</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Page ${safeIndex + 1} of ${safeTotal}. Open page sorter`}
        onPress={onOpenSorter}
        style={[styles.pillLabelButton, { borderColor: theme.border }]}
      >
        <Text style={[styles.pillLabelText, { color: theme.foreground }]}>
          {compact ? `${safeIndex + 1}/${safeTotal}` : `Page ${safeIndex + 1} / ${safeTotal}`}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next page"
        accessibilityState={{ disabled: !hasNext }}
        disabled={!hasNext}
        onPress={onNextPage}
        style={[styles.pillButton, !hasNext && styles.pillButtonDisabled]}
      >
        <Text style={[styles.pillGlyph, { color: theme.foreground }]}>›</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add blank page"
        onPress={onAddPage}
        style={[styles.pillAddButton, { borderColor: theme.border }]}
      >
        <Text style={[styles.pillGlyph, { color: theme.primary }]}>+</Text>
      </Pressable>

      {onDeleteCurrentPage ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete current page"
          accessibilityState={{ disabled: !canDeleteCurrentPage }}
          disabled={!canDeleteCurrentPage}
          onPress={onDeleteCurrentPage}
          style={[
            styles.pillAddButton,
            { borderColor: theme.border },
            !canDeleteCurrentPage && styles.pillButtonDisabled,
          ]}
        >
          <Text style={[styles.pillGlyph, { color: theme.destructive }]}>−</Text>
        </Pressable>
      ) : null}

      {hasBackgroundImage && onToggleBackgroundLock ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isBackgroundLocked
              ? 'Unlock PDF background to move or resize'
              : 'Lock PDF background'
          }
          onPress={onToggleBackgroundLock}
          style={[
            styles.pillAddButton,
            {
              borderColor: theme.border,
              paddingHorizontal: spacing.sm,
              backgroundColor: isBackgroundLocked ? theme.surface : theme.primary + '1F',
            },
          ]}
        >
          <Text
            style={[
              styles.pillLabelText,
              { color: isBackgroundLocked ? theme.foreground : theme.primary },
            ]}
          >
            {isBackgroundLocked ? 'Unlock PDF' : 'Lock PDF'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

type PageSorterCardProps = {
  page: BoardPageRecord;
  index: number;
  totalPages: number;
  active: boolean;
  theme: ThemeColors;
  onSelect: (pageId: string) => void;
  onRename: (pageId: string, name: string) => void;
  onDuplicate: (pageId: string) => void;
  onMoveUp: (pageId: string) => void;
  onMoveDown: (pageId: string) => void;
  onDelete: (pageId: string) => void;
};

const PageSorterCard = React.memo(function PageSorterCard({
  page,
  index,
  totalPages,
  active,
  theme,
  onSelect,
  onRename,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
}: PageSorterCardProps) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(page.name);

  useEffect(() => {
    setDraftName(page.name);
  }, [page.name]);

  const objectCount = page.document.objects.length;
  const strokeCount = page.document.strokes.length;
  const metaText = useMemo(() => {
    if (objectCount === 0 && strokeCount === 0) return 'Blank page';
    const parts: string[] = [];
    if (objectCount > 0) parts.push(`${objectCount} object${objectCount === 1 ? '' : 's'}`);
    if (strokeCount > 0) parts.push(`${strokeCount} stroke${strokeCount === 1 ? '' : 's'}`);
    return parts.join(' · ');
  }, [objectCount, strokeCount]);

  const canMoveUp = index > 0;
  const canMoveDown = index < totalPages - 1;
  const canDelete = totalPages > 1;

  const handleSelect = useCallback(() => {
    if (!editingName) onSelect(page.id);
  }, [editingName, onSelect, page.id]);

  const handleCommitRename = useCallback(() => {
    onRename(page.id, draftName);
    setEditingName(false);
  }, [draftName, onRename, page.id]);

  const handleMoveUp = useCallback(() => onMoveUp(page.id), [onMoveUp, page.id]);
  const handleMoveDown = useCallback(() => onMoveDown(page.id), [onMoveDown, page.id]);
  const handleDuplicate = useCallback(() => onDuplicate(page.id), [onDuplicate, page.id]);
  const handleDelete = useCallback(() => onDelete(page.id), [onDelete, page.id]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${page.name}`}
      accessibilityState={{ selected: active }}
      onPress={handleSelect}
      style={[
        styles.card,
        {
          borderColor: active ? theme.primary : theme.border,
          backgroundColor: active ? theme.muted : theme.surface,
        },
      ]}
    >
      <View style={styles.cardTopRow}>
        <View
          style={[
            styles.pageBadge,
            {
              borderColor: active ? theme.primary : theme.border,
              backgroundColor: active ? theme.primary : theme.background,
            },
          ]}
        >
          <Text
            style={[
              styles.pageBadgeText,
              { color: active ? theme.onPrimary : theme.foreground },
            ]}
          >
            {index + 1}
          </Text>
        </View>

        <View style={styles.cardInfo}>
          {editingName ? (
            <View style={styles.renameRow}>
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                onSubmitEditing={handleCommitRename}
                autoFocus
                returnKeyType="done"
                style={[
                  styles.renameInput,
                  {
                    color: theme.foreground,
                    borderColor: theme.primary,
                    backgroundColor: theme.background,
                  },
                ]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save page name"
                onPress={handleCommitRename}
                style={[styles.renameSaveBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.renameSaveText, { color: theme.onPrimary }]}>
                  Save
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { color: theme.foreground }]} numberOfLines={1}>
                {page.name}
              </Text>
              {page.backgroundAssetId ? (
                <View style={[styles.pdfTag, { backgroundColor: theme.background }]}>
                  <Text style={[styles.pdfTagText, { color: theme.primary }]}>PDF</Text>
                </View>
              ) : null}
            </View>
          )}
          <Text style={[styles.cardMeta, { color: theme.foreground + '99' }]}>{metaText}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Rename ${page.name}`}
          onPress={() => setEditingName((prev) => !prev)}
          style={[styles.actionChip, { borderColor: theme.border, backgroundColor: theme.background }]}
        >
          <Text style={[styles.actionChipText, { color: theme.foreground }]}>Rename</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Move ${page.name} up`}
          disabled={!canMoveUp}
          onPress={handleMoveUp}
          style={[
            styles.actionChip,
            { borderColor: theme.border, backgroundColor: theme.background },
            !canMoveUp && styles.actionChipDisabled,
          ]}
        >
          <Text style={[styles.actionChipText, { color: theme.foreground }]}>↑</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Move ${page.name} down`}
          disabled={!canMoveDown}
          onPress={handleMoveDown}
          style={[
            styles.actionChip,
            { borderColor: theme.border, backgroundColor: theme.background },
            !canMoveDown && styles.actionChipDisabled,
          ]}
        >
          <Text style={[styles.actionChipText, { color: theme.foreground }]}>↓</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Duplicate ${page.name}`}
          onPress={handleDuplicate}
          style={[styles.actionChip, { borderColor: theme.border, backgroundColor: theme.background }]}
        >
          <Text style={[styles.actionChipText, { color: theme.foreground }]}>Copy</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${page.name}`}
          disabled={!canDelete}
          onPress={handleDelete}
          style={[
            styles.actionChip,
            { borderColor: theme.border, backgroundColor: theme.background },
            !canDelete && styles.actionChipDisabled,
          ]}
        >
          <Text style={[styles.actionChipText, { color: theme.destructive }]}>Delete</Text>
        </Pressable>
      </View>
    </Pressable>
  );
});

type PageSorterSheetProps = {
  visible: boolean;
  theme: ThemeColors;
  pages: readonly BoardPageRecord[];
  activePageId: string | null;
  onClose: () => void;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onDuplicatePage: (pageId: string) => void;
  onRenamePage: (pageId: string, name: string) => void;
  onMovePage: (pageId: string, direction: -1 | 1) => void;
  onDeletePage: (pageId: string) => void;
  onOpenPdfImport?: () => void;
};

export const PageSorterSheet = React.memo(function PageSorterSheet({
  visible,
  theme,
  pages,
  activePageId,
  onClose,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onRenamePage,
  onMovePage,
  onDeletePage,
  onOpenPdfImport,
}: PageSorterSheetProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { centeredModal, modalMaxWidth } = resolveFlowModalLayout(width, height);

  const keyExtractor = useCallback((item: BoardPageRecord) => item.id, []);

  const handleMoveUp = useCallback((pageId: string) => onMovePage(pageId, -1), [onMovePage]);
  const handleMoveDown = useCallback((pageId: string) => onMovePage(pageId, 1), [onMovePage]);

  const handleSelectAndClose = useCallback(
    (pageId: string) => {
      onSelectPage(pageId);
      onClose();
    },
    [onClose, onSelectPage],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<BoardPageRecord>) => (
      <PageSorterCard
        page={item}
        index={index}
        totalPages={pages.length}
        active={item.id === activePageId}
        theme={theme}
        onSelect={handleSelectAndClose}
        onRename={onRenamePage}
        onDuplicate={onDuplicatePage}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onDelete={onDeletePage}
      />
    ),
    [
      activePageId,
      handleMoveDown,
      handleMoveUp,
      handleSelectAndClose,
      onDeletePage,
      onDuplicatePage,
      onRenamePage,
      pages.length,
      theme,
    ],
  );

  const ItemSeparator = useCallback(() => <View style={styles.separator} />, []);

  return (
    <Modal
      transparent
      visible={visible}
      animationType={centeredModal ? 'fade' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.scrim, centeredModal && styles.scrimCentered]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.sheet,
            centeredModal
              ? [
                  styles.sheetModal,
                  {
                    maxWidth: modalMaxWidth,
                    borderColor: theme.border,
                    paddingBottom: spacing.lg,
                  },
                ]
              : {
                  borderColor: theme.border,
                  paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.md),
                },
            { backgroundColor: theme.surface },
          ]}
          onPress={() => undefined}
        >
          {!centeredModal && (
            <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          )}

          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.foreground }]}>Board pages</Text>
              <Text style={[styles.subtitle, { color: theme.foreground + '99' }]}>
                {pages.length} page{pages.length === 1 ? '' : 's'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close page sorter"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={[styles.closeText, { color: theme.primary }]}>Done</Text>
            </Pressable>
          </View>

          <FlatList
            data={pages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ItemSeparatorComponent={ItemSeparator}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews
          />

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <View style={styles.footerButton}>
              <AppButton
                label="Add page"
                variant="primary"
                onPress={onAddPage}
              />
            </View>
            {onOpenPdfImport ? (
              <View style={styles.footerButton}>
                <AppButton
                  label="Import PDF"
                  variant="secondary"
                  onPress={() => {
                    onClose();
                    onOpenPdfImport();
                  }}
                />
              </View>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});
