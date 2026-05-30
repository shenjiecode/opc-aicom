import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Zap,
  MoreHorizontal,
  RefreshCw,
  WifiOff,
  User,
  AtSign,
  Circle,
  Folder,
  File,
  Download,
  CheckCircle,
  Clock,
  Play,
  Flag,
} from "lucide-react";
import { useMatrix } from "@/contexts/MatrixContext";
import { MatrixRoomList, MatrixChat, ServerLogTerminal, MatrixUserList, MessageCenter } from "@/components/matrix";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import axios from "axios";
import { X, Eye } from "lucide-react";
import { PRDDocumentPanel } from "@/components/PRDDocumentPanel";

// SOP阶段定义
type SOPStage = 'contract' | 'execution' | 'completed';

const SOP_STAGES: { id: SOPStage; label: string; icon: React.ReactNode }[] = [
  { id: 'contract', label: '需求合同', icon: <CheckCircle className="w-4 h-4" /> },
  { id: 'execution', label: '项目执行', icon: <Play className="w-4 h-4" /> },
  { id: 'completed', label: '项目结束', icon: <Flag className="w-4 h-4" /> },
];

// 项目SOP进度组件
function ProjectSOPProgress({ currentStage }: { currentStage: SOPStage }) {
  const stageIndex = SOP_STAGES.findIndex(s => s.id === currentStage);
  
  return (
    <div className="bg-[#1a1b26] border-b border-slate-700 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 font-medium">项目 SOP 流程</span>
        <span className="text-xs text-violet-400">
          当前阶段: {SOP_STAGES[stageIndex]?.label}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        {SOP_STAGES.map((stage, index) => {
          const isActive = index === stageIndex;
          const isCompleted = index < stageIndex;
          
          return (
            <div key={stage.id} className="flex items-center flex-1">
              <div 
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all",
                  isActive && "bg-violet-500/20 border border-violet-500/40 text-violet-400",
                  isCompleted && "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400",
                  !isActive && !isCompleted && "bg-slate-800/50 border border-slate-700 text-slate-500"
                )}
              >
                {isCompleted ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : isActive ? (
                  <Clock className="w-4 h-4 text-violet-400 animate-pulse" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-slate-600" />
                )}
                <span className="font-medium">{stage.label}</span>
              </div>
              
              {/* 连接线 */}
              {index < SOP_STAGES.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 mx-1",
                  index < stageIndex ? "bg-emerald-500" : "bg-slate-700"
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Workspace 文件列表接口
interface WorkspaceFile {
  name: string;
  size: number;
  modTime: string;
  type: string;
}

// Workspace 面板组件
function WorkspacePanel() {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 加载文件列表
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await axios.get('/api/workspace');
        if (res.data && Array.isArray(res.data)) {
          setFiles(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch workspace files:', err);
      }
    };
    fetchFiles();
  }, []);

  // 打开文件查看弹窗
  const handleOpenFile = async (filename: string) => {
    setSelectedFile(filename);
    setIsDialogOpen(true);
    setIsLoading(true);
    try {
      const res = await axios.get(`/api/workspace/${encodeURIComponent(filename)}`);
      setFileContent(res.data);
    } catch (err) {
      console.error('Failed to load file content:', err);
      setFileContent('无法加载文件内容');
    }
    setIsLoading(false);
  };

  // 关闭弹窗
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedFile(null);
    setFileContent('');
  };

  // 下载文件
  const handleDownload = (filename: string) => {
    window.open(`/api/workspace/${encodeURIComponent(filename)}`, '_blank');
  };

  return (
    <>
      <Card className="bg-[#1a1b26] border-slate-800 h-full flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-violet-400" />
              <CardTitle className="text-white text-sm">项目工作区</CardTitle>
              <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                {files.length}
              </span>
            </div>
            <button 
              className="text-slate-400 hover:text-violet-400 transition-colors"
              title="刷新"
              onClick={() => {
                axios.get('/api/workspace').then(res => setFiles(res.data || []));
              }}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </CardHeader>
        
        {/* 文件列表 - 全宽 */}
        <div className="flex-1 overflow-y-auto p-2 min-h-0">
          {files.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              暂无工作区文件
            </div>
          ) : (
            <div className="space-y-1">
              {files.map((file) => {
                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                const isDoc = ['md', 'txt', 'doc', 'docx', 'pdf'].includes(ext);
                
                return (
                  <div
                    key={file.name}
                    className="group flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-800/50 border border-transparent hover:border-slate-700 cursor-pointer transition-all"
                  >
                    {isDoc ? (
                      <File className="w-4 h-4 text-violet-400" />
                    ) : (
                      <Folder className="w-4 h-4 text-slate-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate text-slate-300">
                        {file.name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {Math.round(file.size / 1024)}KB
                      </div>
                    </div>
                    {/* 查看按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenFile(file.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-emerald-400 transition-all"
                      title="查看"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {/* 下载按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(file.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-violet-400 transition-all"
                      title="下载"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* 文件内容弹窗 */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 背景遮罩 */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={handleCloseDialog}
          />
          
          {/* 弹窗内容 */}
          <div className="relative w-[90%] max-w-3xl max-h-[80vh] bg-[#1a1b26] border border-slate-700 rounded-xl shadow-2xl flex flex-col">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
n                <File className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-medium text-white truncate max-w-[300px]">
                  {selectedFile}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => selectedFile && handleDownload(selectedFile)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-violet-400 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载
                </button>
                <button
                  onClick={handleCloseDialog}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* 弹窗内容区 */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="w-6 h-6 text-violet-400 animate-spin" />
                </div>
              ) : (
                <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
                  {fileContent}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function OPCWorkbench() {
  const { user } = useAuth();
  const location = useLocation();
  const [projectStage, setProjectStage] = useState<SOPStage>('contract');
  
  const {
    isInitialized,
    isLoading,
    error,
    initialize,
    currentRoom,
    selectRoom,
    matrixUserId,
    userOnline,
    updateActivity,
  } = useMatrix();

  useEffect(() => {
    const handleActivity = () => {
      updateActivity();
    };
    
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
    
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [updateActivity]);

  // Initialize Matrix client on mount
  useEffect(() => {
    if (user && !isInitialized && !isLoading) {
      initialize();
    }
    
    return () => {};
  }, [user, isInitialized, isLoading, initialize]);
  
  // Select room from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roomId = params.get('room');
    if (roomId && isInitialized && selectRoom) {
      setTimeout(() => {
        selectRoom(roomId);
      }, 500);
    }
  }, [location.search, isInitialized, selectRoom]);

  // 根据房间名推断项目阶段（演示逻辑）
  useEffect(() => {
    if (currentRoom) {
      const name = currentRoom.name.toLowerCase();
      if (name.includes('结束') || name.includes('完成')) {
        setProjectStage('completed');
      } else if (name.includes('执行') || name.includes('拍摄') || name.includes('制作')) {
        setProjectStage('execution');
      } else {
        setProjectStage('contract');
      }
    }
  }, [currentRoom]);

  return (
    <div className="h-screen bg-[#0a0a0f] p-4 lg:p-6 flex flex-col overflow-hidden">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 flex-1 min-h-0 h-full">
        {/* Left Panel: AI Team & Rooms */}
        <div className="w-full lg:w-72 flex flex-col gap-6 overflow-y-auto scrollbar-thin shrink-0 pb-4">
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
              
              {user && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <User className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-slate-400">OPC:</span>
                    <span className="text-white font-medium">{user.username}</span>
                    <div className="flex items-center gap-1 ml-auto">
                      <Circle className={cn(
                        "w-2 h-2",
                        userOnline ? "fill-green-500 text-green-500" : "fill-slate-500 text-slate-500"
                      )} />
                      <span className={cn(
                        "font-medium",
                        userOnline ? "text-green-400" : "text-slate-500"
                      )}>
                        {userOnline ? "在线" : "离线"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <AtSign className={cn(
                      "w-3.5 h-3.5",
                      isInitialized ? "text-emerald-400" : error ? "text-red-400" : "text-slate-500"
                    )} />
                    <span className="text-slate-400">Matrix:</span>
                    <span className={cn(
                      "font-medium",
                      isInitialized ? "text-emerald-400" : error ? "text-red-400" : "text-slate-500"
                    )}>
                      {matrixUserId ? matrixUserId.split(':')[0].replace('@', '') : '未连接'}
                    </span>
                    {isLoading ? (
                      <div className="flex items-center gap-1 ml-auto">
                        <RefreshCw className="w-3 h-3 animate-spin text-violet-400" />
                        <span className="text-violet-400 text-[10px]">连接中...</span>
                      </div>
                    ) : isInitialized ? (
                      <div className="flex items-center gap-1 ml-auto">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-emerald-400 text-[10px]">已连接</span>
                      </div>
                    ) : error ? (
                      <div className="flex items-center gap-1 ml-auto">
                        <WifiOff className="w-3 h-3 text-red-400" />
                        <button onClick={initialize} className="text-red-400 text-[10px] hover:text-red-300">重试</button>
                      </div>
                    ) : (
                      <button onClick={initialize} className="text-xs text-violet-400 hover:text-violet-300 ml-auto">连接</button>
                    )}
                  </div>
                </div>
              )}
            </CardHeader>
          </Card>
          {/* Message Center */}
          <MessageCenter />

          {/* Matrix Room List */}
          <MatrixRoomList className="flex-1" />

          {/* Server User List */}
          <MatrixUserList />
        </div>

        {/* Middle Panel: Matrix Chat with SOP Progress */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* SOP Progress Bar - 显示在每个项目沟通群顶部 */}
          {currentRoom && (
            <ProjectSOPProgress currentStage={projectStage} />
          )}
          
          <MatrixChat className="flex-1" />
        </div>

        {/* Right Panel: Workspace & Status */}
        <div className="w-full lg:w-80 flex flex-col gap-4 overflow-y-auto scrollbar-thin shrink-0 pb-4">
          {/* PRD Document Panel - PRD 文档 */}
          <PRDDocumentPanel className="shrink-0 h-44" />
          
          {/* Workspace Panel - 项目工作区 */}
          <WorkspacePanel />
          
          {/* Current Room Info - 简化版 */}
          {currentRoom && (
            <Card className="bg-[#1a1b26] border-slate-800 shrink-0">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                  <span>当前房间</span>
                </div>
                <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-3">
                  <div className="text-sm font-semibold text-white">
                    # {currentRoom.name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>{currentRoom.memberCount} 成员</span>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Server Log Terminal */}
          <ServerLogTerminal className="h-[200px] shrink-0" />
        </div>
      </div>
    </div>
  );
}