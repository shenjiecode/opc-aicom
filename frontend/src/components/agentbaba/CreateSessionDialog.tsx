import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Send } from "lucide-react";
import type { CreateSessionRequest } from "@/lib/api/agentbaba";

interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateSessionRequest) => void;
}

export function CreateSessionDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateSessionDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;

    setLoading(true);
    try {
      onSubmit({ title, description });
      setTitle("");
      setDescription("");
      onOpenChange(false);
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
                创建新 Agent
              </DialogTitle>
              <DialogDescription className="text-[var(--text-secondary)]">
                描述你想要的 Agent 功能，我会帮你一步步完成创建
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-[var(--text-primary)]">
              Agent 名称
            </Label>
            <Input
              id="title"
              placeholder="例如：智能客服助手"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-[var(--bg-muted)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-[var(--text-primary)]">
              功能描述
            </Label>
            <Textarea
              id="description"
              placeholder="请详细描述你希望这个 Agent 能做什么...&#10;&#10;例如：帮助用户查询订单状态、处理退款申请、回答常见问题。需要能够连接数据库查询订单信息，并通过邮件通知用户处理结果。"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="bg-[var(--bg-muted)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none"
            />
            <p className="text-xs text-[var(--text-muted)]">
              描述越详细，生成的 Agent 越符合你的需求
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
            disabled={!title.trim() || !description.trim() || loading}
            className="bg-[var(--primary-500)] hover:bg-[var(--primary-400)]"
          >
            <Send className="w-4 h-4 mr-2" />
            {loading ? "创建中..." : "开始创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
