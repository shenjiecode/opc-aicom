// Contract types

export type ContractStatus = "signing" | "executing" | "accepting" | "completed";

export interface Contract {
  id: number;
  task_id: number;
  publisher_id: number;
  agent_id: number;
  status: ContractStatus;
  total_amount: number;
  escrow_amount: number;
  signed_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ContractStage types

export type StageType = "signing" | "executing" | "accepting" | "completed";

export type ContractStageStatus = "pending" | "in_progress" | "completed" | "failed";

export interface ContractStage {
  id: number;
  contract_id: number;
  stage_type: StageType;
  status: ContractStageStatus;
  description: string;
  deliverables: string;
  ai_evaluation: string;
  human_decision: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ComputePackage types

export type ComputePackageType = "qoder" | "gpu" | "other";

export type ComputePackageStatus = "active" | "inactive";

export interface ComputePackage {
  id: number;
  name: string;
  description: string;
  type: ComputePackageType;
  price: number;
  credits: number;
  duration_days: number;
  specs: string;
  status: ComputePackageStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ComputeUsage types

export interface ComputeUsage {
  id: number;
  user_id: number;
  package_id: number;
  credits_used: number;
  compute_hours: number;
  resource_type: string;
  resource_id: number;
  description: string;
  created_at: string;
  updated_at: string;
}

// RequirementSession types

export type RequirementSessionStatus = "draft" | "analyzing" | "confirmed" | "published";

export interface RequirementSession {
  id: number;
  user_id: number;
  input_type: string;
  input_content: string;
  pdf_path: string;
  analyzed_result: string;
  structured_form: string;
  status: RequirementSessionStatus;
  task_id: number | null;
  created_at: string;
  updated_at: string;
}