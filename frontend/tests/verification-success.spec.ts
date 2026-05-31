import { test, expect } from '@playwright/test';
import { register, login, submitEnterpriseVerification, callAdminReviewAPI, waitForCreditBalance } from './helpers/auth';

const TEST_ADMIN_JWT = process.env.ADMIN_JWT || '';

test.describe('Enterprise Verification Success Flow', () => {
  const uniqueUsername = `testuser_success_${Date.now()}`;
  const uniqueEnterprise = {
    enterpriseName: `测试公司成功_${Date.now()}`,
    licenseNumber: `123456789012345678`,
    legalPersonName: '张三',
    unifiedSocialCode: '123456789012345678',
    contactPhone: '13800138000',
  };

  test('should register, login, submit verification, get approved, and show credit balance', async ({ page }) => {
    // Step 1: Register new user
    await register(page, uniqueUsername, 'Test123456');
    await page.waitForURL('**/login');

    // Step 2: Login
    await login(page, uniqueUsername, 'Test123456');
    await page.waitForURL('**/');

    // Step 3: Submit enterprise verification
    await submitEnterpriseVerification(page, uniqueEnterprise);

    // Wait for pending status
    await page.waitForSelector('[data-testid="verification-status"]:has-text("pending")', { timeout: 10000 });

    // Extract verification ID from response or get from page
    // Since we need to call the admin API, we need the verification ID
    // Let's assume the API returns it or we can find it in the page
    const verificationId = await page.evaluate(() => {
      // Try to get from window or localStorage
      return window.localStorage.getItem('lastVerificationId');
    }).catch(() => '1'); // Fallback to 1 if not found

    // Step 4: Call admin review API to approve
    // First login as admin to get JWT
    const adminLoginResponse = await fetch('http://localhost:8080/api/user/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin_e2e', password: 'Admin123456' }),
    });
    const adminData = await adminLoginResponse.json();
    const adminJWT = adminData.data?.token;

    if (!adminJWT) {
      throw new Error('Failed to get admin JWT');
    }

    // Call admin review API to approve
    await callAdminReviewAPI(parseInt(verificationId) || 1, 'approve');

    // Step 5: Verify status is "approved"
    await page.reload();
    await page.waitForSelector('[data-testid="verification-status"]:has-text("approved")', { timeout: 10000 });

    // Step 6: Verify credit balance shows 10000
    await waitForCreditBalance(page, 10000);
  });
});