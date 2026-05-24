import { apiFetch } from "@/lib/api";
import type {
  MallBalance,
  PurchaseRequest,
  PurchaseResponse,
  PackageListResponse,
  MyPackageListResponse,
} from "@/types/mall";

const API_BASE = "/mall";

/**
 * Get all available packages in the mall
 */
export async function getPackages(): Promise<PackageListResponse> {
  return apiFetch<PackageListResponse>(`${API_BASE}/packages`);
}

/**
 * Get user's current points balance
 */
export async function getBalance(): Promise<MallBalance> {
  return apiFetch<MallBalance>(`${API_BASE}/balance`);
}

/**
 * Purchase a package
 */
export async function purchasePackage(data: PurchaseRequest): Promise<PurchaseResponse> {
  return apiFetch<PurchaseResponse>(`${API_BASE}/purchase`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Get user's purchased packages
 */
export async function getMyPackages(): Promise<MyPackageListResponse> {
  return apiFetch<MyPackageListResponse>(`${API_BASE}/my-packages`);
}
