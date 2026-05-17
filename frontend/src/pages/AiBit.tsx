import React, { useState, useEffect, useRef } from 'react';
import { Info, Send, Bot, Terminal, Sparkles, Crown, User, Download, FileText, Folder, File, ChevronDown, PlusCircle, Check, Square } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup } from '@/components/ui/dropdown-menu';

// ============================================
// 日志系统 - 记录完整流程到 localStorage
// ============================================
interface LogEntry {
  timestamp: string;
  phase: 'CONNECTION' | 'SESSION' | 'MESSAGE' | 'RENDER' | 'ERROR' | 'PARSE';
  action: string;
  data?: unknown;
  error?: string;
}

const LOG_STORAGE_KEY = 'aibit_debug_logs';
const MAX_LOG_ENTRIES = 500;

const logger = {
  logs: [] as LogEntry[],
  
  init() {
    // 从 localStorage 恢复日志
    try {
      const stored = localStorage.getItem(LOG_STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (e) {
      this.logs = [];
    }
  },
  
  log(phase: LogEntry['phase'], action: string, data?: unknown) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      phase,
      action,
      data
    };
    this.logs.push(entry);
    
    // 限制日志条数
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs = this.logs.slice(-MAX_LOG_ENTRIES);
    }
    
    // 同步到 localStorage
    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.logs));
    } catch (e) {
      console.error('Failed to save logs:', e);
    }
    
    // 同时输出到控制台
    console.log(`[${phase}] ${action}`, data !== undefined ? data : '');
  },
  
  error(phase: LogEntry['phase'], action: string, error: unknown) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      phase,
      action,
      error: String(error)
    };
    this.logs.push(entry);
    
    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.logs));
    } catch (e) {
      console.error('Failed to save logs:', e);
    }
    
    console.error(`[${phase}] ${action}`, error);
  },
  
  export(): string {
    return JSON.stringify(this.logs, null, 2);
  },
  
  clear() {
    this.logs = [];
    localStorage.removeItem(LOG_STORAGE_KEY);
  }
};

// 初始化日志系统
logger.init();

// ============================================
// 类型定义
// ============================================
interface Part {
  type?: string;
  text?: string;
  options?: string[];
  [key: string]: unknown;
}

interface MessageInfo {
  role: string;
  createdAt?: string;
  [key: string]: unknown;
}

interface OpenCodeProvider {
  id: string;
  name: string;
  models: { id: string; name: string }[];
}

interface ProviderResponse {
  all: { id: string; name: string; models: Record<string, { id: string; name: string }> }[];
  default: { [category: string]: string };
  connected: string[];
}

const GUZHUANG_DRAMA_PRD = `我已为你创建了完整的项目需求文档，文件已保存：

📄 **古装贵女重生短剧_PRD_报价单.docx**

---

## 📋 文档内容概览

### 一、项目基本信息
- **项目名称**：古装贵女重生复仇短剧
- **类型**：竖屏微短剧（9:16）
- **规格**：30集 × 1-1.5分钟/集
- **总预算**：**8-10万元**

### 二、核心定位
- **题材**：古装 / 重生 / 复仇 / 逆袭
- **爽点**：重生预知、打脸仇人、智商在线、甜虐交织
- **目标受众**：18-45岁女性用户

### 三、制作方案
| 项目 | 配置 |
|------|------|
| 拍摄地点 | 横店影视城 |
| 场景数 | 4-5个（闺房、大堂、花园、街道等）|
| 拍摄周期 | 7天 |
| 演员配置 | 双主演+4-5配角 |
| 服化道 | 精品古装+定制头饰 |

### 四、费用明细（8-10万区间）
- 导演：1.0-1.4万
- 摄影灯光：1.0-1.4万
- 双主演：1.4-2.1万
- 配角群演：1.0-1.8万
- 场地+服化道：1.0-1.6万
- 后期制作：0.8-1.2万
- 差旅杂费：1.1-1.4万

### 五、时间规划
- **筹备期**：2-3周
- **拍摄期**：7天
- **后期期**：2-3周
- **交付期**：1周
- **总周期**：约 **6-8周**`;

interface ChatMessage {
  info: MessageInfo;
  parts: Part[];
}

const OPENCODE_BASE_URL = 'https://ai.sjtyy.top';

// ============================================
// JSON 解析器 - 带详细日志
// ============================================
const parseModelResponse = (rawText: string | undefined, msgIndex: number): { text: string, options?: string[], rawParsed?: any } => {
  logger.log('PARSE', `开始解析消息 #${msgIndex}`, { 
    rawTextLength: rawText?.length || 0,
    rawTextPreview: rawText?.substring(0, 200) 
  });
  
  if (!rawText) {
    logger.log('PARSE', `消息 #${msgIndex} 为空，返回空文本`);
    return { text: '' };
  }
  
  try {
    let jsonStr = rawText;
    
    // 查找 JSON 对象
    const startIndex = rawText.indexOf('{');
    const endIndex = rawText.lastIndexOf('}');
    
    logger.log('PARSE', `JSON 边界检测`, { startIndex, endIndex });
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      jsonStr = rawText.substring(startIndex, endIndex + 1);
      logger.log('PARSE', `提取 JSON 片段`, { jsonStrPreview: jsonStr.substring(0, 100) });
      
      // 尝试标准解析
      try {
        const parsed = JSON.parse(jsonStr);
        logger.log('PARSE', `标准解析成功`, { parsed });
        
        if (parsed && typeof parsed.msg === 'string') {
          logger.log('PARSE', `提取 msg 字段成功`, { msg: parsed.msg, options: parsed.options });
          return { 
            text: parsed.msg, 
            options: Array.isArray(parsed.options) ? parsed.options : undefined,
            rawParsed: parsed
          };
        }
      } catch (parseError) {
        logger.log('PARSE', `标准解析失败，尝试清理`, { error: String(parseError) });
        
        let cleaned = jsonStr;
        
        // 查找内部 JSON
        const innerStart = cleaned.indexOf('{"msg":');
        const innerEnd = cleaned.lastIndexOf('}');
        if (innerStart !== -1 && innerEnd !== -1 && innerEnd > innerStart) {
          cleaned = cleaned.substring(innerStart, innerEnd + 1);
          logger.log('PARSE', `提取内部 JSON`, { cleanedPreview: cleaned.substring(0, 100) });
        }
        
        // 移除包裹的引号
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
          cleaned = cleaned.substring(1, cleaned.length - 1);
          logger.log('PARSE', `移除外层引号`);
        }
        
        // 反转义
        cleaned = cleaned.replace(/\\"/g, '"').replace(/\\\\n/g, '\\n');
        
        // 清理未转义的换行符
        let inString = false;
        let sanitized = '';
        for (let i = 0; i < cleaned.length; i++) {
          const c = cleaned[i];
          if (c === '"' && (i === 0 || cleaned[i - 1] !== '\\')) {
            inString = !inString;
          }
          if (c === '\n') {
            sanitized += inString ? '\\n' : '';
          } else if (c === '\r') {
            sanitized += inString ? '\\r' : '';
          } else if (c === '\t') {
            sanitized += inString ? '\\t' : '';
          } else {
            sanitized += c;
          }
        }
        
        try {
          const parsed = JSON.parse(sanitized);
          logger.log('PARSE', `清理后解析成功`, { parsed });
          
          if (parsed && typeof parsed.msg === 'string') {
            return { 
              text: parsed.msg, 
              options: Array.isArray(parsed.options) ? parsed.options : undefined,
              rawParsed: parsed
            };
          }
        } catch (innerErr) {
          logger.error('PARSE', `清理后解析仍失败`, innerErr);
        }
      }
    }
  } catch (e) {
    logger.error('PARSE', `解析过程异常`, e);
  }
  
  // 解析失败，返回原始文本
  const displayText = rawText.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  logger.log('PARSE', `解析失败，返回清理后的原始文本`, { displayText: displayText.substring(0, 100) });
  return { text: displayText, rawParsed: null };
};

// A shared function to process message arrays
const processMessages = (messagesData: any[]): ChatMessage[] => {
  logger.log('RENDER', `开始处理消息数组`, { 
    messageCount: messagesData.length,
    firstMessageRole: messagesData[0]?.info?.role 
  });
  
  return messagesData.map((msg: any, index: number) => {
    logger.log('RENDER', `处理消息 #${index}`, {
      role: msg.info?.role,
      partsCount: msg.parts?.length,
      partsTypes: msg.parts?.map((p: any) => p.type)
    });
    
    if (msg.info?.role === 'assistant' && msg.parts && msg.parts.length > 0) {
      let targetText = '';
      
      // 记录所有 parts 的详细信息
      msg.parts.forEach((p: any, i: number) => {
        logger.log('RENDER', `消息 #${index} Part[${i}]`, {
          type: p.type,
          textPreview: p.text?.substring(0, 100),
          hasOptions: !!p.options
        });
      });
      
      // 用户明确要求优先使用 parts[2]
      if (msg.parts.length > 2 && msg.parts[2].text) {
        targetText = msg.parts[2].text;
        logger.log('RENDER', `消息 #${index} 使用 parts[2]`, { textPreview: targetText.substring(0, 100) });
      } else {
        // 回退到最后一个 part
        targetText = msg.parts[msg.parts.length - 1].text;
        logger.log('RENDER', `消息 #${index} 使用最后一个 part`, { 
          partsIndex: msg.parts.length - 1,
          textPreview: targetText?.substring(0, 100) 
        });
      }

      const { text, options, rawParsed } = parseModelResponse(targetText, index);
      
      logger.log('RENDER', `消息 #${index} 解析完成`, {
        finalTextPreview: text.substring(0, 100),
        hasOptions: !!options,
        optionsCount: options?.length,
        parseSuccess: !!rawParsed
      });
      
      return {
        ...msg,
        parts: [{ type: 'text', text, options }]
      };
    }
    return msg;
  });
};

// ============================================
// 主组件
// ============================================
const AiBit: React.FC = () => {
  const navigate = useNavigate();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const [inputValue, setInputValue] = useState('');
  const [providers, setProviders] = useState<OpenCodeProvider[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState<{status: 'connected' | 'error' | 'disconnected', version?: string, url?: string} | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uiLogLines, setUiLogLines] = useState<string[]>([]);
  const [prdFiles, setPrdFiles] = useState<{name: string, size: number, modTime: string}[]>([]);
  const [selectedPrd, setSelectedPrd] = useState<string | null>(null);
  const [prdContent, setPrdContent] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 添加 UI 日志行
  const addUILog = (line: string) => {
    setUiLogLines(prev => [...prev.slice(-50), `[${new Date().toLocaleTimeString('en-US', {hour12: false})}] ${line}`]);
  };

  // 导出日志文件
  const handleExportLogs = () => {
    const logData = logger.export();
    const blob = new Blob([logData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aibit_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 加载 PRD 文件列表
  const fetchPrdFiles = async () => {
    try {
      const res = await axios.get('/api/prds');
      if (res.data && Array.isArray(res.data)) {
        setPrdFiles(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch PRDs:', err);
    }
  };

  useEffect(() => {
    fetchPrdFiles();
  }, []);

  const handleSelectPrd = async (filename: string) => {
    try {
      const res = await axios.get(`/api/prds/${filename}`);
      setPrdContent(res.data);
      setSelectedPrd(filename);
    } catch (err) {
      console.error('Failed to load PRD content:', err);
    }
  };

  // 生成测试 PRD 文件（模拟后台自动生成）
  const generateMockPrd = async () => {
    try {
      const mockContent = `# 项目需求文档 (PRD)

### 1. 项目概述
本项目旨在根据甲方沟通的初步意向，设计并开发相关产物。目前正在进行需求边界的界定与确认。

### 2. 核心需求清单
* 受众定位：精准投放目标用户群体
* 风格偏好：按照沟通确认的基调执行
* 交付标准：符合平台及行业规范
* 内容素材：需进一步确认由哪方提供

### 3. 预算与周期预估
根据当前需求复杂度，系统正在智能评估开发周期与所需积分，待需求完全明确后生成最终报价单。
`;
      await axios.post('/api/prds', {
        content: mockContent
      });
      fetchPrdFiles();
    } catch (err) {
      console.error('Failed to generate PRD:', err);
    }
  };

  // 创建新会话
  const createNewSession = async () => {
    setIsLoading(true);
    try {
      addUILog('🆕 手动创建新会话...');
      logger.log('SESSION', '手动创建新会话', { title: 'bit-chat' });
      
      const createRes = await axios.post(`${OPENCODE_BASE_URL}/session`, { title: 'bit-chat' });
      
      if (createRes.data && createRes.data.id) {
        const newId = createRes.data.id;
        setSessionId(newId);
        localStorage.setItem('opencode_bit_session_id', newId);
        setMessages([]); // 清空当前消息列表
        addUILog(`✅ 新会话创建成功: ${newId.substring(0, 12)}...`);
      }
    } catch (error) {
      logger.error('SESSION', '手动创建会话失败', error);
      addUILog(`❌ 创建会话失败: ${String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Default welcome message
  const defaultMessage: ChatMessage = {
    info: { role: 'model' },
    parts: [{
      type: 'text',
      text: 'Hi! 我是您的AI服务管家「比特」。请简单描述项目需求（如：海报/短视频/软件开发/短剧等），我会帮您生成标准需求文档并智能定价，然后为您匹配OPC服务方。',
      options: ['我想做一部短剧', '帮我写个前端代码', '帮我生成几张海报']
    }]
  };

  // ============================================
  // Phase 1: 初始化会话
  // ============================================
  useEffect(() => {
    logger.log('SESSION', '开始初始化会话');
    addUILog('🚀 开始初始化会话...');
    
    const initSession = async () => {
      try {
        // 检查本地存储的 sessionId
        const storedSessionId = localStorage.getItem('opencode_bit_session_id');
        logger.log('SESSION', '检查本地存储', { storedSessionId });
        
        if (storedSessionId) {
          logger.log('SESSION', '使用本地存储的 sessionId', { sessionId: storedSessionId });
          addUILog(`✅ 使用本地会话: ${storedSessionId.substring(0, 12)}...`);
          setSessionId(storedSessionId);
          return;
        }

        // 获取现有会话列表
        addUILog('📡 获取远程会话列表...');
        logger.log('SESSION', '请求会话列表', { url: `${OPENCODE_BASE_URL}/session` });
        
        const res = await axios.get(`${OPENCODE_BASE_URL}/session`);
        logger.log('SESSION', '会话列表响应', { 
          status: res.status,
          sessionCount: res.data?.length,
          sessions: res.data?.map((s: any) => ({ id: s.id, title: s.title }))
        });
        
        if (res.data && Array.isArray(res.data)) {
          const existingSession = res.data.find((s: {id: string, title: string}) => s.title === 'bit-chat');
          
          if (existingSession && existingSession.id) {
            logger.log('SESSION', '找到现有 bit-chat 会话', { sessionId: existingSession.id });
            addUILog(`✅ 找到现有会话: ${existingSession.id.substring(0, 12)}...`);
            setSessionId(existingSession.id);
            localStorage.setItem('opencode_bit_session_id', existingSession.id);
            return;
          }
        }
        
        // 创建新会话
        addUILog('🆕 创建新会话...');
        logger.log('SESSION', '创建新会话', { title: 'bit-chat' });
        
        const createRes = await axios.post(`${OPENCODE_BASE_URL}/session`, { title: 'bit-chat' });
        logger.log('SESSION', '新会话创建成功', { 
          sessionId: createRes.data?.id,
          response: createRes.data
        });
        
        addUILog(`✅ 新会话创建成功: ${createRes.data?.id?.substring(0, 12)}...`);
        
        if (createRes.data && createRes.data.id) {
          setSessionId(createRes.data.id);
          localStorage.setItem('opencode_bit_session_id', createRes.data.id);
        }
      } catch (error) {
        logger.error('SESSION', '初始化会话失败', error);
        addUILog(`❌ 会话初始化失败: ${String(error)}`);
        // Fallback
        setSessionId('bit-chat');
      }
    };
    
    initSession();
  }, []);

  // ============================================
  // Phase 2: 健康检查 + 加载历史消息
  // ============================================
  useEffect(() => {
    if (!sessionId) return;

    logger.log('CONNECTION', '开始连接检查和消息加载', { sessionId });
    addUILog(`🔗 开始连接检查 (sessionId: ${sessionId.substring(0, 12)}...)`);

    // 加载历史消息
    const fetchMessages = async () => {
      try {
        addUILog('📥 加载历史消息...');
        logger.log('MESSAGE', '请求历史消息', { url: `${OPENCODE_BASE_URL}/session/${sessionId}/message` });
        
        const res = await axios.get(`${OPENCODE_BASE_URL}/session/${sessionId}/message`);
        
        logger.log('MESSAGE', '历史消息响应', {
          status: res.status,
          dataType: typeof res.data,
          isArray: Array.isArray(res.data),
          dataLength: Array.isArray(res.data) ? res.data.length : 'N/A',
          dataPreview: JSON.stringify(res.data).substring(0, 500)
        });
        
        if (res.data) {
          let historyData = res.data;
          
          // 处理可能的嵌套数据
          if (!Array.isArray(historyData) && historyData.data && Array.isArray(historyData.data)) {
            historyData = historyData.data;
            logger.log('MESSAGE', '解包嵌套数据', { unpackedLength: historyData.length });
          }
          
          if (Array.isArray(historyData)) {
            addUILog(`✅ 加载了 ${historyData.length} 条历史消息`);
            logger.log('MESSAGE', '处理历史消息数组', { messageCount: historyData.length });
            
            const processedHistory = processMessages(historyData);
            setMessages(processedHistory);
            
            logger.log('RENDER', '历史消息渲染完成', { 
              processedCount: processedHistory.length,
              messages: processedHistory.map(m => ({ role: m.info.role, partsCount: m.parts.length }))
            });
          }
        }
      } catch (error) {
        logger.error('MESSAGE', '加载历史消息失败', error);
        addUILog(`❌ 加载历史消息失败: ${String(error)}`);
      }
    };
    
    // 健康检查
    const fetchStatus = async () => {
      try {
        logger.log('CONNECTION', '健康检查请求', { url: `${OPENCODE_BASE_URL}/global/health` });
        
        const res = await axios.get(`${OPENCODE_BASE_URL}/global/health`);
        
        logger.log('CONNECTION', '健康检查响应', {
          status: res.status,
          healthy: res.data?.healthy,
          version: res.data?.version
        });
        
        if (res.status === 200 && res.data.healthy) {
          setModelStatus({ status: 'connected', version: res.data.version, url: OPENCODE_BASE_URL });
          addUILog(`✅ 连接正常 (v${res.data.version})`);
        } else {
          setModelStatus({ status: 'error' });
          addUILog(`⚠️ 服务异常`);
        }
      } catch (error) {
        logger.error('CONNECTION', '健康检查失败', error);
        setModelStatus({ status: 'disconnected' });
        addUILog(`❌ 连接失败`);
      }
    };

    fetchMessages();
    fetchStatus();

    // 定期健康检查
    const statusInterval = setInterval(fetchStatus, 10000);

    return () => clearInterval(statusInterval);
  }, [sessionId]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Fetch available providers and models
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await axios.get<ProviderResponse>(`${OPENCODE_BASE_URL}/provider`);
        if (res.data && res.data.all) {
          // Convert models from object to array format
          const providersWithModels = res.data.all.map(p => ({
            ...p,
            models: Object.values(p.models || {})
          }));
          setProviders(providersWithModels);
          // Set default model from connected providers
          if (providersWithModels.length > 0) {
            // Get first default model from the default object (format: { providerId: modelId })
            const defaultEntries = Object.entries(res.data.default || {});
            if (defaultEntries.length > 0) {
              const [providerId, modelId] = defaultEntries[0];
              setSelectedModel(`${providerId}/${modelId}`);
            } else if (providersWithModels[0]?.models?.[0]) {
              setSelectedModel(`${providersWithModels[0].id}/${providersWithModels[0].models[0].id}`);
            }
          }
          addUILog(`✅ 加载了 ${providersWithModels.length} 个模型提供商`);
        }
      } catch (err) {
        console.error('Failed to fetch providers:', err);
        addUILog('❌ 获取模型列表失败');
      }
    };
    fetchProviders();
  }, []);

  // ============================================

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setIsLoading(false);
  };

  // Phase 3: 发送消息
  // ============================================
  const handleSend = async (textToSend?: string | React.MouseEvent | React.KeyboardEvent) => {
    const text = typeof textToSend === 'string' ? textToSend : inputValue;
    if (!text.trim() || isLoading || !sessionId) return;

    const messageText = text.trim();
    logger.log('MESSAGE', '用户发送消息', { text: messageText, sessionId });
    addUILog(`📤 发送消息: "${messageText.substring(0, 30)}..."`);

    const userMessage: ChatMessage = {
      info: { role: 'user', createdAt: new Date().toISOString() },
      parts: [{ type: 'text', text: messageText }]
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const requestBody = {
        parts: [{ type: 'text', text: userMessage.parts[0].text }],
        model: selectedModel ? { providerID: selectedModel.split('/')[0], modelID: selectedModel.split('/').slice(1).join('/') } : undefined,
      };

      logger.log('MESSAGE', '发送 API 请求', {
        url: `${OPENCODE_BASE_URL}/session/${sessionId}/message`,
        body: requestBody
      });

      const res = await axios.post(`${OPENCODE_BASE_URL}/session/${sessionId}/message`, requestBody, {
        signal: abortControllerRef.current?.signal
      });

      logger.log('MESSAGE', 'API 响应接收', {
        status: res.status,
        responseType: typeof res.data,
        responseKeys: res.data ? Object.keys(res.data) : [],
        responseData: JSON.stringify(res.data).substring(0, 1000)
      });
      
      addUILog(`📥 收到响应 (${res.status})`);

      if (res.data && (Array.isArray(res.data) || res.data.data || res.data.info)) {
        // 分析响应结构
        const hasInfo = !!res.data.info;
        const hasParts = !!res.data.parts;
        const partsLength = res.data.parts?.length || 0;
        
        logger.log('MESSAGE', '响应结构分析', {
          hasInfo,
          hasParts,
          partsLength,
          infoRole: res.data.info?.role,
          partsTypes: res.data.parts?.map((p: any) => p.type)
        });
        
        setMessages((prev) => {
          let messagesToProcess: any[] = [];
          
          let responseData = res.data;
          // Handle { data: [...] } wrapper if exists
          if (!Array.isArray(responseData) && responseData.data && Array.isArray(responseData.data)) {
            responseData = responseData.data;
          }
          
          if (Array.isArray(responseData)) {
            // The API returned the full history
            messagesToProcess = responseData;
          } else if (responseData.info && responseData.parts) {
            // API 返回了完整的消息对象
            messagesToProcess = [
              ...prev.slice(0, -1), 
              { info: { role: 'user', createdAt: new Date().toISOString() }, parts: [{ text: messageText }] }, 
              responseData
            ];
            
            logger.log('MESSAGE', '构建处理队列', {
              queueLength: messagesToProcess.length,
              lastMessageRole: responseData.info.role
            });
          }
          
          if (messagesToProcess.length > 0) {
            addUILog(`🔄 处理 ${messagesToProcess.length} 条消息`);
            return processMessages(messagesToProcess);
          }
          return prev;
        });
      } else {
        throw new Error('收到空响应或无效的会话，请尝试新建对话');
      }
    } catch (error) {
      logger.error('MESSAGE', '发送消息失败', error);
      addUILog(`❌ 发送失败: ${String(error)}`);
      
      const fallbackMsg: ChatMessage = {
        info: { role: 'model', createdAt: new Date().toISOString() },
        parts: [{ type: 'text', text: '抱歉，我现在无法连接到服务器。请稍后再试。' }]
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsStreaming(false);
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderSimpleMarkdown = (text: string): React.ReactNode => {
    const lines = text.split('\n');
    return (
      <>
        {lines.map((line, i) => {
          // 标题
          if (line.startsWith('### ')) return <h3 key={i} className="text-base font-bold text-slate-800 mt-4 mb-2">{line.replace('### ', '')}</h3>;
          if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-slate-900 mt-5 mb-2">{line.replace('## ', '')}</h2>;
          // 分割线
          if (line.trim() === '---') return <hr key={i} className="my-4 border-slate-200" />;
          // 表格行
          if (line.startsWith('|') && line.endsWith('|')) {
            const cells = line.split('|').filter(c => c.trim());
            if (cells.every(c => c.trim().match(/^[-]+$/))) return null;
            return <div key={i} className="flex gap-4 py-1 text-sm"><span className="flex-1 text-slate-500">{cells[0]?.trim()}</span><span className="flex-1 text-slate-700 font-medium">{cells[1]?.trim()}</span></div>;
          }
          // 列表项
          if (line.startsWith('- ')) {
            const content = line.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            return <div key={i} className="flex items-start gap-2 text-sm text-slate-700 ml-2"><span className="text-emerald-500 mt-1">•</span><span dangerouslySetInnerHTML={{ __html: content }} /></div>;
          }
          // 普通文本
          const content = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900">$1</strong>');
          return <p key={i} className="text-sm text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: content }} />;
        })}
      </>
    );
  };

  const handlePublishTask = async () => {
    if (!selectedPrd) return;
    setIsPublishing(true);
    try {
      // 获取任务名 = 左侧文件名 + 需求
      const taskTitle = `${selectedPrd.replace(/_PRD$/, '')}需求`;
      
      // 调用后端创建任务 API
      await axios.post('/api/task/create', {
        title: taskTitle,
        description: prdContent,
        budget: 80000,  // 8-10万区间
        type: '短剧',
        level: 'advanced',
      }, { withCredentials: true });
      
      // 跳转到任务中心
      navigate('/tasks');
    } catch (err) {
      console.error('Failed to publish task:', err);
      alert('发布任务失败，请稍后重试');
    } finally {
      setIsPublishing(false);
    }
  };

  const displayMessages = messages.length > 0 ? messages : [defaultMessage];

  return (
    <div className="absolute inset-0 bg-slate-50 flex flex-col overflow-hidden">
      
      {/* 顶部导航 / Header Area */}
      <div className="shrink-0 w-full px-6 py-4 flex items-center justify-between z-10 bg-slate-50 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800">AI比特</h1>
          <p className="text-sm text-slate-500 mt-1">您的专属智能助理与服务管家</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 md:p-8 flex flex-col lg:flex-row gap-6 max-w-[1600px] mx-auto w-full min-h-0 overflow-hidden">
          
          {/* Left Column: Chat Interface */}
          <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-0 relative">
            
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-white/50 backdrop-blur-sm z-10 shrink-0">
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4 text-slate-400" />
                <h2 className="text-base font-bold text-slate-800">与AI管家「比特」沟通</h2>
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={createNewSession}
                  className="flex items-center text-slate-500 hover:text-emerald-600 transition-colors"
                  title="新建对话"
                >
                  <PlusCircle className="w-5 h-5" />
                </button>
                <div className="flex items-center px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-full border border-emerald-100">
                  <Sparkles className="w-3 h-3 mr-1" />
                  智能需求转译
                </div>
              </div>
            </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth scrollbar-thin">
            {displayMessages.map((msg, index) => {
              const isUser = msg.info.role === 'user';
              const timeString = msg.info.createdAt ? new Date(msg.info.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
              
              return (
                <div key={index} className={`flex items-start space-x-4 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse space-x-reverse' : ''}`}>
                  {!isUser ? (
                    <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center shrink-0 shadow-sm relative">
                      <span className="text-white text-sm font-bold">比特</span>
                      <div className="absolute -top-1 -right-1 bg-white rounded-full p-[2px] shadow-sm">
                        <Crown className="w-3 h-3 text-amber-500" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center shrink-0 shadow-sm">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                  
                  <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center space-x-2 mb-1 px-1">
                      <span className="text-xs font-medium text-slate-500 flex items-center">
                        {!isUser && <Bot className="w-3 h-3 mr-1" />}
                        {isUser ? '我' : '比特管家'}
                      </span>
                    </div>
                    <div className={`border shadow-sm p-4 text-sm leading-relaxed relative ${
                      isUser 
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-900 rounded-2xl rounded-tr-sm' 
                        : 'bg-white border-slate-100 text-slate-700 rounded-2xl rounded-tl-sm'
                    }`}>
                      {msg.parts.map((p, i) => (
                        <div key={i}>
                          <div className="whitespace-pre-wrap">{p.text}</div>
                          
                          {p.options && p.options.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {p.options.map((opt: string, optIdx: number) => (
                                <button
                                  key={optIdx}
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleSend(opt);
                                  }}
                                  className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-100 hover:border-emerald-500 rounded-lg text-sm font-medium transition-colors shadow-sm"
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}

                        </div>
                      ))}
                    </div>
                    <span className="text-[11px] text-slate-400 mt-2 px-1">{timeString}</span>
                  </div>
                </div>
              );
            })}
            
            {isLoading && (
              <div className="flex items-start space-x-4 max-w-[85%]">
                <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center shrink-0 shadow-sm relative">
                  <span className="text-white text-sm font-bold">比特</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center space-x-2 mb-1 px-1">
                    <span className="text-xs font-medium text-slate-500 flex items-center">
                      <Bot className="w-3 h-3 mr-1" /> 比特管家
                    </span>
                  </div>
                  <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tl-sm p-4 text-sm text-slate-700 flex items-center space-x-2">
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 bg-white border-t border-slate-100">
            <div className="flex items-center space-x-3 bg-white border border-slate-200 rounded-full p-2 pl-4 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-sm">
              {/* Model Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-sm text-slate-600 transition-colors shrink-0 outline-none">
                  <Bot className="w-4 h-4" />
                  <span className="truncate max-w-[100px]">{selectedModel?.split('/').pop() || '选择模型'}</span>
                  <ChevronDown className="w-3 h-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 bg-slate-900/95 backdrop-blur-md border-slate-800 text-slate-100 shadow-xl max-h-[400px] overflow-y-auto z-[100] outline-none">
                  {providers.map((provider) => (
                    <DropdownMenuGroup key={provider.id}>
                      <DropdownMenuLabel className="text-slate-400 font-medium text-xs px-2 py-1.5">{provider.name}</DropdownMenuLabel>
                      {provider.models?.map((model) => (
                        <DropdownMenuItem
                          key={`${provider.id}/${model.id}`}
                          onClick={() => setSelectedModel(`${provider.id}/${model.id}`)}
                          className={`flex items-center px-2 py-1.5 cursor-pointer rounded-sm outline-none transition-colors ${selectedModel === `${provider.id}/${model.id}` ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-800 text-slate-200 focus:bg-slate-800 focus:text-slate-200'}`}
                        >
                          <span className="truncate flex-1">{model.name}</span>
                          {selectedModel === `${provider.id}/${model.id}` && <Check className="w-4 h-4 ml-2 shrink-0 text-emerald-400" />}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator className="bg-slate-800 my-1" />
                    </DropdownMenuGroup>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="例如：我需要一套科技感小红书海报，3张..."
                className="flex-1 bg-transparent border-none focus:outline-none text-sm text-slate-700 placeholder:text-slate-400"
                disabled={isLoading && !isStreaming}
              />
              {(isLoading || isStreaming) ? (
                <button onClick={handleStop} className="w-9 h-9 rounded-full bg-slate-800 hover:bg-red-600 text-white flex items-center justify-center transition-colors shrink-0">
                  <Square className="w-3.5 h-3.5" fill="currentColor" />
                </button>
              ) : (
                <button 
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-emerald-500 hover:text-white text-slate-400 flex items-center justify-center transition-colors shrink-0 disabled:opacity-50 disabled:hover:bg-slate-100 disabled:hover:text-slate-400"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
          </div>
          </div>
        </div>

        {/* Right Column: PRD & Status */}
        <div className="w-full lg:w-[450px] xl:w-[500px] flex flex-col gap-6 min-h-0">
          
          {/* PRD Artifact - Directory View */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center">
                <Folder className="w-5 h-5 text-emerald-600 mr-2" />
                <h2 className="text-base font-bold text-slate-800">项目产物目录</h2>
              </div>
              <div className="flex items-center space-x-2">
                {messages.length > 2 && prdFiles.length === 0 && (
                  <button 
                    onClick={generateMockPrd}
                    className="text-xs px-2 py-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-colors"
                  >
                    生成文档
                  </button>
                )}
                <button className="text-slate-400 hover:text-emerald-600 transition-colors" title="下载所有">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              {/* Directory Sidebar */}
              <div className="w-1/3 min-w-[160px] max-w-[200px] border-r border-slate-100 bg-slate-50/50 overflow-y-auto p-3">
                <div className="flex items-center text-sm font-semibold text-slate-700 mb-3 px-2">
                  <ChevronDown className="w-4 h-4 mr-1 text-slate-400" />
                  PRD_Documents
                </div>
                <div className="space-y-1">

                  {/* 硬编码的示例产物 */}
                  <button
                    onClick={() => { setSelectedPrd('古装贵女重生短剧_PRD'); setPrdContent(GUZHUANG_DRAMA_PRD); }}
                    className={`w-full flex items-center text-left px-2 py-2 rounded-lg text-sm transition-colors ${
                      selectedPrd === '古装贵女重生短剧_PRD'
                        ? 'bg-emerald-100 text-emerald-800 font-medium'
                        : 'text-slate-600 hover:bg-slate-200/50'
                    }`}
                  >
                    <File className={`w-4 h-4 mr-2 shrink-0 ${selectedPrd === '古装贵女重生短剧_PRD' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="truncate">古装贵女重生短剧_PRD</span>
                  </button>

                  {prdFiles.map((file, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectPrd(file.name)}
                      className={`w-full flex items-center text-left px-2 py-2 rounded-lg text-sm transition-colors ${
                        selectedPrd === file.name 
                          ? 'bg-emerald-100 text-emerald-800 font-medium' 
                          : 'text-slate-600 hover:bg-slate-200/50'
                      }`}
                    >
                      <File className={`w-4 h-4 mr-2 shrink-0 ${selectedPrd === file.name ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="truncate" title={file.name}>{file.name}</span>
                    </button>
                  ))}
                  {prdFiles.length === 0 && (
                    <div className="px-2 py-4 text-xs text-slate-400 text-center">
                      暂无文件生成
                    </div>
                  )}
                </div>
              </div>

              {/* File Content Preview */}
              <div className="flex-1 overflow-y-auto bg-white p-6">
                {selectedPrd ? (
                  <div className="prose prose-sm prose-slate max-w-none">
                    <div className="flex items-center text-sm text-slate-400 mb-6 border-b pb-4">
                      <FileText className="w-4 h-4 mr-2" />
                      {selectedPrd}
                    </div>
                    {/* Render raw markdown as simple text for now, or could use react-markdown if installed */}
                    <div className="text-sm text-slate-700 leading-relaxed">
                      {renderSimpleMarkdown(prdContent)}
                    </div>
                    
                    {selectedPrd && (
                      <div className="mt-6 pt-4 border-t border-slate-100">
                        <button
                          onClick={handlePublishTask}
                          disabled={isPublishing}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isPublishing ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              发布中...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              发布任务
                            </>
                          )}
                        </button>
                        <p className="text-xs text-slate-400 text-center mt-2">
                          将在任务中心创建新任务
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <FileText className="w-12 h-12 mb-3 text-slate-200" />
                    <p className="text-sm font-medium text-slate-500">
                      {prdFiles.length > 0 ? '请选择左侧文件查看' : '需求尚未明确'}
                    </p>
                    <p className="text-xs mt-1.5 text-slate-400">
                      {prdFiles.length > 0 ? '预览区域' : '请在左侧与比特管家沟通需求'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Workflow Event Log */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-slate-800">AI协作事件流</h2>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={handleExportLogs}
                  className="p-1 hover:bg-slate-100 rounded transition-colors"
                  title="导出完整日志"
                >
                  <Download className="w-4 h-4 text-slate-400" />
                </button>
                <Terminal className="w-4 h-4 text-slate-400" />
              </div>
            </div>
            <div className="flex-1 p-4 bg-[#0f172a] text-emerald-400 font-mono text-xs overflow-y-auto leading-relaxed relative rounded-b-2xl scrollbar-dark">
              <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-[#0f172a] to-transparent z-10 pointer-events-none"></div>
              
              <div className="space-y-1 relative z-0">
                {/* 状态行 */}
                <div className="flex items-start">
                  <span className="text-slate-500 mr-2">&gt;</span>
                  <span className="text-slate-400 mr-2">[{new Date().toLocaleTimeString('en-US', {hour12: false})}]</span>
                  <span className="flex-1">
                    {modelStatus?.status === 'connected' ? (
                      <>
                        <span className="mr-1">✅</span>
                        <span className="text-slate-300">平台已就绪。</span>
                        <span className="text-emerald-400 font-semibold">{modelStatus.url}</span>
                        <span className="text-slate-500 ml-1">v{modelStatus.version}</span>
                      </>
                    ) : (
                      <>
                        <span className="mr-1">❌</span>
                        <span className="text-red-400 font-semibold">连接失败</span>
                        <span className="text-slate-500 ml-1">({modelStatus?.status || 'disconnected'})</span>
                      </>
                    )}
                  </span>
                </div>
                
                {/* 日志行 */}
                {uiLogLines.map((line, i) => (
                  <div key={i} className="flex items-start">
                    <span className="text-slate-500 mr-2">&gt;</span>
                    <span className="flex-1 text-slate-300">{line.split('] ')[1]}</span>
                  </div>
                ))}
                
                {/* 闪烁光标 */}
                <div className="flex items-start mt-2">
                  <span className="text-slate-500 mr-2">&gt;</span>
                  <span className="w-2 h-3 bg-emerald-500 animate-pulse mt-[2px]"></span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AiBit;
