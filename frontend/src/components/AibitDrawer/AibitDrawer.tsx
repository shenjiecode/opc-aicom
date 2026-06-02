import { X } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { useAibitDrawer } from "@/contexts/AibitDrawerContext"
import { AibitChatPanel } from "./AibitChatPanel"
import { AibitChatInput } from "./AibitChatInput"
import { useMatrix } from "@/contexts/MatrixContext"

/**
 * AibitDrawer - Sheet wrapper containing the chat panel
 *
 * Features:
 * - Slides from right on open
 * - Contains chat panel (AibitChatPanel) and input (AibitChatInput)
 * - ESC key closes drawer (built into Sheet)
 * - Focus trap active when open (built into Sheet)
 * - aria-live announces drawer state (built into Sheet)
 * - Width: 400px desktop (lg:), 100% mobile
 */
export function AibitDrawer() {
  const { isOpen, closeDrawer } = useAibitDrawer()
  const { sendMessage, isLoading } = useMatrix()

  const handleSend = async (message: string) => {
    await sendMessage(message)
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open: boolean) => !open && closeDrawer()}>
      <SheetContent
        side="right"
        className="w-full lg:w-[400px] p-0 flex flex-col h-full border-l border-slate-800 bg-[#13141f]"
      >
        <SheetHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="flex flex-col">
            <SheetTitle className="text-white text-base">Aibit 助手</SheetTitle>
            <SheetDescription className="text-slate-500 text-xs">
              AI 智能助手，随时为您服务
            </SheetDescription>
          </div>
          <button
            onClick={closeDrawer}
            className="p-2 rounded-md hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-600"
            aria-label="关闭"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </SheetHeader>

        <AibitChatPanel />

        <AibitChatInput
          onSend={handleSend}
          placeholder="输入消息..."
          disabled={isLoading}
          className="shrink-0"
        />
      </SheetContent>
    </Sheet>
  )
}
