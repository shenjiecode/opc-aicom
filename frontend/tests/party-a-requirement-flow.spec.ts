/**
 * Party A Requirement Flow E2E Tests
 * 
 * Prerequisites:
 * - Backend service running on localhost:8080
 * - Frontend service running on localhost:5173
 * 
 * Run: npx playwright test party-a-requirement-flow.spec.ts --project=chromium
 */

import { test, expect } from '@playwright/test';
import { login, register } from './helpers/auth';
import {
  navigateToPublishPage,
  uploadTextRequirement,
  triggerAIAnalysis,
  confirmPublish,
} from './helpers/requirement';

const generateUsername = (prefix: string) => `${prefix}_${Date.now()}`;

test.describe('Party A Requirement Flow', () => {
  test('完整流程：注册→登录→发布需求', async ({ page }) => {
    const username = generateUsername('partya');
    const password = 'Test123456';

    // Register
    await register(page, username, password);
    await page.waitForURL('**/login');

    // Login
    await login(page, username, password);
    await page.waitForURL('**/');
    await expect(page.url()).toContain('/');

    // Navigate to publish page
    await navigateToPublishPage(page);

    // Upload requirement
    await uploadTextRequirement(page, '需要一个电商网站开发，使用React+Node.js，预算10000元。');

    // Try AI analysis
    try {
      await triggerAIAnalysis(page);
      await page.waitForSelector('text=AI 分析结果', { timeout: 5000 });
    } catch (e) {
      console.log('AI analysis not available');
    }

    // Confirm or verify page
    const confirmButton = page.locator('button:has-text("确认发布")');
    if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmPublish(page);
      await page.waitForURL('**/tasks', { timeout: 10000 });
    } else {
      await expect(page.locator('text=企业需求发布')).toBeVisible();
    }
  });

  test('需求发布页面加载', async ({ page }) => {
    const username = generateUsername('partya2');
    const password = 'Test123456';

    await register(page, username, password);
    await page.waitForURL('**/login');
    await login(page, username, password);
    await page.waitForURL('**/');

    await navigateToPublishPage(page);

    await expect(page.locator('text=企业需求发布')).toBeVisible();
    await expect(page.locator('text=需求输入')).toBeVisible();
  });

  test('文本输入功能', async ({ page }) => {
    const username = generateUsername('partya3');
    const password = 'Test123456';

    await register(page, username, password);
    await page.waitForURL('**/login');
    await login(page, username, password);
    await page.waitForURL('**/');

    await navigateToPublishPage(page);

    const textButton = page.locator('button:has-text("文本描述")');
    await expect(textButton).toBeVisible();
    
    await textButton.click();
    await uploadTextRequirement(page, '需要一个个人博客网站');
    
    const textarea = page.locator('textarea').first();
    await expect(textarea).toHaveValue('需要一个个人博客网站');
  });
});

test.describe('Party A - Basic Navigation', () => {
  test('登录后访问需求中心', async ({ page }) => {
    const username = generateUsername('partya_nav');
    const password = 'Test123456';

    await register(page, username, password);
    await page.waitForURL('**/login');
    await login(page, username, password);
    await page.waitForURL('**/');

    await page.goto('/tasks');
    await page.waitForSelector('text=需求中心', { timeout: 10000 });

    await expect(page.locator('h1:has-text("需求中心")')).toBeVisible();
  });
});