export interface Position {
  id: number;
  title: string;
  department: string;
  jobDescription: string;
  qualifications: string;
  stageTemplate: StageTemplate[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface StageTemplate {
  name: string;
  order: number;
}

export interface Candidate {
  id: number;
  positionId: number;
  name: string;
  phone: string;
  email: string;
  workYears: number;
  skills: string[];
  currentStage: string;
  confidenceScore: number;
  resumeFileUrl: string;
  parsedData: Record<string, any>;
  cardOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StageLog {
  id: number;
  candidateId: number;
  fromStage: string;
  toStage: string;
  operatorId: number;
  remark: string;
  createdAt: string;
}

export interface PositionFormData {
  title: string;
  department: string;
  jobDescription: string;
  qualifications: string;
  stageTemplate: StageTemplate[];
}

export interface MoveCardRequest {
  candidateId: number;
  toStage: string;
  newCardOrder: number;
  remark?: string;
  version: number;
}

export interface ReorderItem {
  candidateId: number;
  cardOrder: number;
  version?: number;
}

export interface ReorderRequest {
  positionId: number;
  items: ReorderItem[];
}

export interface UploadResponse {
  candidateId: number;
  fileName: string;
  status: string;
  message: string;
}

export interface ParseResultDTO {
  fileName: string;
  success: boolean;
  message: string;
  candidate?: Candidate;
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'parsing' | 'success' | 'error';
  message?: string;
}

export interface KanbanColumnData {
  stage: string;
  candidates: Candidate[];
}

export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
}
