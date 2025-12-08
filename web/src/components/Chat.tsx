import { useState, useRef, useEffect } from 'react'
import { Sparkles, User } from 'lucide-react'
import { PromptInputBox } from './ui/ai-prompt-box'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : ''

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hey! I'm your AI coding assistant. What would you like to build today?",
      timestamp: new Date(),
    },
  ])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (message: string, files?: File[]) => {
    if (!message.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      
      const data = await res.json()
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (e) {
      console.error('Chat error:', e)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I couldn't connect to the backend. Make sure the server is running on port 3000.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-3">
            <div className={`
              w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
              ${msg.role === 'assistant' ? 'bg-spawn-accent/20' : 'bg-spawn-surface'}
            `}>
              {msg.role === 'assistant' 
                ? <Sparkles className="w-4 h-4 text-spawn-accent" />
                : <User className="w-4 h-4 text-spawn-muted" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-spawn-text whitespace-pre-wrap break-words leading-relaxed">
                {msg.content}
              </p>
              <p className="text-xs text-spawn-muted mt-1.5">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-spawn-accent/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-spawn-accent animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="flex gap-1 items-center">
                <div className="w-2 h-2 rounded-full bg-spawn-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-spawn-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-spawn-accent animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-spawn-border">
        <PromptInputBox 
          onSend={handleSend}
          isLoading={loading}
          placeholder="Ask me anything..."
        />
      </div>
    </div>
  )
}
