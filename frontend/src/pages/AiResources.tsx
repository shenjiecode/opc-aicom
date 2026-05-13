import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Sparkles,
  Bot,
  Cpu,
  Globe,
  Zap,
  Star,
  Users,
  ExternalLink,
  Plus,
  Filter,
  Download,
  TrendingUp,
} from 'lucide-react';

interface AIResource {
  id: string;
  name: string;
  description: string;
  category: 'agent' | 'model' | 'tool' | 'api';
  tags: string[];
  rating: number;
  usageCount: number;
  author: string;
  icon: string;
  isOfficial: boolean;
  installed?: boolean;
}

const mockResources: AIResource[] = [
  {
    id: '1',
    name: 'GPT-4 Assistant',
    description: 'Advanced language model for complex tasks, coding, and creative writing',
    category: 'model',
    tags: ['NLP', 'Coding', 'Creative'],
    rating: 4.9,
    usageCount: 125000,
    author: 'OpenAI',
    icon: 'Bot',
    isOfficial: true,
    installed: true,
  },
  {
    id: '2',
    name: 'Code Reviewer Pro',
    description: 'Automated code review agent that checks for bugs, security issues, and best practices',
    category: 'agent',
    tags: ['DevOps', 'Security', 'Code Quality'],
    rating: 4.7,
    usageCount: 45000,
    author: 'DevTools Inc',
    icon: 'Code',
    isOfficial: false,
    installed: false,
  },
  {
    id: '3',
    name: 'Image Generator API',
    description: 'High-quality image generation API with style customization and editing capabilities',
    category: 'api',
    tags: ['Image', 'Creative', 'API'],
    rating: 4.5,
    usageCount: 89000,
    author: 'AI Art Studio',
    icon: 'Palette',
    isOfficial: false,
    installed: false,
  },
  {
    id: '4',
    name: 'Data Analyzer',
    description: 'Intelligent data analysis tool with visualization and reporting features',
    category: 'tool',
    tags: ['Data', 'Analytics', 'Business'],
    rating: 4.6,
    usageCount: 32000,
    author: 'DataFlow AI',
    icon: 'BarChart3',
    isOfficial: false,
    installed: true,
  },
  {
    id: '5',
    name: 'Translation Master',
    description: 'Real-time multilingual translation with context awareness and tone adjustment',
    category: 'agent',
    tags: ['Translation', 'NLP', 'Global'],
    rating: 4.4,
    usageCount: 67000,
    author: 'LinguaTech',
    icon: 'Globe',
    isOfficial: false,
    installed: false,
  },
  {
    id: '6',
    name: 'Content Writer',
    description: 'AI writing assistant for blog posts, marketing copy, and social media content',
    category: 'agent',
    tags: ['Writing', 'Marketing', 'Content'],
    rating: 4.3,
    usageCount: 54000,
    author: 'ContentAI',
    icon: 'FileText',
    isOfficial: false,
    installed: false,
  },
];

const categoryIcons = {
  agent: Bot,
  model: Cpu,
  tool: Zap,
  api: Globe,
};

const categoryColors = {
  agent: 'bg-blue-100 text-blue-700 border-blue-200',
  model: 'bg-purple-100 text-purple-700 border-purple-200',
  tool: 'bg-amber-100 text-amber-700 border-amber-200',
  api: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const categoryLabels = {
  agent: 'Agent',
  model: 'Model',
  tool: 'Tool',
  api: 'API',
};

export default function AiResources() {
  const [resources, setResources] = useState<AIResource[]>(mockResources);
  const [filteredResources, setFilteredResources] = useState<AIResource[]>(mockResources);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'usage' | 'newest'>('rating');

  const categories = ['all', 'agent', 'model', 'tool', 'api'];

  useEffect(() => {
    let result = [...resources];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.description.toLowerCase().includes(query) ||
          r.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (selectedCategory !== 'all') {
      result = result.filter((r) => r.category === selectedCategory);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'usage':
          return b.usageCount - a.usageCount;
        case 'newest':
          return b.id.localeCompare(a.id);
        default:
          return 0;
      }
    });

    setFilteredResources(result);
  }, [resources, searchQuery, selectedCategory, sortBy]);

  const handleInstall = (resourceId: string) => {
    setResources((prev) =>
      prev.map((r) => (r.id === resourceId ? { ...r, installed: !r.installed } : r))
    );
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-8 md:p-12">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,white_1px,transparent_1px)] bg-[length:20px_20px]" />
          </div>
          <div className="relative z-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm text-white backdrop-blur-sm">
              <Sparkles className="h-4 w-4" />
              <span>Discover 500+ AI Resources</span>
            </div>
            <h1 className="mb-4 text-3xl font-bold text-white md:text-5xl">
              AI Resources & Agent Market
            </h1>
            <p className="max-w-2xl text-lg text-white/90">
              Discover, install, and integrate powerful AI models, agents, and tools to supercharge your workflow
            </p>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { icon: Bot, label: 'Agents', value: '150+' },
            { icon: Cpu, label: 'Models', value: '80+' },
            { icon: Zap, label: 'Tools', value: '200+' },
            { icon: Users, label: 'Active Users', value: '50k+' },
          ].map((stat) => (
            <Card key={stat.label} className="border-slate-200">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                  <stat.icon className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                  <div className="text-xs text-slate-500">{stat.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search and Filters */}
        <Card className="mb-8 border-slate-200">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search resources, models, agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                    className="capitalize"
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
              <Filter className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-500">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-slate-950"
              >
                <option value="rating">Highest Rated</option>
                <option value="usage">Most Popular</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Resource Grid */}
        {filteredResources.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 text-center">
              <Search className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <h3 className="mb-2 text-lg font-medium text-slate-900">No resources found</h3>
              <p className="text-slate-500">Try adjusting your search or filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredResources.map((resource) => {
              const IconComponent = categoryIcons[resource.category];
              return (
                <Card
                  key={resource.id}
                  className="group border-slate-200 transition-all duration-300 hover:shadow-lg"
                >
                  <CardHeader className="pb-3">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                        <IconComponent className="h-6 w-6" />
                      </div>
                      <div className="flex items-center gap-2">
                        {resource.isOfficial && (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                            <Star className="mr-1 h-3 w-3" />
                            Official
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={categoryColors[resource.category]}
                        >
                          {categoryLabels[resource.category]}
                        </Badge>
                      </div>
                    </div>
                    <CardTitle className="text-lg group-hover:text-indigo-600 transition-colors">
                      {resource.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {resource.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="mb-4 flex flex-wrap gap-2">
                      {resource.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="font-medium">{resource.rating}</span>
                        <span className="text-slate-400">({formatNumber(resource.usageCount)})</span>
                      </div>
                      <div className="text-slate-500">by {resource.author}</div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex gap-2 pt-3">
                    <Button
                      variant={resource.installed ? 'outline' : 'default'}
                      className="flex-1"
                      onClick={() => handleInstall(resource.id)}
                    >
                      {resource.installed ? (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Installed
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Install
                        </>
                      )}
                    </Button>
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* Recommended Section */}
        <Card className="mt-10 border-indigo-100 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              <CardTitle className="text-lg">Trending This Week</CardTitle>
            </div>
            <CardDescription>
              Most popular AI resources based on community usage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {resources
                .slice()
                .sort((a, b) => b.usageCount - a.usageCount)
                .slice(0, 3)
                .map((resource, index) => {
                  const IconComponent = categoryIcons[resource.category];
                  return (
                    <div
                      key={resource.id}
                      className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 font-bold text-sm">
                        #{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4 text-slate-400" />
                          <span className="font-medium text-slate-900 truncate">
                            {resource.name}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatNumber(resource.usageCount)} uses
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
