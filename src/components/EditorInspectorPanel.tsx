import { memo, useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { TidyMode } from '../canvas/auto-layout';
import type { ChartKind } from '../canvas/chart-generator';
import {
  isTableObject,
  isTextualObject,
  type CanvasObject,
  type FunctionPlotObject,
  type ObjectStylePatch,
} from '../canvas/document';
import type { InspectorPresentation } from '../responsive/layout';
import type { ThemeColors } from '../theme';
import { editorInspectorStyles as styles } from './EditorInspectorPanel.styles';
import { StemInspectorSection } from './StemInspectorSection';
import {
  ChevronRightIcon,
  DuplicateIcon,
  EditIcon,
  StyleIcon,
  TrashIcon,
} from './icons';
import {
  InspectorConnectorSection,
  InspectorShapeSection,
  InspectorTableSection,
  InspectorTextualSection,
} from './inspector/InspectorControls';

type EditorInspectorPanelProps = {
  theme: ThemeColors;
  dark: boolean;
  presentation: Extract<InspectorPresentation, 'docked' | 'overlay' | 'edge-tab'>;
  width: number;
  selectedObjects: CanvasObject[];
  onToggleOpen: () => void;
  onEditTextObject: (id: string) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onUpdateObjectStyle: (id: string, patch: ObjectStylePatch) => void;
  onTableAction?: (id: string, action: 'add-row' | 'remove-row' | 'add-col' | 'remove-col') => void;
  canTidySelection?: boolean;
  canPlotMath?: boolean;
  canChartTable?: boolean;
  selectedFunctionPlot?: FunctionPlotObject | null;
  onTidyLayout?: (mode: TidyMode) => void;
  onPlotMath?: () => void;
  onGenerateChart?: (chartType: ChartKind) => void;
  onComputeTableStats?: () => void;
  onUpdatePlotParam?: (name: string, value: number, transient?: boolean) => void;
  onUpdateTangentX?: (x0: number, transient?: boolean) => void;
  onTogglePlotTangent?: () => void;
  onCommitPlotChanges?: () => void;
  canCoverWithTape?: boolean;
  playingPinId?: string | null;
  onCoverWithTape?: () => void;
  onToggleRevealTape?: (id: string) => void;
  onTogglePlayVoicePin?: (id: string) => void;
  onTogglePrivate?: () => void;
};

function objectTypeLabel(type: CanvasObject['type']): string {
  switch (type) {
    case 'sticky':
      return 'Sticky Note';
    case 'text':
      return 'Text Block';
    case 'shape':
      return 'Shape';
    case 'connector':
      return 'Connector';
    case 'image':
      return 'Image';
    case 'table':
      return 'Table';
    case 'math':
      return 'Math Formula';
    case 'function-plot':
      return 'Function Graph';
    case 'chart':
      return 'Chart';
    case 'reveal-tape':
      return 'Reveal Tape';
    case 'voice-pin':
      return 'Voice Pin';
  }
}

export const EditorInspectorPanel = memo(function EditorInspectorPanel({
  theme,
  dark,
  presentation,
  width,
  selectedObjects,
  onToggleOpen,
  onEditTextObject,
  onDuplicateSelected,
  onDeleteSelected,
  onUpdateObjectStyle,
  onTableAction,
  canTidySelection = false,
  canPlotMath = false,
  canChartTable = false,
  selectedFunctionPlot = null,
  onTidyLayout,
  onPlotMath,
  onGenerateChart,
  onComputeTableStats,
  onUpdatePlotParam,
  onUpdateTangentX,
  onTogglePlotTangent,
  onCommitPlotChanges,
  canCoverWithTape = false,
  playingPinId = null,
  onCoverWithTape,
  onToggleRevealTape,
  onTogglePlayVoicePin,
  onTogglePrivate,
}: EditorInspectorPanelProps) {
  const [customPickerTarget, setCustomPickerTarget] = useState<'color' | 'fill' | null>(null);

  const togglePicker = useCallback((target: 'color' | 'fill') => {
    setCustomPickerTarget((current) => (current === target ? null : target));
  }, []);

  const closePicker = useCallback(() => setCustomPickerTarget(null), []);

  if (selectedObjects.length === 0) return null;

  const singleObject = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const isTextual = singleObject ? isTextualObject(singleObject) : false;

  if (presentation === 'edge-tab') {
    return (
      <View style={styles.edgeTabContainer} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open object inspector"
          accessibilityHint="Expands the right-side inspector panel for selected objects"
          onPress={onToggleOpen}
          style={({ pressed }) => [
            styles.edgeTab,
            { backgroundColor: theme.surface, borderColor: theme.border },
            pressed && styles.pressed,
          ]}
        >
          <StyleIcon size={18} color={theme.primary} />
          <Text style={[styles.edgeTabBadge, { color: theme.foreground }]}>
            {selectedObjects.length}
          </Text>
        </Pressable>
      </View>
    );
  }

  const headerTitle = singleObject ? 'Object Inspector' : 'Multi-Object Inspector';
  const headerBadge = singleObject
    ? objectTypeLabel(singleObject.type)
    : `${selectedObjects.length} Selected`;

  const allPrivate = selectedObjects.every((o) => o.isPrivate === true);
  const showActiveRecall = Boolean(
    onTogglePrivate ||
      canCoverWithTape ||
      singleObject?.type === 'reveal-tape' ||
      singleObject?.type === 'voice-pin',
  );

  return (
    <View
      accessibilityLabel={headerTitle}
      style={[
        styles.panel,
        presentation === 'overlay' ? styles.overlayPanel : styles.dockedPanel,
        { width, backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: theme.foreground }]} numberOfLines={1}>
            {headerTitle}
          </Text>
          <View style={[styles.badge, { backgroundColor: `${theme.primary}1A` }]}>
            <Text style={[styles.badgeText, { color: theme.primary }]}>{headerBadge}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Collapse inspector"
          onPress={onToggleOpen}
          style={({ pressed }) => [styles.collapseButton, pressed && styles.pressed]}
        >
          <ChevronRightIcon size={18} color={theme.foreground} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Quick Actions</Text>
          <View style={styles.actionRow}>
            {singleObject && isTextual && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit text"
                onPress={() => onEditTextObject(singleObject.id)}
                style={({ pressed }) => [
                  styles.actionButton,
                  { borderColor: theme.border, backgroundColor: theme.background },
                  pressed && styles.pressed,
                ]}
              >
                <EditIcon size={16} color={theme.foreground} />
                <Text style={[styles.actionLabel, { color: theme.foreground }]}>Edit</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                selectedObjects.length === 1
                  ? 'Duplicate selected object'
                  : 'Duplicate selected objects'
              }
              onPress={onDuplicateSelected}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: theme.border, backgroundColor: theme.background },
                pressed && styles.pressed,
              ]}
            >
              <DuplicateIcon size={16} color={theme.foreground} />
              <Text style={[styles.actionLabel, { color: theme.foreground }]}>Duplicate</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                selectedObjects.length === 1
                  ? 'Delete selected object'
                  : 'Delete selected objects'
              }
              onPress={onDeleteSelected}
              style={({ pressed }) => [
                styles.actionButton,
                {
                  borderColor: `${theme.destructive}40`,
                  backgroundColor: `${theme.destructive}12`,
                },
                pressed && styles.pressed,
              ]}
            >
              <TrashIcon size={16} color={theme.destructive} />
              <Text style={[styles.actionLabel, { color: theme.destructive }]}>Delete</Text>
            </Pressable>
          </View>
        </View>

        <StemInspectorSection
          theme={theme}
          canTidySelection={canTidySelection}
          canPlotMath={canPlotMath}
          canChartTable={canChartTable}
          selectedFunctionPlot={selectedFunctionPlot}
          onTidyLayout={onTidyLayout}
          onPlotMath={onPlotMath}
          onGenerateChart={onGenerateChart}
          onComputeTableStats={onComputeTableStats}
          onUpdatePlotParam={onUpdatePlotParam}
          onUpdateTangentX={onUpdateTangentX}
          onTogglePlotTangent={onTogglePlotTangent}
          onCommitPlotChanges={onCommitPlotChanges}
        />

        {showActiveRecall && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>
              Active Recall & Presenter
            </Text>
            <View style={styles.chipRow}>
              {canCoverWithTape && onCoverWithTape && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cover with tape"
                  onPress={onCoverWithTape}
                  style={[
                    styles.chip,
                    { borderColor: theme.border, backgroundColor: theme.surface },
                  ]}
                >
                  <Text style={[styles.chipLabel, { color: theme.foreground }]}>
                    Cover with tape
                  </Text>
                </Pressable>
              )}
              {singleObject?.type === 'reveal-tape' && onToggleRevealTape && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    singleObject.isRevealed ? 'Hide reveal tape' : 'Reveal answer'
                  }
                  onPress={() => onToggleRevealTape(singleObject.id)}
                  style={[
                    styles.chip,
                    { borderColor: theme.primary, backgroundColor: theme.muted },
                  ]}
                >
                  <Text style={[styles.chipLabel, { color: theme.primary }]}>
                    {singleObject.isRevealed ? 'Hide tape' : 'Reveal answer'}
                  </Text>
                </Pressable>
              )}
              {singleObject?.type === 'voice-pin' && onTogglePlayVoicePin && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    playingPinId === singleObject.id ? 'Stop voice pin' : 'Play voice pin'
                  }
                  onPress={() => onTogglePlayVoicePin(singleObject.id)}
                  style={[
                    styles.chip,
                    { borderColor: theme.primary, backgroundColor: theme.muted },
                  ]}
                >
                  <Text style={[styles.chipLabel, { color: theme.primary }]}>
                    {playingPinId === singleObject.id ? 'Stop audio' : 'Play audio'}
                  </Text>
                </Pressable>
              )}
              {onTogglePrivate && selectedObjects.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Presenter-only (Private)"
                  accessibilityState={{ selected: allPrivate }}
                  onPress={onTogglePrivate}
                  style={[
                    styles.chip,
                    {
                      borderColor: allPrivate ? theme.primary : theme.border,
                      backgroundColor: allPrivate ? theme.muted : theme.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      { color: allPrivate ? theme.primary : theme.foreground },
                    ]}
                  >
                    {allPrivate ? 'Presenter-only (On)' : 'Presenter-only (Private)'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {singleObject ? (
          <>
            {isTextualObject(singleObject) && (
              <InspectorTextualSection
                object={singleObject}
                theme={theme}
                dark={dark}
                customPickerTarget={customPickerTarget}
                onTogglePicker={togglePicker}
                onClosePicker={closePicker}
                onUpdateStyle={onUpdateObjectStyle}
              />
            )}
            {singleObject.type === 'shape' && (
              <InspectorShapeSection
                object={singleObject}
                theme={theme}
                dark={dark}
                customPickerTarget={customPickerTarget}
                onTogglePicker={togglePicker}
                onClosePicker={closePicker}
                onUpdateStyle={onUpdateObjectStyle}
              />
            )}
            {isTableObject(singleObject) && (
              <InspectorTableSection
                table={singleObject}
                theme={theme}
                dark={dark}
                onTableAction={onTableAction}
                onUpdateStyle={onUpdateObjectStyle}
              />
            )}
            {singleObject.type === 'connector' && (
              <InspectorConnectorSection
                object={singleObject}
                theme={theme}
                dark={dark}
                customPickerTarget={customPickerTarget}
                onTogglePicker={togglePicker}
                onClosePicker={closePicker}
                onUpdateStyle={onUpdateObjectStyle}
              />
            )}

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Dimensions</Text>
              <View
                style={[
                  styles.metaCard,
                  { backgroundColor: theme.background, borderColor: theme.border },
                ]}
              >
                <View style={styles.metaItem}>
                  <Text style={[styles.metaKey, { color: theme.foreground }]}>Size</Text>
                  <Text style={[styles.metaValue, { color: theme.foreground }]}>
                    {Math.round(singleObject.width)} × {Math.round(singleObject.height)} pt
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={[styles.metaKey, { color: theme.foreground }]}>Rotation</Text>
                  <Text style={[styles.metaValue, { color: theme.foreground }]}>
                    {Math.round(singleObject.rotation)}°
                  </Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>
              Selection Summary
            </Text>
            <View
              style={[
                styles.metaCard,
                { backgroundColor: theme.background, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.multiHint, { color: theme.foreground }]}>
                {selectedObjects.length} objects selected. Drag on the canvas to move the group
                together, or duplicate and delete them in a single step.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
});
