import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Candidate } from '@/types';
import CandidateCard from './CandidateCard';

interface KanbanColumnProps {
  stage: string;
  candidates: Candidate[];
  isOver?: boolean;
  onViewLogs: (candidate: Candidate) => void;
}

const getStageColor = (stage: string): string => {
  const colorMap: Record<string, string> = {
    '初筛': '#1890ff',
    '一面': '#52c41a',
    '二面': '#722ed1',
    'HR面': '#fa8c16',
    'Offer': '#13c2c2',
    '已淘汰': '#ff4d4f',
  };
  return colorMap[stage] || '#8c8c8c';
};

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  stage,
  candidates,
  isOver,
  onViewLogs,
}) => {
  const { setNodeRef } = useDroppable({
    id: stage,
    data: {
      type: 'column',
      stage,
    },
  });

  const candidateIds = candidates.map((c) => c.id);

  return (
    <div
      ref={setNodeRef}
      className="kanban-column"
      style={{
        flex: 1,
        minWidth: 280,
        maxWidth: 320,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        border: isOver ? '2px dashed #1890ff' : '2px solid transparent',
        transition: 'border 0.2s ease',
      }}
    >
      <div
        className="column-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: '2px solid',
          borderColor: getStageColor(stage),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: getStageColor(stage),
            }}
          />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{stage}</h3>
          <span
            style={{
              backgroundColor: getStageColor(stage),
              color: 'white',
              borderRadius: 12,
              padding: '2px 8px',
              fontSize: 12,
              minWidth: 24,
              textAlign: 'center',
            }}
          >
            {candidates.length}
          </span>
        </div>
      </div>

      <div
        className="column-content"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          minHeight: 100,
        }}
      >
        <SortableContext
          items={candidateIds}
          strategy={verticalListSortingStrategy}
        >
          {candidates.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: '#bfbfbf',
                padding: '40px 0',
                fontSize: 14,
              }}
            >
              拖拽候选人到此列
            </div>
          ) : (
            candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                onViewLogs={onViewLogs}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
};

export default KanbanColumn;
