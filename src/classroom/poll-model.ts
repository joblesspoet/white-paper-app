/**
 * Live Classroom Pop-Quiz Poll (`A / B / C / D` or `True / False`) state model,
 * vote aggregation, and canvas chart generator.
 *
 * Kept free of React Native / Expo imports so it can be verified in plain Node.
 */

import {
  DEFAULT_CHART_HEIGHT,
  DEFAULT_CHART_WIDTH,
  type ChartObjectBase,
} from '../canvas/chart-generator.ts';
import type { ChartObject } from '../canvas/document.ts';
import type { Point } from '../canvas/viewport.ts';

export type PollKind = 'abcd' | 'true-false';

export type PollOption = {
  id: string;
  label: string;
};

export type ClassroomPoll = {
  id: string;
  kind: PollKind;
  question: string;
  options: PollOption[];
  correctOptionId?: string;
  /** Map of `peerId -> optionId` enforcing 1 vote slot per peer. */
  votesByPeerId: Record<string, string>;
  status: 'open' | 'closed';
  createdAt: number;
  closedAt?: number;
};

export type PollOptionSummary = {
  id: string;
  label: string;
  count: number;
  percentage: number;
  isCorrect: boolean;
};

export type PollSummary = {
  totalVotes: number;
  options: PollOptionSummary[];
  leadingOptionId: string | null;
};

const ABCD_OPTIONS: PollOption[] = [
  { id: 'A', label: 'A' },
  { id: 'B', label: 'B' },
  { id: 'C', label: 'C' },
  { id: 'D', label: 'D' },
];

const TRUE_FALSE_OPTIONS: PollOption[] = [
  { id: 'T', label: 'True' },
  { id: 'F', label: 'False' },
];

export function defaultPollOptions(kind: PollKind): PollOption[] {
  return (kind === 'true-false' ? TRUE_FALSE_OPTIONS : ABCD_OPTIONS).map((o) => ({ ...o }));
}

export function createClassroomPoll(input: {
  id: string;
  kind: PollKind;
  question?: string;
  correctOptionId?: string;
  createdAt?: number;
}): ClassroomPoll {
  const options = defaultPollOptions(input.kind);
  const validCorrect = options.some((o) => o.id === input.correctOptionId)
    ? input.correctOptionId
    : undefined;
  return {
    id: input.id,
    kind: input.kind,
    question: input.question?.trim() || 'Quick Poll',
    options,
    ...(validCorrect ? { correctOptionId: validCorrect } : {}),
    votesByPeerId: {},
    status: 'open',
    createdAt: input.createdAt ?? Date.now(),
  };
}

/**
 * Record one vote per `peerId`. Duplicate vote submissions from the same
 * `peerId` do not inflate `totalVotes` (subsequent votes by the same `peerId`
 * are ignored once cast, preventing duplicate votes).
 */
export function submitPollVote(
  poll: ClassroomPoll,
  peerId: string,
  optionId: string,
): ClassroomPoll {
  if (poll.status !== 'open') return poll;
  if (!peerId || !poll.options.some((o) => o.id === optionId)) return poll;
  if (Object.prototype.hasOwnProperty.call(poll.votesByPeerId, peerId)) {
    return poll;
  }
  return {
    ...poll,
    votesByPeerId: {
      ...poll.votesByPeerId,
      [peerId]: optionId,
    },
  };
}

export function closeClassroomPoll(
  poll: ClassroomPoll,
  closedAt: number = Date.now(),
): ClassroomPoll {
  if (poll.status === 'closed') return poll;
  return {
    ...poll,
    status: 'closed',
    closedAt,
  };
}

export function computePollSummary(poll: ClassroomPoll): PollSummary {
  const counts = new Map<string, number>(poll.options.map((o) => [o.id, 0]));
  for (const optionId of Object.values(poll.votesByPeerId)) {
    if (counts.has(optionId)) {
      counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
    }
  }
  const totalVotes = Array.from(counts.values()).reduce((sum, c) => sum + c, 0);

  let leadingOptionId: string | null = null;
  let maxCount = 0;
  const options: PollOptionSummary[] = poll.options.map((option) => {
    const count = counts.get(option.id) ?? 0;
    if (count > maxCount) {
      maxCount = count;
      leadingOptionId = option.id;
    }
    const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    return {
      id: option.id,
      label: option.label,
      count,
      percentage,
      isCorrect: poll.correctOptionId === option.id,
    };
  });

  return {
    totalVotes,
    options,
    leadingOptionId,
  };
}

export function buildPollResultsChartObject(input: {
  id: string;
  poll: ClassroomPoll;
  point: Point;
  colorKey?: string;
}): ChartObject {
  const summary = computePollSummary(input.poll);
  const labels = summary.options.map((o) =>
    o.isCorrect ? `${o.label} ✓` : o.label,
  );
  const values = summary.options.map((o) => o.count);
  const base: ChartObjectBase = {
    type: 'chart',
    chartType: 'bar',
    title: `${input.poll.question} (${summary.totalVotes} vote${summary.totalVotes === 1 ? '' : 's'})`,
    labels,
    series: [
      {
        name: 'Votes',
        values,
        colorKey: input.colorKey ?? 'teal',
      },
    ],
    colorKey: input.colorKey ?? 'teal',
  };
  return {
    id: input.id,
    x: Math.round(input.point.x - DEFAULT_CHART_WIDTH / 2),
    y: Math.round(input.point.y - DEFAULT_CHART_HEIGHT / 2),
    width: DEFAULT_CHART_WIDTH,
    height: DEFAULT_CHART_HEIGHT,
    rotation: 0,
    ...base,
  };
}
