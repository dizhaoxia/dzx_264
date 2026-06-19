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
  source: string;
  education: string;
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

export type SearchSortBy = 'relevance' | 'updatedAt' | 'education';

export interface SearchItem {
  candidateId: number;
  name: string;
  positionId: number;
  positionTitle: string;
  currentStage: string;
  workYears: number;
  education: string;
  source: string;
  confidenceScore: number;
  updatedAt: string;
  skills: string[];
  rank: number;
  snippet: string;
}

export interface SearchResult {
  query: string;
  sortBy: string;
  page: number;
  size: number;
  total: number;
  items: SearchItem[];
}

export interface ChannelSummary {
  source: string;
  applicationCount: number;
  screeningPassedCount: number;
  screeningPassRate: number;
  offerCount: number;
  avgScreeningToOfferHours: number | null;
}

export interface FunnelStage {
  stage: string;
  stageOrder: number;
  count: number;
}

export interface TrendPoint {
  date: string;
  source: string;
  avgHours: number | null;
  offerCount: number;
}

export interface AnalyticsSummary {
  startDate: string;
  endDate: string;
  channels: ChannelSummary[];
  funnel: FunnelStage[];
}

export const RECRUIT_CHANNELS = [
  'BOSS直聘',
  '猎聘',
  '内推',
  '校园',
] as const;

export type RecruitChannel = (typeof RECRUIT_CHANNELS)[number];
