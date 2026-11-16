import { memo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { colors, spacing, type ThemeColors } from '../../theme';
import type { InkTool } from '../CanvasViewport';
import {
  CalculatorIcon,
  CompassRulerIcon,
  ConnectorIcon,
  CurtainIcon,
  EraserIcon,
  FaceCamIcon,
  FlashcardsIcon,
  HandIcon,
  HighlighterIcon,
  ImageIcon,
  LaserIcon,
  MathSumIcon,
  MicIcon,
  PdfDocIcon,
  PenIcon,
  PlayLessonIcon,
  RecordDotIcon,
  RevealTapeIcon,
  SelectIcon,
  ShapeIcon,
  SpotlightIcon,
  StickyIcon,
  TextIcon,
  TimerIcon,
} from '../icons';
import { editorToolRailStyles as styles } from './EditorToolRail.styles';

const PRIMARY_TOOLS = [
  { tool: 'select', label: 'Select', Icon: SelectIcon },
  { tool: 'pan', label: 'Pan', Icon: HandIcon },
  { tool: 'text', label: 'Text', Icon: TextIcon },
  { tool: 'sticky', label: 'Sticky note', Icon: StickyIcon },
  { tool: 'shape', label: 'Shape', Icon: ShapeIcon },
  { tool: 'connector', label: 'Connector', Icon: ConnectorIcon },
  { tool: 'pen', label: 'Pen', Icon: PenIcon },
  { tool: 'highlighter', label: 'Highlighter', Icon: HighlighterIcon },
  { tool: 'eraser', label: 'Eraser', Icon: EraserIcon },
  { tool: 'laser', label: 'Laser', Icon: LaserIcon },
  { tool: 'image', label: 'Image', Icon: ImageIcon },
] as const satisfies ReadonlyArray<{ tool: InkTool; label: string; Icon: typeof PenIcon }>;

type EditorToolRailProps = {
  theme: ThemeColors;
  activeTool: InkTool;
  bottomInset: number;
  timerVisible: boolean;
  calculatorVisible: boolean;
  geometryActive: boolean;
  faceCamVisible: boolean;
  recorderBarVisible: boolean;
  stageOverlayVisible: boolean;
  stageOverlayMode: 'curtain' | 'spotlight';
  voicePinRecording: boolean;
  onToolPress: (tool: InkTool) => void;
  onToggleGeometryBox: () => void;
  onOpenMath: () => void;
  onOpenPdfImport: () => void;
  onToggleTimer: () => void;
  onToggleCalculator: () => void;
  onToggleFaceCam: () => void;
  onToggleRecorder: () => void;
  onOpenSavedLessons: () => void;
  onStartVoicePin: () => void;
  onOpenStageOverlay: (mode: 'curtain' | 'spotlight') => void;
  onOpenFlashcards: () => void;
};

const RailButton = memo(function RailButton({
  label,
  accessibilityLabel,
  accessibilityHint,
  selected = false,
  destructiveActive = false,
  theme,
  onPress,
  renderIcon,
}: {
  label: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  selected?: boolean;
  destructiveActive?: boolean;
  theme: ThemeColors;
  onPress: () => void;
  renderIcon: (color: string) => React.ReactNode;
}) {
  const activeColor = destructiveActive ? colors.destructive : theme.primary;
  const color = selected ? activeColor : theme.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.tool, pressed && styles.toolPressed]}
    >
      <View
        style={[
          styles.toolIconWrap,
          selected && {
            backgroundColor: destructiveActive ? 'rgba(220, 38, 38, 0.12)' : `${theme.primary}1F`,
            borderColor: activeColor,
          },
        ]}
      >
        {renderIcon(color)}
      </View>
      <Text style={[styles.toolLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
});

export const EditorToolRail = memo(function EditorToolRail({
  theme,
  activeTool,
  bottomInset,
  timerVisible,
  calculatorVisible,
  geometryActive,
  faceCamVisible,
  recorderBarVisible,
  stageOverlayVisible,
  stageOverlayMode,
  voicePinRecording,
  onToolPress,
  onToggleGeometryBox,
  onOpenMath,
  onOpenPdfImport,
  onToggleTimer,
  onToggleCalculator,
  onToggleFaceCam,
  onToggleRecorder,
  onOpenSavedLessons,
  onStartVoicePin,
  onOpenStageOverlay,
  onOpenFlashcards,
}: EditorToolRailProps) {
  return (
    <View
      style={[
        styles.rail,
        { borderRightColor: theme.border, backgroundColor: theme.surface },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.railContent,
          { paddingBottom: bottomInset + spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {PRIMARY_TOOLS.map(({ Icon, label, tool }) => (
          <RailButton
            key={tool}
            label={label}
            accessibilityLabel={label}
            accessibilityHint={
              tool !== 'select' ? 'Opens the tool options when selected again' : undefined
            }
            selected={activeTool === tool}
            theme={theme}
            onPress={() => onToolPress(tool)}
            renderIcon={(c) => <Icon size={22} color={c} />}
          />
        ))}

        <View style={[styles.railDivider, { backgroundColor: theme.border }]} />

        <RailButton
          label="Geo"
          accessibilityLabel="Toggle geometry box"
          selected={geometryActive}
          theme={theme}
          onPress={onToggleGeometryBox}
          renderIcon={(c) => <CompassRulerIcon size={20} color={c} />}
        />
        <RailButton
          label="Timer"
          accessibilityLabel="Toggle floating timer"
          selected={timerVisible}
          theme={theme}
          onPress={onToggleTimer}
          renderIcon={(c) => <TimerIcon size={22} color={c} />}
        />
        <RailButton
          label="Calc"
          accessibilityLabel="Toggle floating calculator"
          selected={calculatorVisible}
          theme={theme}
          onPress={onToggleCalculator}
          renderIcon={(c) => <CalculatorIcon size={22} color={c} />}
        />
        <RailButton
          label="Math"
          accessibilityLabel="Open math formula builder"
          theme={theme}
          onPress={onOpenMath}
          renderIcon={(c) => <MathSumIcon size={20} color={c} />}
        />
        <RailButton
          label="PDF"
          accessibilityLabel="Import PDF for markup"
          theme={theme}
          onPress={onOpenPdfImport}
          renderIcon={(c) => <PdfDocIcon size={20} color={c} />}
        />
        <RailButton
          label="Cam"
          accessibilityLabel="Toggle floating Face-Cam"
          selected={faceCamVisible}
          theme={theme}
          onPress={onToggleFaceCam}
          renderIcon={(c) => <FaceCamIcon size={20} color={c} />}
        />
        <RailButton
          label="Rec"
          accessibilityLabel="Toggle lesson recorder"
          selected={recorderBarVisible}
          destructiveActive
          theme={theme}
          onPress={onToggleRecorder}
          renderIcon={(c) => (
            <RecordDotIcon
              size={20}
              color={recorderBarVisible ? colors.destructive : c}
            />
          )}
        />
        <RailButton
          label="Lessons"
          accessibilityLabel="Open saved lessons"
          theme={theme}
          onPress={onOpenSavedLessons}
          renderIcon={(c) => <PlayLessonIcon size={20} color={c} />}
        />

        <View style={[styles.railDivider, { backgroundColor: theme.border }]} />

        <RailButton
          label="Tape"
          accessibilityLabel="Place tap-to-reveal answer tape"
          selected={activeTool === 'reveal-tape'}
          theme={theme}
          onPress={() => onToolPress('reveal-tape')}
          renderIcon={(c) => <RevealTapeIcon size={20} color={c} />}
        />
        <RailButton
          label="Voice"
          accessibilityLabel="Record spatial voice pin"
          selected={voicePinRecording}
          destructiveActive
          theme={theme}
          onPress={onStartVoicePin}
          renderIcon={(c) => <MicIcon size={20} color={c} />}
        />
        <RailButton
          label="Curtain"
          accessibilityLabel="Open stage curtain shade"
          selected={stageOverlayVisible && stageOverlayMode === 'curtain'}
          theme={theme}
          onPress={() => onOpenStageOverlay('curtain')}
          renderIcon={(c) => <CurtainIcon size={20} color={c} />}
        />
        <RailButton
          label="Spot"
          accessibilityLabel="Open spotlight focus shade"
          selected={stageOverlayVisible && stageOverlayMode === 'spotlight'}
          theme={theme}
          onPress={() => onOpenStageOverlay('spotlight')}
          renderIcon={(c) => <SpotlightIcon size={20} color={c} />}
        />
        <RailButton
          label="Cards"
          accessibilityLabel="Study board flashcards"
          theme={theme}
          onPress={onOpenFlashcards}
          renderIcon={(c) => <FlashcardsIcon size={20} color={c} />}
        />
      </ScrollView>
    </View>
  );
});
