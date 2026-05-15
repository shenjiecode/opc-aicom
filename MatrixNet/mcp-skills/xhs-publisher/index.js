import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { chromium } from "playwright";
import { z } from "zod";
import fs from "fs";

const server = new McpServer({
  name: "xhs-publisher",
  version: "1.0.0"
});

server.tool("publish_to_xhs",
  "Publish image and text to Xiaohongshu via web automation",
  {
    image_path: z.string().describe("Local path to the generated image"),
    title: z.string(),
    content: z.string()
  },
  async ({ image_path, title, content }) => {
    if (!fs.existsSync(image_path)) {
      return { content: [{ type: "text", text: "Image file not found" }], isError: true };
    }

    let browser;
    try {
      browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
      const context = await browser.newContext();
      
      if (fs.existsSync('/app/cookies.json')) {
        const cookies = JSON.parse(fs.readFileSync('/app/cookies.json', 'utf-8'));
        await context.addCookies(cookies);
      } else {
        return { content: [{ type: "text", text: "Authentication cookies not found. Please provide cookies.json." }], isError: true };
      }

      const page = await context.newPage();
      await page.goto("https://creator.xiaohongshu.com/publish/publish");
      
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.setInputFiles(image_path);
      } else {
         return { content: [{ type: "text", text: "Could not find image upload input" }], isError: true };
      }
      
      await page.waitForSelector('.title-input', { timeout: 10000 }).catch(() => null);
      const titleInput = await page.$('.title-input');
      if (titleInput) {
         await titleInput.fill(title);
      }

      const contentInput = await page.$('.content-input');
      if (contentInput) {
         await contentInput.fill(content);
      }
      
      const publishBtn = await page.$('.publish-btn');
      if (publishBtn) {
         await publishBtn.click();
      } else {
         return { content: [{ type: "text", text: "Could not find publish button" }], isError: true };
      }
      
      await page.waitForTimeout(5000); 
      
      return { content: [{ type: "text", text: "Successfully published to Xiaohongshu!" }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Automation failed: ${error.message}` }], isError: true };
    } finally {
      if (browser) await browser.close();
    }
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);