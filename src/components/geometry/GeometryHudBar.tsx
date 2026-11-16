import { memo, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  COMPASS_MAX_RADIUS,
  COMPASS_MIN_RADIUS,
  type GeometryInstrumentState,
  type InstrumentKind,
} from '../../canvas/geometry-box';
import { type ThemeColors } from '../../theme';
import { styles } from '../GeometryBoxOverlay.styles';
import { CloseIcon } from '../icons';
import { GEOMETRY_TEAL_BORDER } from './GeometrySkiaRenderers';

const INSTRUMENT_TABS: ReadonlyArray<{ kind: InstrumentKind; label: string }> = [
  { kind: 'ruler', label: 'Ruler' },
  { kind: 'protractor', label: 'Protractor' },
  { kind: 'compass', label: 'Compass' },
  { kind: 'set-square-45', label: '45°' },
  { kind: 'set-square-30-60', label: '30–60°' },
];

type GeometryHudBarProps = {
  instrument: GeometryInstrumentState;
  theme: ThemeColors;
  hudExpanded: boolean;
  readoutText: string;
  angleDrawnFlash: boolean;
  onToggleHudExpanded: () => void;
  onSwitchInstrument: (kind: InstrumentKind) => void;
  onChangeInstrument: (next: GeometryInstrumentState) => void;
  onDrawProtractorAngle: () => void;
  onDrawCompassCircle: () => void;
  onClose: () => void;
};

export const GeometryHudBar = memo(function GeometryHudBar({
  instrument,
  theme,
  hudExpanded,
  readoutText,
  angleDrawnFlash,
  onToggleHudExpanded,
  onSwitchInstrument,
  onChangeInstrument,
  onDrawProtractorAngle,
  onDrawCompassCircle,
  onClose,
}: GeometryHudBarProps) {
  const handleProtractorIncreaseSweep = useCallback(() => {
    if (instrument.kind !== 'protractor') return;
    onChangeInstrument({
      ...instrument,
      sweepAngleDeg: Math.min(360, instrument.sweepAngleDeg + 15),
    });
  }, [instrument, onChangeInstrument]);

  const handleProtractorDecreaseSweep = useCallback(() => {
    if (instrument.kind !== 'protractor') return;
    onChangeInstrument({
      ...instrument,
      sweepAngleDeg: Math.max(15, instrument.sweepAngleDeg - 15),
    });
  }, [instrument, onChangeInstrument]);

  const handleProtractorToggleFullCircle = useCallback(() => {
    if (instrument.kind !== 'protractor') return;
    onChangeInstrument({ ...instrument, fullCircle: !instrument.fullCircle });
  }, [instrument, onChangeInstrument]);

  const handleCompassShrinkRadius = useCallback(() => {
    if (instrument.kind !== 'compass') return;
    onChangeInstrument({
      ...instrument,
      radius: Math.max(COMPASS_MIN_RADIUS, instrument.radius - 16),
    });
  }, [instrument, onChangeInstrument]);

  const handleCompassGrowRadius = useCallback(() => {
    if (instrument.kind !== 'compass') return;
    onChangeInstrument({
      ...instrument,
      radius: Math.min(COMPASS_MAX_RADIUS, instrument.radius + 16),
    });
  }, [instrument, onChangeInstrument]);

  if (!hudExpanded) {
    return (
      <View
        style={[
          styles.compactPill,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle geometry box options"
          onPress={onToggleHudExpanded}
          style={styles.compactToggleBtn}
        >
          <Text style={[styles.readout, { color: theme.foreground }]}>
            {angleDrawnFlash ? 'Angle drawn ✓' : readoutText}
          </Text>
          <Text style={[styles.tabText, { color: theme.primary }]}>Options</Text>
        </Pressable>
        {instrument.kind === 'protractor' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Draw angle"
            onPress={onDrawProtractorAngle}
            style={[styles.primaryBtn, { backgroundColor: GEOMETRY_TEAL_BORDER }]}
          >
            <Text style={styles.primaryBtnText}>Draw</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close geometry box"
          onPress={onClose}
          style={[styles.closeChip, { borderColor: theme.border }]}
        >
          <CloseIcon size={16} color={theme.foreground} />
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.hudBar,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.tabRow}>
        {INSTRUMENT_TABS.map((tab) => (
          <InstrumentTab
            key={tab.kind}
            kind={tab.kind}
            label={tab.label}
            active={instrument.kind === tab.kind}
            theme={theme}
            onSelect={onSwitchInstrument}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Minimize geometry box options"
          onPress={onToggleHudExpanded}
          style={[styles.smallBtn, { borderColor: theme.border }]}
        >
          <Text style={[styles.smallBtnText, { color: theme.primary }]}>Hide</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close geometry box"
          onPress={onClose}
          style={[styles.closeChip, { borderColor: theme.border }]}
        >
          <CloseIcon size={16} color={theme.foreground} />
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <Text style={[styles.readout, { color: theme.foreground }]}>
          {angleDrawnFlash ? 'Angle drawn ✓' : readoutText}
        </Text>

        {instrument.kind === 'protractor' ? (
          <View style={styles.inlineActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase angle by 15 degrees"
              onPress={handleProtractorIncreaseSweep}
              style={[styles.smallBtn, { borderColor: theme.border }]}
            >
              <Text style={[styles.smallBtnText, { color: theme.foreground }]}>+15°</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease angle by 15 degrees"
              onPress={handleProtractorDecreaseSweep}
              style={[styles.smallBtn, { borderColor: theme.border }]}
            >
              <Text style={[styles.smallBtnText, { color: theme.foreground }]}>-15°</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle protractor 180 or 360 mode"
              onPress={handleProtractorToggleFullCircle}
              style={[styles.smallBtn, { borderColor: theme.border }]}
            >
              <Text style={[styles.smallBtnText, { color: theme.foreground }]}>
                {instrument.fullCircle ? '180°' : '360°'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Draw angle"
              onPress={onDrawProtractorAngle}
              style={[styles.primaryBtn, { backgroundColor: GEOMETRY_TEAL_BORDER }]}
            >
              <Text style={styles.primaryBtnText}>Draw angle</Text>
            </Pressable>
          </View>
        ) : null}

        {instrument.kind === 'compass' ? (
          <View style={styles.inlineActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease compass radius"
              onPress={handleCompassShrinkRadius}
              style={[styles.smallBtn, { borderColor: theme.border }]}
            >
              <Text style={[styles.smallBtnText, { color: theme.foreground }]}>- r</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase compass radius"
              onPress={handleCompassGrowRadius}
              style={[styles.smallBtn, { borderColor: theme.border }]}
            >
              <Text style={[styles.smallBtnText, { color: theme.foreground }]}>+ r</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Draw full compass circle"
              onPress={onDrawCompassCircle}
              style={[styles.primaryBtn, { backgroundColor: GEOMETRY_TEAL_BORDER }]}
            >
              <Text style={styles.primaryBtnText}>Full circle</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
});

const InstrumentTab = memo(function InstrumentTab({
  kind,
  label,
  active,
  theme,
  onSelect,
}: {
  kind: InstrumentKind;
  label: string;
  active: boolean;
  theme: ThemeColors;
  onSelect: (kind: InstrumentKind) => void;
}) {
  const handlePress = useCallback(() => {
    onSelect(kind);
  }, [kind, onSelect]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={handlePress}
      style={[
        styles.tabChip,
        {
          backgroundColor: active ? GEOMETRY_TEAL_BORDER : theme.background,
          borderColor: active ? GEOMETRY_TEAL_BORDER : theme.border,
        },
      ]}
    >
      <Text
        style={[
          styles.tabText,
          { color: active ? '#FFFFFF' : theme.foreground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
});
