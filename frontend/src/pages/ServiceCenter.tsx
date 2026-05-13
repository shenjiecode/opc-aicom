import React, { useState, useEffect } from 'react';
import { Search, Star, ArrowRight } from 'lucide-react';
import axios from 'axios';

interface Service {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  tags: string;
  status: string;
  theme_color: string;
  icon_emoji: string;
}

const ServiceCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('全部服务');
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);

  const tabs = ['全部服务', '已上线', '内测中'];

  useEffect(() => {
    fetchServices();
  }, [activeTab]);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/services/list', {
        status: activeTab,
      });
      if (response.data.code === 0) {
        setServices(response.data.data.list || []);
      }
    } catch (error) {
      console.error('Failed to fetch services:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTags = (tagsString: string) => {
    try {
      const tags = JSON.parse(tagsString);
      return tags.map((tag: string, index: number) => (
        <span key={index} className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
          {tag}
        </span>
      ));
    } catch (e) {
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-white w-full overflow-x-hidden flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-6 h-[var(--header-height)] shrink-0">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">🏢</span>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">服务中心</h1>
          <div className="h-4 w-px bg-slate-200 mx-2"></div>
          <p className="text-sm text-slate-500 hidden md:block">一站式AI赋能服务，用积分解锁全部能力</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="搜索服务..."
              className="w-64 bg-slate-50 border-none rounded-full py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
            />
          </div>
          <button className="flex items-center space-x-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span>我的收藏</span>
          </button>
        </div>
      </div>

      <div className="px-6 py-6 flex-1 max-w-[1400px]">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Stat 1 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4">
              <span className="text-xl">🏢</span>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">8</div>
            <div className="text-sm text-slate-500 mb-3">核心服务</div>
            <div className="text-xs font-medium text-emerald-500 flex items-center">
              <span className="mr-1">↑</span> 覆盖6大领域
            </div>
          </div>
          {/* Stat 2 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4">
              <span className="text-xl">⚡</span>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">1,560</div>
            <div className="text-sm text-slate-500 mb-3">服务调用次数</div>
            <div className="text-xs font-medium text-emerald-500 flex items-center">
              <span className="mr-1">↑</span> 本月 +238 次
            </div>
          </div>
          {/* Stat 3 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4">
              <span className="text-xl">🎯</span>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">42</div>
            <div className="text-sm text-slate-500 mb-3">已交付原型</div>
            <div className="text-xs font-medium text-emerald-500 flex items-center">
              <span className="mr-1">↑</span> 48h交付率 89%
            </div>
          </div>
          {/* Stat 4 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4">
              <span className="text-xl">🤝</span>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">28</div>
            <div className="text-sm text-slate-500 mb-3">生态合作伙伴</div>
            <div className="text-xs font-medium text-emerald-500 flex items-center">
              <span className="mr-1">↑</span> 本月新增 5 家
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-3 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all flex items-center space-x-2 ${
                activeTab === tab
                  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab === '全部服务' && <span>📋</span>}
              {tab === '已上线' && <span>✅</span>}
              {tab === '内测中' && <span>🧪</span>}
              <span>{tab}</span>
            </button>
          ))}
        </div>

        {/* Services Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {services.map((service) => (
              <div
                key={service.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer"
              >
                {/* Colored Header Area */}
                <div className={`h-32 bg-gradient-to-br ${service.theme_color} relative overflow-hidden flex items-center justify-center`}>
                  {/* Decorative blur circle */}
                  <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]"></div>
                  <span className="text-4xl relative z-10 drop-shadow-sm transform group-hover:scale-110 transition-transform duration-300">{service.icon_emoji}</span>
                </div>
                
                {/* Content Area */}
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{service.title}</h3>
                  <div className="text-xs font-medium text-slate-500 mb-3">{service.subtitle}</div>
                  
                  <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3 flex-1">
                    {service.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-5">
                    {renderTags(service.tags)}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      service.status === '已上线' ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'
                    }`}>
                      {service.status}
                    </span>
                    
                    <div className="flex items-center text-sm font-medium text-indigo-600 group-hover:text-indigo-700 transition-colors">
                      立即使用 <ArrowRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {services.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-500">
                暂无相关服务
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceCenter;