import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingBag,
  Coins,
  Gift,
  Trophy,
  History,
  ArrowRight,
  Sparkles,
  Zap,
  CheckCircle,
  Star,
  Crown,
} from 'lucide-react';

interface Reward {
  id: string;
  name: string;
  description: string;
  points: number;
  category: 'service' | 'physical' | 'digital' | 'premium';
  icon: string;
  stock: number;
  featured?: boolean;
  hot?: boolean;
}

interface UserPoints {
  balance: number;
  lifetime: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  nextTierPoints: number;
}

interface RedemptionHistory {
  id: string;
  rewardName: string;
  points: number;
  date: string;
  status: 'completed' | 'processing' | 'pending';
}

const mockRewards: Reward[] = [
  {
    id: '1',
    name: 'Premium AI Model Access',
    description: '30 days access to GPT-4 Turbo and Claude 3 Opus models',
    points: 500,
    category: 'premium',
    icon: 'Crown',
    stock: 999,
    featured: true,
    hot: true,
  },
  {
    id: '2',
    name: 'Task Priority Boost',
    description: 'Your tasks appear at the top of the list for 7 days',
    points: 200,
    category: 'service',
    icon: 'Zap',
    stock: 500,
    hot: true,
  },
  {
    id: '3',
    name: 'Amazon Gift Card',
    description: '$25 Amazon gift card delivered via email',
    points: 2500,
    category: 'physical',
    icon: 'Gift',
    stock: 100,
  },
  {
    id: '4',
    name: 'Profile Badge Pack',
    description: 'Exclusive animated badges for your profile',
    points: 150,
    category: 'digital',
    icon: 'Star',
    stock: 1000,
  },
  {
    id: '5',
    name: 'Consultation Session',
    description: '1-hour 1-on-1 consultation with an AI expert',
    points: 1000,
    category: 'service',
    icon: 'Headphones',
    stock: 50,
  },
  {
    id: '6',
    name: 'API Credits Bundle',
    description: '100,000 API calls for your integrations',
    points: 800,
    category: 'premium',
    icon: 'Gem',
    stock: 200,
  },
  {
    id: '7',
    name: 'Featured Creator Status',
    description: 'Get featured on our homepage for 30 days',
    points: 3000,
    category: 'service',
    icon: 'Trophy',
    stock: 20,
  },
  {
    id: '8',
    name: 'Online Course Access',
    description: 'Access to premium AI/ML courses for 3 months',
    points: 1500,
    category: 'digital',
    icon: 'BookOpen',
    stock: 150,
  },
];

const mockUserPoints: UserPoints = {
  balance: 3450,
  lifetime: 12000,
  tier: 'gold',
  nextTierPoints: 15000,
};

const mockHistory: RedemptionHistory[] = [
  {
    id: 'r1',
    rewardName: 'Premium AI Model Access',
    points: 500,
    date: '2024-02-10',
    status: 'completed',
  },
  {
    id: 'r2',
    rewardName: 'Task Priority Boost',
    points: 200,
    date: '2024-02-05',
    status: 'completed',
  },
  {
    id: 'r3',
    rewardName: 'API Credits Bundle',
    points: 800,
    date: '2024-01-28',
    status: 'completed',
  },
];

const categoryIcons = {
  service: Zap,
  physical: Gift,
  digital: Monitor,
  premium: Crown,
};

const categoryLabels = {
  service: 'Services',
  physical: 'Physical',
  digital: 'Digital',
  premium: 'Premium',
};

const categoryColors = {
  service: 'bg-blue-100 text-blue-700 border-blue-200',
  physical: 'bg-green-100 text-green-700 border-green-200',
  digital: 'bg-purple-100 text-purple-700 border-purple-200',
  premium: 'bg-amber-100 text-amber-700 border-amber-200',
};

const tierColors = {
  bronze: 'from-amber-700 to-amber-600',
  silver: 'from-slate-400 to-slate-300',
  gold: 'from-yellow-500 to-amber-400',
  platinum: 'from-cyan-500 to-blue-400',
};

const tierLabels = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

import { Headphones, Gem, BookOpen, Monitor } from 'lucide-react';

export default function PointsMall() {
  const [rewards] = useState<Reward[]>(mockRewards);
  const [filteredRewards, setFilteredRewards] = useState<Reward[]>(mockRewards);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [userPoints] = useState<UserPoints>(mockUserPoints);
  const [history] = useState<RedemptionHistory[]>(mockHistory);
  const [activeTab, setActiveTab] = useState<'rewards' | 'history'>('rewards');
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const isAuthenticated = !!token;

  const categories = ['all', 'service', 'physical', 'digital', 'premium'];

  useEffect(() => {
    let result = [...rewards];

    if (selectedCategory !== 'all') {
      result = result.filter((r) => r.category === selectedCategory);
    }

    // Sort featured first, then by points
    result.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return a.points - b.points;
    });

    setFilteredRewards(result);
  }, [rewards, selectedCategory]);

  const handleRedeem = (rewardId: string, points: number) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (userPoints.balance < points) {
      alert('Insufficient points!');
      return;
    }

    setRedeemingId(rewardId);
    setTimeout(() => {
      alert('Reward redeemed successfully!');
      setRedeemingId(null);
    }, 1000);
  };

  const getProgressToNextTier = () => {
    const tiers = ['bronze', 'silver', 'gold', 'platinum'];
    const currentIndex = tiers.indexOf(userPoints.tier);
    if (currentIndex === tiers.length - 1) return 100;

    const prevTierPoints = currentIndex === 0 ? 0 : [0, 3000, 8000, 15000][currentIndex];
    const progress = ((userPoints.lifetime - prevTierPoints) / (userPoints.nextTierPoints - prevTierPoints)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'processing':
        return 'text-blue-600';
      case 'pending':
        return 'text-amber-600';
      default:
        return 'text-slate-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section with Points Display */}
        <div className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 p-8 md:p-12">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,white_1px,transparent_1px)] bg-[length:20px_20px]" />
          </div>
          <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm text-white backdrop-blur-sm">
                <Sparkles className="h-4 w-4" />
                <span className="capitalize">{tierLabels[userPoints.tier]} Member</span>
              </div>
              <h1 className="mb-2 text-3xl font-bold text-white md:text-4xl">
                Points Mall
              </h1>
              <p className="text-lg text-white/90">
                Redeem your points for exclusive rewards and benefits
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="mb-1 flex items-center justify-center gap-2 text-5xl font-bold text-white">
                  <Coins className="h-8 w-8" />
                  {userPoints.balance.toLocaleString()}
                </div>
                <p className="text-sm text-white/80">Available Points</p>
              </div>
            </div>
          </div>

          {/* Progress to next tier */}
          <div className="relative z-10 mt-8">
            <div className="mb-2 flex items-center justify-between text-sm text-white/90">
              <span>Lifetime: {userPoints.lifetime.toLocaleString()} points</span>
              <span>
                {userPoints.tier === 'platinum'
                  ? 'Max Tier!'
                  : `${userPoints.nextTierPoints - userPoints.lifetime} points to ${tierLabels[
                      ['bronze', 'silver', 'gold', 'platinum'][
                        ['bronze', 'silver', 'gold', 'platinum'].indexOf(userPoints.tier) + 1
                      ] as UserPoints['tier']
                    ]}`}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/20">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-white to-white/80 transition-all duration-500`}
                style={{ width: `${getProgressToNextTier()}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { icon: Gift, label: 'Rewards Available', value: rewards.length.toString() },
            { icon: History, label: 'Redemptions', value: history.length.toString() },
            { icon: Trophy, label: 'Current Tier', value: tierLabels[userPoints.tier] },
            { icon: Star, label: 'Lifetime Points', value: userPoints.lifetime.toLocaleString() },
          ].map((stat) => (
            <Card key={stat.label} className="border-slate-200">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${tierColors[userPoints.tier]}`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{stat.value}</div>
                  <div className="text-xs text-slate-500">{stat.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'rewards' ? 'default' : 'outline'}
              onClick={() => setActiveTab('rewards')}
              size="sm"
            >
              <Gift className="mr-2 h-4 w-4" />
              Rewards
            </Button>
            <Button
              variant={activeTab === 'history' ? 'default' : 'outline'}
              onClick={() => setActiveTab('history')}
              size="sm"
            >
              <History className="mr-2 h-4 w-4" />
              History
            </Button>
          </div>
        </div>

        {activeTab === 'rewards' ? (
          <>
            {/* Category Filters */}
            <div className="mb-6 flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="capitalize"
                >
                  {cat === 'all' ? 'All Rewards' : categoryLabels[cat as keyof typeof categoryLabels]}
                </Button>
              ))}
            </div>

            {/* Featured Rewards */}
            {selectedCategory === 'all' && (
              <div className="mb-8">
                <h2 className="mb-4 text-xl font-semibold text-slate-900">Featured Rewards</h2>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {rewards
                    .filter((r) => r.featured)
                    .map((reward) => {
                      const IconComponent = categoryIcons[reward.category];
                      const canAfford = userPoints.balance >= reward.points;
                      return (
                        <Card
                          key={reward.id}
                          className="relative overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/50"
                        >
                          {reward.hot && (
                            <div className="absolute right-0 top-0 bg-gradient-to-bl from-red-500 to-pink-500 px-3 py-1 text-xs font-medium text-white">
                              HOT
                            </div>
                          )}
                          <CardContent className="p-6">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center">
                              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white">
                                <IconComponent className="h-8 w-8" />
                              </div>
                              <div className="flex-1">
                                <div className="mb-2 flex items-center gap-2">
                                  <Badge className={categoryColors[reward.category]}>
                                    {categoryLabels[reward.category]}
                                  </Badge>
                                  <span className="text-sm text-slate-500">
                                    {reward.stock} left
                                  </span>
                                </div>
                                <h3 className="mb-1 text-lg font-semibold text-slate-900">
                                  {reward.name}
                                </h3>
                                <p className="text-sm text-slate-600">{reward.description}</p>
                              </div>
                              <div className="text-right">
                                <div className="mb-2 flex items-center justify-end gap-1 text-2xl font-bold text-amber-600">
                                  <Coins className="h-5 w-5" />
                                  {reward.points}
                                </div>
                                <Button
                                  onClick={() => handleRedeem(reward.id, reward.points)}
                                  disabled={!canAfford || redeemingId === reward.id}
                                  className="w-full md:w-auto"
                                >
                                  {redeemingId === reward.id ? (
                                    'Processing...'
                                  ) : canAfford ? (
                                    <>
                                      Redeem
                                      <ArrowRight className="ml-1 h-4 w-4" />
                                    </>
                                  ) : (
                                    'Not Enough'
                                  )}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </div>
            )}

            {/* All Rewards Grid */}
            <div>
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                {selectedCategory === 'all' ? 'All Rewards' : categoryLabels[selectedCategory as keyof typeof categoryLabels]}
              </h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredRewards
                  .filter((r) => selectedCategory !== 'all' || !r.featured)
                  .map((reward) => {
                    const IconComponent = categoryIcons[reward.category];
                    const canAfford = userPoints.balance >= reward.points;
                    return (
                      <Card
                        key={reward.id}
                        className="group flex flex-col border-slate-200 transition-all duration-300 hover:shadow-lg"
                      >
                        <CardHeader className="pb-3">
                          <div className="mb-3 flex items-start justify-between">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 group-hover:from-amber-100 group-hover:to-orange-100 transition-colors">
                              <IconComponent className="h-6 w-6 text-slate-600 group-hover:text-amber-600" />
                            </div>
                            {reward.hot && (
                              <Badge className="bg-red-100 text-red-700">HOT</Badge>
                            )}
                          </div>
                          <CardTitle className="text-base">{reward.name}</CardTitle>
                          <CardDescription className="line-clamp-2">
                            {reward.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                          <Badge
                            variant="outline"
                            className={categoryColors[reward.category]}
                          >
                            {categoryLabels[reward.category]}
                          </Badge>
                          <div className="mt-2 text-sm text-slate-500">
                            {reward.stock} remaining
                          </div>
                        </CardContent>
                        <CardFooter className="flex items-center justify-between border-t border-slate-100 pt-4">
                          <div className="flex items-center gap-1 text-lg font-bold text-amber-600">
                            <Coins className="h-4 w-4" />
                            {reward.points}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleRedeem(reward.id, reward.points)}
                            disabled={!canAfford || redeemingId === reward.id}
                            variant={canAfford ? 'default' : 'outline'}
                          >
                            {redeemingId === reward.id
                              ? '...'
                              : canAfford
                              ? 'Redeem'
                              : 'Need More'}
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
              </div>
            </div>

            {/* How to Earn Points */}
            <Card className="mt-10 border-amber-100 bg-gradient-to-r from-amber-50/50 to-orange-50/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-lg">How to Earn Points</CardTitle>
                </div>
                <CardDescription>
                  Complete tasks and engage with the community to earn more points
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {[
                    { icon: CheckCircle, title: 'Complete Tasks', points: '+50-500', desc: 'Earn points for every task you complete' },
                    { icon: Trophy, title: 'Daily Login', points: '+10', desc: 'Check in daily to earn bonus points' },
                    { icon: Gift, title: 'Refer Friends', points: '+200', desc: 'Get points when your friends join' },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="flex items-start gap-3 rounded-lg bg-white p-4 shadow-sm"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                        <item.icon className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{item.title}</p>
                          <Badge variant="secondary" className="text-amber-600">
                            {item.points}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          /* History Tab */
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-slate-600" />
                Redemption History
              </CardTitle>
              <CardDescription>
                View your past reward redemptions and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="py-12 text-center">
                  <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                  <h3 className="mb-2 text-lg font-medium text-slate-900">No redemptions yet</h3>
                  <p className="text-slate-500">Start earning and redeeming rewards!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 p-4 hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                          <Gift className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{item.rewardName}</p>
                          <p className="text-sm text-slate-500">{item.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-amber-600">-{item.points} pts</p>
                        <p className={`text-sm ${getStatusColor(item.status)}`}>
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
