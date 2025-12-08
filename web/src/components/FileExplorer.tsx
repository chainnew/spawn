import { useState, useEffect } from 'react'
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  Cog,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { useAppStore, FileNode } from '../stores/app'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : ''

export default function FileExplorer() {
  const { files, setFiles, selectedFile, setSelectedFile, openFile } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    fetchFiles()
  }, [])

  const fetchFiles = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch(`${API_BASE}/api/files`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      
      const data = await res.json()
      // Transform backend format to our format
      const transformed = transformFiles(data)
      setFiles(transformed)
    } catch (e) {
      console.error('Failed to fetch files:', e)
      setError('Failed to load files')
      // Use demo files as fallback
      setFiles(demoFiles)
    } finally {
      setLoading(false)
    }
  }

  const transformFiles = (nodes: any[]): FileNode[] => {
    return nodes.map(node => ({
      name: node.name,
      type: node.type === 'directory' ? 'directory' : 'file',
      path: node.path,
      children: node.children ? transformFiles(node.children) : undefined,
    }))
  }

  const handleFileClick = async (node: FileNode) => {
    if (node.type === 'file') {
      setSelectedFile(node.path)
      
      try {
        const res = await fetch(`${API_BASE}/api/files/${encodeURIComponent(node.path)}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        
        const content = await res.text()
        openFile(node.path, content)
      } catch (e) {
        console.error('Failed to read file:', e)
        openFile(node.path, `// Failed to load ${node.name}`)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-spawn-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-2 px-2">
        <span className="text-xs text-spawn-muted uppercase tracking-wider">Files</span>
        <button 
          onClick={fetchFiles}
          className="p-1 hover:bg-spawn-border rounded text-spawn-muted hover:text-spawn-text"
          title="Refresh"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
      
      {error && (
        <div className="text-xs text-spawn-red px-2 mb-2">{error}</div>
      )}
      
      {files.length === 0 ? (
        <div className="text-spawn-muted text-sm p-2">No files</div>
      ) : (
        files.map((node) => (
          <FileTreeNode 
            key={node.path} 
            node={node} 
            depth={0}
            selectedPath={selectedFile}
            onSelect={handleFileClick}
          />
        ))
      )}
    </div>
  )
}

function FileTreeNode({ 
  node, 
  depth, 
  selectedPath,
  onSelect,
}: { 
  node: FileNode
  depth: number
  selectedPath: string | null
  onSelect: (node: FileNode) => void
}) {
  const [expanded, setExpanded] = useState(depth < 1)
  
  const isSelected = node.path === selectedPath
  const isDirectory = node.type === 'directory'
  
  const getIcon = () => {
    if (isDirectory) {
      return expanded 
        ? <FolderOpen className="w-4 h-4 text-spawn-accent" />
        : <Folder className="w-4 h-4 text-spawn-accent" />
    }
    
    const ext = node.name.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'rs':
        return <FileCode className="w-4 h-4 text-orange-400" />
      case 'ts':
      case 'tsx':
        return <FileCode className="w-4 h-4 text-blue-400" />
      case 'js':
      case 'jsx':
        return <FileCode className="w-4 h-4 text-yellow-400" />
      case 'py':
        return <FileCode className="w-4 h-4 text-green-400" />
      case 'json':
        return <FileJson className="w-4 h-4 text-yellow-500" />
      case 'toml':
        return <Cog className="w-4 h-4 text-gray-400" />
      case 'md':
        return <FileText className="w-4 h-4 text-spawn-muted" />
      case 'sql':
        return <FileCode className="w-4 h-4 text-cyan-400" />
      default:
        return <File className="w-4 h-4 text-spawn-muted" />
    }
  }

  return (
    <div>
      <div
        className={`
          flex items-center gap-1 py-1 px-2 rounded cursor-pointer
          file-item
          ${isSelected ? 'selected' : ''}
        `}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (isDirectory) {
            setExpanded(!expanded)
          } else {
            onSelect(node)
          }
        }}
      >
        {isDirectory && (
          <span className="w-4 h-4 flex items-center justify-center">
            {expanded 
              ? <ChevronDown className="w-3 h-3 text-spawn-muted" />
              : <ChevronRight className="w-3 h-3 text-spawn-muted" />
            }
          </span>
        )}
        {!isDirectory && <span className="w-4" />}
        {getIcon()}
        <span className="text-sm text-spawn-text truncate">{node.name}</span>
      </div>
      
      {isDirectory && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Demo file structure (fallback)
const demoFiles: FileNode[] = [
  {
    name: 'crates',
    type: 'directory',
    path: 'crates',
    children: [
      {
        name: 'spawn-core',
        type: 'directory',
        path: 'crates/spawn-core',
        children: [
          { name: 'Cargo.toml', type: 'file', path: 'crates/spawn-core/Cargo.toml' },
          {
            name: 'src',
            type: 'directory',
            path: 'crates/spawn-core/src',
            children: [
              { name: 'lib.rs', type: 'file', path: 'crates/spawn-core/src/lib.rs' },
            ],
          },
        ],
      },
    ],
  },
  { name: 'Cargo.toml', type: 'file', path: 'Cargo.toml' },
  { name: 'README.md', type: 'file', path: 'README.md' },
]
