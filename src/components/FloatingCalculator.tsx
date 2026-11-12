import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import {
  evaluateExpression,
  type AngleMode,
} from '../calculator/calculator-engine';
import { radii, spacing, typography, type ThemeColors } from '../theme';
import { triggerHapticFeedback } from '../utils/haptics';

type FloatingCalculatorProps = {
  visible: boolean;
  theme: ThemeColors;
  haptics: boolean;
  isTablet: boolean;
  bounds: { width: number; height: number };
  onPasteToBoard: (expression: string, result: string) => void;
  onClose: () => void;
};

const PHONE_WIDTH = 268;
const WIDE_WIDTH = 320;
const EST_HEIGHT = 380;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function FloatingCalculator({
  visible,
  theme,
  haptics,
  isTablet,
  bounds,
  onPasteToBoard,
  onClose,
}: FloatingCalculatorProps) {
  const [expression, setExpression] = useState('');
  const [ans, setAns] = useState(0);
  const [evaluatedResult, setEvaluatedResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [angleMode, setAngleMode] = useState<AngleMode>('DEG');
  const [scientific, setScientific] = useState(isTablet);
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const dragStart = useRef({ x: 16, y: 16 });

  const cardWidth = scientific || isTablet ? WIDE_WIDTH : PHONE_WIDTH;

  useEffect(() => {
    setPos((prev) => ({
      x: clamp(prev.x, 8, Math.max(8, bounds.width - cardWidth - 8)),
      y: clamp(prev.y, 8, Math.max(8, bounds.height - EST_HEIGHT - 8)),
    }));
  }, [bounds.height, bounds.width, cardWidth]);

  const livePreview = useMemo(() => {
    if (!expression.trim()) return null;
    return evaluateExpression(expression, { angleMode, ans });
  }, [angleMode, ans, expression]);

  if (!visible) return null;

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onStart(() => {
      dragStart.current = pos;
    })
    .onUpdate((event) => {
      setPos({
        x: clamp(dragStart.current.x + event.translationX, 8, Math.max(8, bounds.width - cardWidth - 8)),
        y: clamp(dragStart.current.y + event.translationY, 8, Math.max(8, bounds.height - EST_HEIGHT - 8)),
      });
    });

  const append = (token: string) => {
    void triggerHapticFeedback('selection', haptics);
    setErrorMessage(null);
    setEvaluatedResult(null);
    setExpression((prev) => prev + token);
  };

  const handleClear = () => {
    void triggerHapticFeedback('selection', haptics);
    setExpression('');
    setEvaluatedResult(null);
    setErrorMessage(null);
  };

  const handleBackspace = () => {
    void triggerHapticFeedback('selection', haptics);
    setErrorMessage(null);
    setEvaluatedResult(null);
    setExpression((prev) => prev.slice(0, -1));
  };

  const handleNegate = () => {
    void triggerHapticFeedback('selection', haptics);
    setErrorMessage(null);
    setEvaluatedResult(null);
    setExpression((prev) => {
      if (!prev) return '-';
      if (prev.startsWith('-')) return prev.slice(1);
      return `-(${prev})`;
    });
  };

  const handleEvaluate = (): string | null => {
    void triggerHapticFeedback('selection', haptics);
    if (!expression.trim()) return null;
    const res = evaluateExpression(expression, { angleMode, ans });
    if (res.ok) {
      setAns(res.value);
      setEvaluatedResult(res.formatted);
      setErrorMessage(null);
      return res.formatted;
    }
    setErrorMessage(res.error);
    setEvaluatedResult(null);
    return null;
  };

  const handlePaste = () => {
    const resultStr = evaluatedResult ?? handleEvaluate();
    if (!resultStr || !expression.trim()) return;
    onPasteToBoard(expression.trim(), resultStr);
  };

  const displayValue = errorMessage
    ? errorMessage
    : evaluatedResult ?? (livePreview?.ok ? livePreview.formatted : '0');

  const sciKeys: Array<{ label: string; onPress: () => void }> = [
    { label: 'sin', onPress: () => append('sin(') },
    { label: 'cos', onPress: () => append('cos(') },
    { label: 'tan', onPress: () => append('tan(') },
    { label: '√', onPress: () => append('√(') },
    { label: 'x²', onPress: () => append('^2') },
    { label: 'xʸ', onPress: () => append('^') },
    { label: 'log', onPress: () => append('log(') },
    { label: 'ln', onPress: () => append('ln(') },
    { label: 'π', onPress: () => append('π') },
    { label: 'e', onPress: () => append('e') },
    { label: '1/x', onPress: () => append('1÷(') },
    { label: '!', onPress: () => append('!') },
  ];

  const stdRows: Array<Array<{ label: string; kind?: 'op' | 'eq' | 'fn'; onPress: () => void }>> = [
    [
      { label: 'C', kind: 'fn', onPress: handleClear },
      { label: '(', kind: 'fn', onPress: () => append('(') },
      { label: ')', kind: 'fn', onPress: () => append(')') },
      { label: '÷', kind: 'op', onPress: () => append('÷') },
    ],
    [
      { label: '7', onPress: () => append('7') },
      { label: '8', onPress: () => append('8') },
      { label: '9', onPress: () => append('9') },
      { label: '×', kind: 'op', onPress: () => append('×') },
    ],
    [
      { label: '4', onPress: () => append('4') },
      { label: '5', onPress: () => append('5') },
      { label: '6', onPress: () => append('6') },
      { label: '-', kind: 'op', onPress: () => append('-') },
    ],
    [
      { label: '1', onPress: () => append('1') },
      { label: '2', onPress: () => append('2') },
      { label: '3', onPress: () => append('3') },
      { label: '+', kind: 'op', onPress: () => append('+') },
    ],
    [
      { label: '±', kind: 'fn', onPress: handleNegate },
      { label: '0', onPress: () => append('0') },
      { label: '.', onPress: () => append('.') },
      { label: '=', kind: 'eq', onPress: () => { void handleEvaluate(); } },
    ],
  ];

  return (
    <View
      accessibilityLabel="Floating scientific calculator"
      style={[
        styles.card,
        {
          left: pos.x,
          top: pos.y,
          width: cardWidth,
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <GestureDetector gesture={panGesture}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Angle mode ${angleMode}`}
              onPress={() => setAngleMode((m) => (m === 'DEG' ? 'RAD' : 'DEG'))}
              style={[styles.badgeBtn, { borderColor: theme.border, backgroundColor: theme.background }]}
            >
              <Text style={[styles.badgeText, { color: theme.primary }]}>{angleMode}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle scientific keys"
              accessibilityState={{ selected: scientific }}
              onPress={() => setScientific((s) => !s)}
              style={[
                styles.badgeBtn,
                { borderColor: scientific ? theme.primary : theme.border },
                scientific && { backgroundColor: theme.primary + '18' },
              ]}
            >
              <Text style={[styles.badgeText, { color: scientific ? theme.primary : theme.foreground }]}>
                Sci
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Insert previous answer"
              onPress={() => append('ANS')}
              style={[styles.badgeBtn, { borderColor: theme.border, backgroundColor: theme.background }]}
            >
              <Text style={[styles.badgeText, { color: theme.foreground }]}>ANS</Text>
            </Pressable>
          </View>

          <View style={styles.headerRight}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Backspace"
              onPress={handleBackspace}
              hitSlop={6}
              style={styles.iconBtn}
            >
              <Text style={[styles.headerActionText, { color: theme.foreground }]}>⌫</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close calculator"
              onPress={onClose}
              hitSlop={6}
              style={styles.iconBtn}
            >
              <Text style={[styles.headerActionText, { color: theme.foreground }]}>×</Text>
            </Pressable>
          </View>
        </View>
      </GestureDetector>

      <View style={[styles.display, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <Text style={[styles.exprText, { color: theme.foreground }]} numberOfLines={1}>
          {expression || ' '}
        </Text>
        <Text
          style={[
            styles.resultText,
            { color: errorMessage ? theme.destructive : theme.foreground },
          ]}
          numberOfLines={1}
        >
          {displayValue}
        </Text>
      </View>

      {scientific && (
        <View style={styles.sciGrid}>
          {sciKeys.map((key) => (
            <Pressable
              key={key.label}
              accessibilityRole="button"
              accessibilityLabel={key.label}
              onPress={key.onPress}
              style={({ pressed }) => [
                styles.sciKey,
                { borderColor: theme.border, backgroundColor: theme.background },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.sciKeyText, { color: theme.foreground }]}>{key.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.keypad}>
        {stdRows.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.keyRow}>
            {row.map((key) => {
              const isEq = key.kind === 'eq';
              const isOp = key.kind === 'op';
              return (
                <Pressable
                  key={key.label}
                  accessibilityRole="button"
                  accessibilityLabel={key.label}
                  onPress={key.onPress}
                  style={({ pressed }) => [
                    styles.keyBtn,
                    {
                      borderColor: isEq ? theme.primary : theme.border,
                      backgroundColor: isEq
                        ? theme.primary
                        : isOp
                          ? theme.primary + '16'
                          : theme.background,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.keyText,
                      {
                        color: isEq
                          ? theme.onPrimary
                          : isOp
                            ? theme.primary
                            : theme.foreground,
                      },
                    ]}
                  >
                    {key.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Paste calculation to board"
        disabled={!expression.trim() || Boolean(errorMessage)}
        onPress={handlePaste}
        style={[
          styles.pasteBtn,
          {
            borderColor: theme.border,
            backgroundColor: theme.background,
            opacity: !expression.trim() || errorMessage ? 0.5 : 1,
          },
        ]}
      >
        <Text style={[styles.pasteBtnText, { color: theme.primary }]}>Paste to board</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.sm,
    gap: 6,
    zIndex: 26,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeBtn: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  iconBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  display: {
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    alignItems: 'flex-end',
  },
  exprText: {
    fontSize: 12,
    opacity: 0.72,
    fontVariant: ['tabular-nums'],
  },
  resultText: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sciGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  sciKey: {
    width: '23.8%',
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  sciKeyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  keypad: {
    gap: 4,
  },
  keyRow: {
    flexDirection: 'row',
    gap: 4,
  },
  keyBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  keyText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pasteBtn: {
    paddingVertical: 7,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  pasteBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
