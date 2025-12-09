// ============================================================
// FILE: artifact.types.ts
// PURPOSE: Complete Artifact Schema TypeScript definitions
// VERSION: 1.0.0
// USAGE: Import into spawn.new for type-safe artifact handling
// ============================================================

// ═══════════════════════════════════════════════════════════════
// CORE TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * All supported artifact types
 */
export type ArtifactType =
  // Code
  | 'code'
  | 'code:module'
  | 'code:script'
  | 'code:snippet'
  // Frontend
  | 'react'
  | 'react:app'
  | 'vue'
  | 'vue:app'
  | 'svelte'
  | 'html'
  | 'html:app'
  // Visual
  | 'svg'
  | 'canvas'
  | 'webgl'
  | 'd3'
  | 'chart'
  | 'diagram'
  | 'image'
  // Document
  | 'markdown'
  | 'document'
  | 'slides'
  | 'spreadsheet'
  | 'notebook'
  // Data
  | 'json'
  | 'json:schema'
  | 'json:config'
  | 'yaml'
  | 'csv'
  | 'sql'
  | 'graphql'
  // API
  | 'api:rest'
  | 'api:graphql'
  | 'api:websocket'
  | 'api:mock'
  // Media
  | 'audio'
  | 'video'
  | 'model3d'
  // Interactive
  | 'terminal'
  | 'repl'
  | 'form'
  | 'dashboard'
  // Infrastructure
  | 'docker'
  | 'terraform'
  | 'workflow'
  | 'config'
  // Composite
  | 'project'
  | 'workspace'
  | 'bundle';

export type ArtifactCategory =
  | 'code'
  | 'frontend'
  | 'visual'
  | 'document'
  | 'data'
  | 'api'
  | 'media'
  | 'interactive'
  | 'infrastructure'
  | 'composite';

export type ArtifactStatus =
  | 'draft'
  | 'complete'
  | 'validated'
  | 'error'
  | 'deprecated'
  | 'archived';

// ═══════════════════════════════════════════════════════════════
// FILE TYPES
// ═══════════════════════════════════════════════════════════════

export type Language =
  // Programming
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'csharp'
  | 'cpp'
  | 'c'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'kotlin'
  | 'scala'
  | 'elixir'
  | 'haskell'
  // Web
  | 'html'
  | 'css'
  | 'scss'
  | 'less'
  | 'jsx'
  | 'tsx'
  | 'vue'
  | 'svelte'
  // Data
  | 'json'
  | 'yaml'
  | 'toml'
  | 'xml'
  | 'csv'
  // Query
  | 'sql'
  | 'graphql'
  | 'prisma'
  // Config
  | 'dockerfile'
  | 'makefile'
  | 'nginx'
  | 'terraform'
  | 'hcl'
  // Shell
  | 'bash'
  | 'sh'
  | 'powershell'
  | 'fish'
  | 'zsh'
  // Docs
  | 'markdown'
  | 'mdx'
  | 'rst'
  | 'asciidoc'
  | 'latex'
  // Other
  | 'plaintext'
  | 'binary'
  | 'unknown';

export type FileRole =
  | 'source'
  | 'test'
  | 'config'
  | 'asset'
  | 'documentation'
  | 'generated'
  | 'build'
  | 'schema'
  | 'migration'
  | 'fixture'
  | 'example';

export interface FileMetadata {
  source?: string;
  generated_at?: string;
  generator?: {
    name: string;
    version: string;
  };
  [key: string]: unknown;
}

export interface ArtifactFile {
  path: string;
  language: Language;
  content: string;
  role?: FileRole;
  entrypoint?: boolean;
  executable?: boolean;
  metadata?: FileMetadata;
  checksum?: string;
  size?: number;
  encoding?: 'utf-8' | 'base64' | 'binary';
}

// ═══════════════════════════════════════════════════════════════
// ASSET TYPES
// ═══════════════════════════════════════════════════════════════

export type AssetType =
  | 'image'
  | 'font'
  | 'audio'
  | 'video'
  | 'wasm'
  | 'binary'
  | 'archive';

export interface AssetMetadata {
  // Image
  width?: number;
  height?: number;
  format?: string;
  // Audio/video
  duration?: number;
  bitrate?: number;
  // Font
  family?: string;
  weight?: number;
  style?: string;
  // Generic
  alt?: string;
  description?: string;
}

export interface ArtifactAsset {
  id: string;
  path: string;
  mime_type: string;
  type: AssetType;
  size: number;
  content: string;
  delivery: 'inline' | 'url' | 'reference';
  url?: string;
  checksum?: string;
  metadata?: AssetMetadata;
}

// ═══════════════════════════════════════════════════════════════
// EXECUTION TYPES
// ═══════════════════════════════════════════════════════════════

export type RuntimeType =
  | 'browser'
  | 'browser:worker'
  | 'browser:sw'
  | 'node'
  | 'node:esm'
  | 'node:cjs'
  | 'deno'
  | 'bun'
  | 'python'
  | 'python:venv'
  | 'rust'
  | 'rust:wasm'
  | 'go'
  | 'docker'
  | 'cloudflare'
  | 'vercel'
  | 'lambda'
  | 'shell';

export type Capability =
  | 'fs:read'
  | 'fs:write'
  | 'net:outbound'
  | 'net:inbound'
  | 'env:read'
  | 'env:write'
  | 'process:spawn'
  | 'ffi'
  | 'gpu'
  | 'audio'
  | 'video'
  | 'clipboard'
  | 'notifications';

export interface ResourceLimits {
  memory_mb?: number;
  cpu_percent?: number;
  disk_mb?: number;
  time_ms?: number;
  processes?: number;
  file_descriptors?: number;
}

export interface NetworkConfig {
  outbound: boolean;
  allowed_domains?: string[];
  blocked_domains?: string[];
  inbound: boolean;
  port?: number;
  public?: boolean;
}

export interface RestartPolicy {
  enabled: boolean;
  max_retries?: number;
  delay_ms?: number;
  backoff?: 'linear' | 'exponential';
}

export interface ExecutionConfig {
  runtime: RuntimeType;
  runtime_version?: string;
  entrypoint?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  setup?: string[];
  cleanup?: string[];
  limits?: ResourceLimits;
  network?: NetworkConfig;
  capabilities?: Capability[];
  timeout?: number;
  restart?: RestartPolicy;
}

// ═══════════════════════════════════════════════════════════════
// DEPENDENCY TYPES
// ═══════════════════════════════════════════════════════════════

export type PackageManager =
  | 'npm'
  | 'yarn'
  | 'pnpm'
  | 'bun'
  | 'pip'
  | 'poetry'
  | 'cargo'
  | 'go'
  | 'deno';

export type DependencySpec =
  | string
  | {
      version: string;
      git?: string;
      ref?: string;
      path?: string;
      registry?: string;
      optional?: boolean;
    };

export interface DependencyManifest {
  manager: PackageManager;
  dependencies?: Record<string, DependencySpec>;
  dev_dependencies?: Record<string, DependencySpec>;
  peer_dependencies?: Record<string, DependencySpec>;
  lockfile?: string;
  install_command?: string;
  registry?: string;
}

export interface EnvironmentVariable {
  name: string;
  description: string;
  default?: string;
  sensitive?: boolean;
  pattern?: string;
  example?: string;
}

export interface EnvironmentConfig {
  required: EnvironmentVariable[];
  optional?: EnvironmentVariable[];
  dotenv?: string;
  dotenv_example?: string;
}

// ═══════════════════════════════════════════════════════════════
// AGENT TYPES
// ═══════════════════════════════════════════════════════════════

export type AgentType =
  | 'orchestrator'
  | 'coder'
  | 'designer'
  | 'reviewer'
  | 'tester'
  | 'documenter'
  | 'devops'
  | 'data'
  | 'security'
  | 'specialist'
  | 'human';

export interface AgentMetadata {
  agent_id: string;
  agent_name: string;
  agent_type: AgentType;
  model?: string;
  task_id?: string;
  session_id?: string;
  intent?: string;
  confidence?: number;
  notes?: string;
  tools_used?: string[];
  creation_time_ms?: number;
  tokens?: {
    input: number;
    output: number;
  };
}

export interface ContextMetadata {
  request?: string;
  conversation_id?: string;
  message_index?: number;
  project_id?: string;
  branch?: string;
  related_artifacts?: string[];
  custom?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// VERSION TYPES
// ═══════════════════════════════════════════════════════════════

export type ChangeType =
  | 'create'
  | 'update'
  | 'delete'
  | 'rename'
  | 'move'
  | 'refactor'
  | 'fix'
  | 'feature'
  | 'docs'
  | 'style'
  | 'test'
  | 'config';

export interface ChangeEntry {
  type: ChangeType;
  target: string;
  description?: string;
  diff?: string;
}

export interface VersionInfo {
  number: string;
  label?: string;
  hash?: string;
  parent_hash?: string;
  message?: string;
  changes?: ChangeEntry[];
  draft?: boolean;
  published?: boolean;
  tags?: string[];
}

// ═══════════════════════════════════════════════════════════════
// REFERENCE TYPES
// ═══════════════════════════════════════════════════════════════

export type ReferenceRelationship =
  | 'imports'
  | 'extends'
  | 'embeds'
  | 'links'
  | 'depends'
  | 'tests'
  | 'documents'
  | 'configures'
  | 'generates'
  | 'replaces'
  | 'related';

export interface ArtifactReference {
  artifact_id: string;
  version?: string;
  relationship: ReferenceRelationship;
  usage?: string;
  required?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// COMPOSITION TYPES
// ═══════════════════════════════════════════════════════════════

export interface LayoutConfig {
  type: 'grid' | 'tabs' | 'split' | 'stack' | 'free';
  options?: Record<string, unknown>;
  responsive?: ResponsiveLayout[];
}

export interface ResponsiveLayout {
  breakpoint: number;
  layout: LayoutConfig;
}

export interface SharedStateConfig {
  schema?: Record<string, unknown>;
  initial?: Record<string, unknown>;
  persist?: boolean;
}

export interface ChannelConfig {
  name: string;
  schema?: Record<string, unknown>;
  participants: string[];
}

export interface CompositeChild {
  artifact: string | Artifact;
  slot?: string;
  name?: string;
  config?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// RENDER TYPES
// ═══════════════════════════════════════════════════════════════

export interface RenderHints {
  renderer?: string;
  dimensions?: {
    width?: number | string;
    height?: number | string;
    min_width?: number;
    min_height?: number;
    max_width?: number;
    max_height?: number;
  };
  display?: 'inline' | 'block' | 'fullscreen' | 'modal' | 'panel';
  theme?: 'light' | 'dark' | 'system' | 'custom';
  theme_values?: Record<string, string>;
  show_code?: boolean;
  code_first?: boolean;
  allow_fullscreen?: boolean;
  allow_download?: boolean;
  allow_copy?: boolean;
  allow_edit?: boolean;
  custom_css?: string;
  sandboxed?: boolean;
  sandbox_flags?: string[];
}

export interface PreviewConfig {
  generate_thumbnail?: boolean;
  thumbnail_size?: {
    width: number;
    height: number;
  };
  preview_url?: string;
  preview_expires?: string;
  interactive?: boolean;
  refresh_interval?: number;
}

// ═══════════════════════════════════════════════════════════════
// VALIDATION TYPES
// ═══════════════════════════════════════════════════════════════

export interface ValidationIssue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  fix?: string;
  docs_url?: string;
}

export interface TypeCheckResult {
  success: boolean;
  errors: ValidationIssue[];
}

export interface LintResult {
  success: boolean;
  issues: ValidationIssue[];
}

export interface TestResult {
  success: boolean;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
}

export interface SecurityResult {
  success: boolean;
  vulnerabilities: ValidationIssue[];
}

export interface ValidationResult {
  valid: boolean;
  validated_at: string;
  validator: string;
  errors?: ValidationIssue[];
  warnings?: ValidationIssue[];
  info?: ValidationIssue[];
  type_check?: TypeCheckResult;
  lint?: LintResult;
  tests?: TestResult;
  security?: SecurityResult;
}

export interface ArtifactError {
  code: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  recoverable?: boolean;
  retry?: {
    suggested: boolean;
    delay_ms?: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// MAIN ARTIFACT INTERFACE
// ═══════════════════════════════════════════════════════════════

/**
 * Generic content type - structure depends on artifact type
 */
export type ArtifactContent = Record<string, unknown>;

/**
 * The root artifact object - all artifacts conform to this structure
 */
export interface Artifact {
  // Identity
  id: string;
  type: ArtifactType;
  title: string;
  description?: string;
  tags?: string[];

  // Content
  content?: ArtifactContent;
  files?: ArtifactFile[];
  assets?: ArtifactAsset[];

  // Execution
  execution?: ExecutionConfig;
  dependencies?: DependencyManifest;
  env?: EnvironmentConfig;

  // Agent Context
  agent?: AgentMetadata;
  context?: ContextMetadata;

  // Versioning
  version: VersionInfo;
  parent_id?: string;
  references?: ArtifactReference[];

  // Rendering
  render?: RenderHints;
  preview?: PreviewConfig;

  // State
  status: ArtifactStatus;
  validation?: ValidationResult;
  error?: ArtifactError;

  // Timestamps
  created_at: string;
  updated_at: string;
  checksum?: string;
}

/**
 * Composite artifact with children
 */
export interface CompositeArtifact extends Artifact {
  type: 'project' | 'workspace' | 'bundle' | 'dashboard';
  children: CompositeChild[];
  layout?: LayoutConfig;
  shared_state?: SharedStateConfig;
  channels?: ChannelConfig[];
}

// ═══════════════════════════════════════════════════════════════
// EMISSION TYPES (Agent → System)
// ═══════════════════════════════════════════════════════════════

export interface StreamChunk {
  type: 'file' | 'content' | 'metadata' | 'status';
  path?: string;
  content?: string;
  mode?: 'append' | 'replace';
  position?: {
    line?: number;
    column?: number;
    offset?: number;
  };
  metadata?: Partial<Artifact>;
}

export interface EmissionMetadata {
  id: string;
  timestamp: string;
  agent_id: string;
  sequence: number;
  final: boolean;
}

export interface ArtifactEmission {
  type: 'create' | 'update' | 'stream' | 'finalize';
  artifact_id?: string;
  artifact?: Partial<Artifact>;
  chunk?: StreamChunk;
  emission: EmissionMetadata;
}

// ═══════════════════════════════════════════════════════════════
// UTILITY TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Map artifact types to their categories
 */
export const ARTIFACT_CATEGORIES: Record<ArtifactType, ArtifactCategory> = {
  // Code
  'code': 'code',
  'code:module': 'code',
  'code:script': 'code',
  'code:snippet': 'code',
  // Frontend
  'react': 'frontend',
  'react:app': 'frontend',
  'vue': 'frontend',
  'vue:app': 'frontend',
  'svelte': 'frontend',
  'html': 'frontend',
  'html:app': 'frontend',
  // Visual
  'svg': 'visual',
  'canvas': 'visual',
  'webgl': 'visual',
  'd3': 'visual',
  'chart': 'visual',
  'diagram': 'visual',
  'image': 'visual',
  // Document
  'markdown': 'document',
  'document': 'document',
  'slides': 'document',
  'spreadsheet': 'document',
  'notebook': 'document',
  // Data
  'json': 'data',
  'json:schema': 'data',
  'json:config': 'data',
  'yaml': 'data',
  'csv': 'data',
  'sql': 'data',
  'graphql': 'data',
  // API
  'api:rest': 'api',
  'api:graphql': 'api',
  'api:websocket': 'api',
  'api:mock': 'api',
  // Media
  'audio': 'media',
  'video': 'media',
  'model3d': 'media',
  // Interactive
  'terminal': 'interactive',
  'repl': 'interactive',
  'form': 'interactive',
  'dashboard': 'interactive',
  // Infrastructure
  'docker': 'infrastructure',
  'terraform': 'infrastructure',
  'workflow': 'infrastructure',
  'config': 'infrastructure',
  // Composite
  'project': 'composite',
  'workspace': 'composite',
  'bundle': 'composite',
};

/**
 * Language to file extension mapping
 */
export const LANGUAGE_EXTENSIONS: Record<Language, string[]> = {
  typescript: ['.ts', '.tsx', '.mts', '.cts'],
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  python: ['.py', '.pyw', '.pyi'],
  rust: ['.rs'],
  go: ['.go'],
  java: ['.java'],
  csharp: ['.cs'],
  cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
  c: ['.c', '.h'],
  ruby: ['.rb'],
  php: ['.php'],
  swift: ['.swift'],
  kotlin: ['.kt', '.kts'],
  scala: ['.scala'],
  elixir: ['.ex', '.exs'],
  haskell: ['.hs'],
  html: ['.html', '.htm'],
  css: ['.css'],
  scss: ['.scss'],
  less: ['.less'],
  jsx: ['.jsx'],
  tsx: ['.tsx'],
  vue: ['.vue'],
  svelte: ['.svelte'],
  json: ['.json'],
  yaml: ['.yaml', '.yml'],
  toml: ['.toml'],
  xml: ['.xml'],
  csv: ['.csv'],
  sql: ['.sql'],
  graphql: ['.graphql', '.gql'],
  prisma: ['.prisma'],
  dockerfile: ['Dockerfile', '.dockerfile'],
  makefile: ['Makefile', '.mk'],
  nginx: ['.conf'],
  terraform: ['.tf'],
  hcl: ['.hcl'],
  bash: ['.sh', '.bash'],
  sh: ['.sh'],
  powershell: ['.ps1'],
  fish: ['.fish'],
  zsh: ['.zsh'],
  markdown: ['.md', '.mdx'],
  mdx: ['.mdx'],
  rst: ['.rst'],
  asciidoc: ['.adoc', '.asciidoc'],
  latex: ['.tex'],
  plaintext: ['.txt'],
  binary: [],
  unknown: [],
};

/**
 * Get category for an artifact type
 */
export function getArtifactCategory(type: ArtifactType): ArtifactCategory {
  return ARTIFACT_CATEGORIES[type];
}

/**
 * Infer language from file path
 */
export function inferLanguage(path: string): Language {
  const ext = path.toLowerCase().split('.').pop() || '';
  const filename = path.split('/').pop() || '';

  for (const [lang, extensions] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (extensions.some(e => path.endsWith(e) || filename === e)) {
      return lang as Language;
    }
  }

  return 'unknown';
}

/**
 * Create a minimal valid artifact
 */
export function createArtifact(
  type: ArtifactType,
  title: string,
  options: Partial<Artifact> = {}
): Artifact {
  const now = new Date().toISOString();
  
  return {
    id: options.id || `art_${Date.now()}`,
    type,
    title,
    status: 'draft',
    version: { number: '0.1.0' },
    created_at: now,
    updated_at: now,
    ...options,
  };
}

/**
 * Create an artifact file
 */
export function createFile(
  path: string,
  content: string,
  options: Partial<ArtifactFile> = {}
): ArtifactFile {
  return {
    path,
    language: options.language || inferLanguage(path),
    content,
    ...options,
  };
}
