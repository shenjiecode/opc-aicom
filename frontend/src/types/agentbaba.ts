export interface ClarificationQuestion {
  id: string;
  question: string;
  type: "text" | "select" | "multiselect" | "number";
  options?: string[];
  default?: string | number | boolean;
  required: boolean;
}

export interface MatchedSkill {
  skill_id: number;
  skill_name: string;
  display_name: string;
  relevance_score: number;
  reason: string;
}

export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  skills: SkillConfig[];
  mcp_servers: MCPServerConfig[];
  memory: MemoryConfig;
  planner: PlannerConfig;
}

export interface SkillConfig {
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface MCPServerConfig {
  name: string;
  transport_type: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export interface MemoryConfig {
  type: string;
  max_messages: number;
  enable_summary: boolean;
}

export interface PlannerConfig {
  type: string;
  max_iterations: number;
}

export interface AgentBabaSession {
  id: number;
  user_id: number;
  title: string;
  description: string;
  status: SessionStatus;
  current_step: number;
  clarification_json: string;
  answers_json: string;
  matched_skills_json: string;
  agent_config_json: string;
  agent_instance_id: number | null;
  created_at: string;
  updated_at: string;
}

export type SessionStatus =
  | "draft"
  | "clarifying"
  | "configuring"
  | "building"
  | "testing"
  | "completed"
  | "failed";

export interface TestCase {
  name: string;
  input: string;
  expected: string;
  timeout: number;
}

export interface TestResult {
  passed: number;
  failed: number;
  total: number;
  duration: number;
  details: TestDetail[];
}

export interface TestDetail {
  test_case_name: string;
  passed: boolean;
  actual: string;
  expected: string;
  error: string;
  duration: number;
}

export interface Skill {
  id: number;
  name: string;
  display_name: string;
  description: string;
  category: string;
  tags: string;
  source: string;
  source_id: string;
  mcp_name: string;
  version: string;
  author: string;
  rating: number;
  install_count: number;
  status: string;
}

export interface AgentInstance {
  id: number;
  session_id: number;
  user_id: number;
  name: string;
  description: string;
  container_name: string;
  status: string;
  health_status: string;
  cpu_limit: number;
  memory_limit: number;
  total_runs: number;
  success_runs: number;
  failed_runs: number;
  created_at: string;
}
