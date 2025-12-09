# 📦 ARTIFACT SCHEMA SPECIFICATION v1.0

## For: spawn.new Multi-Agent Orchestration Framework

> *"The universal contract between agents and the world they create."*

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Core Schema](#core-schema)
3. [Artifact Types](#artifact-types)
4. [File Specification](#file-specification)
5. [Execution Context](#execution-context)
6. [Dependencies](#dependencies)
7. [Agent Metadata](#agent-metadata)
8. [Versioning & History](#versioning--history)
9. [Composition & References](#composition--references)
10. [Rendering Hints](#rendering-hints)
11. [Validation](#validation)
12. [Examples](#examples)
13. [Agent Emission Protocol](#agent-emission-protocol)

---

## Overview

The Artifact Schema defines the **universal format** for all outputs produced by agents in the spawn.new system. Whether an agent generates code, visualizations, documents, or data — it emits an Artifact conforming to this spec.

### Design Principles

| Principle | Description |
|-----------|-------------|
| **Self-Describing** | Artifacts contain all metadata needed to understand, render, and execute them |
| **Composable** | Artifacts can reference and embed other artifacts |
| **Versionable** | Full history tracking with diffs |
| **Executable** | Runtime configuration is part of the schema |
| **Portable** | Export to standard formats (zip, git, docker) |
| **Streamable** | Support incremental/chunked emission |

---

## Core Schema

### Root Artifact Object

```typescript
/**
 * The root artifact object - all artifacts conform to this structure
 */
interface Artifact {
  // ═══════════════════════════════════════════════════════════
  // IDENTITY
  // ═══════════════════════════════════════════════════════════
  
  /** Unique identifier (ULID recommended for sortability) */
  id: string;
  
  /** Artifact type - determines rendering and execution behavior */
  type: ArtifactType;
  
  /** Human-readable title */
  title: string;
  
  /** Optional description/summary */
  description?: string;
  
  /** Searchable tags */
  tags?: string[];
  
  // ═══════════════════════════════════════════════════════════
  // CONTENT
  // ═══════════════════════════════════════════════════════════
  
  /** Primary content - structure depends on artifact type */
  content: ArtifactContent;
  
  /** File-based artifacts contain multiple files */
  files?: ArtifactFile[];
  
  /** Binary assets (images, fonts, etc.) */
  assets?: ArtifactAsset[];
  
  // ═══════════════════════════════════════════════════════════
  // EXECUTION
  // ═══════════════════════════════════════════════════════════
  
  /** Runtime configuration */
  execution?: ExecutionConfig;
  
  /** Package dependencies */
  dependencies?: DependencyManifest;
  
  /** Environment variables required */
  env?: EnvironmentConfig;
  
  // ═══════════════════════════════════════════════════════════
  // AGENT CONTEXT
  // ═══════════════════════════════════════════════════════════
  
  /** Which agent created this and why */
  agent?: AgentMetadata;
  
  /** Task/conversation context */
  context?: ContextMetadata;
  
  // ═══════════════════════════════════════════════════════════
  // VERSIONING
  // ═══════════════════════════════════════════════════════════
  
  /** Version info and history */
  version: VersionInfo;
  
  /** Parent artifact if this is a revision */
  parent_id?: string;
  
  /** Artifacts this one references/depends on */
  references?: ArtifactReference[];
  
  // ═══════════════════════════════════════════════════════════
  // RENDERING
  // ═══════════════════════════════════════════════════════════
  
  /** Hints for UI rendering */
  render?: RenderHints;
  
  /** Preview configuration */
  preview?: PreviewConfig;
  
  // ═══════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════
  
  /** Current status */
  status: ArtifactStatus;
  
  /** Validation results */
  validation?: ValidationResult;
  
  /** Error information if status is 'error' */
  error?: ArtifactError;
  
  // ═══════════════════════════════════════════════════════════
  // TIMESTAMPS
  // ═══════════════════════════════════════════════════════════
  
  /** ISO 8601 timestamps */
  created_at: string;
  updated_at: string;
  
  /** Content hash for integrity verification */
  checksum?: string;
}
```

---

## Artifact Types

### Type Enumeration

```typescript
/**
 * All supported artifact types
 */
type ArtifactType =
  // ─────────────────────────────────────────────────────────
  // CODE ARTIFACTS
  // ─────────────────────────────────────────────────────────
  | 'code'              // Generic code file(s)
  | 'code:module'       // Importable module/library
  | 'code:script'       // Executable script
  | 'code:snippet'      // Code fragment (not standalone)
  
  // ─────────────────────────────────────────────────────────
  // FRONTEND ARTIFACTS
  // ─────────────────────────────────────────────────────────
  | 'react'             // React component(s)
  | 'react:app'         // Full React application
  | 'vue'               // Vue component(s)
  | 'vue:app'           // Full Vue application
  | 'svelte'            // Svelte component(s)
  | 'html'              // Plain HTML
  | 'html:app'          // HTML + JS + CSS application
  
  // ─────────────────────────────────────────────────────────
  // VISUAL ARTIFACTS
  // ─────────────────────────────────────────────────────────
  | 'svg'               // SVG graphics
  | 'canvas'            // Canvas 2D drawing
  | 'webgl'             // WebGL/Three.js scene
  | 'd3'                // D3.js visualization
  | 'chart'             // Chart (Recharts, Chart.js, etc.)
  | 'diagram'           // Mermaid/diagram
  | 'image'             // Generated/processed image
  
  // ─────────────────────────────────────────────────────────
  // DOCUMENT ARTIFACTS
  // ─────────────────────────────────────────────────────────
  | 'markdown'          // Markdown document
  | 'document'          // Rich document (docx, pdf source)
  | 'slides'            // Presentation
  | 'spreadsheet'       // Spreadsheet/data table
  | 'notebook'          // Jupyter-style notebook
  
  // ─────────────────────────────────────────────────────────
  // DATA ARTIFACTS
  // ─────────────────────────────────────────────────────────
  | 'json'              // JSON data
  | 'json:schema'       // JSON Schema definition
  | 'json:config'       // Configuration file
  | 'yaml'              // YAML data
  | 'csv'               // Tabular data
  | 'sql'               // SQL queries/schema
  | 'graphql'           // GraphQL schema/queries
  
  // ─────────────────────────────────────────────────────────
  // API ARTIFACTS
  // ─────────────────────────────────────────────────────────
  | 'api:rest'          // REST API definition
  | 'api:graphql'       // GraphQL API
  | 'api:websocket'     // WebSocket endpoint
  | 'api:mock'          // Mock API responses
  
  // ─────────────────────────────────────────────────────────
  // MEDIA ARTIFACTS
  // ─────────────────────────────────────────────────────────
  | 'audio'             // Audio file/player
  | 'video'             // Video file/player
  | 'model3d'           // 3D model (glTF, OBJ)
  
  // ─────────────────────────────────────────────────────────
  // INTERACTIVE ARTIFACTS
  // ─────────────────────────────────────────────────────────
  | 'terminal'          // Terminal/CLI interface
  | 'repl'              // Interactive REPL
  | 'form'              // Interactive form
  | 'dashboard'         // Multi-widget dashboard
  
  // ─────────────────────────────────────────────────────────
  // INFRASTRUCTURE ARTIFACTS
  // ─────────────────────────────────────────────────────────
  | 'docker'            // Dockerfile/compose
  | 'terraform'         // Infrastructure as code
  | 'workflow'          // CI/CD workflow
  | 'config'            // Configuration files
  
  // ─────────────────────────────────────────────────────────
  // COMPOSITE ARTIFACTS
  // ─────────────────────────────────────────────────────────
  | 'project'           // Multi-artifact project
  | 'workspace'         // Full workspace snapshot
  | 'bundle';           // Bundled/packaged artifact

/**
 * Type categories for grouping
 */
type ArtifactCategory =
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

/**
 * Map types to categories
 */
const TYPE_CATEGORIES: Record<ArtifactType, ArtifactCategory> = {
  'code': 'code',
  'code:module': 'code',
  'code:script': 'code',
  'code:snippet': 'code',
  'react': 'frontend',
  'react:app': 'frontend',
  // ... etc
};
```

---

## File Specification

### File Object

```typescript
/**
 * Represents a single file within an artifact
 */
interface ArtifactFile {
  /** Relative path from artifact root */
  path: string;
  
  /** Programming/markup language */
  language: Language;
  
  /** File content (actual newlines, not escaped) */
  content: string;
  
  /** File purpose/role */
  role?: FileRole;
  
  /** Is this the main entry point? */
  entrypoint?: boolean;
  
  /** Is this file executable? */
  executable?: boolean;
  
  /** File-specific metadata */
  metadata?: FileMetadata;
  
  /** Content hash */
  checksum?: string;
  
  /** Size in bytes */
  size?: number;
  
  /** Encoding (default: utf-8) */
  encoding?: 'utf-8' | 'base64' | 'binary';
}

/**
 * Supported languages
 */
type Language =
  // Programming
  | 'typescript' | 'javascript' | 'python' | 'rust' | 'go'
  | 'java' | 'csharp' | 'cpp' | 'c' | 'ruby' | 'php'
  | 'swift' | 'kotlin' | 'scala' | 'elixir' | 'haskell'
  
  // Web
  | 'html' | 'css' | 'scss' | 'less' | 'jsx' | 'tsx' | 'vue' | 'svelte'
  
  // Data
  | 'json' | 'yaml' | 'toml' | 'xml' | 'csv'
  
  // Query
  | 'sql' | 'graphql' | 'prisma'
  
  // Config
  | 'dockerfile' | 'makefile' | 'nginx' | 'terraform' | 'hcl'
  
  // Shell
  | 'bash' | 'sh' | 'powershell' | 'fish' | 'zsh'
  
  // Docs
  | 'markdown' | 'mdx' | 'rst' | 'asciidoc' | 'latex'
  
  // Other
  | 'plaintext' | 'binary' | 'unknown';

/**
 * File roles within an artifact
 */
type FileRole =
  | 'source'        // Source code
  | 'test'          // Test file
  | 'config'        // Configuration
  | 'asset'         // Static asset
  | 'documentation' // Docs/readme
  | 'generated'     // Auto-generated
  | 'build'         // Build output
  | 'schema'        // Schema definition
  | 'migration'     // Database migration
  | 'fixture'       // Test fixture/mock data
  | 'example';      // Example/demo

/**
 * File-specific metadata
 */
interface FileMetadata {
  /** Original source (if generated/transformed) */
  source?: string;
  
  /** Generation timestamp */
  generated_at?: string;
  
  /** Generator info */
  generator?: {
    name: string;
    version: string;
  };
  
  /** Language-specific metadata */
  [key: string]: unknown;
}
```

### Asset Object

```typescript
/**
 * Binary asset within an artifact
 */
interface ArtifactAsset {
  /** Asset identifier */
  id: string;
  
  /** Relative path */
  path: string;
  
  /** MIME type */
  mime_type: string;
  
  /** Asset type */
  type: AssetType;
  
  /** Size in bytes */
  size: number;
  
  /** Content - base64 encoded or URL */
  content: string;
  
  /** Content delivery method */
  delivery: 'inline' | 'url' | 'reference';
  
  /** CDN/storage URL if delivery is 'url' */
  url?: string;
  
  /** Checksum */
  checksum?: string;
  
  /** Asset metadata */
  metadata?: AssetMetadata;
}

type AssetType =
  | 'image'
  | 'font'
  | 'audio'
  | 'video'
  | 'wasm'
  | 'binary'
  | 'archive';

interface AssetMetadata {
  // Image-specific
  width?: number;
  height?: number;
  format?: string;
  
  // Audio/video-specific
  duration?: number;
  bitrate?: number;
  
  // Font-specific
  family?: string;
  weight?: number;
  style?: string;
  
  // Generic
  alt?: string;
  description?: string;
}
```

---

## Execution Context

### Execution Configuration

```typescript
/**
 * How to execute/run the artifact
 */
interface ExecutionConfig {
  /** Target runtime environment */
  runtime: RuntimeType;
  
  /** Runtime version constraint */
  runtime_version?: string;
  
  /** Entry point file or command */
  entrypoint?: string;
  
  /** Command to run */
  command?: string;
  
  /** Command arguments */
  args?: string[];
  
  /** Working directory */
  cwd?: string;
  
  /** Pre-run setup commands */
  setup?: string[];
  
  /** Post-run cleanup commands */
  cleanup?: string[];
  
  /** Resource limits */
  limits?: ResourceLimits;
  
  /** Network configuration */
  network?: NetworkConfig;
  
  /** Capabilities required */
  capabilities?: Capability[];
  
  /** Timeout in milliseconds */
  timeout?: number;
  
  /** Auto-restart on crash */
  restart?: RestartPolicy;
}

/**
 * Supported runtimes
 */
type RuntimeType =
  | 'browser'           // Browser (Chrome, Firefox, etc.)
  | 'browser:worker'    // Web Worker
  | 'browser:sw'        // Service Worker
  | 'node'              // Node.js
  | 'node:esm'          // Node.js ESM
  | 'node:cjs'          // Node.js CommonJS
  | 'deno'              // Deno
  | 'bun'               // Bun
  | 'python'            // Python
  | 'python:venv'       // Python virtualenv
  | 'rust'              // Rust (cargo run)
  | 'rust:wasm'         // Rust → WASM
  | 'go'                // Go
  | 'docker'            // Docker container
  | 'cloudflare'        // Cloudflare Workers
  | 'vercel'            // Vercel Edge
  | 'lambda'            // AWS Lambda
  | 'shell';            // Shell script

/**
 * Resource limits for execution
 */
interface ResourceLimits {
  /** Max memory in MB */
  memory_mb?: number;
  
  /** Max CPU percentage */
  cpu_percent?: number;
  
  /** Max disk in MB */
  disk_mb?: number;
  
  /** Max execution time in ms */
  time_ms?: number;
  
  /** Max concurrent processes */
  processes?: number;
  
  /** Max open file descriptors */
  file_descriptors?: number;
}

/**
 * Network configuration
 */
interface NetworkConfig {
  /** Allow outbound connections */
  outbound: boolean;
  
  /** Allowed outbound domains */
  allowed_domains?: string[];
  
  /** Blocked domains */
  blocked_domains?: string[];
  
  /** Allow inbound connections */
  inbound: boolean;
  
  /** Port to listen on */
  port?: number;
  
  /** Expose publicly */
  public?: boolean;
}

/**
 * Capabilities the artifact requires
 */
type Capability =
  | 'fs:read'           // Read filesystem
  | 'fs:write'          // Write filesystem
  | 'net:outbound'      // Outbound network
  | 'net:inbound'       // Inbound network
  | 'env:read'          // Read environment
  | 'env:write'         // Modify environment
  | 'process:spawn'     // Spawn processes
  | 'ffi'               // Foreign function interface
  | 'gpu'               // GPU access
  | 'audio'             // Audio I/O
  | 'video'             // Video I/O
  | 'clipboard'         // Clipboard access
  | 'notifications';    // System notifications

/**
 * Restart policy
 */
interface RestartPolicy {
  enabled: boolean;
  max_retries?: number;
  delay_ms?: number;
  backoff?: 'linear' | 'exponential';
}
```

---

## Dependencies

### Dependency Manifest

```typescript
/**
 * Package/dependency management
 */
interface DependencyManifest {
  /** Package manager to use */
  manager: PackageManager;
  
  /** Production dependencies */
  dependencies?: Record<string, DependencySpec>;
  
  /** Development dependencies */
  dev_dependencies?: Record<string, DependencySpec>;
  
  /** Peer dependencies */
  peer_dependencies?: Record<string, DependencySpec>;
  
  /** Lock file content (if available) */
  lockfile?: string;
  
  /** Install command override */
  install_command?: string;
  
  /** Registry URL override */
  registry?: string;
}

type PackageManager =
  | 'npm'
  | 'yarn'
  | 'pnpm'
  | 'bun'
  | 'pip'
  | 'poetry'
  | 'cargo'
  | 'go'
  | 'deno';

/**
 * Dependency specification
 */
type DependencySpec = string | {
  /** Version constraint */
  version: string;
  
  /** Git repository */
  git?: string;
  
  /** Git ref (branch, tag, commit) */
  ref?: string;
  
  /** Local path */
  path?: string;
  
  /** Registry URL */
  registry?: string;
  
  /** Optional dependency */
  optional?: boolean;
};
```

### Environment Configuration

```typescript
/**
 * Environment variables configuration
 */
interface EnvironmentConfig {
  /** Required environment variables */
  required: EnvironmentVariable[];
  
  /** Optional environment variables with defaults */
  optional?: EnvironmentVariable[];
  
  /** Environment variable file (.env) content */
  dotenv?: string;
  
  /** Example .env file for documentation */
  dotenv_example?: string;
}

interface EnvironmentVariable {
  /** Variable name */
  name: string;
  
  /** Description */
  description: string;
  
  /** Default value (if optional) */
  default?: string;
  
  /** Is this sensitive (secret)? */
  sensitive?: boolean;
  
  /** Validation pattern */
  pattern?: string;
  
  /** Example value */
  example?: string;
}
```

---

## Agent Metadata

### Agent Context

```typescript
/**
 * Information about the agent that created this artifact
 */
interface AgentMetadata {
  /** Agent identifier */
  agent_id: string;
  
  /** Agent name/persona */
  agent_name: string;
  
  /** Agent type/role */
  agent_type: AgentType;
  
  /** Model used (if AI agent) */
  model?: string;
  
  /** Task that triggered creation */
  task_id?: string;
  
  /** Conversation/session ID */
  session_id?: string;
  
  /** Why was this artifact created? */
  intent?: string;
  
  /** Confidence score (0-1) */
  confidence?: number;
  
  /** Agent's notes/reasoning */
  notes?: string;
  
  /** Tools used to create this */
  tools_used?: string[];
  
  /** Time spent creating (ms) */
  creation_time_ms?: number;
  
  /** Token usage (if AI agent) */
  tokens?: {
    input: number;
    output: number;
  };
}

type AgentType =
  | 'orchestrator'      // Main orchestrating agent
  | 'coder'             // Code generation agent
  | 'designer'          // UI/UX design agent
  | 'reviewer'          // Code review agent
  | 'tester'            // Testing agent
  | 'documenter'        // Documentation agent
  | 'devops'            // Infrastructure agent
  | 'data'              // Data analysis agent
  | 'security'          // Security analysis agent
  | 'specialist'        // Domain-specific agent
  | 'human';            // Human contributor
```

### Context Metadata

```typescript
/**
 * Task/conversation context
 */
interface ContextMetadata {
  /** Original user request */
  request?: string;
  
  /** Conversation history reference */
  conversation_id?: string;
  
  /** Message index in conversation */
  message_index?: number;
  
  /** Project/workspace this belongs to */
  project_id?: string;
  
  /** Branch name (if versioned) */
  branch?: string;
  
  /** Related artifacts */
  related_artifacts?: string[];
  
  /** Custom context data */
  custom?: Record<string, unknown>;
}
```

---

## Versioning & History

### Version Information

```typescript
/**
 * Version tracking
 */
interface VersionInfo {
  /** Semantic version */
  number: string;
  
  /** Version label/name */
  label?: string;
  
  /** Git-style commit hash */
  hash?: string;
  
  /** Previous version hash */
  parent_hash?: string;
  
  /** Change description */
  message?: string;
  
  /** What changed */
  changes?: ChangeEntry[];
  
  /** Is this a draft? */
  draft?: boolean;
  
  /** Is this published/released? */
  published?: boolean;
  
  /** Tags applied to this version */
  tags?: string[];
}

/**
 * Individual change entry
 */
interface ChangeEntry {
  /** Type of change */
  type: ChangeType;
  
  /** What was changed */
  target: string;
  
  /** Description */
  description?: string;
  
  /** Diff (for file changes) */
  diff?: string;
}

type ChangeType =
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
```

---

## Composition & References

### Artifact References

```typescript
/**
 * Reference to another artifact
 */
interface ArtifactReference {
  /** Referenced artifact ID */
  artifact_id: string;
  
  /** Specific version (optional) */
  version?: string;
  
  /** Relationship type */
  relationship: ReferenceRelationship;
  
  /** Where this reference is used */
  usage?: string;
  
  /** Is this a hard dependency? */
  required?: boolean;
}

type ReferenceRelationship =
  | 'imports'       // Code import
  | 'extends'       // Inheritance/extension
  | 'embeds'        // Embedded content
  | 'links'         // Hyperlink reference
  | 'depends'       // Runtime dependency
  | 'tests'         // Test for this artifact
  | 'documents'     // Documentation for
  | 'configures'    // Configuration for
  | 'generates'     // Generated from
  | 'replaces'      // Replacement for
  | 'related';      // General relation
```

### Composite Artifact

```typescript
/**
 * Artifact that composes multiple child artifacts
 */
interface CompositeArtifact extends Artifact {
  type: 'project' | 'workspace' | 'bundle' | 'dashboard';
  
  /** Child artifacts */
  children: CompositeChild[];
  
  /** Layout configuration */
  layout?: LayoutConfig;
  
  /** Shared state configuration */
  shared_state?: SharedStateConfig;
  
  /** Inter-artifact communication */
  channels?: ChannelConfig[];
}

interface CompositeChild {
  /** Child artifact ID or inline artifact */
  artifact: string | Artifact;
  
  /** Position/slot in layout */
  slot?: string;
  
  /** Display name override */
  name?: string;
  
  /** Child-specific config */
  config?: Record<string, unknown>;
}

interface LayoutConfig {
  /** Layout type */
  type: 'grid' | 'tabs' | 'split' | 'stack' | 'free';
  
  /** Layout-specific options */
  options?: Record<string, unknown>;
  
  /** Responsive breakpoints */
  responsive?: ResponsiveLayout[];
}

interface ResponsiveLayout {
  /** Breakpoint (min-width) */
  breakpoint: number;
  
  /** Layout at this breakpoint */
  layout: LayoutConfig;
}

interface SharedStateConfig {
  /** State schema */
  schema?: Record<string, unknown>;
  
  /** Initial state */
  initial?: Record<string, unknown>;
  
  /** State persistence */
  persist?: boolean;
}

interface ChannelConfig {
  /** Channel name */
  name: string;
  
  /** Message schema */
  schema?: Record<string, unknown>;
  
  /** Participants */
  participants: string[];
}
```

---

## Rendering Hints

### Render Configuration

```typescript
/**
 * Hints for UI rendering
 */
interface RenderHints {
  /** Preferred renderer */
  renderer?: string;
  
  /** Initial dimensions */
  dimensions?: {
    width?: number | string;
    height?: number | string;
    min_width?: number;
    min_height?: number;
    max_width?: number;
    max_height?: number;
  };
  
  /** Display mode */
  display?: 'inline' | 'block' | 'fullscreen' | 'modal' | 'panel';
  
  /** Theme preference */
  theme?: 'light' | 'dark' | 'system' | 'custom';
  
  /** Custom theme values */
  theme_values?: Record<string, string>;
  
  /** Show code toggle */
  show_code?: boolean;
  
  /** Default to code view */
  code_first?: boolean;
  
  /** Enable fullscreen */
  allow_fullscreen?: boolean;
  
  /** Enable download */
  allow_download?: boolean;
  
  /** Enable copy */
  allow_copy?: boolean;
  
  /** Enable edit */
  allow_edit?: boolean;
  
  /** Custom CSS */
  custom_css?: string;
  
  /** Sandbox iframe? */
  sandboxed?: boolean;
  
  /** Iframe sandbox flags */
  sandbox_flags?: string[];
}

/**
 * Preview configuration
 */
interface PreviewConfig {
  /** Generate preview image */
  generate_thumbnail?: boolean;
  
  /** Thumbnail dimensions */
  thumbnail_size?: {
    width: number;
    height: number;
  };
  
  /** Preview URL (if hosted) */
  preview_url?: string;
  
  /** Preview expires at */
  preview_expires?: string;
  
  /** Interactive preview */
  interactive?: boolean;
  
  /** Auto-refresh interval (ms) */
  refresh_interval?: number;
}
```

---

## Validation

### Validation Types

```typescript
/**
 * Artifact status
 */
type ArtifactStatus =
  | 'draft'         // Work in progress
  | 'complete'      // Finished, not validated
  | 'validated'     // Passed validation
  | 'error'         // Has errors
  | 'deprecated'    // No longer recommended
  | 'archived';     // Historical only

/**
 * Validation result
 */
interface ValidationResult {
  /** Overall valid? */
  valid: boolean;
  
  /** Validation timestamp */
  validated_at: string;
  
  /** Validator used */
  validator: string;
  
  /** Validation errors */
  errors?: ValidationIssue[];
  
  /** Validation warnings */
  warnings?: ValidationIssue[];
  
  /** Info messages */
  info?: ValidationIssue[];
  
  /** Type checking results */
  type_check?: TypeCheckResult;
  
  /** Lint results */
  lint?: LintResult;
  
  /** Test results */
  tests?: TestResult;
  
  /** Security scan results */
  security?: SecurityResult;
}

interface ValidationIssue {
  /** Issue code */
  code: string;
  
  /** Severity */
  severity: 'error' | 'warning' | 'info';
  
  /** Message */
  message: string;
  
  /** File path */
  file?: string;
  
  /** Line number */
  line?: number;
  
  /** Column number */
  column?: number;
  
  /** Suggested fix */
  fix?: string;
  
  /** Documentation link */
  docs_url?: string;
}

/**
 * Artifact error
 */
interface ArtifactError {
  /** Error code */
  code: string;
  
  /** Error message */
  message: string;
  
  /** Stack trace */
  stack?: string;
  
  /** Error context */
  context?: Record<string, unknown>;
  
  /** Recoverable? */
  recoverable?: boolean;
  
  /** Retry suggestion */
  retry?: {
    suggested: boolean;
    delay_ms?: number;
  };
}
```

---

## Agent Emission Protocol

### How Agents Emit Artifacts

```typescript
/**
 * Protocol for agents emitting artifacts
 */
interface ArtifactEmission {
  /** Emission type */
  type: 'create' | 'update' | 'stream' | 'finalize';
  
  /** Target artifact ID (for update/stream) */
  artifact_id?: string;
  
  /** Artifact data */
  artifact?: Partial<Artifact>;
  
  /** Streaming chunk (for stream type) */
  chunk?: StreamChunk;
  
  /** Emission metadata */
  emission: {
    /** Emission ID */
    id: string;
    
    /** Timestamp */
    timestamp: string;
    
    /** Emitting agent */
    agent_id: string;
    
    /** Sequence number (for ordering) */
    sequence: number;
    
    /** Is this the final emission? */
    final: boolean;
  };
}

/**
 * Streaming chunk for incremental artifact building
 */
interface StreamChunk {
  /** Chunk type */
  type: 'file' | 'content' | 'metadata' | 'status';
  
  /** Target path (for file chunks) */
  path?: string;
  
  /** Content to append/replace */
  content?: string;
  
  /** Append or replace */
  mode?: 'append' | 'replace';
  
  /** Position for insertion */
  position?: {
    line?: number;
    column?: number;
    offset?: number;
  };
  
  /** Metadata updates */
  metadata?: Partial<Artifact>;
}
```

### Emission Examples

```typescript
// Example 1: Simple artifact creation
const createEmission: ArtifactEmission = {
  type: 'create',
  artifact: {
    id: 'art_01HXYZ...',
    type: 'react',
    title: 'Button Component',
    files: [{
      path: 'Button.tsx',
      language: 'tsx',
      content: `import React from 'react';

export interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  variant = 'primary'
}) => {
  return (
    <button
      className={\`btn btn-\${variant}\`}
      onClick={onClick}
    >
      {label}
    </button>
  );
};`,
      entrypoint: true
    }],
    status: 'complete',
    version: { number: '1.0.0' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  emission: {
    id: 'emit_01HXYZ...',
    timestamp: new Date().toISOString(),
    agent_id: 'agent_coder_01',
    sequence: 1,
    final: true
  }
};

// Example 2: Streaming code generation
const streamEmissions: ArtifactEmission[] = [
  // Initial structure
  {
    type: 'stream',
    artifact_id: 'art_01HXYZ...',
    chunk: {
      type: 'file',
      path: 'api.ts',
      content: '// API Client\n',
      mode: 'replace'
    },
    emission: { id: 'e1', timestamp: '...', agent_id: 'a1', sequence: 1, final: false }
  },
  // Add imports
  {
    type: 'stream',
    artifact_id: 'art_01HXYZ...',
    chunk: {
      type: 'content',
      path: 'api.ts',
      content: "import axios from 'axios';\n\n",
      mode: 'append'
    },
    emission: { id: 'e2', timestamp: '...', agent_id: 'a1', sequence: 2, final: false }
  },
  // Add function
  {
    type: 'stream',
    artifact_id: 'art_01HXYZ...',
    chunk: {
      type: 'content',
      path: 'api.ts',
      content: `export async function fetchUser(id: string) {
  const response = await axios.get(\`/users/\${id}\`);
  return response.data;
}`,
      mode: 'append'
    },
    emission: { id: 'e3', timestamp: '...', agent_id: 'a1', sequence: 3, final: false }
  },
  // Finalize
  {
    type: 'finalize',
    artifact_id: 'art_01HXYZ...',
    artifact: {
      status: 'complete',
      validation: { valid: true, validated_at: '...', validator: 'typescript' }
    },
    emission: { id: 'e4', timestamp: '...', agent_id: 'a1', sequence: 4, final: true }
  }
];
```

---

## Full Examples

### Example 1: React Component Artifact

```json
{
  "id": "art_01HX7QJKM3N4P5R6S7T8V9W0",
  "type": "react",
  "title": "DataTable Component",
  "description": "Sortable, filterable data table with pagination",
  "tags": ["component", "table", "data", "ui"],
  
  "files": [
    {
      "path": "DataTable.tsx",
      "language": "tsx",
      "content": "import React, { useState, useMemo } from 'react';\nimport { ChevronUp, ChevronDown } from 'lucide-react';\n\nexport interface Column<T> {\n  key: keyof T;\n  header: string;\n  sortable?: boolean;\n  render?: (value: T[keyof T], row: T) => React.ReactNode;\n}\n\nexport interface DataTableProps<T> {\n  data: T[];\n  columns: Column<T>[];\n  pageSize?: number;\n}\n\nexport function DataTable<T extends Record<string, unknown>>({\n  data,\n  columns,\n  pageSize = 10\n}: DataTableProps<T>) {\n  const [sortKey, setSortKey] = useState<keyof T | null>(null);\n  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');\n  const [page, setPage] = useState(0);\n\n  const sortedData = useMemo(() => {\n    if (!sortKey) return data;\n    return [...data].sort((a, b) => {\n      const aVal = a[sortKey];\n      const bVal = b[sortKey];\n      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;\n      return sortDir === 'asc' ? cmp : -cmp;\n    });\n  }, [data, sortKey, sortDir]);\n\n  const pageData = sortedData.slice(page * pageSize, (page + 1) * pageSize);\n  const totalPages = Math.ceil(data.length / pageSize);\n\n  const handleSort = (key: keyof T) => {\n    if (sortKey === key) {\n      setSortDir(d => d === 'asc' ? 'desc' : 'asc');\n    } else {\n      setSortKey(key);\n      setSortDir('asc');\n    }\n  };\n\n  return (\n    <div className=\"w-full\">\n      <table className=\"w-full border-collapse\">\n        <thead>\n          <tr>\n            {columns.map(col => (\n              <th\n                key={String(col.key)}\n                className=\"p-3 text-left bg-gray-100 border-b cursor-pointer hover:bg-gray-200\"\n                onClick={() => col.sortable && handleSort(col.key)}\n              >\n                <div className=\"flex items-center gap-2\">\n                  {col.header}\n                  {col.sortable && sortKey === col.key && (\n                    sortDir === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />\n                  )}\n                </div>\n              </th>\n            ))}\n          </tr>\n        </thead>\n        <tbody>\n          {pageData.map((row, i) => (\n            <tr key={i} className=\"border-b hover:bg-gray-50\">\n              {columns.map(col => (\n                <td key={String(col.key)} className=\"p-3\">\n                  {col.render ? col.render(row[col.key], row) : String(row[col.key])}\n                </td>\n              ))}\n            </tr>\n          ))}\n        </tbody>\n      </table>\n      <div className=\"flex justify-between items-center mt-4\">\n        <span>Page {page + 1} of {totalPages}</span>\n        <div className=\"flex gap-2\">\n          <button\n            onClick={() => setPage(p => Math.max(0, p - 1))}\n            disabled={page === 0}\n            className=\"px-3 py-1 border rounded disabled:opacity-50\"\n          >\n            Previous\n          </button>\n          <button\n            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}\n            disabled={page >= totalPages - 1}\n            className=\"px-3 py-1 border rounded disabled:opacity-50\"\n          >\n            Next\n          </button>\n        </div>\n      </div>\n    </div>\n  );\n}",
      "entrypoint": true,
      "role": "source"
    },
    {
      "path": "DataTable.test.tsx",
      "language": "tsx",
      "content": "import { render, screen, fireEvent } from '@testing-library/react';\nimport { DataTable } from './DataTable';\n\nconst mockData = [\n  { id: 1, name: 'Alice', age: 30 },\n  { id: 2, name: 'Bob', age: 25 },\n  { id: 3, name: 'Charlie', age: 35 }\n];\n\nconst columns = [\n  { key: 'name' as const, header: 'Name', sortable: true },\n  { key: 'age' as const, header: 'Age', sortable: true }\n];\n\ndescribe('DataTable', () => {\n  it('renders data correctly', () => {\n    render(<DataTable data={mockData} columns={columns} />);\n    expect(screen.getByText('Alice')).toBeInTheDocument();\n    expect(screen.getByText('Bob')).toBeInTheDocument();\n  });\n\n  it('sorts data when header clicked', () => {\n    render(<DataTable data={mockData} columns={columns} />);\n    fireEvent.click(screen.getByText('Age'));\n    const rows = screen.getAllByRole('row');\n    expect(rows[1]).toHaveTextContent('Bob'); // 25 is youngest\n  });\n});",
      "role": "test"
    }
  ],
  
  "execution": {
    "runtime": "browser",
    "entrypoint": "DataTable.tsx"
  },
  
  "dependencies": {
    "manager": "npm",
    "dependencies": {
      "react": "^18.2.0",
      "lucide-react": "^0.263.1"
    },
    "dev_dependencies": {
      "@testing-library/react": "^14.0.0",
      "typescript": "^5.0.0"
    }
  },
  
  "agent": {
    "agent_id": "agent_coder_react_01",
    "agent_name": "React Specialist",
    "agent_type": "coder",
    "model": "claude-sonnet-4-20250514",
    "intent": "Create reusable data table component with sorting and pagination",
    "confidence": 0.95,
    "tools_used": ["code_generation", "type_inference"],
    "creation_time_ms": 3200
  },
  
  "version": {
    "number": "1.0.0",
    "hash": "a1b2c3d4",
    "message": "Initial implementation with sort and pagination"
  },
  
  "render": {
    "display": "block",
    "show_code": true,
    "allow_edit": true,
    "dimensions": {
      "min_height": 300
    }
  },
  
  "status": "validated",
  "validation": {
    "valid": true,
    "validated_at": "2024-01-15T10:30:00Z",
    "validator": "typescript",
    "warnings": []
  },
  
  "created_at": "2024-01-15T10:28:00Z",
  "updated_at": "2024-01-15T10:30:00Z",
  "checksum": "sha256:abc123..."
}
```

### Example 2: Full-Stack API Artifact

```json
{
  "id": "art_01HX8ABCD1234567890",
  "type": "api:rest",
  "title": "User Management API",
  "description": "REST API for user CRUD operations with authentication",
  "tags": ["api", "rest", "users", "auth"],
  
  "files": [
    {
      "path": "src/index.ts",
      "language": "typescript",
      "content": "import { Hono } from 'hono';\nimport { cors } from 'hono/cors';\nimport { jwt } from 'hono/jwt';\nimport { userRoutes } from './routes/users';\nimport { authRoutes } from './routes/auth';\n\nconst app = new Hono();\n\napp.use('/*', cors());\napp.use('/api/*', jwt({ secret: process.env.JWT_SECRET! }));\n\napp.route('/auth', authRoutes);\napp.route('/api/users', userRoutes);\n\napp.get('/health', (c) => c.json({ status: 'ok' }));\n\nexport default app;",
      "entrypoint": true
    },
    {
      "path": "src/routes/users.ts",
      "language": "typescript",
      "content": "import { Hono } from 'hono';\nimport { z } from 'zod';\nimport { db } from '../db';\n\nconst userRoutes = new Hono();\n\nconst UserSchema = z.object({\n  name: z.string().min(1),\n  email: z.string().email()\n});\n\nuserRoutes.get('/', async (c) => {\n  const users = await db.query.users.findMany();\n  return c.json(users);\n});\n\nuserRoutes.get('/:id', async (c) => {\n  const id = c.req.param('id');\n  const user = await db.query.users.findFirst({ where: { id } });\n  if (!user) return c.json({ error: 'Not found' }, 404);\n  return c.json(user);\n});\n\nuserRoutes.post('/', async (c) => {\n  const body = await c.req.json();\n  const parsed = UserSchema.safeParse(body);\n  if (!parsed.success) {\n    return c.json({ error: parsed.error.issues }, 400);\n  }\n  const user = await db.insert(users).values(parsed.data).returning();\n  return c.json(user[0], 201);\n});\n\nuserRoutes.put('/:id', async (c) => {\n  const id = c.req.param('id');\n  const body = await c.req.json();\n  const parsed = UserSchema.partial().safeParse(body);\n  if (!parsed.success) {\n    return c.json({ error: parsed.error.issues }, 400);\n  }\n  const user = await db.update(users).set(parsed.data).where({ id }).returning();\n  return c.json(user[0]);\n});\n\nuserRoutes.delete('/:id', async (c) => {\n  const id = c.req.param('id');\n  await db.delete(users).where({ id });\n  return c.json({ success: true });\n});\n\nexport { userRoutes };"
    },
    {
      "path": "src/db/schema.ts",
      "language": "typescript",
      "content": "import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';\n\nexport const users = sqliteTable('users', {\n  id: text('id').primaryKey(),\n  name: text('name').notNull(),\n  email: text('email').notNull().unique(),\n  created_at: integer('created_at', { mode: 'timestamp' }).notNull()\n});"
    },
    {
      "path": "wrangler.toml",
      "language": "toml",
      "content": "name = \"user-api\"\nmain = \"src/index.ts\"\ncompatibility_date = \"2024-01-01\"\n\n[[d1_databases]]\nbinding = \"DB\"\ndatabase_name = \"users-db\"\ndatabase_id = \"${D1_DATABASE_ID}\"",
      "role": "config"
    }
  ],
  
  "execution": {
    "runtime": "cloudflare",
    "entrypoint": "src/index.ts",
    "command": "wrangler dev",
    "network": {
      "outbound": true,
      "inbound": true,
      "port": 8787
    }
  },
  
  "dependencies": {
    "manager": "npm",
    "dependencies": {
      "hono": "^4.0.0",
      "drizzle-orm": "^0.29.0",
      "zod": "^3.22.0"
    },
    "dev_dependencies": {
      "wrangler": "^3.0.0",
      "@cloudflare/workers-types": "^4.0.0"
    }
  },
  
  "env": {
    "required": [
      {
        "name": "JWT_SECRET",
        "description": "Secret key for JWT signing",
        "sensitive": true,
        "example": "your-256-bit-secret"
      },
      {
        "name": "D1_DATABASE_ID",
        "description": "Cloudflare D1 database ID",
        "sensitive": false
      }
    ],
    "dotenv_example": "JWT_SECRET=your-secret-here\nD1_DATABASE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  },
  
  "agent": {
    "agent_id": "agent_backend_01",
    "agent_name": "Backend Architect",
    "agent_type": "coder",
    "intent": "Create REST API for user management with Cloudflare Workers"
  },
  
  "version": {
    "number": "1.0.0",
    "message": "Initial API with CRUD operations"
  },
  
  "status": "complete",
  "created_at": "2024-01-15T14:00:00Z",
  "updated_at": "2024-01-15T14:05:00Z"
}
```

### Example 3: D3 Visualization Artifact

```json
{
  "id": "art_01HX9VIZ123456",
  "type": "d3",
  "title": "Real-Time Network Graph",
  "description": "Force-directed graph visualization with live updates",
  "tags": ["visualization", "d3", "graph", "realtime"],
  
  "content": {
    "type": "d3",
    "data_schema": {
      "nodes": [{ "id": "string", "label": "string", "group": "number" }],
      "links": [{ "source": "string", "target": "string", "weight": "number" }]
    }
  },
  
  "files": [
    {
      "path": "NetworkGraph.tsx",
      "language": "tsx",
      "content": "import React, { useRef, useEffect } from 'react';\nimport * as d3 from 'd3';\n\ninterface Node {\n  id: string;\n  label: string;\n  group: number;\n}\n\ninterface Link {\n  source: string;\n  target: string;\n  weight: number;\n}\n\ninterface Props {\n  nodes: Node[];\n  links: Link[];\n  width?: number;\n  height?: number;\n}\n\nexport const NetworkGraph: React.FC<Props> = ({\n  nodes,\n  links,\n  width = 800,\n  height = 600\n}) => {\n  const svgRef = useRef<SVGSVGElement>(null);\n\n  useEffect(() => {\n    if (!svgRef.current || !nodes.length) return;\n\n    const svg = d3.select(svgRef.current);\n    svg.selectAll('*').remove();\n\n    const color = d3.scaleOrdinal(d3.schemeCategory10);\n\n    const simulation = d3.forceSimulation(nodes as any)\n      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))\n      .force('charge', d3.forceManyBody().strength(-300))\n      .force('center', d3.forceCenter(width / 2, height / 2));\n\n    const link = svg.append('g')\n      .selectAll('line')\n      .data(links)\n      .join('line')\n      .attr('stroke', '#999')\n      .attr('stroke-opacity', 0.6)\n      .attr('stroke-width', d => Math.sqrt(d.weight));\n\n    const node = svg.append('g')\n      .selectAll('circle')\n      .data(nodes)\n      .join('circle')\n      .attr('r', 8)\n      .attr('fill', d => color(String(d.group)))\n      .call(drag(simulation) as any);\n\n    node.append('title').text(d => d.label);\n\n    simulation.on('tick', () => {\n      link\n        .attr('x1', (d: any) => d.source.x)\n        .attr('y1', (d: any) => d.source.y)\n        .attr('x2', (d: any) => d.target.x)\n        .attr('y2', (d: any) => d.target.y);\n\n      node\n        .attr('cx', (d: any) => d.x)\n        .attr('cy', (d: any) => d.y);\n    });\n\n    return () => simulation.stop();\n  }, [nodes, links, width, height]);\n\n  function drag(simulation: any) {\n    return d3.drag()\n      .on('start', (event) => {\n        if (!event.active) simulation.alphaTarget(0.3).restart();\n        event.subject.fx = event.subject.x;\n        event.subject.fy = event.subject.y;\n      })\n      .on('drag', (event) => {\n        event.subject.fx = event.x;\n        event.subject.fy = event.y;\n      })\n      .on('end', (event) => {\n        if (!event.active) simulation.alphaTarget(0);\n        event.subject.fx = null;\n        event.subject.fy = null;\n      });\n  }\n\n  return <svg ref={svgRef} width={width} height={height} />;\n};",
      "entrypoint": true
    }
  ],
  
  "execution": {
    "runtime": "browser"
  },
  
  "dependencies": {
    "manager": "npm",
    "dependencies": {
      "react": "^18.2.0",
      "d3": "^7.8.0"
    }
  },
  
  "render": {
    "display": "block",
    "dimensions": {
      "width": 800,
      "height": 600
    },
    "theme": "dark",
    "allow_fullscreen": true
  },
  
  "status": "complete",
  "created_at": "2024-01-15T16:00:00Z",
  "updated_at": "2024-01-15T16:00:00Z"
}
```

---

## TypeScript Type Definitions

For easy integration, here's the complete type definitions file:

```typescript
// ============================================================
// FILE: types/artifact.ts
// PURPOSE: Complete Artifact Schema TypeScript definitions
// VERSION: 1.0.0
// ============================================================

// [All interfaces from above consolidated into single file]
// Export everything for use in spawn.new

export type {
  Artifact,
  ArtifactType,
  ArtifactCategory,
  ArtifactFile,
  ArtifactAsset,
  ArtifactContent,
  ArtifactStatus,
  ArtifactError,
  ArtifactReference,
  
  ExecutionConfig,
  RuntimeType,
  ResourceLimits,
  NetworkConfig,
  Capability,
  
  DependencyManifest,
  PackageManager,
  DependencySpec,
  EnvironmentConfig,
  EnvironmentVariable,
  
  AgentMetadata,
  AgentType,
  ContextMetadata,
  
  VersionInfo,
  ChangeEntry,
  ChangeType,
  
  CompositeArtifact,
  CompositeChild,
  LayoutConfig,
  SharedStateConfig,
  ChannelConfig,
  
  RenderHints,
  PreviewConfig,
  
  ValidationResult,
  ValidationIssue,
  
  ArtifactEmission,
  StreamChunk,
  
  Language,
  FileRole,
  FileMetadata,
  AssetType,
  AssetMetadata
};
```

---

*"A well-defined contract is the foundation of a reliable system."*

**— Artifact Schema v1.0 🔥**
