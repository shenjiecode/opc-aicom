import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Search,
  Plus,
  Hash,
  Users,
  MessageCircle,
  MessageSquare,
  ChevronRight,
  LogOut,
  Sparkles,
  Flame,
  Star,
  UserCheck,
} from "lucide-react";
import { useMatrix } from "@/contexts/MatrixContext";
import { cn } from "@/lib/utils";

// Room card component for displaying individual rooms
interface Room {
  roomId: string;
  name: string;
  topic?: string;
  avatarUrl?: string;
  members: string[];
  memberCount: number;
  unreadCount: number;
  messageCount?: number;
  joined?: boolean;
  isDirect?: boolean;
  isOfficial?: boolean;
}

interface RoomCardProps {
  room: Room;
  onJoin: () => void;
  onEnter: () => void;
  onLeave: () => void;
  isJoining?: boolean;
  isLeaving?: boolean;
}

function RoomCard({ room, onJoin, onEnter, onLeave, isJoining, isLeaving }: RoomCardProps) {
  return (
    <Card className="overflow-hidden bg-[#1a1b26] border-slate-700/50 hover:border-violet-500/50 transition-all duration-300 group">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Avatar / Icon */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center border border-violet-500/20 group-hover:from-violet-500/30 group-hover:to-purple-500/30 transition-all">
            <Hash className="w-6 h-6 text-violet-400" />
          </div>

          {/* Room Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-sm truncate group-hover:text-violet-400 transition-colors">
                {room.name}
              </h3>
              {room.joined && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-400 border-0">
                  已加入
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {room.memberCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {room.messageCount ?? 0}
              </span>
              {room.unreadCount > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <MessageCircle className="w-3 h-3" />
                  {room.unreadCount} 未读
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        {/* Topic */}
        <p className="text-xs text-slate-400 line-clamp-2 mb-4 min-h-[2rem]">
          {room.topic || "暂无描述"}
        </p>

        {/* Action Buttons */}
        {room.joined ? (
          <div className="flex gap-2">
            <Button
              onClick={onEnter}
              variant="outline"
              className="flex-1 h-8 bg-violet-500/10 border-violet-500/30 text-violet-400 hover:bg-violet-500/20 hover:text-violet-300 text-xs"
            >
              进入房间
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
            <Button
              onClick={onLeave}
              disabled={isLeaving}
              variant="outline"
              className="h-8 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 text-xs"
            >
              {isLeaving ? "离开中..." : "离开"}
              <LogOut className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        ) : (
          <Button
            onClick={onJoin}
            disabled={isJoining}
            className="w-full h-8 bg-violet-500 hover:bg-violet-600 text-white text-xs disabled:opacity-50"
          >
            {isJoining ? "加入中..." : "加入房间"}
            <Plus className="w-3.5 h-3.5 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Create Room Dialog Component
function CreateRoomDialog({ onCreate }: { onCreate: (name: string, topic: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      await onCreate(name.trim(), topic.trim());
      setName("");
      setTopic("");
      setOpen(false);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-violet-500 hover:bg-violet-600 text-white">
          <Plus className="w-4 h-4 mr-2" />
          创建房间
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#1a1b26] border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">创建新房间</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm text-slate-400 mb-2 block">房间名称</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入房间名称"
              className="bg-[#13141f] border-slate-700 text-white placeholder:text-slate-600"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-2 block">房间描述</label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="输入房间描述（可选）"
              className="bg-[#13141f] border-slate-700 text-white placeholder:text-slate-600"
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="w-full bg-violet-500 hover:bg-violet-600 text-white"
          >
            {isCreating ? "创建中..." : "创建房间"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Filter tab item component
interface FilterTabItemProps {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }> | null;
  label: string;
}

function FilterTabItem({ active, onClick, icon: Icon, label }: FilterTabItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-all",
        active
          ? "bg-violet-500 text-white"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}

// Filter type
type FilterType = "all" | "official" | "hot" | "recommended" | "joined";

export default function BitePlaza() {
  const { allRooms, rooms, joinRoom, leaveRoom, createRoom, selectRoom, initialize, isInitialized } = useMatrix();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState<string | null>(null);

  // Initialize Matrix connection on mount
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // Filter rooms based on search and filter type
  const filteredRooms = useMemo(() => {
    let result = [...allRooms];

    // Apply filter type
    switch (activeFilter) {
      case "joined":
        const joinedRoomIds = new Set(rooms.map((r) => r.roomId));
        result = result.filter((r) => joinedRoomIds.has(r.roomId));
        break;
      case "official":
        // Rooms marked as official by backend (from config)
        result = result.filter((r) => r.isOfficial === true);
        break;
      case "hot":
        // Sort by member count
        result = result.sort((a, b) => b.memberCount - a.memberCount);
        break;
      case "recommended":
        // Rooms with topics, sorted by member count
        result = result
          .filter((r) => r.topic && r.topic.length > 0)
          .sort((a, b) => b.memberCount - a.memberCount);
        break;
      default:
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.topic?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [allRooms, rooms, searchQuery, activeFilter]);

  const handleJoinRoom = async (roomId: string) => {
    setIsJoining(roomId);
    try {
      await joinRoom(roomId);
    } finally {
      setIsJoining(null);
    }
  };

  const handleCreateRoom = async (name: string, topic: string) => {
    await createRoom(name, topic, true);
  };

  const handleEnterRoom = (roomId: string) => {
    selectRoom(roomId);
    // Navigate to room chat or handle via callback
    window.location.href = `/opc-workbench?room=${encodeURIComponent(roomId)}`;
  };

  const handleLeaveRoom = async (roomId: string) => {
    setIsLeaving(roomId);
    try {
      await leaveRoom(roomId);
    } finally {
      setIsLeaving(null);
    }
  };

  // Get joined room IDs set for quick lookup
  const joinedRoomIds = useMemo(
    () => new Set(rooms.map((r) => r.roomId)),
    [rooms]
  );

  // Filter tabs configuration
  const filterTabs = [
    { value: "all" as FilterType, label: "全部", icon: null },
    { value: "official" as FilterType, label: "官方", icon: Sparkles },
    { value: "hot" as FilterType, label: "热门", icon: Flame },
    { value: "recommended" as FilterType, label: "推荐", icon: Star },
    { value: "joined" as FilterType, label: "我加入的", icon: UserCheck },
  ];

  return (
    <div className="h-screen bg-[#13141f] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800 bg-[#1a1b26] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Hash className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Bite广场</h1>
            <p className="text-xs text-slate-400">发现有趣的 Matrix 房间</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索房间..."
              className="w-64 pl-10 bg-[#13141f] border-slate-700 text-white placeholder:text-slate-600 focus:border-violet-500"
            />
          </div>

          {/* Create Room Button */}
          <CreateRoomDialog onCreate={handleCreateRoom} />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-6 py-4 border-b border-slate-800 bg-[#13141f] shrink-0">
        <div className="flex items-center gap-1 bg-[#1a1b26] border border-slate-700/50 p-1 rounded-lg inline-flex">
          {filterTabs.map((tab) => (
            <FilterTabItem
              key={tab.value}
              active={activeFilter === tab.value}
              onClick={() => setActiveFilter(tab.value)}
              icon={tab.icon}
              label={tab.label}
            />
          ))}
        </div>
      </div>

      {/* Room Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {!isInitialized ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 opacity-50" />
            </div>
            <p>正在连接 Matrix 服务器...</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
              <Hash className="w-8 h-8 opacity-50" />
            </div>
            <p className="text-lg font-medium mb-2">
              {searchQuery ? "没有找到匹配的房间" : "暂无房间"}
            </p>
            <p className="text-sm">
              {searchQuery
                ? "尝试其他搜索关键词"
                : "点击右上角创建房间开始交流"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.roomId}
                room={{
                  ...room,
                  joined: joinedRoomIds.has(room.roomId),
                }}
                onJoin={() => handleJoinRoom(room.roomId)}
                onEnter={() => handleEnterRoom(room.roomId)}
                onLeave={() => handleLeaveRoom(room.roomId)}
                isJoining={isJoining === room.roomId}
                isLeaving={isLeaving === room.roomId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="h-12 px-6 flex items-center justify-between border-t border-slate-800 bg-[#1a1b26] shrink-0">
        <div className="flex items-center gap-6 text-xs text-slate-500">
          <span>总房间: {allRooms.length}</span>
          <span>已加入: {rooms.length}</span>
          <span>总帖子: {allRooms.reduce((acc, r) => acc + (r.messageCount ?? 0), 0)}</span>
        </div>
        <div className="text-xs text-slate-600">
          Matrix Protocol
        </div>
      </div>
    </div>
  );
}
