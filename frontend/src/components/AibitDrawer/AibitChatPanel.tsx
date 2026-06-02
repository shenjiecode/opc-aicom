import { useEffect, useRef } from "react"

import { useMatrix } from "@/contexts/MatrixContext"
import { cn } from "@/lib/utils"

/**
 * Format timestamp to HH:mm
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Skeleton loading component for messages
 */
function MessageSkeleton() {
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="w-9 h-9 rounded-full bg-slate-800 shrink-0" />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="h-4 w-20 bg-slate-800 rounded" />
          <div className="h-3 w-12 bg-slate-800/50 rounded" />
        </div>
        <div className="h-10 w-48 bg-slate-800 rounded-lg" />
      </div>
    </div>
  )
}

/**
 * Typing indicator with animated dots
 */
function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shrink-0">
        <span className="text-white text-sm">A</span>
      </div>
      <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 rounded-lg">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-xs text-slate-400 ml-1">正在输入</span>
      </div>
    </div>
  )
}

/**
 * Message type from MatrixContext
 */
interface MessageData {
  id: string
  sender: string
  senderName: string
  content: string
  timestamp: number
  isOwn: boolean
  msgtype?: string
}

/**
 * Single message item component
 */
interface MessageItemProps {
  message: MessageData
  showAvatar: boolean
}

function MessageItem({ message, showAvatar }: MessageItemProps) {
  return (
    <div
      className={cn(
        "flex gap-3",
        message.isOwn ? "flex-row-reverse" : ""
      )}
    >
      {showAvatar ? (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shrink-0">
          <span className="text-white text-sm">
            {message.senderName.charAt(0).toUpperCase()}
          </span>
        </div>
      ) : (
        <div className="w-9 shrink-0" />
      )}

      <div
        className={cn(
          "flex flex-col max-w-[70%]",
          message.isOwn ? "items-end" : "items-start"
        )}
      >
        {showAvatar && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-white">
              {message.isOwn ? "你" : message.senderName}
            </span>
            <span className="text-xs text-slate-500">
              {formatTime(message.timestamp)}
            </span>
          </div>
        )}
        <div
          className={cn(
            "px-3 py-2 rounded-lg text-sm",
            message.isOwn
              ? "bg-violet-500 text-white"
              : "bg-slate-800 text-slate-200"
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  )
}

/**
 * Empty state component
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="text-slate-500 text-sm">暂无私信</div>
      <div className="text-slate-600 text-xs mt-1">开始与 Aibit 助手对话</div>
    </div>
  )
}

/**
 * AibitChatPanel - Message list display for the Aibit drawer
 *
 * Features:
 * - Displays messages in a scrollable container
 * - Auto-scrolls to bottom when messages change
 * - Shows loading skeleton while fetching
 * - Shows typing indicator when AI is thinking
 * - Shows empty state when no messages
 */
export function AibitChatPanel() {
  const { messages, isLoading } = useMatrix()
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change (refresh or new message)
  useEffect(() => {
    if (containerRef.current) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight
        }
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [messages])

  return (
    <div
      data-testid="message-list"
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 space-y-3 chat-scroll"
    >
      {isLoading ? (
        // Loading skeleton
        <div className="space-y-4">
          <MessageSkeleton />
          <MessageSkeleton />
          <MessageSkeleton />
        </div>
      ) : messages.length === 0 ? (
        // Empty state
        <EmptyState />
      ) : (
        // Message list
        <div className="space-y-3">
          {messages.map((message, index) => {
            const showAvatar =
              index === 0 ||
              messages[index - 1].sender !== message.sender

            return (
              <MessageItem
                key={message.id}
                message={message}
                showAvatar={showAvatar}
              />
            )
          })}
          {/* Typing indicator - shown when last message is from user (waiting for AI response) */}
          {messages.length > 0 && messages[messages.length - 1].isOwn && (
            <TypingIndicator />
          )}
        </div>
      )}
    </div>
  )
}
