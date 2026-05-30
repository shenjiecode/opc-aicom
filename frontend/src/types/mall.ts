// Points Mall Types

export interface MallPackage {
  id: number;
  name: string;
  description: string;
  type: 'qoder' | 'gpu' | 'other';
  price: number;
  credits: number;
  duration_days: number;
  specs: string;
  status: 'active' | 'inactive';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MallBalance {
  points: number;
}

export interface MyPackage {
  id: number;
  user_id: number;
  package_id: number;
  package_name: string;
  credits_total: number;
  credits_used: number;
  credits_remaining: number;
  started_at: string;
  expires_at: string;
  status: 'active' | 'expired' | 'cancelled';
  created_at: string;
}

export interface PurchaseRequest {
  package_id: number;
}

export interface PurchaseResponse {
  success: boolean;
  message: string;
  order_id?: number;
  remaining_balance?: number;
}

export interface PackageListResponse {
  list: MallPackage[];
  total: number;
}

export interface MyPackageListResponse {
  list: MyPackage[];
  total: number;
}


// Qoder Purchase Types
export interface QoderPurchaseRequest {
  email: string;
}

export interface QoderPurchaseResponse {
  order_no: string;
  account_id: string;
  account_email: string;
  points_deducted: number;
  expires_at: string;
}
