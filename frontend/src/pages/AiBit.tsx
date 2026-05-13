import React, { useState } from 'react';
import { Info, Send, Bot, ChevronRight, Terminal, Sparkles, Crown } from 'lucide-react';

const AiBit: React.FC = () => {
  const [inputValue, setInputValue] = useState('');

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
          <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30">
            <div className="flex items-start space-x-4 max-w-[85%]">
              <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center shrink-0 shadow-sm relative">
                <span className="text-white text-sm font-bold">比特</span>
                <div className="absolute -top-1 -right-1 bg-white rounded-full p-[2px] shadow-sm">
                  <Crown className="w-3 h-3 text-amber-500" />
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-2 mb-1 px-1">
                  <span className="text-xs font-medium text-slate-500 flex items-center">
                    <Bot className="w-3 h-3 mr-1" /> 比特管家
                  </span>
                </div>
                <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tl-sm p-4 text-sm text-slate-700 leading-relaxed relative">
                  Hi! 我是您的AI服务管家「比特」。请简单描述项目需求（如：海报/短视频/软件开发/短剧等），我会帮您生成标准需求文档并智能定价，然后为您匹配OPC服务方。
                </div>
                <span className="text-[11px] text-slate-400 mt-2 px-1">23:15</span>
              </div>
            </div>
          </div>

          {/* Chat Input */}
          <div className="p-4 bg-white border-t border-slate-100">
            <div className="flex items-center space-x-3 bg-white border border-slate-200 rounded-full p-2 pl-4 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-sm">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="例如：我需要一套科技感小红书海报，3张..."
                className="flex-1 bg-transparent border-none focus:outline-none text-sm text-slate-700 placeholder:text-slate-400"
              />
              <button className="w-9 h-9 rounded-full bg-slate-100 hover:bg-emerald-500 hover:text-white text-slate-400 flex items-center justify-center transition-colors shrink-0">
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