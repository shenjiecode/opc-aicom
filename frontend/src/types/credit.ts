export interface CreditBalance {
  points: number;           // 海贝余额
  coupons: number;
  computeHours: number;
  computeGpu: number;
}

export interface CreditTransaction {
  id: number;
  user_id: number;
  type: 'recharge' | 'consume' | 'refund';
  amount: number;           // 正数=充值, 负数=消费
  balance_after: number;
  description: string;
  model?: string;
  tokens_used?: number;
  created_at: string;
}

export interface LLMGateway {
  id: number;
  user_id: number;
  api_key: string;          // sk-xxx format, partially masked for display
  key_name: string;
  quota: number;
  used_tokens: number;
  credits_used: number;
  status: 'active' | 'revoked';
  created_at: string;
}

export interface TransactionListResponse {
  list: CreditTransaction[];
  total: number;
  page: number;
  pageSize: number;
}

// Recharge request types
export interface RechargeRequest {
  email: string;
  amount: number;  // 海贝数量
}

export interface RechargeResponse {
  success: boolean;
  message: string;
  newBalance?: number;
}
