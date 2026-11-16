import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '../theme';

type IconProps = {
  size?: number;
  color?: string;
};

/**
 * One vector family for the whole app: 24px grid, 2px stroke, round caps.
 * Icons are drawn locally with `react-native-svg` so the icon set stays
 * consistent and no emoji are used as iconography.
 */

export function SettingsIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={2} />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PlusIcon({ size = 24, color = colors.onAccent }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function MoreIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={5} cy={12} r={1.5} fill={color} />
      <Circle cx={12} cy={12} r={1.5} fill={color} />
      <Circle cx={19} cy={12} r={1.5} fill={color} />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 24, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m9 18 6-6-6-6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BoardIcon({ size = 24, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={2} stroke={color} strokeWidth={2} />
      <Path d="M3 9h18M9 21V9" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function SelectIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m5 3 13 8-5.5 1.5L10 19 5 3Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PenIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20l4.5-1L19 8.5a2.12 2.12 0 0 0-3-3L5.5 16 4 20ZM14.5 7l2.5 2.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HighlighterIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m9 15-4 4v-4h4ZM14 4l6 6-8.5 8.5H7V14L14 4Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M4 21h11" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function EraserIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m7 21-4-4 10-10a2.12 2.12 0 0 1 3 0l4 4a2.12 2.12 0 0 1 0 3L13 21H7Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="m9 11 6 6" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function TextIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 6V4h14v2M12 4v16M9 20h6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ShapeIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={4} width={16} height={16} rx={2} stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

export function RectangleIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={6} width={16} height={12} rx={2} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function EllipseIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function LineIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 19 19 5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function ConnectorIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 18 18 6M13 6h5v5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Elbow connector: a right-angled run that turns at a corner. */
export function ElbowIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 4v11a2 2 0 0 0 2 2h13" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 13l4 4-4 4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function StickyIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 4h16v10l-6 6H4V4Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M14 20v-6h6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function EditIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20h4L19 9a2.12 2.12 0 0 0-3-3L5 17v3Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="m14 7 3 3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ImageIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={2} stroke={color} strokeWidth={2} />
      <Circle cx={8.5} cy={7} r={2} fill={color} />
      <Path d="m21 17-5-5L5 20" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function RotateIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 12a9 9 0 1 1-3-6.7M21 3v5h-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CheckIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m5 12 5 5L20 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ZoomInIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Path d="m21 21-4.3-4.3M11 8v6M8 11h6" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function StyleIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M4 12h16M4 17h16" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={9} cy={7} r={2} fill={color} />
      <Circle cx={15} cy={12} r={2} fill={color} />
      <Circle cx={9} cy={17} r={2} fill={color} />
    </Svg>
  );
}

export function DuplicateIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={8} y={8} width={12} height={12} rx={2} stroke={color} strokeWidth={2} />
      <Path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function TrashIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M10 11v5M14 11v5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function UndoIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 14 4 9l5-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function RedoIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m15 14 5-5-5-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function InfoIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M12 8h.01M12 12v4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function DatabaseIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 6c0-1.66 3.58-3 8-3s8 1.34 8 3v12c0 1.66-3.58 3-8 3s-8-1.34-8-3V6Z"
        stroke={color}
        strokeWidth={2}
      />
      <Path
        d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3M4 6c0 1.66 3.58 3 8 3s8-1.34 8-3"
        stroke={color}
        strokeWidth={2}
      />
    </Svg>
  );
}

export function LaserIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={17} cy={7} r={3} stroke={color} strokeWidth={2} />
      <Path
        d="M17 2v1M22 7h-1M20.5 3.5l-.7.7M4 20l10-10"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TimerIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={13} r={8} stroke={color} strokeWidth={2} />
      <Path
        d="M12 9v4l2.5 2.5M9.5 3h5M12 3v2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CalculatorIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={3} width={16} height={18} rx={2} stroke={color} strokeWidth={2} />
      <Path
        d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function GridIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={2} stroke={color} strokeWidth={2} />
      <Path
        d="M3 9h18M3 15h18M9 3v18M15 3v18"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function HandIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 11V6a2 2 0 0 0-4 0v4m0-4V4a2 2 0 0 0-4 0v6m0-4a2 2 0 0 0-4 0v7.5L4.5 12a2 2 0 0 0-2.8 2.8l4.7 5.2A4 4 0 0 0 9.4 21H15a5 5 0 0 0 5-5v-5a2 2 0 0 0-2-2Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BroadcastIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={2.2} fill={color} />
      <Path
        d="M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.5 18.5a9.2 9.2 0 0 1 0-13M18.5 5.5a9.2 9.2 0 0 1 0 13"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function FlowCanvasLogoIcon({ size = 24, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 15.5c2.2-4.8 4.4-7.5 6.2-7.5 2 0 1.4 8 3.6 8 1.8 0 3.7-3.4 6.2-8.5"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={19.5} cy={7.5} r={1.5} fill={colors.accent} />
    </Svg>
  );
}

export function SearchIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Path
        d="m20 20-3.5-3.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function CloseIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m18 6-12 12M6 6l12 12"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ImportIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 4v11m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ShieldCheckIcon({ size = 24, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3 5 6v6c0 4.5 3 8 7 9 4-1 7-4.5 7-9V6l-7-3Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m9.5 12 1.8 1.8 3.7-3.8"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CompassRulerIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 20 20 3v17H3Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M11 16h5v-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function MathSumIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6H7l6 6-6 6h11"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PdfDocIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M14 3v5h5M9 13h6M9 17h4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function FaceCamIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={6} width={13} height={12} rx={2.5} stroke={color} strokeWidth={2} />
      <Path
        d="m16 10 5-3v10l-5-3v-4Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function RecordDotIcon({ size = 24, color = colors.destructive }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={12} r={4} fill={color} />
    </Svg>
  );
}

export function PlayLessonIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path
        d="m10 8.5 6 3.5-6 3.5v-7Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function RevealTapeIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={7} width={18} height={10} rx={2} stroke={color} strokeWidth={2} />
      <Path d="M7 12h10M9 7v10M15 7v10" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function MicIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={9} y={3} width={6} height={11} rx={3} stroke={color} strokeWidth={2} />
      <Path
        d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CurtainIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={18} height={16} rx={2} stroke={color} strokeWidth={2} />
      <Path d="M3 12h18M12 12v4m-2-2 2 2 2-2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SpotlightIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={2} strokeDasharray="3 2" />
      <Circle cx={12} cy={12} r={3.5} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function FlashcardsIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={7} width={14} height={13} rx={2} stroke={color} strokeWidth={2} />
      <Path
        d="M8 7V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-1"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path d="M8 12h6M8 15.5h4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function RulerIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3}
        y={7}
        width={18}
        height={10}
        rx={2}
        transform="rotate(-25 12 12)"
        stroke={color}
        strokeWidth={2}
      />
      <Path d="m7.5 11.2 1.2 2.4M11 9.5l1.2 2.4M14.5 7.8l1.2 2.4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function ProtractorIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 17a9 9 0 0 1 18 0H3Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M8 17a4 4 0 0 1 8 0M12 8v3M6.5 11.5l1.8 1.8M17.5 11.5l-1.8 1.8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function CompassIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={6} r={2} stroke={color} strokeWidth={2} />
      <Path
        d="M12 3v1M10.8 7.8 6 20M13.2 7.8 18 20M7.5 14.5a7.5 7.5 0 0 0 9 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TableGridIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={18} height={16} rx={2} stroke={color} strokeWidth={2} />
      <Path d="M3 10h18M3 15h18M10 4v16M16 4v16" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function MoveIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ResizeHorizontalIcon({ size = 24, color = colors.foreground }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

