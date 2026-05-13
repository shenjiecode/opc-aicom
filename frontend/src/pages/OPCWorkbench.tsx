import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Bot, 
  Users, 
  Zap, 
  MessageSquare, 
  CheckCircle2, 
  Send,
  FileText,
  BarChart3,
  Sparkles,
  MoreHorizontal,
  TrendingUp,
  Brain
} from 'lucide-react';
import { cn } from '@/lib/utils';

// AI Team Members Data
const agents = [
  { id: 1, name: '战略分析师', role: 'Strategy Agent', color: 'bg-violet-500', icon: BarChart3, status: 'active' },
  { id: 2, name: '内容创作师', role: 'Content Writer', color: 'bg-amber-500', icon: FileText, status: 'waiting' },
  { id: 3, name: '设计排版师', role: 'Design Agent', color: 'bg-pink-500', icon: Sparkles, status: 'idle' },
  { id: 4, name: '社媒运营官', role: 'Social Media', color: 'bg-emerald-500', icon: MessageSquare, status: 'idle' },
  { id: 5, name: '研究助理', role: 'Research Agent', color: 'bg-cyan-500', icon: Brain, status: 'active' },
  { id: 6, name: '数据分析师', role: 'Data Analyst', color: 'bg-orange-500', icon: TrendingUp, status: 'idle' },
];

// Quick Workflows Data
const workflows = [
  { title: '发布行业洞察文章', icon: '📝', color: 'border-l-amber-500' },
  { title: '客户周报自动生成', icon: '📊', color: 'border-l-emerald-500' },
  { title: '竞品月度分析', icon: '🔍', color: 'border-l-violet-500' },
];

// Workflow Steps Data
const workflowSteps = [
  { id: 1, name: 'CEO 下达指令', status: 'completed', time: '14:30 完成' },
  { id: 2, name: '战略分析师 → 趋势扫描', status: 'in-progress', progress: 65 },
  { id: 3, name: '研究助理 → 案例搜集', status: 'in-progress', progress: 40 },
  { id: 4, name: '内容创作师 → 撰写文章', status: 'pending' },
  { id: 5, name: '设计排版师 → 制作配图', status: 'pending' },
  { id: 6, name: '社媒运营官 → 多平台分发', status: 'pending' },
];

// Team Stats Data
const teamStats = [
  { label: '活跃Agents', value: '6', color: 'text-blue-400' },
  { label: '任务完成率', value: '98%', color: 'text-emerald-400' },
  { label: '进行中任务', value: '3', color: 'text-amber-400' },
  { label: '平均响应', value: '12min', color: 'text-pink-400' },
];

// Knowledge Base Data
const knowledgeBase = [
  { name: '品牌风格指南 v2.1', icon: '📄' },
  { name: '历史爆款文章库 (47篇)', icon: '📁' },
  { name: '客户画像数据', icon: '📊' },
];

// Quick Actions Data
const quickActions = [
  '@所有人 汇报进度',
  '@战略分析师 调整方向',
  '@内容创作师 修改语气',
  '暂停当前任务',
  '📎 上传参考资料',
];

export default function OPCWorkbench() {
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;
    setInputText('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
      case 'waiting':
        return 'bg-amber-500';
      default:
        return 'bg-slate-600';
    }
  };

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500';
      case 'in-progress':
        return 'bg-violet-500';
      default:
        return 'bg-slate-700';
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)] min-h-[600px]">
      {/* Left Panel: AI Team & Workflows */}
      <div className="w-full lg:w-72 flex flex-col gap-6">
        {/* Header Card */}
        <Card className="bg-[#1a1b26] border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-300 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-base">OPC Command Center</CardTitle>
                <p className="text-xs text-slate-400">AI 团队协作工作台</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* CEO Panel */}
        <Card className="bg-[#1a1b26] border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <Users className="w-3.5 h-3.5" />
              <span>CEO 指令台</span>
            </div>
            <div className="bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/30 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:border-violet-500/50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-lg">
                🔥
              </div>
              <div>
                <div className="text-sm font-semibold text-white">你 (CEO)</div>
                <div className="text-xs text-violet-300">总指挥</div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* AI Agents */}
        <Card className="bg-[#1a1b26] border-slate-800 flex-1">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <Bot className="w-3.5 h-3.5" />
              <span>AI 虚拟团队</span>
            </div>
            <div className="flex flex-col gap-2">
              {agents.map((agent) => {
                const IconComponent = agent.icon;
                return (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-white", agent.color)}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                        {agent.name}
                      </div>
                      <div className="text-xs text-slate-500">{agent.role}</div>
                    </div>
                    <div className={cn("w-2 h-2 rounded-full", getStatusColor(agent.status))} />
                  </div>
                );
              })}
            </div>
          </CardHeader>
        </Card>

        {/* Quick Workflows */}
        <Card className="bg-[#1a1b26] border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <Zap className="w-3.5 h-3.5" />
              <span>快捷工作流</span>
            </div>
            <div className="flex flex-col gap-2">
              {workflows.map((wf, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 p-3 bg-[#242636] rounded-lg cursor-pointer hover:bg-slate-800 transition-colors border-l-4",
                    wf.color
                  )}
                >
                  <span className="text-lg">{wf.icon}</span>
                  <span className="text-sm text-slate-300">{wf.title}</span>
                </div>
              ))}
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Middle Panel: Chat/Command Center */}
      <div className="flex-1 flex flex-col min-h-0">
        <Card className="bg-[#13141f] border-slate-800 flex-1 flex flex-col">
          {/* Header */}
          <CardHeader className="border-b border-slate-800 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-white font-semibold">
                  <MessageSquare className="w-4 h-4" />
                  <span># 全员协作频道</span>
                  <span className="text-xs font-normal text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded-full">
                    ChatClaw Mode
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  用自然语言下达指令，AI Agents 自动协作执行
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>2026-05-01 14:32</span>
                <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>系统运行中 · 6 Agents在线</span>
                </div>
              </div>
            </div>
          </CardHeader>

          {/* Chat Area */}
          <CardContent className="flex-1 overflow-y-auto py-6 space-y-6">
            {/* CEO Message */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-sm">
                  🔥
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">你 (CEO)</span>
                  <span className="text-xs text-slate-500">14:30</span>
                </div>
              </div>
              <div className="ml-11 bg-violet-500/10 border border-violet-500/20 p-4 rounded-2xl rounded-tl-none text-slate-300 text-sm leading-relaxed">
                <span className="text-violet-300">@所有人</span> 本周需要发布一篇关于"AI Native 一人公司趋势"的深度文章。
                <br /><br />
                <span className="text-blue-300">@战略分析师</span> 先做行业趋势扫描，找出3个关键洞察<br />
                <span className="text-cyan-300">@研究助理</span> 搜集最近一个月的相关案例和数据<br />
                <span className="text-amber-300">@内容创作师</span> 等前两位完成后，基于素材撰写2500字文章<br />
                <span className="text-pink-300">@设计排版师</span> 文章完成后制作封面和3张信息图<br />
                <span className="text-emerald-300">@社媒运营官</span> 最后拆解为小红书/即刻/公众号三个版本
              </div>
            </div>

            {/* Agent Reply */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">战略分析师</span>
                  <span className="text-xs text-slate-500">14:31</span>
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">
                    ✅ 已接收任务
                  </span>
                </div>
              </div>
              <div className="ml-11 bg-[#1e1f2e] border border-slate-800 p-4 rounded-2xl rounded-tl-none text-slate-400 text-sm leading-relaxed">
                收到！开始扫描 AI Native 一人公司趋势...<br /><br />
                <span className="text-slate-500">
                  🔍 正在分析：<br />
                  • Google Trends / 行业报告<br />
                  • 社交媒体热点话题<br />
                  • 投融资动态
                </span>
                <br /><br />
                预计5分钟内完成初步扫描，将输出3个关键洞察方向。
              </div>
              
              {/* Progress Bar */}
              <div className="ml-11 bg-[#1e1f2e] border border-slate-800 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>任务进度</span>
                </div>
                <div className="text-sm text-slate-300 mb-2">行业趋势扫描中... 数据源: 12个已接入</div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full w-[65%] bg-gradient-to-r from-violet-500 to-violet-300 rounded-full" />
                </div>
              </div>
            </div>
          </CardContent>

          {/* Input Area */}
          <div className="p-4 border-t border-slate-800 bg-gradient-to-t from-[#13141f] to-transparent">
            <div className="flex gap-3">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="用自然语言下达指令，例如：@内容创作师 把刚才的文章改写成一封客户邮件..."
                className="flex-1 bg-[#1e1f2e] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
              <button
                onClick={handleSend}
                className="bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-medium px-5 py-3 rounded-xl flex items-center gap-2 transition-all"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">发送指令</span>
              </button>
            </div>
            
            {/* Quick Actions */}
            <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  className="whitespace-nowrap bg-[#1e1f2e] border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-full text-xs text-slate-400 hover:text-slate-300 transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Right Panel: Status & Analytics */}
      <div className="w-full lg:w-80 flex flex-col gap-6">
        {/* Workflow Status */}
        <Card className="bg-[#1a1b26] border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
              <MoreHorizontal className="w-3.5 h-3.5" />
              <span>当前工作流执行状态</span>
            </div>
            <div className="relative pl-4">
              {/* Vertical Line */}
              <div className="absolute left-[27px] top-6 bottom-6 w-0.5 bg-slate-800" />
              
              {workflowSteps.map((step, index) => (
                <div key={step.id} className={cn(
                  "flex gap-4 mb-6 relative last:mb-0",
                  step.status === 'pending' && "opacity-50"
                )}>
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs text-white z-10 shrink-0 mt-0.5",
                    getStepStatusColor(step.status)
                  )}>
                    {step.status === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "text-sm font-medium",
                      step.status === 'in-progress' ? "text-violet-300" : "text-slate-300"
                    )}>
                      {step.name}
                    </div>
                    {step.status === 'completed' && step.time && (
                      <div className="text-xs text-slate-500 mt-1">{step.time}</div>
                    )}
                    {step.status === 'in-progress' && step.progress && (
                      <>
                        <div className="text-xs text-orange-400 mt-1">进行中... {step.progress}%</div>
                        <div className="h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="h-full bg-orange-500 rounded-full transition-all"
                            style={{ width: `${step.progress}%` }}
                          />
                        </div>
                      </>
                    )}
                    {step.status === 'pending' && (
                      <div className="text-xs text-slate-500 mt-1">
                        {index > 2 ? '等待中' : '等待前置任务'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardHeader>
        </Card>

        {/* Team Stats */}
        <Card className="bg-[#1a1b26] border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>团队效能</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {teamStats.map((stat) => (
                <div key={stat.label} className="bg-[#1e1f2e] border border-slate-800 p-4 rounded-xl text-center">
                  <div className={cn("text-2xl font-bold mb-1", stat.color)}>{stat.value}</div>
                  <div className="text-xs text-slate-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </CardHeader>
        </Card>

        {/* Knowledge Base */}
        <Card className="bg-[#1a1b26] border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
              <Brain className="w-3.5 h-3.5" />
              <span>知识库调用</span>
            </div>
            <div className="flex flex-col gap-3">
              {knowledgeBase.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="text-slate-500">{item.icon}</span>
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
