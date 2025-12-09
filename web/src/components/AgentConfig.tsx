import { useState } from 'react'
import {
  Bot,
  Sparkles,
  Code2,
  Bug,
  FileText,
  Zap,
  ChevronRight,
  Copy,
  Check,
  Plus,
  Pencil
} from 'lucide-react'

// Preset agent configurations
const PRESET_AGENTS = [
  {
    id: 'architect',
    name: 'Code Architect',
    icon: Code2,
    color: '#58a6ff',
    description: 'Designs system architecture and implements features',
    systemPrompt: `You are an expert software architect and senior developer. Your role is to:

1. **Analyze Requirements**: Break down complex features into implementable components
2. **Design Systems**: Create scalable, maintainable architectures
3. **Write Clean Code**: Implement features using best practices and design patterns
4. **Consider Trade-offs**: Evaluate performance, maintainability, and complexity

When coding:
- Use TypeScript for type safety
- Follow SOLID principles
- Write self-documenting code with clear naming
- Include error handling and edge cases
- Suggest tests for critical paths

Always explain your architectural decisions and trade-offs.`
  },
  {
    id: 'debugger',
    name: 'Bug Hunter',
    icon: Bug,
    color: '#f85149',
    description: 'Finds and fixes bugs with systematic debugging',
    systemPrompt: `You are an expert debugger and problem solver. Your approach:

1. **Reproduce**: Understand the exact steps to reproduce the issue
2. **Isolate**: Narrow down the problem to specific code sections
3. **Analyze**: Examine stack traces, logs, and state
4. **Hypothesize**: Form theories about root causes
5. **Test**: Verify fixes don't introduce regressions

Debugging techniques you use:
- Binary search through commits/code
- Strategic console.log / breakpoints
- State inspection and data flow tracing
- Edge case analysis
- Memory and performance profiling

Always explain your debugging thought process step by step.`
  },
  {
    id: 'reviewer',
    name: 'Code Reviewer',
    icon: FileText,
    color: '#3fb950',
    description: 'Reviews code for quality, security, and best practices',
    systemPrompt: `You are a thorough code reviewer focused on quality. You check for:

**Correctness**
- Logic errors and edge cases
- Proper error handling
- Type safety and null checks

**Security**
- Input validation and sanitization
- Authentication/authorization issues
- Secrets exposure
- Injection vulnerabilities

**Performance**
- Unnecessary re-renders or computations
- Memory leaks
- N+1 queries
- Bundle size impact

**Maintainability**
- Code clarity and readability
- DRY violations
- Proper abstractions
- Documentation needs

Provide specific, actionable feedback with code examples.`
  },
  {
    id: 'optimizer',
    name: 'Performance Optimizer',
    icon: Zap,
    color: '#d29922',
    description: 'Optimizes code for speed and efficiency',
    systemPrompt: `You are a performance optimization specialist. You focus on:

**Frontend Performance**
- Bundle size reduction and code splitting
- React rendering optimization (memo, useMemo, useCallback)
- Image and asset optimization
- Critical rendering path
- Web Vitals (LCP, FID, CLS)

**Backend Performance**
- Database query optimization
- Caching strategies (Redis, CDN, in-memory)
- Connection pooling
- Async processing and queues

**Profiling**
- Identifying bottlenecks
- Memory profiling
- CPU flame graphs
- Network waterfall analysis

Always measure before and after. Provide benchmarks when possible.`
  },
  {
    id: 'creative',
    name: 'Creative Assistant',
    icon: Sparkles,
    color: '#a371f7',
    description: 'Helps with creative solutions and brainstorming',
    systemPrompt: `You are a creative problem solver and brainstorming partner. You help by:

**Ideation**
- Generating multiple solution approaches
- Thinking outside conventional patterns
- Combining ideas from different domains
- Exploring "what if" scenarios

**Innovation**
- Suggesting novel architectures
- Proposing creative UX solutions
- Finding elegant simplifications
- Identifying automation opportunities

**Communication**
- Naming things well (the hardest problem!)
- Writing clear documentation
- Creating helpful error messages
- Designing intuitive APIs

Approach problems with curiosity. Challenge assumptions. Propose bold ideas.`
  }
]

interface AgentConfigProps {
  onSelectAgent?: (agent: typeof PRESET_AGENTS[0]) => void
  selectedAgentId?: string
}

export default function AgentConfig({ onSelectAgent, selectedAgentId }: AgentConfigProps) {
  const [activeAgent, setActiveAgent] = useState(selectedAgentId || 'architect')
  const [customPrompt, setCustomPrompt] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [_showCustom, setShowCustom] = useState(false)

  const currentAgent = PRESET_AGENTS.find(a => a.id === activeAgent) || PRESET_AGENTS[0]

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentAgent.systemPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSelectAgent = (agent: typeof PRESET_AGENTS[0]) => {
    setActiveAgent(agent.id)
    onSelectAgent?.(agent)
  }

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Agent selector tabs */}
      <div className="p-2 border-b border-[#333]">
        <div className="flex gap-1 flex-wrap">
          {PRESET_AGENTS.map((agent) => {
            const Icon = agent.icon
            const isActive = activeAgent === agent.id
            return (
              <button
                key={agent.id}
                onClick={() => handleSelectAgent(agent)}
                className={`
                  flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium
                  transition-all duration-200
                  ${isActive 
                    ? 'bg-white/10 text-white' 
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }
                `}
                style={isActive ? { 
                  boxShadow: `0 0 12px ${agent.color}30`,
                  borderColor: agent.color 
                } : {}}
              >
                <Icon className="w-3 h-3" style={{ color: agent.color }} />
                <span>{agent.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Agent details */}
      <div className="flex-1 overflow-auto p-3">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${currentAgent.color}20` }}
          >
            <currentAgent.icon className="w-5 h-5" style={{ color: currentAgent.color }} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">{currentAgent.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{currentAgent.description}</p>
          </div>
        </div>

        {/* System prompt */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-gray-500">System Prompt</span>
            <div className="flex gap-1">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title="Edit prompt"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={handleCopy}
                className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title="Copy prompt"
              >
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
          
          {isEditing ? (
            <textarea
              value={customPrompt || currentAgent.systemPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full h-64 bg-[#161b22] border border-[#333] rounded-lg p-3 text-xs text-gray-300 font-mono resize-none focus:outline-none focus:border-spawn-accent"
              placeholder="Enter custom system prompt..."
            />
          ) : (
            <div className="bg-[#161b22] border border-[#333] rounded-lg p-3 max-h-64 overflow-auto">
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
                {currentAgent.systemPrompt}
              </pre>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="mt-4 pt-4 border-t border-[#333]">
          <span className="text-[10px] uppercase tracking-wider text-gray-500">Quick Actions</span>
          <div className="mt-2 space-y-1">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-300 hover:bg-white/5 transition-colors text-left">
              <ChevronRight className="w-3 h-3 text-gray-500" />
              <span>Apply to current chat</span>
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-300 hover:bg-white/5 transition-colors text-left">
              <ChevronRight className="w-3 h-3 text-gray-500" />
              <span>Set as default agent</span>
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-300 hover:bg-white/5 transition-colors text-left">
              <ChevronRight className="w-3 h-3 text-gray-500" />
              <span>Export configuration</span>
            </button>
          </div>
        </div>

        {/* Custom agents section */}
        <div className="mt-4 pt-4 border-t border-[#333]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-gray-500">Custom Agents</span>
            <button 
              onClick={() => setShowCustom(true)}
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-spawn-accent transition-colors"
              title="Add custom agent"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500 text-center py-4">
            <Bot className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p>No custom agents yet</p>
            <p className="text-[10px] mt-1">Create your own agent configurations</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[#333] bg-[#0a0a0a]">
        <button 
          className="w-full py-2 px-4 rounded-lg text-xs font-medium transition-all"
          style={{ 
            backgroundColor: `${currentAgent.color}20`,
            color: currentAgent.color,
          }}
        >
          <span className="flex items-center justify-center gap-2">
            <currentAgent.icon className="w-3 h-3" />
            Activate {currentAgent.name}
          </span>
        </button>
      </div>
    </div>
  )
}

export { PRESET_AGENTS }
