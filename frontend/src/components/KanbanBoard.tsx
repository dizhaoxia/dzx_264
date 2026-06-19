import React, { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Spin, Empty } from 'antd';
import { useKanbanStore } from '@/store/kanbanStore';
import type { Candidate } from '@/types';
import KanbanColumn from './KanbanColumn';
import CandidateCard from './CandidateCard';

interface KanbanBoardProps {
  onViewLogs: (candidate: Candidate) => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ onViewLogs }) => {
  const {
    candidates,
    loading,
    getStages,
    getCandidatesByStage,
    moveCandidate,
    reorderCandidates,
    currentPositionId,
  } = useKanbanStore();

  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const stages = getStages();

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const id = active.id as number;
    setActiveId(id);
    const candidate = candidates.find((c) => c.id === id);
    setActiveCandidate(candidate || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;

    if (!over) {
      setOverColumn(null);
      return;
    }

    const overData = over.data.current;
    if (overData?.type === 'column') {
      setOverColumn(overData.stage as string);
    } else {
      const overCandidate = candidates.find((c) => c.id === (over.id as number));
      if (overCandidate) {
        setOverColumn(overCandidate.currentStage);
      }
    }
  };

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveId(null);
      setActiveCandidate(null);
      setOverColumn(null);

      if (!over) return;

      const activeId = active.id as number;
      const activeCandidate = candidates.find((c) => c.id === activeId);

      if (!activeCandidate) return;

      const overData = over.data.current;

      let targetStage: string | null = null;
      let targetIndex = 0;

      if (overData?.type === 'column') {
        targetStage = overData.stage as string;
        const stageCandidates = getCandidatesByStage(targetStage);
        targetIndex = stageCandidates.length;
      } else {
        const overId = over.id as number;
        const overCandidate = candidates.find((c) => c.id === overId);
        if (!overCandidate) return;

        targetStage = overCandidate.currentStage;
        const stageCandidates = getCandidatesByStage(targetStage);
        const overIndex = stageCandidates.findIndex((c) => c.id === overId);
        targetIndex = overIndex;
      }

      if (!targetStage) return;

      if (activeCandidate.currentStage === targetStage) {
        const stageCandidates = getCandidatesByStage(targetStage);
        const oldIndex = stageCandidates.findIndex((c) => c.id === activeId);
        const newIndex = targetIndex;

        if (oldIndex === newIndex) return;

        const newCandidates = arrayMove(stageCandidates, oldIndex, newIndex);
        const candidateIds = newCandidates.map((c) => c.id);

        await reorderCandidates(targetStage, candidateIds);
      } else {
        await moveCandidate(activeId, targetStage, targetIndex);
      }
    },
    [candidates, getCandidatesByStage, moveCandidate, reorderCandidates]
  );

  if (!currentPositionId) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}
      >
        <Empty description="请先选择或创建一个职位" />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div
          className="kanban-board"
          style={{
            display: 'flex',
            gap: 16,
            padding: 16,
            flex: 1,
            overflowX: 'auto',
            minHeight: 0,
          }}
        >
          {stages.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              candidates={getCandidatesByStage(stage)}
              isOver={overColumn === stage}
              onViewLogs={onViewLogs}
            />
          ))}
        </div>

        <DragOverlay>
          {activeId && activeCandidate ? (
            <div style={{ transform: 'rotate(3deg)', opacity: 0.9 }}>
              <CandidateCard
                candidate={activeCandidate}
                onViewLogs={onViewLogs}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default KanbanBoard;
