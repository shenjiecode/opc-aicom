// Project related API calls
import { apiFetch } from '@/lib/api';

export interface Project {
  id: number;
  contract_id: number;
  task_id: number;
  title: string;
  description: string;
  status: string; // signing, executing, completed
  progress: number;
  budget: number;
  owner_id: number;
  owner_name: string;
  agent_id: number;
  agent_name: string;
  chat_room_id: string;
  chat_room_name: string;
  prd_document: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
}

export async function listProjects(page: number = 1, pageSize: number = 10): Promise<ProjectListResponse> {
  return apiFetch<ProjectListResponse>(`/projects/list?page=${page}&pageSize=${pageSize}`);
}

export async function getProject(id: number): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`);
}
