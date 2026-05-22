import { apiFetch } from "@/lib/api";
import type {
  CreditBalance,
  LLMGateway,
  TransactionListResponse,
  RechargeRequest,
  RechargeResponse,
} from "@/types/credit";

const API_BASE = "/credit";

/**
 * Get user's Haibei balance
 */
export async function getCreditBalance(): Promise<CreditBalance> {
  return apiFetch<CreditBalance>(`${API_BASE}/balance`);
}

/**
 * Get transaction history with pagination
 * @param page Page number (1-based)
 * @param pageSize Number of items per page
 * @param type Filter by transaction type ('all', 'recharge', 'consume')
 */
export async function getTransactions(
  page: number = 1,
  pageSize: number = 20,
  type: 'all' | 'recharge' | 'consume' = 'all'
): Promise<TransactionListResponse> {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('pageSize', pageSize.toString());
  if (type !== 'all') {
    params.append('type', type);
  }
  return apiFetch<TransactionListResponse>(`${API_BASE}/transactions?${params.toString()}`);
}

/**
 * Get user's LLM Gateway (API Key) info
 */
export async function getMyGateway(): Promise<LLMGateway | null> {
  try {
    return await apiFetch<LLMGateway>(`${API_BASE}/gateway`);
  } catch {
    // Return null if no gateway exists
    return null;
  }
}

/**
 * Create a new LLM Gateway for the user
 */
export async function createGateway(): Promise<LLMGateway> {
  return apiFetch<LLMGateway>(`${API_BASE}/gateway`, {
    method: "POST",
  });
}

/**
 * Revoke user's LLM Gateway API key
 */
export async function revokeGateway(): Promise<void> {
  return apiFetch<void>(`${API_BASE}/gateway/revoke`, {
    method: "POST",
  });
}

/**
 * Admin: Recharge credits for a user
 * @param data Recharge request with email and amount
 */
export async function rechargeCredits(data: RechargeRequest): Promise<RechargeResponse> {
  return apiFetch<RechargeResponse>(`${API_BASE}/admin/recharge`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
