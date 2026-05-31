import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { testUser } from './fixtures/test-data';

test.describe('Enterprise Verification Validation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUser.username, testUser.password);
    await page.waitForURL('**/');
  });

  test('should fail to submit with empty form', async ({ page }) => {
    // Open verification dialog
    await page.click('[data-testid="verification-trigger"]');
    await page.click('button:has-text("企业认证")');
    await page.waitForSelector('[data-testid="verification-dialog"]', { timeout: 5000 });

    // Try to submit empty form
    await page.click('button:has-text("提交认证")');

    // Should show validation errors
    await page.waitForSelector('[data-testid="error-enterpriseName"], text=请输入企业名称', { timeout: 5000 });
    await page.waitForSelector('[data-testid="error-licenseNumber"], text=请输入营业执照号', { timeout: 5000 });
    await page.waitForSelector('[data-testid="error-legalPersonName"], text=请输入法人姓名', { timeout: 5000 });
    await page.waitForSelector('[data-testid="error-contactPhone"], text=请输入联系电话', { timeout: 5000 });
    await page.waitForSelector('[data-testid="error-businessLicense"], text=请上传营业执照', { timeout: 5000 });
  });

  test('should fail to submit with invalid license number (less than 18 chars)', async ({ page }) => {
    // Open verification dialog
    await page.click('[data-testid="verification-trigger"]');
    await page.click('button:has-text("企业认证")');
    await page.waitForSelector('[data-testid="verification-dialog"]', { timeout: 5000 });

    // Fill with invalid license number (only 17 chars)
    await page.fill('[name="enterpriseName"]', '测试公司验证');
    await page.fill('[name="licenseNumber"]', '12345678901234567'); // 17 chars
    await page.fill('[name="legalPersonName"]', '张三');
    await page.fill('[name="contactPhone"]', '13800138000');
    await page.setInputFiles('[name="businessLicense"]', 'tests/fixtures/test-license.jpg');

    await page.click('button:has-text("提交认证")');

    // Should show error for license number
    await page.waitForSelector('[data-testid="error-licenseNumber"], text=营业执照号须为18位', { timeout: 5000 });
  });

  test('should fail to submit with invalid phone number (less than 11 chars)', async ({ page }) => {
    // Open verification dialog
    await page.click('[data-testid="verification-trigger"]');
    await page.click('button:has-text("企业认证")');
    await page.waitForSelector('[data-testid="verification-dialog"]', { timeout: 5000 });

    // Fill with invalid phone number (only 10 chars)
    await page.fill('[name="enterpriseName"]', '测试公司验证');
    await page.fill('[name="licenseNumber"]', '123456789012345678');
    await page.fill('[name="legalPersonName"]', '张三');
    await page.fill('[name="contactPhone"]', '1380013800'); // 10 chars
    await page.setInputFiles('[name="businessLicense"]', 'tests/fixtures/test-license.jpg');

    await page.click('button:has-text("提交认证")');

    // Should show error for phone number
    await page.waitForSelector('[data-testid="error-contactPhone"], text=手机号须为11位', { timeout: 5000 });
  });

  test('should fail to submit without business license file', async ({ page }) => {
    // Open verification dialog
    await page.click('[data-testid="verification-trigger"]');
    await page.click('button:has-text("企业认证")');
    await page.waitForSelector('[data-testid="verification-dialog"]', { timeout: 5000 });

    // Fill form but don't upload file
    await page.fill('[name="enterpriseName"]', '测试公司验证');
    await page.fill('[name="licenseNumber"]', '123456789012345678');
    await page.fill('[name="legalPersonName"]', '张三');
    await page.fill('[name="contactPhone"]', '13800138000');

    // Don't set any file
    await page.click('button:has-text("提交认证")');

    // Should show error for missing file
    await page.waitForSelector('[data-testid="error-businessLicense"], text=请上传营业执照', { timeout: 5000 });
  });
});