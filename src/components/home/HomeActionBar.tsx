import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { ThemeColors } from '../../theme';
import { AppButton } from '../AppButton';
import { BroadcastIcon, ImportIcon, StyleIcon } from '../icons';
import { HomeSearchBar } from './HomeSearchBar';
import { homeActionBarStyles as styles } from './HomeActionBar.styles';

type HomeActionBarProps = {
  theme: ThemeColors;
  isTabletPortrait: boolean;
  showSearchBar: boolean;
  searchQuery: string;
  boardCount: number;
  maxBoards: number | null;
  filteredCount: number;
  onSearchChange: (text: string) => void;
  onClearSearch: () => void;
  onCreateBoard: () => void;
  onOpenCustomize: () => void;
  onOpenJoinClass: () => void;
  onStartImport: () => void;
};

export const HomeActionBar = memo(function HomeActionBar({
  theme,
  isTabletPortrait,
  showSearchBar,
  searchQuery,
  boardCount,
  maxBoards,
  filteredCount,
  onSearchChange,
  onClearSearch,
  onCreateBoard,
  onOpenCustomize,
  onOpenJoinClass,
  onStartImport,
}: HomeActionBarProps) {
  const showSectionMeta = boardCount > 0;

  return (
    <View style={styles.phoneStack}>
      {showSearchBar && (
        <HomeSearchBar
          value={searchQuery}
          onChangeText={onSearchChange}
          onClear={onClearSearch}
          theme={theme}
        />
      )}

      {isTabletPortrait ? (
        <View style={styles.tabletRow}>
          <View style={styles.tabletPrimaryWrap}>
            <AppButton
              label="New board"
              accessibilityHint="Creates a blank board and opens it"
              onPress={onCreateBoard}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Customize new board"
            onPress={onOpenCustomize}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: theme.border, backgroundColor: theme.surface },
              pressed && styles.secondaryPressed,
            ]}
          >
            <StyleIcon size={18} color={theme.primary} />
            <Text style={[styles.secondaryText, { color: theme.foreground }]}>Customize</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Join live class"
            onPress={onOpenJoinClass}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: theme.primary, backgroundColor: theme.surface },
              pressed && styles.secondaryPressed,
            ]}
          >
            <BroadcastIcon size={18} color={theme.primary} />
            <Text style={[styles.secondaryText, { color: theme.primary }]}>Join live class</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Import a board"
            onPress={onStartImport}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: theme.border, backgroundColor: theme.surface },
              pressed && styles.secondaryPressed,
            ]}
          >
            <ImportIcon size={18} color={theme.primary} />
            <Text style={[styles.secondaryText, { color: theme.foreground }]}>Import</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <AppButton
            label="+ New board"
            accessibilityHint="Creates a blank board and opens it"
            onPress={onCreateBoard}
          />
          <View style={styles.phoneRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Customize new board"
              onPress={onOpenCustomize}
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.secondaryFlex,
                { borderColor: theme.border, backgroundColor: theme.surface },
                pressed && styles.secondaryPressed,
              ]}
            >
              <StyleIcon size={18} color={theme.primary} />
              <Text style={[styles.secondaryText, { color: theme.foreground }]}>Customize</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Join live class"
              onPress={onOpenJoinClass}
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.secondaryFlex,
                { borderColor: theme.primary, backgroundColor: theme.surface },
                pressed && styles.secondaryPressed,
              ]}
            >
              <BroadcastIcon size={18} color={theme.primary} />
              <Text style={[styles.secondaryText, { color: theme.primary }]}>Join class</Text>
            </Pressable>
          </View>
        </>
      )}

      {showSectionMeta && (
        <View style={styles.sectionMetaRow}>
          <Text style={[styles.sectionHeading, { color: theme.primary }]}>
            RECENT BOARDS ({filteredCount})
          </Text>
          <Text style={[styles.sectionCount, { color: theme.foreground }]}>
            {maxBoards !== null ? `${boardCount} / ${maxBoards} boards` : 'Local storage'}
          </Text>
        </View>
      )}
    </View>
  );
});
