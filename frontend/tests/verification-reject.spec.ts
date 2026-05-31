import { test, expect } from '@playwright/test';
import { login, submitEnterpriseVerification, callAdminReviewAPI, waitForCreditBalance } from './helpers/auth';
import { testUser } from './fixtures/test-data';

test.describe('Enterprise Verification Reject Flow', () => {
  const uniqueEnterprise = {
    enterpriseName: `测试公司拒绝_${Date.now()}`,
    licenseNumber: `223456789012345678`,
    legalPersonName: '李四',
    unifiedSocialCode: '223456789012345678',
    contactPhone: '13800138001',
  };

  const updatedEnterprise = {
    enterpriseName: `测试公司重新_${Date.now()}`,
    licenseNumber: `323456789012345678`,
    legalPersonName: '王五',
    unifiedSocialCode: '323456789012345678',
    contactPhone: '13800138002',
  };

  test('should reject verification, resubmit, and get approved', async ({ page }) => {
    // Step 1: Login with existing test user
    await login(page, testUser.username, testUser.password);
    await page.waitForURL('**/');

    // Step 2: Submit enterprise verification
    await submitEnterpriseVerification(page, uniqueEnterprise);

    // Wait for pending status
    await page.waitForSelector('[data-testid="verification-status"]:has-text("pending")', { timeout: 10000 });

    // Get verification ID
    const verificationId = await page.evaluate(() => {
      return window.localStorage.getItem('lastVerificationId');
    }).catch(() => '1');

    // Step 3: Call admin review API to reject
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

    await callAdminReviewAPI(parseInt(verificationId) || 1, 'reject', '资料不完整');

    // Step 4: Verify status is "rejected"
    await page.reload();
    await page.waitForSelector('[data-testid="verification-status"]:has-text("rejected")', { timeout: 10000 });

    // Step 5: Click "重新提交" button
    await page.click('[data-testid="verification-resubmit"]');
    await page.waitForSelector('[data-testid="verification-dialog"]', { timeout: 5000 });

    // Clear and fill with updated info
    await page.fill('[name="enterpriseName"]', '');
    await page.fill('[name="licenseNumber"]', '');
    await page.fill('[name="legalPersonName"]', '');
    await page.fill('[name="contactPhone"]', '');

    await page.fill('[name="enterpriseName"]', updatedEnterprise.enterpriseName);
    await page.fill('[name="licenseNumber"]', updatedEnterprise.licenseNumber);
    await page.fill('[name="legalPersonName"]', updatedEnterprise.legalPersonName);
    await page.fill('[name="contactPhone"]', updatedEnterprise.contactPhone);
    await page.setInputFiles('[name="businessLicense"]', 'tests/fixtures/test-license.jpg');
    await page.click('button:has-text("提交认证")');

    // Wait for pending status again
    await page.waitForSelector('[data-testid="verification-status"]:has-text("pending")', { timeout: 10000 });

    // Step 6: Approve and verify credit balance
    const newVerificationId = await page.evaluate(() => {
      return window.localStorage.getItem('lastVerificationId');
    }).catch(() => '2');

    await callAdminReviewAPI(parseInt(newVerificationId) || 2, 'approve');

    // Verify approved status
    await page.reload();
    await page.waitForSelector('[data-testid="verification-status"]:has-text("approved")', { timeout: 10000 });

    // Verify credit balance
    await waitForCreditBalance(page, 10000);
  });
});