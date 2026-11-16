import { useCallback, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '../src/components/AppButton';
import { BoardCard } from '../src/components/BoardCard';
import { BroadcastIcon, ImportIcon, StyleIcon } from '../src/components/icons';
import { ImportBoardModal } from '../src/components/ImportBoardModal';
import { JoinClassModal } from '../src/components/JoinClassModal';
import { BoardOptionsModal } from '../src/components/home/BoardOptionsModal';
import { CustomizeBoardModal } from '../src/components/home/CustomizeBoardModal';
import { HomeActionBar } from '../src/components/home/HomeActionBar';
import { HomeEmptyState } from '../src/components/home/HomeEmptyState';
import { HomeHeader } from '../src/components/home/HomeHeader';
import { HomeSearchBar } from '../src/components/home/HomeSearchBar';
import type { Board } from '../src/board-context';
import { useHomeBoards } from '../src/hooks/useHomeBoards';
import { resolveHomeLayout } from '../src/responsive/layout';
import { homeStyles as styles } from '../src/screens/home.styles';
import { usePreferences } from '../src/settings/preferences-context';

const keyExtractor = (item: Board) => item.id;

function ItemSeparator() {
  return <View style={styles.itemSeparator} />;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { theme, isDark, reducedMotion } = usePreferences();

  const {
    boards,
    filteredBoards,
    ready,
    storageError,
    showSearchBar,
    searchQuery,
    setSearchQuery,
    clearSearch,
    sheetVisible,
    openCustomize,
    closeCustomize,
    canvasBackground,
    setCanvasBackground,
    canvasStyle,
    setCanvasStyle,
    orientation,
    setOrientation,
    createBoardNow,
    createCustomizedBoard,
    joinModalVisible,
    joinInitialCode,
    openJoinModal,
    closeJoinModal,
    handleJoinClass,
    importState,
    startImport,
    closeImport,
    handleImported,
    openBoard,
    openSettings,
    menuBoard,
    menuMode,
    renameDraft,
    setRenameDraft,
    busyDuplicate,
    openBoardMenu,
    closeBoardMenu,
    startRenameBoard,
    submitRenameBoard,
    handleDuplicateBoard,
    startDeleteBoard,
    backToBoardMenu,
    confirmDeleteBoard,
  } = useHomeBoards();

  const layout = useMemo(
    () => resolveHomeLayout(width, height, insets),
    [width, height, insets],
  );
  const { columns, cardWidth, twoPane, sidebarWidth } = layout;

  const contentStyle = useMemo(
    () => ({
      paddingLeft: twoPane ? 0 : layout.paddingLeft,
      paddingRight: twoPane ? 0 : layout.paddingRight,
      paddingBottom: layout.paddingBottom,
    }),
    [layout.paddingBottom, layout.paddingLeft, layout.paddingRight, twoPane],
  );

  const renderBoard = useCallback(
    ({ item }: ListRenderItemInfo<Board>) => (
      <BoardCard
        board={item}
        width={cardWidth}
        theme={theme}
        onPress={openBoard}
        onMenuPress={openBoardMenu}
      />
    ),
    [cardWidth, openBoard, openBoardMenu, theme],
  );

  const handleQuickCreate = useCallback(() => {
    createBoardNow();
  }, [createBoardNow]);

  const handleOpenJoin = useCallback(() => {
    openJoinModal();
  }, [openJoinModal]);

  const handleStartImport = useCallback(() => {
    void startImport();
  }, [startImport]);

  const handleDuplicate = useCallback(() => {
    void handleDuplicateBoard();
  }, [handleDuplicateBoard]);

  const listHeader = useMemo(
    () =>
      twoPane ? undefined : (
        <HomeActionBar
          theme={theme}
          isTabletPortrait={layout.profile.isTabletPortrait}
          showSearchBar={showSearchBar}
          searchQuery={searchQuery}
          boardCount={boards.length}
          filteredCount={filteredBoards.length}
          onSearchChange={setSearchQuery}
          onClearSearch={clearSearch}
          onCreateBoard={handleQuickCreate}
          onOpenCustomize={openCustomize}
          onOpenJoinClass={handleOpenJoin}
          onStartImport={handleStartImport}
        />
      ),
    [
      boards.length,
      clearSearch,
      filteredBoards.length,
      handleOpenJoin,
      handleQuickCreate,
      handleStartImport,
      layout.profile.isTabletPortrait,
      openCustomize,
      searchQuery,
      setSearchQuery,
      showSearchBar,
      theme,
      twoPane,
    ],
  );

  const emptyComponent = useMemo(
    () => (
      <HomeEmptyState
        ready={ready}
        hasAnyBoards={boards.length > 0}
        searchQuery={searchQuery}
        columns={columns}
        cardWidth={cardWidth}
        theme={theme}
        isDark={isDark}
        reducedMotion={reducedMotion}
        onCreateBoard={handleQuickCreate}
        onOpenJoinClass={handleOpenJoin}
        onStartImport={handleStartImport}
        onClearSearch={clearSearch}
      />
    ),
    [
      boards.length,
      cardWidth,
      clearSearch,
      columns,
      handleOpenJoin,
      handleQuickCreate,
      handleStartImport,
      isDark,
      ready,
      reducedMotion,
      searchQuery,
      theme,
    ],
  );

  const listFooter = useMemo(
    () =>
      !twoPane && filteredBoards.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Import a board"
          onPress={handleStartImport}
          style={styles.importFooter}
        >
          <ImportIcon size={18} color={theme.primary} />
          <Text style={[styles.importFooterText, { color: theme.primary }]}>
            Import a board backup
          </Text>
        </Pressable>
      ) : undefined,
    [filteredBoards.length, handleStartImport, theme.primary, twoPane],
  );

  const boardList = (
    <FlatList
      key={`${columns}-${twoPane ? 'two' : 'one'}`}
      data={ready ? filteredBoards : []}
      numColumns={columns}
      renderItem={renderBoard}
      keyExtractor={keyExtractor}
      columnWrapperStyle={filteredBoards.length > 0 && columns > 1 ? styles.row : undefined}
      contentContainerStyle={contentStyle}
      ListHeaderComponent={listHeader}
      ListHeaderComponentStyle={!twoPane ? styles.listHeader : undefined}
      ListEmptyComponent={emptyComponent}
      ListFooterComponent={listFooter}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={ItemSeparator}
      removeClippedSubviews
      initialNumToRender={8}
      windowSize={5}
    />
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top']}>
      <HomeHeader
        theme={theme}
        paddingLeft={layout.paddingLeft}
        paddingRight={layout.paddingRight}
        isCompactHeight={layout.profile.isCompactHeight}
        isTablet={layout.profile.isTablet}
        boardCount={boards.length}
        onImportPress={handleStartImport}
        onSettingsPress={openSettings}
      />

      {storageError && (
        <View
          accessibilityRole="alert"
          style={[
            styles.storageBanner,
            {
              marginLeft: layout.paddingLeft,
              marginRight: layout.paddingRight,
              borderColor: theme.destructive,
              backgroundColor: theme.muted,
            },
          ]}
        >
          <Text style={[styles.storageBannerText, { color: theme.destructive }]}>
            Local storage: {storageError} Boards stay usable in memory, and the next change retries
            the save.
          </Text>
        </View>
      )}

      {twoPane ? (
        <View
          style={[
            styles.twoPaneBody,
            { paddingLeft: layout.paddingLeft, paddingRight: layout.paddingRight },
          ]}
        >
          <View style={[styles.sidebar, { width: sidebarWidth, borderRightColor: theme.border }]}>
            <AppButton
              label="+ New board"
              accessibilityHint="Creates a blank board and opens it"
              onPress={handleQuickCreate}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Customize new board"
              onPress={openCustomize}
              style={({ pressed }) => [
                styles.sidebarButton,
                { borderColor: theme.border, backgroundColor: theme.surface },
                pressed && styles.sidebarButtonPressed,
              ]}
            >
              <StyleIcon size={18} color={theme.primary} />
              <Text style={[styles.sidebarButtonText, { color: theme.foreground }]}>
                Customize board
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Join live class"
              onPress={handleOpenJoin}
              style={({ pressed }) => [
                styles.sidebarButton,
                { borderColor: theme.primary, backgroundColor: theme.surface },
                pressed && styles.sidebarButtonPressed,
              ]}
            >
              <BroadcastIcon size={18} color={theme.primary} />
              <Text style={[styles.sidebarButtonText, { color: theme.primary }]}>
                Join live class
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Import a board"
              onPress={handleStartImport}
              style={({ pressed }) => [
                styles.sidebarButton,
                { borderColor: theme.border, backgroundColor: theme.surface },
                pressed && styles.sidebarButtonPressed,
              ]}
            >
              <ImportIcon size={18} color={theme.primary} />
              <Text style={[styles.sidebarButtonText, { color: theme.foreground }]}>
                Import backup
              </Text>
            </Pressable>

            <View
              style={[
                styles.sidebarCard,
                { borderColor: theme.border, backgroundColor: theme.surface },
              ]}
            >
              <Text style={[styles.sidebarMetaTitle, { color: theme.primary }]}>
                LOCAL WORKSPACE
              </Text>
              <Text style={[styles.sidebarMetaBody, { color: theme.foreground }]}>
                {boards.length} {boards.length === 1 ? 'board' : 'boards'} stored on this device.
              </Text>
            </View>
          </View>

          <View style={styles.gridPane}>
            {(showSearchBar || boards.length > 0) && (
              <View style={styles.twoPaneSearchHeader}>
                {showSearchBar && (
                  <HomeSearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onClear={clearSearch}
                    theme={theme}
                  />
                )}
                {boards.length > 0 && (
                  <View style={styles.sectionMetaRow}>
                    <Text style={[styles.sectionHeading, { color: theme.primary }]}>
                      RECENT BOARDS ({filteredBoards.length})
                    </Text>
                    <Text style={[styles.sectionCount, { color: theme.foreground }]}>
                      100% On-device SQLite
                    </Text>
                  </View>
                )}
              </View>
            )}
            {boardList}
          </View>
        </View>
      ) : (
        boardList
      )}

      <CustomizeBoardModal
        visible={sheetVisible}
        centered={layout.customizeModalCentered}
        maxWidth={layout.customizeModalMaxWidth}
        bottomInset={insets.bottom}
        theme={theme}
        reducedMotion={reducedMotion}
        canvasBackground={canvasBackground}
        canvasStyle={canvasStyle}
        orientation={orientation}
        onSelectBackground={setCanvasBackground}
        onSelectStyle={setCanvasStyle}
        onSelectOrientation={setOrientation}
        onCreate={createCustomizedBoard}
        onClose={closeCustomize}
      />

      <BoardOptionsModal
        board={menuBoard}
        mode={menuMode}
        renameDraft={renameDraft}
        busyDuplicate={busyDuplicate}
        centered={layout.customizeModalCentered}
        maxWidth={layout.customizeModalMaxWidth}
        bottomInset={insets.bottom}
        theme={theme}
        reducedMotion={reducedMotion}
        onChangeRenameDraft={setRenameDraft}
        onStartRename={startRenameBoard}
        onSubmitRename={submitRenameBoard}
        onDuplicate={handleDuplicate}
        onStartDelete={startDeleteBoard}
        onConfirmDelete={confirmDeleteBoard}
        onBackToMenu={backToBoardMenu}
        onClose={closeBoardMenu}
      />

      <ImportBoardModal
        state={importState}
        theme={theme}
        onClose={closeImport}
        onImported={handleImported}
      />

      <JoinClassModal
        visible={joinModalVisible}
        initialCode={joinInitialCode}
        theme={theme}
        onClose={closeJoinModal}
        onJoin={handleJoinClass}
      />
    </SafeAreaView>
  );
}
