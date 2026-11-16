import { useCallback, useState } from 'react';

import type { DocumentCommand } from '../canvas/document';
import type { Point } from '../canvas/viewport';
import type { ClassroomSession, ClassroomSessionState } from '../classroom/classroom-session';
import {
  buildPollResultsChartObject,
  createClassroomPoll,
  type ClassroomPoll,
  type PollKind,
} from '../classroom/poll-model';

export type UseClassroomPollParams = {
  classroomSession: ClassroomSession | null;
  classroomState: ClassroomSessionState | null;
  getViewportCenterPoint: () => Point;
  dispatchCommand: (command: DocumentCommand, transient?: boolean) => void;
  setSelectedIds: (ids: string[]) => void;
};

export function useClassroomPoll({
  classroomSession,
  classroomState,
  getViewportCenterPoint,
  dispatchCommand,
  setSelectedIds,
}: UseClassroomPollParams) {
  const [pollModalVisible, setPollModalVisible] = useState(false);

  const handleOpenPollModal = useCallback(() => {
    setPollModalVisible(true);
  }, []);

  const handleClosePollModal = useCallback(() => {
    setPollModalVisible(false);
  }, []);

  const handleStartPoll = useCallback(
    (params: { kind: PollKind; question: string; correctOptionId?: string }) => {
      if (!classroomSession) return;
      const poll = createClassroomPoll({
        id: `poll-${Date.now().toString(36)}`,
        kind: params.kind,
        question: params.question,
        correctOptionId: params.correctOptionId,
      });
      void classroomSession.startPoll(poll);
    },
    [classroomSession],
  );

  const handleVote = useCallback(
    (pollId: string, optionId: string) => {
      if (!classroomSession) return;
      void classroomSession.voteInPoll(pollId, optionId);
    },
    [classroomSession],
  );

  const handleClosePoll = useCallback(
    (pollId: string) => {
      if (!classroomSession) return;
      void classroomSession.closePoll(pollId);
    },
    [classroomSession],
  );

  const handleClearPoll = useCallback(() => {
    classroomSession?.clearPoll();
  }, [classroomSession]);

  const handleInsertChartOnBoard = useCallback(
    (poll: ClassroomPoll) => {
      const chart = buildPollResultsChartObject({
        id: `chart-poll-${Date.now().toString(36)}`,
        poll,
        point: getViewportCenterPoint(),
      });
      dispatchCommand({ type: 'object.insert', object: chart });
      setSelectedIds([chart.id]);
    },
    [dispatchCommand, getViewportCenterPoint, setSelectedIds],
  );

  return {
    pollModalVisible,
    activePoll: classroomState?.activePoll ?? null,
    handleOpenPollModal,
    handleClosePollModal,
    handleStartPoll,
    handleVote,
    handleClosePoll,
    handleClearPoll,
    handleInsertChartOnBoard,
  };
}
