import { Page, expect } from '@playwright/test';

/**
 * Navigate to the requirement publish page
 */
export async function navigateToPublishPage(page: Page): Promise<void> {
  await page.goto('/tasks');
  await page.click('button:has-text("发布任务")');
  await page.waitForSelector('text=企业需求发布', { timeout: 10000 });
}

/**
 * Upload a text-based requirement
 */
export async function uploadTextRequirement(page: Page, text: string): Promise<void> {
  // Ensure text input mode is selected
  const textButton = page.locator('button:has-text("文本描述")');
  if (await textButton.isVisible().catch(() => false)) {
    await textButton.click();
  }
  
  // Fill in the requirement text
  const textarea = page.locator('textarea').first();
  await textarea.fill(text);
}

/**
 * Trigger AI analysis on the uploaded requirement
 * Note: May timeout if AI service is not available
 */
export async function triggerAIAnalysis(page: Page): Promise<void> {
  const analyzeButton = page.locator('button:has-text("智能分析需求")');
  
  // Check if button is enabled
  const isEnabled = await analyzeButton.isEnabled();
  if (!isEnabled) {
    throw new Error('Analyze button is not enabled');
  }
  
  await analyzeButton.click();
  
  // Wait for analysis to complete
  try {
    await analyzeButton.waitFor({ state: 'hidden', timeout: 30000 });
  } catch (e) {
    // Check if there's an error message
    const errorMsg = page.locator('[class*="text-red-600"]');
    if (await errorMsg.isVisible().catch(() => false)) {
      const errorText = await errorMsg.textContent();
      throw new Error(`AI analysis failed: ${errorText}`);
    }
    throw e;
  }
  
  // Wait for the analysis result section
  await page.waitForSelector('text=AI 分析结果', { timeout: 10000 });
}

/**
 * Confirm and publish the requirement
 */
export async function confirmPublish(page: Page): Promise<void> {
  const confirmButton = page.locator('button:has-text("确认发布")');
  await confirmButton.click();
  
  // Wait for navigation to tasks page
  await page.waitForURL('**/tasks', { timeout: 10000 });
}

/**
 * Verify the task appears in the task list
 */
export async function verifyTaskInList(page: Page, title: string): Promise<void> {
  await page.waitForSelector(`text=${title}`, { timeout: 10000 });
}

/**
 * Re-analyze the requirement
 */
export async function reAnalyzeRequirement(page: Page): Promise<void> {
  const reAnalyzeButton = page.locator('button:has-text("重新分析")');
  await reAnalyzeButton.click();
  await page.waitForSelector('text=需求输入', { timeout: 10000 });
}

/**
 * Set party A identity (placeholder)
 */
export async function setPartyAIdentity(page: Page): Promise<void> {
  // Placeholder
}