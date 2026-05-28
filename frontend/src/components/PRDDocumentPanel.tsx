import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  ExternalLink,
  RefreshCw,
  Eye,
  Download,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PRDDocument {
  name: string;
  path: string;
  size: number;
  modTime: string;
}

interface PRDDocumentPanelProps {
  className?: string;
  prdPath?: string; // 从项目传入的 PRD 文件路径
}

export function PRDDocumentPanel({ className, prdPath }: PRDDocumentPanelProps) {
  const [prdFiles, setPrdFiles] = useState<PRDDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 加载 PRD 文件列表
  useEffect(() => {
    const fetchPRDFiles = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/prds");
        const data = await res.json();
        if (data && Array.isArray(data)) {
          setPrdFiles(data);
        }
      } catch (err) {
        console.error("Failed to fetch PRD files:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPRDFiles();
  }, []);

  // 如果传入 prdPath，自动选择
  useEffect(() => {
    if (prdPath && prdFiles.length > 0) {
      const matchingFile = prdFiles.find(f => f.path === prdPath || f.name.includes(prdPath));
      if (matchingFile) {
        setSelectedFile(matchingFile.path);
      }
    }
  }, [prdPath, prdFiles]);

  const handleViewFile = async (path: string) => {
    setSelectedFile(path);
    setIsDialogOpen(true);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/prds/${encodeURIComponent(path.split("/").pop() || path)}`);
      setFileContent(await res.text());
    } catch (err) {
      console.error("Failed to load PRD content:", err);
      setFileContent("无法加载 PRD 文档内容");
    }
    setIsLoading(false);
  };

  const handleDownload = (path: string) => {
    window.open(`/api/prds/${encodeURIComponent(path.split("/").pop() || path)}`, "_blank");
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setFileContent("");
  };

  return (
    <>
      <Card className={cn("bg-[#1a1b26] border-slate-800 flex flex-col", className)}>
        <CardHeader className="pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              <CardTitle className="text-white text-sm">PRD 文档</CardTitle>
              <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                {prdFiles.length}
              </span>
            </div>
            <button
              className="text-slate-400 hover:text-emerald-400 transition-colors"
              title="刷新"
              onClick={() => {
                fetch("/api/prds")
                  .then(res => res.json())
                  .then(data => setPrdFiles(data || []));
              }}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-2 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
            </div>
          ) : prdFiles.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              暂无 PRD 文档
            </div>
          ) : (
            <div className="space-y-2">
              {prdFiles.map((file) => (
                <div
                  key={file.path}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800/50 border transition-all cursor-pointer",
                    selectedFile === file.path
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-transparent hover:border-slate-700"
                  )}
                  onClick={() => handleViewFile(file.path)}
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate text-slate-300">
                      {file.name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {Math.round(file.size / 1024)}KB
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewFile(file.path);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-emerald-400 transition-all"
                    title="查看"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(file.path);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-violet-400 transition-all"
                    title="下载"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PRD 文档内容弹窗 */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleCloseDialog} />
          <div className="relative w-[90%] max-w-4xl max-h-[80vh] bg-[#1a1b26] border border-slate-700 rounded-xl shadow-2xl flex flex-col">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-white truncate max-w-[300px]">
                  {selectedFile?.split("/").pop()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => selectedFile && handleDownload(selectedFile)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  打开
                </button>
                <button onClick={handleCloseDialog} className="p-1 text-slate-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 弹窗内容区 */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
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