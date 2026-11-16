import { memo, type RefObject } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { objectScreenRect, type MathObject } from '../../canvas/document';
import {
  applyMathSpanEdit,
  getEditableMathSlots,
  layoutMathExpression,
  type MathSourceSpan,
} from '../../canvas/math-layout';
import type { Viewport } from '../../canvas/viewport';
import type { ThemeColors } from '../../theme';
import { inlineMathBarStyles as styles } from './InlineMathBar.styles';

export type EditingMathInlineState = {
  objectId: string;
  latex: string;
  span: MathSourceSpan | null;
  slotText: string;
};

type InlineMathBarProps = {
  mathObj: MathObject;
  editingState: EditingMathInlineState;
  viewport: Viewport;
  canvasWidth: number;
  canvasHeight: number;
  theme: ThemeColors;
  inputRef: RefObject<React.ComponentRef<typeof TextInput> | null>;
  onChangeState: (next: EditingMathInlineState) => void;
  onTransientLatex: (objectId: string, latex: string) => void;
  onOpenKeypad: () => void;
  onDone: () => void;
};

export const InlineMathBar = memo(function InlineMathBar({
  mathObj,
  editingState,
  viewport,
  canvasWidth,
  canvasHeight,
  theme,
  inputRef,
  onChangeState,
  onTransientLatex,
  onOpenKeypad,
  onDone,
}: InlineMathBarProps) {
  const rect = objectScreenRect(mathObj, viewport);
  const isSlotMode = editingState.span !== null;
  const editableSlots = getEditableMathSlots(
    layoutMathExpression(editingState.latex, mathObj.fontSize),
  );
  const activeSlot = editingState.span
    ? editableSlots.find(
        (s) =>
          s.span.start === editingState.span!.start &&
          s.span.end === editingState.span!.end,
      )
    : undefined;

  const editorW = Math.min(isSlotMode ? 360 : 380, Math.max(250, canvasWidth - 24));
  const left = Math.max(12, Math.min(canvasWidth - editorW - 12, rect.x));
  const placeAbove = rect.y + rect.height + 64 > canvasHeight;
  const top = placeAbove
    ? Math.max(12, rect.y - 56)
    : Math.min(canvasHeight - 56, rect.y + rect.height + 8);

  const stepSlot = (delta: 1 | -1) => {
    if (editableSlots.length === 0) return;
    const cur = editingState.span;
    const currentIdx = cur
      ? editableSlots.findIndex(
          (s) => s.span.start === cur.start && s.span.end === cur.end,
        )
      : -1;
    const baseIdx = currentIdx >= 0 ? currentIdx : 0;
    const nextIdx = (baseIdx + delta + editableSlots.length) % editableSlots.length;
    const nextSlot = editableSlots[nextIdx];
    onChangeState({
      ...editingState,
      span: nextSlot.span,
      slotText: editingState.latex.slice(nextSlot.span.start, nextSlot.span.end),
    });
    inputRef.current?.focus();
  };

  return (
    <View
      style={[
        styles.container,
        {
          left,
          top,
          width: editorW,
          borderColor: theme.primary,
          backgroundColor: theme.surface,
        },
      ]}
    >
      {activeSlot?.label ? (
        <Text style={[styles.slotLabel, { color: theme.primary }]}>{activeSlot.label}</Text>
      ) : null}
      <TextInput
        ref={inputRef}
        autoFocus
        accessibilityLabel={
          isSlotMode ? 'Inline math token input' : 'Inline math formula input'
        }
        value={isSlotMode ? editingState.slotText : editingState.latex}
        onChangeText={(nextValue) => {
          let nextLatex = nextValue;
          let nextSpan: MathSourceSpan | null = null;
          if (editingState.span) {
            const edited = applyMathSpanEdit(
              editingState.latex,
              editingState.span,
              nextValue,
            );
            nextLatex = edited.latex;
            nextSpan = edited.span;
          }
          onChangeState({
            ...editingState,
            latex: nextLatex,
            span: nextSpan,
            slotText: nextValue,
          });
          onTransientLatex(mathObj.id, nextLatex);
        }}
        onSubmitEditing={() => {
          if (isSlotMode && editableSlots.length > 1) {
            stepSlot(1);
          } else {
            onDone();
          }
        }}
        returnKeyType={isSlotMode && editableSlots.length > 1 ? 'next' : 'done'}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={isSlotMode ? 'Value…' : 'Type LaTeX…'}
        placeholderTextColor={`${theme.foreground}70`}
        style={[
          styles.input,
          { color: theme.foreground, backgroundColor: theme.background },
        ]}
      />

      {editableSlots.length > 1 ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous formula slot"
            onPress={() => stepSlot(-1)}
            style={[styles.navButton, { borderColor: theme.border }]}
          >
            <Text style={[styles.buttonText, { color: theme.foreground }]}>←</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next formula slot"
            onPress={() => stepSlot(1)}
            style={[styles.navButton, { borderColor: theme.border }]}
          >
            <Text style={[styles.buttonText, { color: theme.foreground }]}>→</Text>
          </Pressable>
        </>
      ) : null}

      {isSlotMode ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit full formula"
          onPress={() =>
            onChangeState({
              ...editingState,
              span: null,
              slotText: editingState.latex,
            })
          }
          style={[styles.navButton, { borderColor: theme.border }]}
        >
          <Text style={[styles.buttonText, { color: theme.foreground }]}>Full</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open math keypad"
        onPress={onOpenKeypad}
        style={[styles.keypadButton, { borderColor: theme.border }]}
      >
        <Text style={[styles.buttonText, { color: theme.foreground }]}>∑</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Done editing formula"
        onPress={onDone}
        style={[styles.doneButton, { backgroundColor: theme.primary }]}
      >
        <Text style={[styles.doneText, { color: theme.surface }]}>Done</Text>
      </Pressable>
    </View>
  );
});
