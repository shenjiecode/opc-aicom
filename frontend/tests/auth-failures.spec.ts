import { test, expect } from '@playwright/test';
import { register, login } from './helpers/auth';

test.describe('Authentication Failure Scenarios', () => {
  test('should fail to register with duplicate username', async ({ page }) => {
    const duplicateUsername = `testuser_duplicate_${Date.now()}`;

    // First registration should succeed
    await register(page, duplicateUsername, 'Test123456');
    await page.waitForURL('**/login');

    // Second registration with same username should fail
    await page.goto('/register');
    await page.fill('[name="username"]', duplicateUsername);
    await page.fill('[name="password"]', 'Test123456');
    await page.fill('[name="confirmPassword"]', 'Test123456');
    await page.click('button:has-text("创建账号")');

    // Should show error message
    await page.waitForSelector('[data-testid="error-message"], text=用户名已存在', { timeout: 5000 });
    await expect(page.locator('[name="username"]')).toHaveValue(duplicateUsername);
  });

  test('should fail to login with wrong password', async ({ page }) => {
    const testUsername = `testuser_login_fail_${Date.now()}`;

    // Register first
    await register(page, testUsername, 'Test123456');
    await page.waitForURL('**/login');

    // Try to login with wrong password
    await page.goto('/login');
    await page.fill('[name="username"]', testUsername);
    await page.fill('[name="password"]', 'WrongPassword123');
    await page.click('button:has-text("登录")');

    // Should show error message
    await page.waitForSelector('[data-testid="error-message"], text=密码错误', { timeout: 5000 });

    // Should not navigate away from login page
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('should fail to login with non-existent username', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="username"]', `nonexistent_${Date.now()}`);
    await page.fill('[name="password"]', 'Test123456');
    await page.click('button:has-text("登录")');

    // Should show error message
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 5000 });
    await expect(page).toHaveURL(/.*\/login/);
  });
});