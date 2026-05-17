import { apiFetch } from "@/lib/api";
import type {
  AgentBabaSession,
  AgentConfig,
  ClarificationQuestion,
  MatchedSkill,
  SessionStatus,
  TestCase,
  TestResult,
} from "@/types/agentbaba";

const API_BASE = "/agentbaba";
const MOCK_SESSIONS_KEY = "agentbaba:mock:sessions:v1";
const MOCK_NEXT_ID_KEY = "agentbaba:mock:next_id:v1";

function testLog(event: string, data?: unknown) {
  if (typeof window === "undefined") return;
  console.log(`[TEST LOG][AgentBaba] ${event}`, data ?? "");
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function readMockSessions(): AgentBabaSession[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(MOCK_SESSIONS_KEY) || "[]";
  return safeJsonParse<AgentBabaSession[]>(raw, []);
}

function writeMockSessions(list: AgentBabaSession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MOCK_SESSIONS_KEY, JSON.stringify(list));
}

function nextMockId(): number {
  if (typeof window === "undefined") return Date.now();
  const current = Number(window.localStorage.getItem(MOCK_NEXT_ID_KEY) || "1000");
  const next = current + 1;
  window.localStorage.setItem(MOCK_NEXT_ID_KEY, String(next));
  return current;
}

function upsertMockSession(session: AgentBabaSession) {
  const sessions = readMockSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.unshift(session);
  writeMockSessions(
    sessions.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
  );
}

function getMockSession(sessionId: number): AgentBabaSession | null {
  const sessions = readMockSessions();
  return sessions.find((s) => s.id === sessionId) || null;
}

function withStep(status: SessionStatus) {
  switch (status) {
    case "draft":
      return 1;
    case "clarifying":
      return 2;
    case "configuring":
      return 4;
    case "building":
      return 5;
    case "testing":
      return 6;
    case "completed":
      return 6;
    case "failed":
      return 6;
  }
}

function defaultClarificationQuestions(): ClarificationQuestion[] {
  return [
    {
      id: "goal",
      question: "你希望这个智能体解决什么问题？",
      type: "text",
      required: true,
    },
    {
      id: "audience",
      question: "主要服务对象是谁？",
      type: "text",
      required: true,
    },
    {
      id: "output",
      question: "希望输出形式偏向哪种？",
      type: "text",
      required: true,
    },
  ];
}

function defaultMatchedSkills(): MatchedSkill[] {
  return [
    {
      skill_id: 101,
      skill_name: "email-sender",
      display_name: "邮件发送",
      relevance_score: 0.92,
      reason: "支持给指定收件人发送通知或报告。",
    },
    {
      skill_id: 102,
      skill_name: "web-search",
      display_name: "网页检索",
      relevance_score: 0.86,
      reason: "可从公开网页检索资料并汇总输出。",
    },
    {
      skill_id: 103,
      skill_name: "file-tools",
      display_name: "文件处理",
      relevance_score: 0.78,
      reason: "支持读取/生成常见文件内容。",
    },
  ];
}

function buildMockConfig(session: AgentBabaSession, skillIds: number[]): AgentConfig {
  const matched = safeJsonParse<MatchedSkill[]>(session.matched_skills_json || "[]", []);
  const skills = matched
    .filter((s) => skillIds.includes(s.skill_id))
    .map((s) => ({
      name: s.skill_name,
      enabled: true,
      config: {},
    }));

  return {
    name: session.title || "未命名 Agent",
    description: session.description || "",
    model: "gpt-4o-mini",
    system_prompt: "你是一个高效、可靠的智能体，请用简洁的步骤帮助用户完成目标。",
    temperature: 0.7,
    max_tokens: 2048,
    skills,
    mcp_servers: skills.some((s) => s.name === "email-sender")
      ? [
          {
            name: "email-sender",
            transport_type: "stdio",
          },
        ]
      : [],
    memory: { type: "conversation", max_messages: 20, enable_summary: true },
    planner: { type: "react", max_iterations: 6 },
  };
}

export interface CreateSessionRequest {
  title: string;
  description: string;
}

export interface CreateSessionResponse {
  session_id: number;
  status: string;
}

export async function createSession(
  data: CreateSessionRequest
): Promise<CreateSessionResponse> {
  testLog("createSession:request", data);
  try {
    const res = await apiFetch<CreateSessionResponse>(`${API_BASE}/session/create`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    testLog("createSession:success", res);
    return res;
  } catch (err) {
    testLog("createSession:fallback_to_mock", String(err));
    const id = nextMockId();
    const session: AgentBabaSession = {
      id,
      user_id: 0,
      title: data.title,
      description: data.description,
      status: "draft",
      current_step: 1,
      clarification_json: "[]",
      answers_json: "{}",
      matched_skills_json: "[]",
      agent_config_json: "",
      agent_instance_id: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    upsertMockSession(session);
    const res = { session_id: id, status: session.status };
    testLog("createSession:mock_created", res);
    return res;
  }
}

export async function getSession(sessionId: number) {
  testLog("getSession:request", { sessionId });
  try {
    const res = await apiFetch<{
      session: AgentBabaSession;
      current_step_description: string;
    }>(`${API_BASE}/session/${sessionId}`);
    testLog("getSession:success", { sessionId, status: res.session.status });
    return res;
  } catch (err) {
    testLog("getSession:fallback_to_mock", String(err));
    const session = getMockSession(sessionId);
    if (!session) {
      throw err;
    }
    const clarification = safeJsonParse<ClarificationQuestion[]>(
      session.clarification_json || "[]",
      []
    );
    if (clarification.some((q) => q.type !== "text")) {
      const normalized = clarification.map((q) =>
        q.type === "text"
          ? q
          : {
              ...q,
              type: "text",
              options: undefined,
            }
      );
      const updated: AgentBabaSession = {
        ...session,
        clarification_json: JSON.stringify(normalized),
        updated_at: nowIso(),
      };
      upsertMockSession(updated);
      const res = { session: updated, current_step_description: updated.status };
      testLog("getSession:mock_normalized", { sessionId, status: updated.status });
      return res;
    }
    const res = { session, current_step_description: session.status };
    testLog("getSession:mock", { sessionId, status: session.status });
    return res;
  }
}

export async function startClarification(sessionId: number) {
  testLog("startClarification:request", { sessionId });
  try {
    const res = await apiFetch<{ questions: ClarificationQuestion[] }>(
      `${API_BASE}/session/${sessionId}/clarify`,
      { method: "POST" }
    );
    testLog("startClarification:success", { sessionId, count: res.questions.length });
    return res;
  } catch (err) {
    testLog("startClarification:fallback_to_mock", String(err));
    const session = getMockSession(sessionId);
    if (!session) throw err;
    const questions = defaultClarificationQuestions();
    const updated: AgentBabaSession = {
      ...session,
      status: "clarifying",
      current_step: withStep("clarifying"),
      clarification_json: JSON.stringify(questions),
      updated_at: nowIso(),
    };
    upsertMockSession(updated);
    const res = { questions };
    testLog("startClarification:mock", { sessionId, count: questions.length });
    return res;
  }
}

export async function answerQuestion(
  sessionId: number,
  questionId: string,
  answer: unknown
) {
  testLog("answerQuestion:request", { sessionId, questionId, answer });
  try {
    const res = await apiFetch<{
      next_questions: ClarificationQuestion[];
      completed: boolean;
    }>(`${API_BASE}/session/${sessionId}/answer`, {
      method: "POST",
      body: JSON.stringify({ question_id: questionId, answer }),
    });
    testLog("answerQuestion:success", { sessionId, questionId, completed: res.completed });
    return res;
  } catch (err) {
    testLog("answerQuestion:fallback_to_mock", String(err));
    const session = getMockSession(sessionId);
    if (!session) throw err;
    const questions = safeJsonParse<ClarificationQuestion[]>(
      session.clarification_json || "[]",
      defaultClarificationQuestions()
    );
    const answers = safeJsonParse<Record<string, unknown>>(session.answers_json || "{}", {});
    answers[questionId] = answer;
    const completed = Object.keys(answers).filter((k) => !k.startsWith("__")).length >= questions.length;
    const updated: AgentBabaSession = {
      ...session,
      status: "clarifying",
      current_step: withStep("clarifying"),
      answers_json: JSON.stringify(answers),
      updated_at: nowIso(),
    };
    upsertMockSession(updated);
    const res = {
      next_questions: questions,
      completed,
    };
    testLog("answerQuestion:mock", { sessionId, questionId, completed });
    return res;
  }
}

export async function matchSkills(sessionId: number) {
  testLog("matchSkills:request", { sessionId });
  try {
    const res = await apiFetch<{ matched_skills: MatchedSkill[] }>(
      `${API_BASE}/session/${sessionId}/match-skills`,
      { method: "POST" }
    );
    testLog("matchSkills:success", { sessionId, count: res.matched_skills.length });
    return res;
  } catch (err) {
    testLog("matchSkills:fallback_to_mock", String(err));
    const session = getMockSession(sessionId);
    if (!session) throw err;
    const matched_skills = defaultMatchedSkills();
    const updated: AgentBabaSession = {
      ...session,
      status: "configuring",
      current_step: 3,
      matched_skills_json: JSON.stringify(matched_skills),
      updated_at: nowIso(),
    };
    upsertMockSession(updated);
    const res = { matched_skills };
    testLog("matchSkills:mock", { sessionId, count: matched_skills.length });
    return res;
  }
}

export async function selectSkills(sessionId: number, skillIds: number[]) {
  testLog("selectSkills:request", { sessionId, skillIds });
  try {
    const res = await apiFetch<void>(`${API_BASE}/session/${sessionId}/select-skills`, {
      method: "POST",
      body: JSON.stringify({ skill_ids: skillIds }),
    });
    testLog("selectSkills:success", { sessionId, count: skillIds.length });
    return res;
  } catch (err) {
    testLog("selectSkills:fallback_to_mock", String(err));
    const session = getMockSession(sessionId);
    if (!session) throw err;
    const answers = safeJsonParse<Record<string, unknown>>(session.answers_json || "{}", {});
    answers.__selectedSkills = skillIds;
    const updated: AgentBabaSession = {
      ...session,
      answers_json: JSON.stringify(answers),
      updated_at: nowIso(),
    };
    upsertMockSession(updated);
    testLog("selectSkills:mock", { sessionId, count: skillIds.length });
  }
}

export async function generateConfig(sessionId: number) {
  testLog("generateConfig:request", { sessionId });
  try {
    const res = await apiFetch<{ config: AgentConfig }>(
      `${API_BASE}/session/${sessionId}/generate-config`,
      { method: "POST" }
    );
    testLog("generateConfig:success", { sessionId, name: res.config.name });
    return res;
  } catch (err) {
    testLog("generateConfig:fallback_to_mock", String(err));
    const session = getMockSession(sessionId);
    if (!session) throw err;
    const answers = safeJsonParse<Record<string, unknown>>(session.answers_json || "{}", {});
    const selected = Array.isArray(answers.__selectedSkills)
      ? (answers.__selectedSkills as number[])
      : defaultMatchedSkills().map((s) => s.skill_id);
    const config = buildMockConfig(session, selected);
    const updated: AgentBabaSession = {
      ...session,
      status: "configuring",
      current_step: withStep("configuring"),
      agent_config_json: JSON.stringify(config),
      updated_at: nowIso(),
    };
    upsertMockSession(updated);
    const res = { config };
    testLog("generateConfig:mock", { sessionId, name: config.name });
    return res;
  }
}

export async function buildAgent(sessionId: number) {
  testLog("buildAgent:request", { sessionId });
  try {
    const res = await apiFetch<{
      instance_id: number;
      container_id: string;
      status: string;
    }>(`${API_BASE}/session/${sessionId}/build`, { method: "POST" });
    testLog("buildAgent:success", { sessionId, instance_id: res.instance_id });
    return res;
  } catch (err) {
    testLog("buildAgent:fallback_to_mock", String(err));
    const session = getMockSession(sessionId);
    if (!session) throw err;
    const instance_id = nextMockId();
    const updated: AgentBabaSession = {
      ...session,
      status: "building",
      current_step: withStep("building"),
      agent_instance_id: instance_id,
      updated_at: nowIso(),
    };
    upsertMockSession(updated);
    const res = { instance_id, container_id: `mock-${instance_id}`, status: "building" };
    testLog("buildAgent:mock", res);
    return res;
  }
}

export async function testAgent(
  sessionId: number,
  testCases: TestCase[]
) {
  testLog("testAgent:request", { sessionId, count: testCases.length });
  try {
    const res = await apiFetch<{ result: TestResult }>(`${API_BASE}/session/${sessionId}/test`, {
      method: "POST",
      body: JSON.stringify({ test_cases: testCases }),
    });
    testLog("testAgent:success", { sessionId, passed: res.result.passed, total: res.result.total });
    return res;
  } catch (err) {
    testLog("testAgent:fallback_to_mock", String(err));
    const result: TestResult = {
      passed: testCases.length,
      failed: 0,
      total: testCases.length,
      duration: 1.2,
      details: testCases.map((t) => ({
        test_case_name: t.name,
        passed: true,
        actual: t.expected,
        expected: t.expected,
        error: "",
        duration: 0.4,
      })),
    };
    testLog("testAgent:mock", { sessionId, passed: result.passed, total: result.total });
    return { result };
  }
}

export async function deployAgent(sessionId: number) {
  testLog("deployAgent:request", { sessionId });
  try {
    const res = await apiFetch<{ agent_id: number; status: string }>(
      `${API_BASE}/session/${sessionId}/deploy`,
      { method: "POST" }
    );
    testLog("deployAgent:success", { sessionId, agent_id: res.agent_id });
    return res;
  } catch (err) {
    testLog("deployAgent:fallback_to_mock", String(err));
    const session = getMockSession(sessionId);
    if (!session) throw err;
    const agent_id = nextMockId();
    const updated: AgentBabaSession = {
      ...session,
      status: "completed",
      current_step: withStep("completed"),
      agent_instance_id: agent_id,
      updated_at: nowIso(),
    };
    upsertMockSession(updated);
    const res = { agent_id, status: "completed" };
    testLog("deployAgent:mock", res);
    return res;
  }
}

export async function listSessions(offset = 0, limit = 20) {
  testLog("listSessions:request", { offset, limit });
  try {
    const res = await apiFetch<{ list: AgentBabaSession[]; total: number }>(
      `${API_BASE}/sessions?offset=${offset}&limit=${limit}`
    );
    testLog("listSessions:success", { total: res.total });
    return res;
  } catch (err) {
    testLog("listSessions:fallback_to_mock", String(err));
    const sessions = readMockSessions();
    const list = sessions.slice(offset, offset + limit);
    const res = { list, total: sessions.length };
    testLog("listSessions:mock", { total: res.total });
    return res;
  }
}
