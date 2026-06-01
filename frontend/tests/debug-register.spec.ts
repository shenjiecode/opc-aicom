import { test, expect } from '@playwright/test';

test('Debug: 检查注册页面元素', async ({ page }) => {
  // 访问注册页面
  await page.goto('/register');
  
  // 等待页面完全加载
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000); // 额外等待React渲染
  
  // 截图查看页面状态
  await page.screenshot({ path: 'test-results/debug-register-page.png' });
  
  // 检查页面标题
  const title = await page.title();
  console.log('页面标题:', title);
  
  // 检查页面URL
  const url = page.url();
  console.log('当前URL:', url);
  
  // 查找用户名输入框（多种方式）
  const usernameById = await page.$('#username');
  const usernameByName = await page.$('input[name="username"]');
  const usernameByPlaceholder = await page.$('input[placeholder*="用户名"]');
  const usernameByType = await page.$('input[type="text"]');
  
  console.log('通过ID找到用户名输入框:', !!usernameById);
  console.log('通过Name找到用户名输入框:', !!usernameByName);
  console.log('通过Placeholder找到用户名输入框:', !!usernameByPlaceholder);
  console.log('通过Type找到输入框:', !!usernameByType);
  
  // 获取页面上所有input元素
  const inputs = await page.$$('input');
  console.log('页面上的input元素数量:', inputs.length);
  
  // 获取body的HTML
  const bodyHTML = await page.evaluate(() => document.body.innerHTML);
  console.log('Body内容长度:', bodyHTML.length);
  
  // 期望至少找到一个输入框
  expect(inputs.length).toBeGreaterThan(0);
});
