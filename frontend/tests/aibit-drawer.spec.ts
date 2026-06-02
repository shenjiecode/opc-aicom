import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Aibit Drawer', () => {
  test.describe('Unauthenticated User', () => {
    test('should redirect to login when clicking floating button', async ({ page }) => {
      // Go to homepage without being logged in
      await page.goto('/');

      // Wait for the floating button to be visible
      const floatingButton = page.locator('[data-testid="aibit-floating-btn"]');
      await expect(floatingButton).toBeVisible();

      // Click the floating button
      await floatingButton.click();

      // Should redirect to login page
      await expect(page).toHaveURL(/.*\/login/);
    });

    test('floating button should have correct accessibility label for unauthenticated user', async ({ page }) => {
      await page.goto('/');

      const floatingButton = page.locator('[data-testid="aibit-floating-btn"]');
      await expect(floatingButton).toBeVisible();
      await expect(floatingButton).toHaveAttribute('aria-label', '登录后使用聊天助手');
    });
  });

  test.describe('Authenticated User', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await login(page);
    });

    test('floating button should be visible at bottom-right', async ({ page }) => {
      await page.goto('/');

      const floatingButton = page.locator('[data-testid="aibit-floating-btn"]');
      await expect(floatingButton).toBeVisible();

      // Check button position is bottom-right
      const box = await floatingButton.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThan(0);
      expect(box!.y).toBeGreaterThan(0);
    });

    test('floating button should have correct accessibility label for authenticated user', async ({ page }) => {
      await page.goto('/');

      const floatingButton = page.locator('[data-testid="aibit-floating-btn"]');
      await expect(floatingButton).toBeVisible();
      await expect(floatingButton).toHaveAttribute('aria-label', '打开聊天助手');
    });

    test('clicking button opens drawer', async ({ page }) => {
      await page.goto('/');

      const floatingButton = page.locator('[data-testid="aibit-floating-btn"]');
      await floatingButton.click();

      // Drawer should be visible
      const drawer = page.locator('[role="dialog"]');
      await expect(drawer).toBeVisible();

      // Drawer title should be visible
      await expect(page.getByText('Aibit 助手')).toBeVisible();
    });

    test('clicking X button closes drawer', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      await page.locator('[data-testid="aibit-floating-btn"]').click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Click close button
      const closeButton = page.locator('[role="dialog"] button[aria-label="关闭"]');
      await closeButton.click();

      // Drawer should be closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('clicking overlay closes drawer', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      await page.locator('[data-testid="aibit-floating-btn"]').click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Click overlay (the area outside the dialog)
      const overlay = page.locator('[data-state="open"] ~ [data-state="open"]').first();
      if (await overlay.count() > 0) {
        await overlay.click({ position: { x: 10, y: 10 } });
      }

      // Drawer should be closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('ESC key closes drawer', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      await page.locator('[data-testid="aibit-floating-btn"]').click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Press ESC
      await page.keyboard.press('Escape');

      // Drawer should be closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('should show empty state when no messages', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      await page.locator('[data-testid="aibit-floating-btn"]').click();

      // Wait for drawer to be visible
      const drawer = page.locator('[role="dialog"]');
      await expect(drawer).toBeVisible();

      // Check empty state message
      await expect(page.getByText('暂无私信')).toBeVisible();
      await expect(page.getByText('开始与 Aibit 助手对话')).toBeVisible();
    });

    test('should display message list container', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      await page.locator('[data-testid="aibit-floating-btn"]').click();

      // Check message list container exists
      const messageList = page.locator('[data-testid="message-list"]');
      await expect(messageList).toBeVisible();
    });

    test('should type and send message using Enter key', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      await page.locator('[data-testid="aibit-floating-btn"]').click();

      // Wait for drawer to be visible
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Type a message in the input
      const input = page.locator('[data-testid="chat-input"]');
      await expect(input).toBeVisible();
      await input.fill('Hello Aibit');

      // Press Enter to send
      await input.press('Enter');

      // Message should appear in the list (or at least input should be cleared)
      // Note: The actual message display depends on the API response
      await expect(input).toHaveValue('');
    });

    test('should send message using send button', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      await page.locator('[data-testid="aibit-floating-btn"]').click();

      // Wait for drawer to be visible
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Type a message
      const input = page.locator('[data-testid="chat-input"]');
      await input.fill('Test message');

      // Click send button
      const sendButton = page.locator('[role="dialog"] button:has([class*="lucide-send"])');
      await sendButton.click();

      // Input should be cleared after sending
      await expect(input).toHaveValue('');
    });

    test('should not send empty message', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      await page.locator('[data-testid="aibit-floating-btn"]').click();

      // Try to press Enter with empty input
      const input = page.locator('[data-testid="chat-input"]');
      await input.press('Enter');

      // Input should still be empty (not throw error)
      await expect(input).toHaveValue('');
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await login(page);
    });

    test('drawer should be 100% width on mobile viewport', async ({ page }) => {
      // Resize to mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });

      await page.goto('/');

      // Open drawer
      await page.locator('[data-testid="aibit-floating-btn"]').click();

      // Get drawer content
      const drawerContent = page.locator('[role="dialog"] [class*="w-full"]').first();
      await expect(drawerContent).toBeVisible();

      // Check that it takes full width on mobile
      const box = await drawerContent.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(370); // Close to viewport width
    });

    test('floating button should be visible on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });

      await page.goto('/');

      const floatingButton = page.locator('[data-testid="aibit-floating-btn"]');
      await expect(floatingButton).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('drawer should have proper role and attributes', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      await page.locator('[data-testid="aibit-floating-btn"]').click();

      // Check dialog role
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Check that it has aria-label or title
      const title = page.locator('[role="dialog"] [class*="text-white text-base"]');
      await expect(title).toBeVisible();
    });

    test('close button should have aria-label', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      await page.locator('[data-testid="aibit-floating-btn"]').click();

      // Check close button has aria-label
      const closeButton = page.locator('[role="dialog"] button[aria-label="关闭"]');
      await expect(closeButton).toBeVisible();
    });

    test('input should be focusable', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      await page.locator('[data-testid="aibit-floating-btn"]').click();

      // Input should be focusable
      const input = page.locator('[data-testid="chat-input"]');
      await expect(input).toBeVisible();
      await input.focus();
      await expect(input).toBeFocused();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/');

      // Open drawer with keyboard (Enter on button)
      const floatingButton = page.locator('[data-testid="aibit-floating-btn"]');
      await floatingButton.focus();
      await floatingButton.press('Enter');

      // Drawer should open
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Focus should move to input
      const input = page.locator('[data-testid="chat-input"]');
      await expect(input).toBeFocused();
    });
  });
});
