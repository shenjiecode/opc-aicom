const rawText = ` {"msg": "您好！我是 BitBay OPC-AI 协作平台的客户管家 **比特 (bit)**，非常荣幸能为您服务！🎬\n\n短剧是一个非常热门的内容形式！不过在开始之前，我需要了解一些具体信息，以便为您提供更准确的方案：\n\n### 🤔 请帮我确认以下问题：\n\n1. **短剧类型**：您想做的是什么类型的短剧？\n   - 竖屏短剧（适合抖音、快手、视频号等平台）\n   - 横屏迷你剧（适合 B站、优爱腾等平台）\n   - 品牌定制剧 / 植入式短剧\n\n2. **目标受众**：主要面向哪些观众？\n   - 年轻群体（18-25岁）\n   - 中青年（25-40岁）\n   - 银发族（40岁以上）\n   - 特定兴趣圈层\n\n3. **题材方向**：您倾向于什么题材？\n   - 甜宠/言情\n   - 悬疑/推理\n   - 都市/职场\n   - 古装/穿越\n   - 搞笑/沙雕\n   - 励志/成长\n\n4. **集数和时长**：您计划做多长？\n\n5. **投?onst rawText = ` {"msg": "您好！我是 BitBay ?、快手、B站、视频号等）\n\n您可以先告诉我以上任意几条线索，我会继续帮您梳理需求！", "options": ["我想做抖音竖屏短剧，甜宠题材，大概30集，每集1-2分钟", "我想做品牌定制短剧，需要植入我们公司的产品", "我想拍一部悬疑推理类的横屏短剧，适合 B站 播出", "你先跟我说说，不同平台的短剧有什么区别？"]}`;

try {
  const startIndex = rawText.indexOf('{');
  const endIndex = rawText.lastIndexOf('}');
  const jsonStr = rawText.substring(startIndex, endIndex + 1);
  console.log("JSON STR", JSON.stringify(jsonStr));
  let parsed = JSON.parse(jsonStr);
  console.log("SUCCESS:", parsed.msg);
} catch (e) {
  console.error("FAIL:", e);
}
