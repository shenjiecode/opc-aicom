# LightAgent & MCP Skills Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the open-source `light-agent` into the existing Docker environment and implement two custom MCP skills: Xiaohongshu automated publishing (via Playwright) and Email sending (via SMTP).

**Architecture:** 
- Add `light-agent` (from the specified open-source repo) as a new service in the existing `MatrixNet/docker-compose.yml`.
- Create a new directory `MatrixNet/mcp-skills` to host the custom MCP servers.
- **Skill 1 (Email):** A Node.js MCP server using `nodemailer` to format raw messages into beautiful HTML emails and send them via standard SMTP.
- **Skill 2 (Xiaohongshu):** A Node.js MCP server using `playwright` to automate the Xiaohongshu creator center web UI for publishing generated image-text content.
- Configure `light-agent` to connect to these two MCP servers (e.g., via HTTP/SSE or stdio over Docker exec).

**Tech Stack:** Node.js, Docker, `@modelcontextprotocol/sdk`, Playwright, Nodemailer.

---

### Task 1: Integrate `light-agent` into Docker

**Files:**
- Modify: `MatrixNet/docker-compose.yml`
- Create: `MatrixNet/light-agent-config/mcporter.json` (or `.env` depending on light-agent specs)

- [ ] **Step 1: Add light-agent service to docker-compose**

```yaml
# Add to MatrixNet/docker-compose.yml under services:
  light-agent:
    image: ghcr.io/puruboard-droid/light-agent:latest # Or build from cloned repo
    container_name: light-agent
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
    volumes:
      - ./light-agent-config:/app/config
```
*(Note: adjust the exact image name or build context based on the actual repository structure after cloning)*

- [ ] **Step 2: Commit**

```bash
git add MatrixNet/docker-compose.yml
git commit -m "feat: add light-agent service to docker-compose"
```

### Task 2: Implement Email Sender MCP Server

**Files:**
- Create: `MatrixNet/mcp-skills/email-sender/package.json`
- Create: `MatrixNet/mcp-skills/email-sender/index.js`
- Create: `MatrixNet/mcp-skills/email-sender/Dockerfile`

- [ ] **Step 1: Initialize Node project and install dependencies**

```bash
mkdir -p MatrixNet/mcp-skills/email-sender
cd MatrixNet/mcp-skills/email-sender
npm init -y
npm install @modelcontextprotocol/sdk nodemailer
```

- [ ] **Step 2: Write the MCP server logic**

```javascript
// MatrixNet/mcp-skills/email-sender/index.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import nodemailer from "nodemailer";
import { z } from "zod";

const server = new McpServer({
  name: "email-sender",
  version: "1.0.0"
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.example.com",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

server.tool("send_email",
  "Beautify and send an email",
  {
    to: z.string().email(),
    subject: z.string(),
    raw_message: z.string()
  },
  async ({ to, subject, raw_message }) => {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #333333;">${subject}</h2>
          <hr style="border: none; border-top: 1px solid #eeeeee; margin: 20px 0;" />
          <div style="color: #555555; line-height: 1.6;">
            ${raw_message.replace(/\n/g, '<br/>')}
          </div>
          <br/>
          <p style="font-size: 12px; color: #999999;">Sent via LightAgent MCP</p>
        </div>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_USER,
        to,
        subject,
        html: htmlContent
      });
      return { content: [{ type: "text", text: `Email sent successfully: ${info.messageId}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Failed to send email: ${error.message}` }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
```

- [ ] **Step 3: Create Dockerfile for Email Sender**

```dockerfile
# MatrixNet/mcp-skills/email-sender/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "index.js"]
```

- [ ] **Step 4: Commit**

```bash
git add MatrixNet/mcp-skills/email-sender
git commit -m "feat: implement email sender MCP server"
```

### Task 3: Implement Xiaohongshu Publisher MCP Server

**Files:**
- Create: `MatrixNet/mcp-skills/xhs-publisher/package.json`
- Create: `MatrixNet/mcp-skills/xhs-publisher/index.js`
- Create: `MatrixNet/mcp-skills/xhs-publisher/Dockerfile`

- [ ] **Step 1: Initialize project and install dependencies**

```bash
mkdir -p MatrixNet/mcp-skills/xhs-publisher
cd MatrixNet/mcp-skills/xhs-publisher
npm init -y
npm install @modelcontextprotocol/sdk playwright
```

- [ ] **Step 2: Write the MCP server logic (Playwright Automation)**

```javascript
// MatrixNet/mcp-skills/xhs-publisher/index.js
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
      // Launch browser. Note: In docker, requires appropriate dependencies.
      browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
      const context = await browser.newContext();
      
      // Load cookies if available
      if (fs.existsSync('/app/cookies.json')) {
        const cookies = JSON.parse(fs.readFileSync('/app/cookies.json', 'utf-8'));
        await context.addCookies(cookies);
      } else {
        return { content: [{ type: "text", text: "Authentication cookies not found. Please provide cookies.json." }], isError: true };
      }

      const page = await context.newPage();
      await page.goto("https://creator.xiaohongshu.com/publish/publish");
      
      // Automation steps (simplified placeholders for actual selectors)
      // 1. Upload image
      const fileInput = await page.$('input[type="file"]');
      await fileInput.setInputFiles(image_path);
      
      // 2. Fill title
      await page.waitForSelector('.title-input');
      await page.fill('.title-input', title);
      
      // 3. Fill content
      await page.fill('.content-input', content);
      
      // 4. Click publish
      await page.click('.publish-btn');
      
      // Wait for success confirmation
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
```

- [ ] **Step 3: Create Dockerfile for XHS Publisher**

```dockerfile
# MatrixNet/mcp-skills/xhs-publisher/Dockerfile
FROM mcr.microsoft.com/playwright:v1.50.0-jammy
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "index.js"]
```

- [ ] **Step 4: Commit**

```bash
git add MatrixNet/mcp-skills/xhs-publisher
git commit -m "feat: implement xiaohongshu publisher MCP server using playwright"
```

### Task 4: Finalize Integration in Docker Compose

**Files:**
- Modify: `MatrixNet/docker-compose.yml`

- [ ] **Step 1: Add MCP skill services and configure MCP routing**

```yaml
# Add to MatrixNet/docker-compose.yml:
  email-sender-mcp:
    build: ./mcp-skills/email-sender
    container_name: email-sender-mcp
    restart: unless-stopped
    environment:
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}

  xhs-publisher-mcp:
    build: ./mcp-skills/xhs-publisher
    container_name: xhs-publisher-mcp
    restart: unless-stopped
    volumes:
      - ./xhs-cookies.json:/app/cookies.json
      - ./shared-images:/app/images # Shared volume for images
```

- [ ] **Step 2: Connect LightAgent to MCP Servers**
Depending on `light-agent`'s specific MCP connection method (HTTP SSE vs Stdio), configure it to talk to `email-sender-mcp` and `xhs-publisher-mcp`. If it uses `mcporter.json` (as seen in OpenClaw/LightAgent ecosystems):

```json
// MatrixNet/light-agent-config/mcporter.json
{
  "mcpServers": {
    "email_skill": {
      "command": "docker",
      "args": ["exec", "-i", "email-sender-mcp", "node", "index.js"]
    },
    "xhs_skill": {
      "command": "docker",
      "args": ["exec", "-i", "xhs-publisher-mcp", "node", "index.js"]
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add MatrixNet/docker-compose.yml MatrixNet/light-agent-config
git commit -m "feat: finalize light-agent and MCP skills integration in docker-compose"
```
