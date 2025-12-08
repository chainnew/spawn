import { useState } from 'react'
import { 
  Github, 
  GitBranch, 
  Star, 
  GitFork,
  Folder,
  RefreshCw,
  Download,
  Sparkles,
  Check,
  ExternalLink,
  Search,
  Lock,
  Unlock,
  Clock,
  Link,
  Loader2,
  AlertCircle
} from 'lucide-react'

export interface Repository {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  stargazers_count: number
  forks_count: number
  language: string | null
  updated_at: string
  default_branch: string
  clone_url: string
  html_url: string
}

interface GitHubPanelProps {
  onCloneRepo?: (repo: Repository) => void
  onClaudify?: (repo: Repository) => Promise<void>
  isClaudifying?: boolean
  claudifyingRepo?: string | null
}

// Mock repos for demo
const DEMO_REPOS: Repository[] = [
  {
    id: 1,
    name: 'spawn.new',
    full_name: 'user/spawn.new',
    description: 'AI-powered development environment with multi-agent orchestration',
    private: false,
    stargazers_count: 142,
    forks_count: 23,
    language: 'TypeScript',
    updated_at: '2024-12-09T10:30:00Z',
    default_branch: 'main',
    clone_url: 'https://github.com/user/spawn.new.git',
    html_url: 'https://github.com/user/spawn.new'
  },
  {
    id: 2,
    name: 'webvm',
    full_name: 'chainnew/webvm',
    description: 'Virtual Machine for the Web - Linux in your browser',
    private: false,
    stargazers_count: 77,
    forks_count: 37,
    language: 'JavaScript',
    updated_at: '2024-12-08T15:20:00Z',
    default_branch: 'main',
    clone_url: 'https://github.com/chainnew/webvm.git',
    html_url: 'https://github.com/chainnew/webvm'
  },
]

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Rust: '#dea584',
  Python: '#3572A5',
  Go: '#00ADD8',
  Ruby: '#701516',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
}

// Parse GitHub URL to extract owner/repo
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Handle various GitHub URL formats
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/\.]+)/,  // https://github.com/owner/repo
    /github\.com:([^\/]+)\/([^\/\.]+)/,    // git@github.com:owner/repo
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return { owner: match[1], repo: match[2].replace('.git', '') }
    }
  }
  return null
}

export default function GitHubPanel({ 
  onCloneRepo, 
  onClaudify,
  isClaudifying = false,
  claudifyingRepo = null
}: GitHubPanelProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [repos, setRepos] = useState<Repository[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null)
  const [cloning, setCloning] = useState<number | null>(null)
  
  // URL clone state
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [urlLoading, setUrlLoading] = useState(false)

  const handleConnect = async () => {
    setLoading(true)
    // TODO: Replace with real GitHub OAuth
    await new Promise(r => setTimeout(r, 1500))
    setIsConnected(true)
    setRepos(DEMO_REPOS)
    setLoading(false)
  }

  const handleClone = async (repo: Repository) => {
    setCloning(repo.id)
    await new Promise(r => setTimeout(r, 1500))
    setCloning(null)
    setSelectedRepo(repo)
    onCloneRepo?.(repo)
  }

  const handleClaudify = async (repo: Repository) => {
    await onClaudify?.(repo)
  }

  // Clone from URL
  const handleUrlClone = async () => {
    setUrlError(null)
    
    const parsed = parseGitHubUrl(urlInput)
    if (!parsed) {
      setUrlError('Invalid GitHub URL')
      return
    }

    setUrlLoading(true)

    try {
      // Create a repo object from the URL
      const repo: Repository = {
        id: Date.now(),
        name: parsed.repo,
        full_name: `${parsed.owner}/${parsed.repo}`,
        description: null,
        private: false,
        stargazers_count: 0,
        forks_count: 0,
        language: null,
        updated_at: new Date().toISOString(),
        default_branch: 'main',
        clone_url: `https://github.com/${parsed.owner}/${parsed.repo}.git`,
        html_url: `https://github.com/${parsed.owner}/${parsed.repo}`,
      }

      // Add to repos list
      setRepos(prev => [repo, ...prev])
      setSelectedRepo(repo)
      setUrlInput('')
      setShowUrlInput(false)
      
      // Trigger clone
      onCloneRepo?.(repo)
    } catch (err) {
      setUrlError((err as Error).message)
    } finally {
      setUrlLoading(false)
    }
  }

  const filteredRepos = repos.filter(repo => 
    repo.name.toLowerCase().includes(search.toLowerCase()) ||
    repo.description?.toLowerCase().includes(search.toLowerCase())
  )

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  // Not connected view
  if (!isConnected) {
    return (
      <div className="h-full flex flex-col bg-[#0d1117]">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <Github className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">GitHub</h3>
          <p className="text-sm text-gray-400 text-center mb-6 max-w-xs">
            Connect your GitHub or paste any public repo URL
          </p>
          
          {/* URL Input */}
          <div className="w-full max-w-xs mb-4">
            <div className="relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="https://github.com/owner/repo"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value)
                  setUrlError(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlClone()}
                className="w-full pl-9 pr-4 py-2.5 bg-[#161b22] border border-[#333] rounded-xl text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-spawn-accent"
              />
            </div>
            {urlError && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {urlError}
              </p>
            )}
            <button
              onClick={handleUrlClone}
              disabled={!urlInput || urlLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-spawn-accent text-black rounded-xl font-medium hover:bg-spawn-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {urlLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Clone Repository
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500 my-4">
            <div className="h-px flex-1 bg-[#333]" />
            <span>or</span>
            <div className="h-px flex-1 bg-[#333]" />
          </div>

          <button
            onClick={handleConnect}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#333] text-white rounded-xl font-medium hover:bg-[#444] transition-colors disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Github className="w-4 h-4" />
            )}
            {loading ? 'Connecting...' : 'Connect GitHub'}
          </button>
          <p className="text-[10px] text-gray-500 mt-2">
            Access your private repositories
          </p>
        </div>
      </div>
    )
  }

  // Connected view
  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Header */}
      <div className="p-3 border-b border-[#333]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-3 h-3 text-green-400" />
            </div>
            <span className="text-xs text-gray-300">Connected as <span className="text-white font-medium">@matto</span></span>
          </div>
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className={`p-1.5 rounded-lg transition-colors ${showUrlInput ? 'bg-spawn-accent/20 text-spawn-accent' : 'text-gray-500 hover:text-white hover:bg-[#333]'}`}
            title="Clone from URL"
          >
            <Link className="w-4 h-4" />
          </button>
        </div>
        
        {/* URL Input (collapsible) */}
        {showUrlInput && (
          <div className="mb-3 p-2 bg-[#161b22] rounded-lg border border-[#333]">
            <div className="relative">
              <input
                type="text"
                placeholder="https://github.com/owner/repo"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value)
                  setUrlError(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlClone()}
                className="w-full px-3 py-2 bg-[#0d1117] border border-[#333] rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-spawn-accent"
              />
            </div>
            {urlError && (
              <p className="text-xs text-red-400 mt-1">{urlError}</p>
            )}
            <button
              onClick={handleUrlClone}
              disabled={!urlInput || urlLoading}
              className="w-full mt-2 py-1.5 bg-spawn-accent text-black rounded-lg text-xs font-medium disabled:opacity-50"
            >
              {urlLoading ? 'Cloning...' : 'Clone'}
            </button>
          </div>
        )}
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#161b22] border border-[#333] rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-spawn-accent"
          />
        </div>
      </div>

      {/* Repo list */}
      <div className="flex-1 overflow-auto p-2">
        {filteredRepos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Folder className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No repositories found</p>
          </div>
        ) : (
          filteredRepos.map((repo) => {
            const isClaudifyingThis = claudifyingRepo === repo.name
            
            return (
              <div
                key={repo.id}
                className={`p-3 rounded-xl mb-2 border transition-all cursor-pointer ${
                  selectedRepo?.id === repo.id
                    ? 'bg-spawn-accent/10 border-spawn-accent/50'
                    : 'bg-[#161b22] border-[#333] hover:border-[#444]'
                }`}
                onClick={() => setSelectedRepo(repo)}
              >
                {/* Repo header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-spawn-accent" />
                    <span className="text-sm font-medium text-white">{repo.name}</span>
                    {repo.private && <Lock className="w-3 h-3 text-yellow-500" />}
                  </div>
                  <a 
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-gray-500 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Description */}
                {repo.description && (
                  <p className="text-xs text-gray-400 mb-2 line-clamp-2">{repo.description}</p>
                )}

                {/* Meta */}
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  {repo.language && (
                    <span className="flex items-center gap-1">
                      <span 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: LANGUAGE_COLORS[repo.language] || '#888' }}
                      />
                      {repo.language}
                    </span>
                  )}
                  {repo.stargazers_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {repo.stargazers_count}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(repo.updated_at)}
                  </span>
                </div>

                {/* Actions */}
                {selectedRepo?.id === repo.id && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-[#333]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleClone(repo)
                      }}
                      disabled={cloning === repo.id || isClaudifying}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#333] hover:bg-[#444] rounded-lg text-xs text-white transition-colors disabled:opacity-50"
                    >
                      {cloning === repo.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      Clone
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleClaudify(repo)
                      }}
                      disabled={isClaudifyingThis || isClaudifying}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-spawn-accent/20 to-purple-500/20 hover:from-spawn-accent/30 hover:to-purple-500/30 border border-spawn-accent/30 rounded-lg text-xs text-spawn-accent transition-colors disabled:opacity-50"
                    >
                      {isClaudifyingThis ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      Claude-ify
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[#333] bg-[#0a0a0a]">
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>{repos.length} repositories</span>
          <button 
            onClick={() => {/* refresh */}}
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
