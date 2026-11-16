import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { CanvasObject } from '../../canvas/document';
import type { ThemeColors } from '../../theme';
import { editorStyles as styles } from '../../screens/editor.styles';
import { DuplicateIcon, EditIcon, StyleIcon, TrashIcon } from '../icons';

type SelectionActionRailProps = {
  theme: ThemeColors;
  x: number;
  y: number;
  width: number;
  height: number;
  selectionLabel: string;
  selectedObjectsCount: number;
  selectedObject: CanvasObject | null;
  selectedIsTextual: boolean;
  selectedIsMath: boolean;
  selectedIsImage: boolean;
  selectedIsTable: boolean;
  selectedIsStemDiagram: boolean;
  plottableMath: boolean;
  canTidySelection: boolean;
  onEditObject: (id: string) => void;
  onToggleStyleSheet: () => void;
  onPlotMath: () => void;
  onTidyLayout: (mode: 'grid' | 'row' | 'column') => void;
  onTableAction: (id: string, action: 'add-row' | 'add-col') => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export const SelectionActionRail = memo(function SelectionActionRail({
  theme,
  x,
  y,
  width,
  height,
  selectionLabel,
  selectedObjectsCount,
  selectedObject,
  selectedIsTextual,
  selectedIsMath,
  selectedIsImage,
  selectedIsTable,
  selectedIsStemDiagram,
  plottableMath,
  canTidySelection,
  onEditObject,
  onToggleStyleSheet,
  onPlotMath,
  onTidyLayout,
  onTableAction,
  onDuplicate,
  onDelete,
}: SelectionActionRailProps) {
  return (
    <View
      accessibilityLabel={selectionLabel}
      style={[
        styles.selectionRail,
        {
          left: x,
          top: y,
          width,
          height,
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      {(selectedIsTextual || selectedIsMath) && selectedObject && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit selected object"
          accessibilityHint={
            selectedIsMath
              ? 'Opens the math formula builder'
              : "Opens the object's text editor"
          }
          onPress={() => onEditObject(selectedObject.id)}
          style={({ pressed }) => [styles.selectionAction, pressed && styles.pressed]}
        >
          <EditIcon size={18} color={theme.foreground} />
        </Pressable>
      )}

      {selectedObject &&
        !selectedIsImage &&
        !selectedIsTable &&
        !selectedIsMath &&
        !selectedIsStemDiagram && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Style selected object"
            accessibilityHint="Opens the object's style options"
            onPress={onToggleStyleSheet}
            style={({ pressed }) => [
              styles.selectionAction,
              selectedIsTextual && styles.selectionActionSeparator,
              { borderTopColor: theme.border },
              pressed && styles.pressed,
            ]}
          >
            <StyleIcon size={18} color={theme.foreground} />
          </Pressable>
        )}

      {plottableMath && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Plot graph"
          accessibilityHint="Plots this math function onto 2D coordinate axes"
          onPress={onPlotMath}
          style={({ pressed }) => [
            styles.selectionAction,
            styles.selectionActionSeparator,
            { borderTopColor: theme.border },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.railTextAction, { color: theme.primary }]}>Plot</Text>
        </Pressable>
      )}

      {canTidySelection && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tidy grid"
            onPress={() => onTidyLayout('grid')}
            style={({ pressed }) => [styles.selectionAction, pressed && styles.pressed]}
          >
            <Text style={[styles.railTextAction, { color: theme.primary }]}>Grid</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Align row"
            onPress={() => onTidyLayout('row')}
            style={({ pressed }) => [
              styles.selectionAction,
              styles.selectionActionSeparator,
              { borderTopColor: theme.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.railTextAction, { color: theme.foreground }]}>Row</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Align column"
            onPress={() => onTidyLayout('column')}
            style={({ pressed }) => [
              styles.selectionAction,
              styles.selectionActionSeparator,
              { borderTopColor: theme.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.railTextAction, { color: theme.foreground }]}>Col</Text>
          </Pressable>
        </>
      )}

      {selectedIsTable && selectedObject && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add table row"
            onPress={() => onTableAction(selectedObject.id, 'add-row')}
            style={({ pressed }) => [styles.selectionAction, pressed && styles.pressed]}
          >
            <Text style={[styles.railTextAction, { color: theme.foreground }]}>+R</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add table column"
            onPress={() => onTableAction(selectedObject.id, 'add-col')}
            style={({ pressed }) => [
              styles.selectionAction,
              styles.selectionActionSeparator,
              { borderTopColor: theme.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.railTextAction, { color: theme.foreground }]}>+C</Text>
          </Pressable>
        </>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          selectedObjectsCount === 1
            ? 'Duplicate selected object'
            : 'Duplicate selected objects'
        }
        accessibilityHint="Creates an offset copy in the same undo step"
        onPress={onDuplicate}
        style={({ pressed }) => [
          styles.selectionAction,
          (selectedObject || canTidySelection) && styles.selectionActionSeparator,
          { borderTopColor: theme.border },
          pressed && styles.pressed,
        ]}
      >
        <DuplicateIcon size={18} color={theme.foreground} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          selectedObjectsCount === 1 ? 'Delete selected object' : 'Delete selected objects'
        }
        accessibilityHint="Removes the selection; undo restores it"
        onPress={onDelete}
        style={({ pressed }) => [
          styles.selectionAction,
          styles.selectionActionSeparator,
          { borderTopColor: theme.border },
          pressed && styles.pressed,
        ]}
      >
        <TrashIcon size={18} color={theme.destructive} />
      </Pressable>
    </View>
  );
});
