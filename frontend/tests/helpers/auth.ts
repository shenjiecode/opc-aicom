import { Page } from '@playwright/test';
import { testUser, testEnterprise, testAdmin } from '../fixtures/test-data';

/**
 * Login with username and password
 */
export async function login(page: Page, username: string = testUser.username, password: string = testUser.password): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('#username', { timeout: 10000 });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button:has-text("登录")');
  await page.waitForURL('**/', { timeout: 15000 });
}

/**
 * Register a new user
 */
export async function register(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/register');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('#username', { timeout: 10000 });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.fill('#confirmPassword', password);
  await page.click('button:has-text("创建账号")');
  await page.waitForURL('**/login', { timeout: 15000 });
}

/**
 * Submit enterprise verification
 */
export async function submitEnterpriseVerification(page: Page, data: typeof testEnterprise = testEnterprise): Promise<void> {
  await page.click('[data-testid="verification-trigger"]');
  await page.click('button:has-text("企业认证")');
  await page.fill('[name="enterpriseName"]', data.enterpriseName);
  await page.fill('[name="licenseNumber"]', data.licenseNumber);
  await page.fill('[name="legalPersonName"]', data.legalPersonName);
  await page.fill('[name="contactPhone"]', data.contactPhone);
  await page.setInputFiles('[name="businessLicense"]', 'tests/fixtures/test-license.jpg');
  await page.click('button:has-text("提交认证")');
}

/**
 * Call admin review API
 */
export async function callAdminReviewAPI(verificationId: number, action: 'approve' | 'reject', reason?: string): Promise<void> {
  const response = await fetch('http://localhost:8080/api/admin/verification/review', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ADMIN_JWT}`,
    },
    body: JSON.stringify({ verification_id: verificationId, action, reason }),
  });
  if (!response.ok) {
    throw new Error(`Admin review API failed: ${response.statusText}`);
  }
}

/**
 * Wait for credit balance to show
 */
export async function waitForCreditBalance(page: Page, expected: number): Promise<void> {
  await page.waitForSelector(`[data-testid="credit-balance"]:has-text("${expected.toLocaleString()}")`, { timeout: 10000 });
}
