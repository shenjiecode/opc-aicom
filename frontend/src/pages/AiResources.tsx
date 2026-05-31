import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import axios from 'axios';

interface Resource {
  id: number;
  title: string;
  category: string;
  description: string;
  icon_emoji: string;
  icon_bg_color: string;
  icon_color: string;
  publisher: string;
  rating: number;
  auth_count: number;
  price: number;
  type: string;
}

const AiResources: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ip' | 'expert'>('ip');
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchResources();
  }, [activeTab]);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/resources/list', {
        page: 1,
        pageSize: 20,
        type: activeTab,
      });
      if (response.data.code === 0) {
        console.log('Fetched resources:', response.data.data);
        setResources(response.data.data.list || []);
      }
    } catch (error) {
      console.error('Failed to fetch resources:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white w-full overflow-x-hidden flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-6 h-[var(--header-height)] shrink-0">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">🧠</span>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">服务集市</h1>
          <div className="h-4 w-px bg-slate-200 mx-2"></div>
          <p className="text-sm text-slate-500 hidden md:block">聚合可交易IP资源与专家服务，帮助OPC快速补齐能力</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="搜索IP资源或场景..."
              className="w-64 bg-slate-50 border-none rounded-full py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      <div className="px-6 py-6 flex-1 max-w-[1400px]">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Stat 1 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4">
              <span className="text-xl">📦</span>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">126</div>
            <div className="text-sm text-slate-500 mb-3">在架IP资源</div>
            <div className="text-xs font-medium text-emerald-500 flex items-center">
              <span className="mr-1">↑</span> 本月新增 14 个
            </div>
          </div>
          {/* Stat 2 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4">
              <span className="text-xl">🔄</span>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">9,540</div>
            <div className="text-sm text-slate-500 mb-3">累计调用</div>
            <div className="text-xs font-medium text-emerald-500 flex items-center">
              <span className="mr-1">↑</span> 周增长 21%
            </div>
          </div>
          {/* Stat 3 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4">
              <span className="text-xl">💎</span>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">4.8</div>
            <div className="text-sm text-slate-500 mb-3">资源评分均值</div>
            <div className="text-xs font-medium text-emerald-500 flex items-center">
              <span className="mr-1">↑</span> 优质率 91%
            </div>
          </div>
          {/* Stat 4 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4">
              <span className="text-xl">💰</span>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">32.8k</div>
            <div className="text-sm text-slate-500 mb-3">本月交易积分</div>
            <div className="text-xs font-medium text-emerald-500 flex items-center">
              <span className="mr-1">↑</span> 资源流转活跃
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-3 mb-8">
          <button
            onClick={() => setActiveTab('ip')}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all flex items-center space-x-2 ${
              activeTab === 'ip'
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>🚀</span>
            <span>IP资源</span>
          </button>
          <button
            onClick={() => setActiveTab('expert')}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all flex items-center space-x-2 ${
              activeTab === 'expert'
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>🤖</span>
            <span>AI专家</span>
          </button>
        </div>

        {/* Resource Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {resources && resources.length > 0 ? resources.map((resource) => (
              <div
                key={resource.id}
                className="bg-white border border-slate-100 rounded-2xl p-6 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 group flex flex-col h-full"
              >
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-5 ${resource.icon_bg_color} ${resource.icon_color}`}>
                  {resource.icon_emoji}
                </div>
                
                {/* Content */}
                <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">
                  {resource.title}
                </h3>
                <div className="text-xs font-medium text-slate-500 mb-4">{resource.category}</div>
                <p className="text-sm text-slate-600 leading-relaxed mb-5 line-clamp-3 flex-1">
                  {resource.description}
                </p>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <div className="px-2.5 py-1 bg-indigo-50 rounded-md text-[11px] font-medium text-indigo-600">
                    发布者: {resource.publisher}
                  </div>
                  <div className="px-2.5 py-1 bg-amber-50 rounded-md text-[11px] font-medium text-amber-600 flex items-center">
                    评分: ⭐ {resource.rating}
                  </div>
                  <div className="px-2.5 py-1 bg-slate-50 rounded-md text-[11px] font-medium text-slate-500">
                    {resource.auth_count?.toLocaleString()} 次授权
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                  <div className="text-lg font-bold text-indigo-600">
                    {resource.price?.toLocaleString()} <span className="text-sm font-medium">积分</span>
                  </div>
                  <button className="px-4 py-2 bg-slate-100 hover:bg-indigo-500 hover:text-white text-slate-700 text-sm font-medium rounded-lg transition-colors">
                    立即接入
                  </button>
                </div>
              </div>
            )) : (
              <div className="col-span-full py-20 text-center text-slate-500">
                暂无相关资源
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AiResources;