import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import type { StudentBoardSnapshot } from '../../classroom/classroom-session';
import type { ThemeColors } from '../../theme';
import { liveClassHostStyles as styles } from '../LiveClassHostSheet.styles';

type PreviewPolyline = {
  id: string;
  points: string;
};

function buildPreviewPolylines(
  strokes: StudentBoardSnapshot['document']['strokes'],
): PreviewPolyline[] {
  const recentStrokes = strokes.slice(-12);
  if (recentStrokes.length === 0) return [];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of recentStrokes) {
    for (const pt of stroke.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  const width = Math.max(40, maxX - minX);
  const height = Math.max(40, maxY - minY);
  const scale = Math.min(120 / width, 64 / height);

  return recentStrokes.map((stroke) => ({
    id: stroke.id,
    points: stroke.points
      .map((pt) => `${((pt.x - minX) * scale + 8).toFixed(1)},${((pt.y - minY) * scale + 6).toFixed(1)}`)
      .join(' '),
  }));
}

export type StudentBoardCardProps = {
  item: StudentBoardSnapshot;
  isShowcased: boolean;
  theme: ThemeColors;
  onShowcase: (peerId: string | null) => void;
};

/** Renders a thumbnail preview of a student's scratchpad with a Showcase toggle. */
export const StudentBoardCard = React.memo(function StudentBoardCard({
  item,
  isShowcased,
  theme,
  onShowcase,
}: StudentBoardCardProps) {
  const previewPolylines = useMemo(
    () => buildPreviewPolylines(item.document.strokes),
    [item.document.strokes],
  );

  return (
    <View
      style={[
        styles.galleryCard,
        {
          borderColor: isShowcased ? theme.accent : theme.border,
          backgroundColor: theme.background,
        },
      ]}
    >
      <View
        style={[
          styles.galleryPreview,
          { borderColor: theme.border, backgroundColor: '#FFFFFF' },
        ]}
      >
        {previewPolylines.length > 0 ? (
          <Svg width={136} height={76}>
            {previewPolylines.map((line) => (
              <Polyline
                key={line.id}
                points={line.points}
                fill="none"
                stroke="#0F172A"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
        ) : (
          <Text style={[styles.emptyText, { color: '#64748B' }]}>
            {item.objectCount > 0 ? `${item.objectCount} objects` : 'Blank scratchpad'}
          </Text>
        )}
      </View>

      <View style={styles.galleryFooter}>
        <View style={styles.participantMeta}>
          <Text style={[styles.participantName, { color: theme.foreground }]} numberOfLines={1}>
            {item.displayName}
          </Text>
          <Text style={[styles.participantSub, { color: theme.foreground }]}>
            {item.strokeCount} strokes • {item.objectCount} objs
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isShowcased ? `Stop showcasing ${item.displayName}` : `Showcase ${item.displayName}`
          }
          onPress={() => onShowcase(isShowcased ? null : item.peerId)}
          style={[
            styles.pillBtn,
            {
              borderColor: isShowcased ? theme.accent : theme.primary,
              backgroundColor: isShowcased ? theme.accent : theme.surface,
            },
          ]}
        >
          <Text style={[styles.pillBtnText, { color: isShowcased ? '#FFFFFF' : theme.primary }]}>
            {isShowcased ? 'Showing' : 'Showcase'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});
