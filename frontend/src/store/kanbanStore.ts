import { create } from 'zustand';
import type { Position, Candidate } from '@/types';
import { positionApi, candidateApi } from '@/services/api';
import { message } from 'antd';

interface KanbanState {
  positions: Position[];
  currentPositionId: number | null;
  candidates: Candidate[];
  loading: boolean;
  positionsLoading: boolean;
  setCurrentPositionId: (id: number | null) => void;
  fetchPositions: () => Promise<void>;
  fetchCandidates: (positionId: number) => Promise<void>;
  addPosition: (position: Position) => void;
  updatePosition: (position: Position) => void;
  removePosition: (id: number) => void;
  addCandidates: (candidates: Candidate[]) => void;
  updateCandidate: (candidate: Candidate) => void;
  removeCandidate: (id: number) => void;
  moveCandidate: (
    candidateId: number,
    targetStage: string,
    newIndex: number
  ) => Promise<boolean>;
  reorderCandidates: (
    stage: string,
    candidateIds: number[]
  ) => Promise<boolean>;
  getCandidatesByStage: (stage: string) => Candidate[];
  getCurrentPosition: () => Position | undefined;
  getStages: () => string[];
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  positions: [],
  currentPositionId: null,
  candidates: [],
  loading: false,
  positionsLoading: false,

  setCurrentPositionId: (id: number | null) => {
    set({ currentPositionId: id });
    if (id !== null) {
      get().fetchCandidates(id);
    }
  },

  fetchPositions: async () => {
    set({ positionsLoading: true });
    try {
      const response = await positionApi.getAll();
      set({ positions: response.data });
      if (response.data.length > 0 && get().currentPositionId === null) {
        set({ currentPositionId: response.data[0].id });
        await get().fetchCandidates(response.data[0].id);
      }
    } catch (error) {
      message.error('获取职位列表失败');
      console.error(error);
    } finally {
      set({ positionsLoading: false });
    }
  },

  fetchCandidates: async (positionId: number) => {
    set({ loading: true });
    try {
      const response = await candidateApi.getByPosition(positionId);
      const sortedCandidates = response.data.sort((a, b) => a.cardOrder - b.cardOrder);
      set({ candidates: sortedCandidates });
    } catch (error) {
      message.error('获取候选人列表失败');
      console.error(error);
    } finally {
      set({ loading: false });
    }
  },

  addPosition: (position: Position) => {
    set((state) => ({
      positions: [...state.positions, position],
    }));
  },

  updatePosition: (position: Position) => {
    set((state) => ({
      positions: state.positions.map((p) =>
        p.id === position.id ? position : p
      ),
    }));
  },

  removePosition: (id: number) => {
    set((state) => ({
      positions: state.positions.filter((p) => p.id !== id),
      currentPositionId:
        state.currentPositionId === id
          ? state.positions.find((p) => p.id !== id)?.id || null
          : state.currentPositionId,
    }));
  },

  addCandidates: (candidates: Candidate[]) => {
    set((state) => ({
      candidates: [...state.candidates, ...candidates].sort(
        (a, b) => a.cardOrder - b.cardOrder
      ),
    }));
  },

  updateCandidate: (candidate: Candidate) => {
    set((state) => ({
      candidates: state.candidates.map((c) =>
        c.id === candidate.id ? candidate : c
      ),
    }));
  },

  removeCandidate: (id: number) => {
    set((state) => ({
      candidates: state.candidates.filter((c) => c.id !== id),
    }));
  },

  moveCandidate: async (
    candidateId: number,
    targetStage: string,
    newIndex: number
  ): Promise<boolean> => {
    const state = get();
    const candidate = state.candidates.find((c) => c.id === candidateId);
    if (!candidate || !state.currentPositionId) {
      return false;
    }

    const originalStage = candidate.currentStage;
    const originalIndex = state
      .getCandidatesByStage(originalStage)
      .findIndex((c) => c.id === candidateId);

    const optimisticCandidate = {
      ...candidate,
      currentStage: targetStage,
      cardOrder: newIndex,
    };

    set((state) => {
      const newCandidates = [...state.candidates];
      const targetStageCandidates = newCandidates
        .filter((c) => c.currentStage === targetStage && c.id !== candidateId)
        .sort((a, b) => a.cardOrder - b.cardOrder);
      
      targetStageCandidates.splice(newIndex, 0, optimisticCandidate);
      
      targetStageCandidates.forEach((c, idx) => {
        c.cardOrder = idx;
      });

      return {
        candidates: [
          ...newCandidates.filter(
            (c) => c.currentStage !== targetStage && c.id !== candidateId
          ),
          ...targetStageCandidates,
        ],
      };
    });

    try {
      const response = await candidateApi.moveCard({
        candidateId,
        toStage: targetStage,
        newCardOrder: newIndex,
        version: candidate.version,
      });

      if (response.data.success) {
        await get().fetchCandidates(state.currentPositionId);
        return true;
      } else {
        throw new Error(response.data.message || '移动失败');
      }
    } catch (error: any) {
      if (error.message?.includes('冲突') || error.message?.includes('conflict')) {
        message.error('数据已被修改，请刷新页面后重试');
        if (state.currentPositionId) {
          await get().fetchCandidates(state.currentPositionId);
        }
      } else {
        message.error(error.message || '状态机校验失败，无法移动到该阶段');
        set((state) => {
          const newCandidates = [...state.candidates].filter(
            (c) => c.id !== candidateId
          );
          const originalStageCandidates = newCandidates
            .filter((c) => c.currentStage === originalStage)
            .sort((a, b) => a.cardOrder - b.cardOrder);
          originalStageCandidates.splice(originalIndex, 0, candidate);
          originalStageCandidates.forEach((c, idx) => {
            c.cardOrder = idx;
          });
          return {
            candidates: [
              ...newCandidates.filter((c) => c.currentStage !== originalStage),
              ...originalStageCandidates,
            ],
          };
        });
      }
      return false;
    }
  },

  reorderCandidates: async (
    stage: string,
    candidateIds: number[]
  ): Promise<boolean> => {
    const state = get();
    if (!state.currentPositionId) return false;

    set((state) => {
      const newCandidates = [...state.candidates];
      const stageCandidates = newCandidates.filter(
        (c) => c.currentStage === stage
      );
      const reordered = candidateIds.map((id, idx) => {
        const c = stageCandidates.find((sc) => sc.id === id)!;
        return { ...c, cardOrder: idx };
      });
      return {
        candidates: [
          ...newCandidates.filter((c) => c.currentStage !== stage),
          ...reordered,
        ],
      };
    });

    try {
      const items = candidateIds.map((id, idx) => {
        const c = state.candidates.find((sc) => sc.id === id)!;
        return {
          candidateId: id,
          cardOrder: idx,
          version: c.version,
        };
      });

      const response = await candidateApi.reorder({
        positionId: state.currentPositionId,
        items,
      });
      if (!response.data.success) {
        throw new Error(response.data.message);
      }
      return true;
    } catch (error: any) {
      message.error(error.message || '排序更新失败');
      await get().fetchCandidates(state.currentPositionId);
      return false;
    }
  },

  getCandidatesByStage: (stage: string): Candidate[] => {
    const state = get();
    return state.candidates
      .filter((c) => c.currentStage === stage)
      .sort((a, b) => a.cardOrder - b.cardOrder);
  },

  getCurrentPosition: (): Position | undefined => {
    const state = get();
    return state.positions.find((p) => p.id === state.currentPositionId);
  },

  getStages: (): string[] => {
    const position = get().getCurrentPosition();
    if (!position) return ['初筛', '一面', '二面', 'HR面', 'Offer', '已淘汰'];
    return position.stageTemplate
      .sort((a, b) => a.order - b.order)
      .map((s) => s.name);
  },
}));
