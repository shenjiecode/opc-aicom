import { Circle } from "lucide-react"
import { useState, useEffect } from "react"

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

const BITE_USER_ID = '@bite:8.217.143.228';

/**
 * AibitDrawer - Sheet wrapper containing the chat panel
 *
 * Features:
 * - Slides from right on open
 * - Contains chat panel (AibitChatPanel) and input (AibitChatInput)
 * - Auto-selects or creates bite DM room when opened
 * - Shows bite online status indicator
 * - ESC key closes drawer (built into Sheet)
 * - Focus trap active when open (built into Sheet)
 * - aria-live announces drawer state (built into Sheet)
 * - Width: 400px desktop (lg:), 100% mobile
 */
export function AibitDrawer() {
  const { isOpen, closeDrawer } = useAibitDrawer()
  const { sendMessage, isLoading, currentRoom, rooms, isInitialized, createDirectMessage, selectRoom, getUserPresence } = useMatrix()
  const [isPreparingRoom, setIsPreparingRoom] = useState(false)
  const [biteOnline, setBiteOnline] = useState<boolean | null>(null)

  // Check bite online status
  useEffect(() => {
    if (!isOpen || !isInitialized) return;

    const checkBiteStatus = async () => {
      try {
        const { isOnline } = await getUserPresence(BITE_USER_ID);
        setBiteOnline(isOnline);
      } catch (error) {
        console.error('[AibitDrawer] Failed to get bite presence:', error);
        setBiteOnline(null);
      }
    };

    checkBiteStatus();
    // Re-check every 30 seconds while drawer is open
    const interval = setInterval(checkBiteStatus, 30000);
    return () => clearInterval(interval);
  }, [isOpen, isInitialized, getUserPresence]);

  // Auto-select/create bite room when drawer opens
  useEffect(() => {
    if (!isOpen || !isInitialized) return;

    const prepareBiteRoom = async () => {
      // If already have a room selected, skip
      if (currentRoom) return;

      setIsPreparingRoom(true);
      try {
        // Find existing bite DM room
        const biteUserPattern = /@bite:/i;
        const biteDMRooms = rooms.filter(room =>
          room.isDirect && room.directWith && biteUserPattern.test(room.directWith)
        );

        if (biteDMRooms.length > 0) {
          // Select existing room
          selectRoom(biteDMRooms[0].roomId);
        } else {
          // Create new DM room
          const roomId = await createDirectMessage(BITE_USER_ID, 'bite');
          selectRoom(roomId);
        }
      } catch (error) {
        console.error('[AibitDrawer] Failed to prepare bite room:', error);
      } finally {
        setIsPreparingRoom(false);
      }
    };

    prepareBiteRoom();
  }, [isOpen, isInitialized, currentRoom, rooms, createDirectMessage, selectRoom]);

  const handleSend = async (message: string) => {
    if (!currentRoom) {
      console.error('[AibitDrawer] No room selected, cannot send message');
      return;
    }
    await sendMessage(message);
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open: boolean) => !open && closeDrawer()}>
      <SheetContent
        side="right"
        className="w-full lg:w-[400px] p-0 flex flex-col h-full border-l border-slate-800 bg-[#13141f]"
      >
        <SheetHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-white text-base">比特AI</SheetTitle>
              {/* Online status indicator */}
              {biteOnline !== null && (
                <div className="flex items-center gap-1">
                  <Circle
                    className={`h-2 w-2 ${
                      biteOnline
                        ? 'fill-green-500 text-green-500'
                        : 'fill-slate-500 text-slate-500'
                    }`}
                  />
                  <span className={`text-xs ${biteOnline ? 'text-green-500' : 'text-slate-500'}`}>
                    {biteOnline ? '在线' : '离线'}
                  </span>
                </div>
              )}
            </div>
            <SheetDescription className="text-slate-500 text-xs">
              AI 智能助手，随时为您服务
            </SheetDescription>
          </div>
        </SheetHeader>

        <AibitChatPanel />

        <AibitChatInput
          onSend={handleSend}
          placeholder="输入消息..."
          disabled={isLoading || isPreparingRoom}
          className="shrink-0"
        />
      </SheetContent>
    </Sheet>
  )
}
