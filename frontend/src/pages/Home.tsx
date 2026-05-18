import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSubmit = () => {
    if (query.trim()) {
      navigate(`/aibit?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-200/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-200/15 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-100/10 rounded-full blur-3xl" />

      {/* Main content */}
      <div className="z-10 flex flex-col items-center justify-center px-4 w-full max-w-2xl">
        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-12 tracking-tight">
          <span className="bg-gradient-to-r from-slate-800 via-blue-800 to-indigo-700 bg-clip-text text-transparent">
            欢迎来到 青橙国际OPC社区
          </span>
        </h1>

        {/* Search box */}
        <div className="w-full max-w-xl relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500 opacity-0 group-hover:opacity-100" />
          AI比特：
          <div className="relative flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-lg shadow-slate-200/50 px-4 py-3 transition-all duration-300 hover:shadow-xl hover:shadow-slate-300/50 hover:border-slate-300/80">
             <Input
              type="text"
              placeholder="输入您的需求..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 border-0 bg-transparent text-slate-700 placeholder:text-slate-400 text-base focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
            />
            <Button
              size="icon"
              onClick={handleSubmit}
              disabled={!query.trim()}
              className="shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl h-10 w-10 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      {/* Footer */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-2">
        <img 
          src="/bitOcto.png" 
          alt="BitOcto Logo" 
          className="h-5 w-auto opacity-70"
        />
        <p className="text-sm text-slate-400 font-medium tracking-wide">
          powered by BitOcto
        </p>
      </div>
    </div>
  );
}
