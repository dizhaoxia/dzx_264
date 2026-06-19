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
  locked?: boolean;
  talentPoolStatus?: string;
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

export interface Interviewer {
  id: number;
  name: string;
  email: string;
  department: string;
  title: string;
}

export interface MeetingRoom {
  id: number;
  name: string;
  location: string;
  capacity: number;
}

export interface InterviewSchedule {
  id: number;
  candidateId: number;
  candidateName: string;
  positionId: number;
  stage: string;
  interviewerId: number;
  interviewerName: string;
  roomId: number;
  roomName: string;
  startTime: string;
  endTime: string;
  status: string;
  round: number;
  remark: string;
  createdAt: string;
}

export interface InterviewScheduleRequest {
  candidateId: number;
  positionId?: number;
  stage: string;
  interviewerId: number;
  roomId: number;
  startTime: string;
  endTime: string;
  round?: number;
  remark?: string;
}

export interface RecommendedSlot {
  startTime: string;
  endTime: string;
}

export interface ConflictCheckResult {
  conflict: boolean;
  interviewerConflict: boolean;
  roomConflict: boolean;
  message?: string;
  conflictingSchedules: InterviewSchedule[];
  recommendedSlots: RecommendedSlot[];
}

export interface OfferApprovalNode {
  id: number;
  nodeOrder: number;
  roleName: string;
  approverName: string;
  status: string;
  comment: string;
  approvedAt: string;
}

export interface OfferApproval {
  id: number;
  candidateId: number;
  candidateName: string;
  positionId: number;
  status: string;
  salaryPackage: string;
  onboardingDate: string;
  currentNode: number;
  createdAt: string;
  updatedAt: string;
  nodes: OfferApprovalNode[];
}

export interface CreateOfferApprovalRequest {
  candidateId: number;
  salaryPackage: string;
  onboardingDate: string;
}

export interface UpdateOfferRequest {
  salaryPackage?: string;
  onboardingDate?: string;
}

export interface ApprovalActionRequest {
  approverName: string;
  comment?: string;
}
