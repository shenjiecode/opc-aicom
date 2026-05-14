import React, { useState, useEffect, useRef } from 'react';
import { Info, Send, Bot, ChevronRight, Terminal, Sparkles, Crown, User, Download, FileText } from 'lucide-react';
import axios from 'axios';

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
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState<{status: 'connected' | 'error' | 'disconnected', version?: string, url?: string} | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uiLogLines, setUiLogLines] = useState<string[]>([]);
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

  // ============================================
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
        parts: [{ type: 'text', text: userMessage.parts[0].text }]
      };
      
      logger.log('MESSAGE', '发送 API 请求', {
        url: `${OPENCODE_BASE_URL}/session/${sessionId}/message`,
        body: requestBody
      });
      
      const res = await axios.post(`${OPENCODE_BASE_URL}/session/${sessionId}/message`, requestBody);

      logger.log('MESSAGE', 'API 响应接收', {
        status: res.status,
        responseType: typeof res.data,
        responseKeys: res.data ? Object.keys(res.data) : [],
        responseData: JSON.stringify(res.data).substring(0, 1000)
      });
      
      addUILog(`📥 收到响应 (${res.status})`);

      if (res.data) {
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
          
          if (res.data.info && res.data.parts) {
            // API 返回了完整的消息对象
            messagesToProcess = [
              ...prev.slice(0, -1), 
              { info: { role: 'user', createdAt: new Date().toISOString() }, parts: [{ text: messageText }] }, 
              res.data
            ];
            
            logger.log('MESSAGE', '构建处理队列', {
              queueLength: messagesToProcess.length,
              lastMessageRole: res.data.info.role
            });
          }
          
          if (messagesToProcess.length > 0) {
            addUILog(`🔄 处理 ${messagesToProcess.length} 条消息`);
            return processMessages(messagesToProcess);
          }
          return prev;
        });
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
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayMessages = messages.length > 0 ? messages : [defaultMessage];

  return (
    <div className="h-[calc(100vh-theme(spacing.16))] w-full bg-slate-50 flex flex-col relative overflow-hidden">
      
      {/* 顶部导航 / Header Area */}
      <div className="shrink-0 w-full px-6 py-4 flex items-center justify-between z-10 bg-slate-50">
        <div>
          <h1 className="text-xl font-bold text-slate-800">AI比特</h1>
          <p className="text-sm text-slate-500 mt-1">您的专属智能助理与服务管家</p>
        </div>
      </div>

      {/* Main Content Area */}
        <div className="flex-1 p-6 md:p-8 flex flex-col lg:flex-row gap-6 max-w-[1600px] mx-auto w-full overflow-hidden">
          
          {/* Left Column: Chat Interface */}
          <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden h-full relative">
            
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-white/50 backdrop-blur-sm z-10 shrink-0">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-slate-400" />
              <h2 className="text-base font-bold text-slate-800">与AI管家「比特」沟通</h2>
            </div>
            <div className="flex items-center px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-full border border-emerald-100">
              <Sparkles className="w-3 h-3 mr-1" />
              智能需求转译
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
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
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="例如：我需要一套科技感小红书海报，3张..."
                className="flex-1 bg-transparent border-none focus:outline-none text-sm text-slate-700 placeholder:text-slate-400"
                disabled={isLoading}
              />
              <button 
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-emerald-500 hover:text-white text-slate-400 flex items-center justify-center transition-colors shrink-0 disabled:opacity-50 disabled:hover:bg-slate-100 disabled:hover:text-slate-400"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: PRD & Status */}
        <div className="w-full lg:w-[450px] xl:w-[500px] flex flex-col space-y-6">
          
          {/* PRD Artifact */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-1 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center">
                <FileText className="w-4 h-4 text-emerald-600 mr-2" />
                <h2 className="text-base font-bold text-slate-800">需求PRD产物</h2>
              </div>
              <button className="text-slate-400 hover:text-emerald-600 transition-colors" title="下载文档">
                <Download className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto bg-white">
              {messages.length > 0 ? (
                <div className="prose prose-sm prose-slate max-w-none">
                  <h1 className="text-xl font-bold text-slate-800 mb-6 border-b pb-2">项目需求文档 (PRD)</h1>
                  
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">1. 项目概述</h3>
                  <p className="text-slate-600 mb-6 leading-relaxed">
                    本项目旨在根据甲方沟通的初步意向，设计并开发相关产物。目前正在进行需求边界的界定与确认。
                  </p>
                  
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">2. 核心需求清单</h3>
                  <ul className="list-disc pl-5 mb-6 text-slate-600 space-y-2">
                    <li>受众定位：精准投放目标用户群体</li>
                    <li>风格偏好：按照沟通确认的基调执行</li>
                    <li>交付标准：符合平台及行业规范</li>
                    <li>内容素材：需进一步确认由哪方提供</li>
                  </ul>

                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">3. 预算与周期预估</h3>
                  <p className="text-slate-600 mb-6 leading-relaxed">
                    根据当前需求复杂度，系统正在智能评估开发周期与所需积分，待需求完全明确后生成最终报价单。
                  </p>
                  
                  <div className="mt-8 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start">
                    <Sparkles className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-medium text-emerald-800 text-sm">文档实时生成中</h4>
                      <p className="text-xs text-emerald-600/80 mt-1.5 leading-relaxed">
                        随着您与「比特」的对话深入，这份需求文档将自动完善，最终生成可供开发执行的标准PRD。
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <FileText className="w-12 h-12 mb-3 text-slate-200" />
                  <p className="text-sm font-medium text-slate-500">需求尚未明确</p>
                  <p className="text-xs mt-1.5 text-slate-400">请在左侧与比特管家沟通需求</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AiBit;
