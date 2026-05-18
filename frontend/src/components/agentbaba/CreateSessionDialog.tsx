import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send } from "lucide-react";

const AIBIT_PENDING_KEY = "aibit_pending_message";

interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSessionDialog({
  open,
  onOpenChange,
}: CreateSessionDialogProps) {
  const navigate = useNavigate();
  const [requirement, setRequirement] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!requirement.trim()) return;

    setLoading(true);
    try {
      const text = requirement.trim();
      console.log("[TEST LOG][AgentBaba] Saving requirement and navigating to AiBit", { text });
      localStorage.setItem(AIBIT_PENDING_KEY, text);
      setRequirement("");
      onOpenChange(false);
      navigate("/aibit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-[var(--bg-elevated)] border-[var(--border-default)]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--primary-500)] to-purple-500 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl text-[var(--text-primary)]">
                AgentBaba - 智能体工厂
              </DialogTitle>
              <DialogDescription className="text-[var(--text-secondary)]">
                告诉我你想要什么，我来帮你创建
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="text-[var(--text-primary)] font-medium flex items-center gap-2 text-base">
              <span className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-gradient-to-r from-[var(--primary-500)] to-purple-500 text-white text-sm font-bold">
                AI比特：
              </span>
              请描述你的需求
            </label>
            <Textarea
              placeholder="你有什么需求"
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              rows={6}
              className="bg-[var(--bg-muted)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none"
            />
            <p className="text-xs text-[var(--text-muted)]">
              描述越详细，生成的智能体越符合你的需求。AI比特会通过对话帮你澄清细节。
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-[var(--border-default)]"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!requirement.trim() || loading}
            className="bg-[var(--primary-500)] hover:bg-[var(--primary-400)]"
          >
            <Send className="w-4 h-4 mr-2" />
            {loading ? "处理中..." : "让AI比特处理"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
