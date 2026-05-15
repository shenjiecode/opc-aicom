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