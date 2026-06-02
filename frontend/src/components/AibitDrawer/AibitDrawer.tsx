import { Circle, Loader2, Wifi, WifiOff } from "lucide-react"
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
 * - Connects to Matrix if not initialized
 * - Auto-selects or creates bite DM room when opened
 * - Shows connection status indicator
 * - ESC key closes drawer (built into Sheet)
 * - Focus trap active when open (built into Sheet)
 * - aria-live announces drawer state (built into Sheet)
 * - Width: 400px desktop (lg:), 100% mobile
 */
export function AibitDrawer() {
  const { isOpen, closeDrawer, initialMessage } = useAibitDrawer()
  const { sendMessage, isLoading, currentRoom, rooms, isInitialized, initialize, createDirectMessage, selectRoom, getUserPresence, error } = useMatrix()
  const [isPreparingRoom, setIsPreparingRoom] = useState(false)
  const [isConnectingMatrix, setIsConnectingMatrix] = useState(false)
  const [biteOnline, setBiteOnline] = useState<boolean | null>(null)

  // Connect to Matrix if not initialized
  useEffect(() => {
    if (!isOpen) return;
    
    if (!isInitialized) {
      setIsConnectingMatrix(true);
      initialize().then(() => {
        setIsConnectingMatrix(false);
      }).catch((err) => {
        console.error('[AibitDrawer] Failed to initialize Matrix:', err);
        setIsConnectingMatrix(false);
      });
    }
  }, [isOpen, isInitialized, initialize]);

  // Check bite online status
  useEffect(() => {
    if (!isOpen || !isInitialized) return;

    const checkBiteStatus = async () => {
      try {
        const { isOnline } = await getUserPresence(BITE_USER_ID);
        setBiteOnline(isOnline);
      } catch (err) {
        console.error('[AibitDrawer] Failed to get bite presence:', err);
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
    if (!isOpen || !isInitialized || isConnectingMatrix) return;

    const prepareBiteRoom = async () => {
      // Check if current room is already a bite DM room
      const biteUserPattern = /@bite:/i;
      const isBiteRoom = currentRoom?.isDirect && 
        currentRoom.directWith && 
        biteUserPattern.test(currentRoom.directWith);
      
      if (isBiteRoom) return; // Already in bite room, skip
      
      setIsPreparingRoom(true);
      try {
        // Find existing bite DM room
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
      } catch (err) {
        console.error('[AibitDrawer] Failed to prepare bite room:', err);
      } finally {
        setIsPreparingRoom(false);
      }
    };

    prepareBiteRoom();
  }, [isOpen, isInitialized, isConnectingMatrix, currentRoom, rooms, createDirectMessage, selectRoom]);

  const handleSend = async (message: string) => {
    if (!currentRoom) {
      console.error('[AibitDrawer] No room selected, cannot send message');
      return;
    }
    await sendMessage(message);
  }

  // Determine if input should be disabled
  const isInputDisabled = isLoading || isPreparingRoom || isConnectingMatrix || !isInitialized;

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
              {/* Connection status indicator */}
              {isConnectingMatrix ? (
                <div className="flex items-center gap-1">
                  <Wifi className="h-3 w-3 animate-pulse text-blue-500" />
                  <span className="text-xs text-blue-500">连接 Matrix...</span>
                </div>
              ) : isPreparingRoom ? (
                <div className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                  <span className="text-xs text-amber-500">连接中...</span>
                </div>
              ) : error ? (
                <div className="flex items-center gap-1">
                  <WifiOff className="h-3 w-3 text-red-500" />
                  <span className="text-xs text-red-500">连接失败</span>
                </div>
              ) : !isInitialized ? (
                <div className="flex items-center gap-1">
                  <WifiOff className="h-3 w-3 text-slate-500" />
                  <span className="text-xs text-slate-500">未连接</span>
                </div>
              ) : biteOnline !== null ? (
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
              ) : null}
            </div>
            <SheetDescription className="text-slate-500 text-xs">
              AI 智能助手，随时为您服务
            </SheetDescription>
          </div>
        </SheetHeader>

        <AibitChatPanel />

        <AibitChatInput
          onSend={handleSend}
          placeholder={isConnectingMatrix ? "正在连接 Matrix..." : isInputDisabled ? "请等待连接完成" : "输入消息..."}
          disabled={isInputDisabled}
          className="shrink-0"
          initialMessage={initialMessage}
        />
      </SheetContent>
    </Sheet>
  )
}