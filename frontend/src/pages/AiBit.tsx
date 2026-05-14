import React, { useState, useEffect, useRef } from 'react';
import { Info, Send, Bot, ChevronRight, Terminal, Sparkles, Crown, User } from 'lucide-react';
import axios from 'axios';

interface Part {
  text: string;
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

const SESSION_ID = 'bit-chat';

const AiBit: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Default welcome message
  const defaultMessage: ChatMessage = {
    info: { role: 'model' },
    parts: [{ text: 'Hi! 我是您的AI服务管家「比特」。请简单描述项目需求（如：海报/短视频/软件开发/短剧等），我会帮您生成标准需求文档并智能定价，然后为您匹配OPC服务方。' }]
  };

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`/session/${SESSION_ID}/message`);
        if (res.data && Array.isArray(res.data)) {
          setMessages(res.data);
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };
    fetchMessages();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      info: { role: 'user', createdAt: new Date().toISOString() },
      parts: [{ text: inputValue }]
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await axios.post(`/session/${SESSION_ID}/message`, {
        parts: [{ text: userMessage.parts[0].text }]
      });
      if (res.data && res.data.info) {
        setMessages(prev => [...prev, res.data]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Fallback message for demo if API is not available
      const fallbackMsg: ChatMessage = {
        info: { role: 'model', createdAt: new Date().toISOString() },
        parts: [{ text: '抱歉，我现在无法连接到服务器。请稍后再试。' }]
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
    <div className="min-h-screen bg-[#f8fafc] w-full flex flex-col">
      {/* Header Area */}
      <div className="bg-white border-b border-slate-100 px-8 py-5 shrink-0 flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse"></div>
            <h1 className="text-xl font-bold text-emerald-900 tracking-tight">AI比特 · OPC-AI协作平台</h1>
          </div>
          <div className="flex items-center text-xs font-medium text-slate-500 mt-2 space-x-2">
            <span className="text-slate-700">B2B多智能体</span>
            <span className="text-slate-300">|</span>
            <span>需求</span>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span>AI管家撮合</span>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span>契约签约</span>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span>资金启动</span>
          </div>
        </div>
        
        <button className="flex items-center space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-semibold transition-colors border border-indigo-100/50">
          <span>比特 智能体 配置</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 md:p-8 flex flex-col lg:flex-row gap-6 max-w-[1600px] mx-auto w-full">
        
        {/* Left Column: Chat Interface */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[600px] relative">
          
          {/* Chat Header */}
          <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-white/50 backdrop-blur-sm z-10">
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
          <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30 space-y-6">
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
                        <div key={i}>{p.text}</div>
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

        {/* Right Column: Status & Logs */}
        <div className="w-full lg:w-[450px] xl:w-[500px] flex flex-col space-y-6">
          
          {/* OPC Match Source */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50">
              <h2 className="text-base font-bold text-slate-800">OPC 匹配源</h2>
            </div>
            <div className="p-6">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-sm text-slate-500 leading-relaxed">
                  等待甲方生成需求单后，小O将自动匹配最佳OPC服务方，并推送收款信息。
                </p>
              </div>
            </div>
          </div>

          {/* AI Workflow Event Log */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-1 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">AI协作事件流</h2>
              <Terminal className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1 p-6 bg-[#0f172a] text-emerald-400 font-mono text-xs overflow-y-auto leading-relaxed relative rounded-b-2xl">
              <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-[#0f172a] to-transparent z-10 pointer-events-none"></div>
              
              <div className="space-y-2 relative z-0">
                <div className="flex items-start">
                  <span className="text-slate-500 mr-2">&gt;</span>
                  <span className="text-slate-400 mr-2">[23:15:57]</span>
                  <span className="flex-1">
                    <span className="mr-1">✅</span>
                    <span className="text-slate-300">平台已就绪。比特管家已连接大模型：</span>
                    <span className="text-emerald-400 font-semibold">deepseek-v4-flash</span>
                    <span className="text-slate-500 ml-1">(状态：connected)</span>
                  </span>
                </div>
                {/* Blinking cursor */}
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