import axios, { AxiosError, AxiosResponse } from 'axios';
import type {
  Position,
  Candidate,
  StageLog,
  PositionFormData,
  MoveCardRequest,
  ReorderRequest,
  UploadResponse,
  ApiError,
} from '@/types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<ApiError>) => {
    const errorMessage = error.response?.data?.message || error.message || '请求失败';
    return Promise.reject(new Error(errorMessage));
  }
);

export const positionApi = {
  getAll: (): Promise<AxiosResponse<Position[]>> => api.get('/positions'),

  getById: (id: number): Promise<AxiosResponse<Position>> => api.get(`/positions/${id}`),

  create: (data: PositionFormData): Promise<AxiosResponse<Position>> =>
    api.post('/positions', data),

  update: (id: number, data: PositionFormData): Promise<AxiosResponse<Position>> =>
    api.put(`/positions/${id}`, data),

  delete: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/positions/${id}`),
};

export const candidateApi = {
  getByPosition: (positionId: number): Promise<AxiosResponse<Candidate[]>> =>
    api.get('/candidates', { params: { positionId } }),

  getById: (id: number): Promise<AxiosResponse<Candidate>> => api.get(`/candidates/${id}`),

  getStageLogs: (id: number): Promise<AxiosResponse<StageLog[]>> =>
    api.get(`/candidates/${id}/logs`),

  uploadResume: (
    positionId: number,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<AxiosResponse<UploadResponse>> => {
    const formData = new FormData();
    formData.append('positionId', String(positionId));
    formData.append('file', file);

    return api.post('/candidates/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });
  },

  moveCard: (data: MoveCardRequest): Promise<AxiosResponse<{ success: boolean; message: string; conflict?: boolean; candidate?: Candidate }>> =>
    api.post('/candidates/move', data),

  reorder: (data: ReorderRequest): Promise<AxiosResponse<{ success: boolean; message: string }>> =>
    api.post('/candidates/reorder', data),

  delete: (id: number): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/candidates/${id}`),
};

export default api;
