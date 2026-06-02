import { useState, type KeyboardEvent, type ChangeEvent } from "react"

import { Send } from "lucide-react"

import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AibitChatInputProps {
  onSend?: (message: string) => Promise<void> | void
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * AibitChatInput - Message input component for the Aibit drawer
 *
 * Features:
 * - Enter to send message
 * - Shift+Enter for newline
 * - Send button with loading state
 * - Disabled state during sending
 */
export function AibitChatInput({
  onSend,
  placeholder = "输入消息...",
  disabled = false,
  className,
}: AibitChatInputProps) {
  const [message, setMessage] = useState("")
  const [isSending, setIsSending] = useState(false)

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = async () => {
    const trimmedMessage = message.trim()
    if (!trimmedMessage || isSending || disabled) {
      return
    }

    setIsSending(true)
    try {
      if (onSend) {
        await onSend(trimmedMessage)
      }
      setMessage("")
    } finally {
      setIsSending(false)
    }
  }

  const isDisabled = disabled || isSending

  return (
    <div className={cn("flex items-end gap-2 p-3 border-t border-slate-800 bg-[#13141f]", className)}>
      <Textarea
        data-testid="chat-input"
        value={message}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isDisabled}
        rows={1}
        className="min-h-[44px] max-h-[120px] resize-none bg-slate-800 text-white placeholder:text-slate-500 border-slate-700 focus-visible:ring-slate-600"
      />
      <Button
        size="icon"
        onClick={handleSend}
        disabled={!message.trim() || isDisabled}
        className="shrink-0 h-11 w-11 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-700 disabled:opacity-50"
      >
        {isSending ? (
          <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}