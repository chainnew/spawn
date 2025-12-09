#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

// ==================== Logging System ====================
const LOG_BUFFER_SIZE = 1000; // Keep last 1000 log entries
const logBuffer = [];
const logLevels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

function log(level, category, message, data = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    data: data ? (typeof data === 'string' ? data : JSON.stringify(data).slice(0, 500)) : null
  };

  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();

  // Also output to console
  const prefix = `[${entry.timestamp}] [${level}] [${category}]`;
  if (level === 'ERROR') console.error(prefix, message, data || '');
  else if (level === 'WARN') console.warn(prefix, message, data || '');
  else console.log(prefix, message, data || '');

  return entry;
}

// Convenience methods
const logger = {
  debug: (cat, msg, data) => log('DEBUG', cat, msg, data),
  info: (cat, msg, data) => log('INFO', cat, msg, data),
  warn: (cat, msg, data) => log('WARN', cat, msg, data),
  error: (cat, msg, data) => log('ERROR', cat, msg, data),

  // Specific categories
  request: (msg, data) => log('INFO', 'REQUEST', msg, data),
  tool: (msg, data) => log('INFO', 'TOOL', msg, data),
  llm: (msg, data) => log('INFO', 'LLM', msg, data),
  artifact: (msg, data) => log('INFO', 'ARTIFACT', msg, data),
  embed: (msg, data) => log('INFO', 'EMBED', msg, data),
  vector: (msg, data) => log('INFO', 'VECTOR', msg, data),
};

const app = express();
const PORT = process.env.PORT || 3080;
const WORKSPACE_PATH = process.env.WORKSPACE_PATH || './public/workspace';
const WORKSPACE_ABS = path.resolve(__dirname, WORKSPACE_PATH);
const TERMINAL_API = process.env.TERMINAL_API || 'http://localhost:3001';
const SPAWN_API = process.env.SPAWN_API || 'http://localhost:3000';
const USE_RUST_BACKEND = process.env.USE_RUST_BACKEND === 'true';

// Ensure workspace exists
if (!fs.existsSync(WORKSPACE_ABS)) {
  fs.mkdirSync(WORKSPACE_ABS, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ==================== Local Exec ====================

async function runExec(command, cwd = WORKSPACE_ABS) {
  const workDir = cwd.startsWith('./') ? path.resolve(__dirname, cwd) : cwd;
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: workDir,
      maxBuffer: 50 * 1024 * 1024,
      timeout: 60000,
      shell: '/bin/bash',
      env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin' },
    });
    return { success: true, stdout, stderr };
  } catch (err) {
    return {
      success: false,
      stdout: err.stdout || '',
      stderr: err.stderr || err.message,
      code: err.code,
    };
  }
}

function runExecStream(command, cwd, res, req) {
  const workDir = cwd.startsWith('./') ? path.resolve(__dirname, cwd) : cwd;
  const proc = spawn('bash', ['-c', command], { cwd: workDir });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  proc.stdout.on('data', (d) => {
    res.write(`data: ${JSON.stringify({ type: 'stdout', content: d.toString() })}\n\n`);
  });
  proc.stderr.on('data', (d) => {
    res.write(`data: ${JSON.stringify({ type: 'stderr', content: d.toString() })}\n\n`);
  });
  proc.on('close', (code) => {
    res.write(`data: ${JSON.stringify({ type: 'exit', code })}\n\n`);
    res.end();
  });
  proc.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`);
    res.end();
  });
  req.on('close', () => proc.kill());
}

// ==================== Artifact Validation ====================

// Valid artifact types from the spec
const VALID_ARTIFACT_TYPES = new Set([
  // Code
  'code', 'code:module', 'code:script', 'code:snippet',
  // Frontend
  'react', 'react:app', 'react:component', 'vue', 'vue:app', 'svelte', 'svelte:app',
  'html', 'html:app', 'html:page',
  // Visual
  'svg', 'canvas', 'webgl', 'd3', 'chart', 'diagram', 'image',
  // Document
  'markdown', 'document', 'slides', 'spreadsheet', 'notebook',
  // Data
  'json', 'json:schema', 'json:config', 'yaml', 'csv', 'sql', 'graphql',
  // API
  'api:rest', 'api:graphql', 'api:mock',
  // Interactive
  'terminal', 'repl', 'form', 'dashboard',
  // Infrastructure
  'docker', 'terraform', 'workflow', 'config',
  // Composite
  'project', 'workspace', 'bundle'
]);

const VALID_LANGUAGES = new Set([
  'typescript', 'javascript', 'python', 'rust', 'go', 'java', 'csharp', 'cpp', 'c',
  'ruby', 'php', 'swift', 'kotlin', 'scala', 'elixir', 'haskell',
  'html', 'css', 'scss', 'less', 'jsx', 'tsx', 'vue', 'svelte',
  'json', 'yaml', 'toml', 'xml', 'csv', 'sql', 'graphql', 'prisma',
  'dockerfile', 'makefile', 'nginx', 'terraform', 'hcl',
  'bash', 'sh', 'powershell', 'fish', 'zsh',
  'markdown', 'mdx', 'rst', 'latex', 'plaintext'
]);

const VALID_RUNTIMES = new Set([
  'browser', 'browser:worker', 'node', 'node:esm', 'deno', 'bun',
  'python', 'python:venv', 'rust', 'go', 'docker', 'shell'
]);

const VALID_FILE_ROLES = new Set([
  'source', 'test', 'config', 'asset', 'documentation', 'generated', 'schema', 'example'
]);

const VALID_DISPLAY_MODES = new Set(['inline', 'block', 'fullscreen', 'modal', 'panel']);

const VALID_THEMES = new Set(['light', 'dark', 'system']);

/**
 * Validate an artifact against the Artifact Schema Specification v1.0
 * Returns { valid: boolean, errors: string[], warnings: string[] }
 */
function validateArtifact(artifact) {
  const errors = [];
  const warnings = [];

  // === REQUIRED FIELDS ===
  if (!artifact.type) {
    errors.push('Missing required field: type');
  } else if (!VALID_ARTIFACT_TYPES.has(artifact.type)) {
    errors.push(`Invalid artifact type: '${artifact.type}'. Must be one of: ${[...VALID_ARTIFACT_TYPES].slice(0, 10).join(', ')}...`);
  }

  if (!artifact.title) {
    errors.push('Missing required field: title');
  } else if (typeof artifact.title !== 'string' || artifact.title.length === 0) {
    errors.push('Title must be a non-empty string');
  } else if (artifact.title.length > 200) {
    warnings.push('Title exceeds recommended 200 character limit');
  }

  // === FILES VALIDATION ===
  if (artifact.files) {
    if (!Array.isArray(artifact.files)) {
      errors.push('files must be an array');
    } else {
      artifact.files.forEach((file, idx) => {
        if (!file.path) {
          errors.push(`files[${idx}]: Missing required field 'path'`);
        }
        if (!file.language) {
          warnings.push(`files[${idx}]: Missing language, will use 'plaintext'`);
        } else if (!VALID_LANGUAGES.has(file.language)) {
          warnings.push(`files[${idx}]: Unknown language '${file.language}'`);
        }
        if (!file.content && file.content !== '') {
          errors.push(`files[${idx}]: Missing required field 'content'`);
        }
        if (file.role && !VALID_FILE_ROLES.has(file.role)) {
          warnings.push(`files[${idx}]: Unknown role '${file.role}'`);
        }
      });

      // Check for duplicate paths
      const paths = artifact.files.map(f => f.path);
      const duplicates = paths.filter((p, i) => paths.indexOf(p) !== i);
      if (duplicates.length > 0) {
        errors.push(`Duplicate file paths: ${[...new Set(duplicates)].join(', ')}`);
      }

      // Check for multiple entrypoints
      const entrypoints = artifact.files.filter(f => f.entrypoint);
      if (entrypoints.length > 1) {
        warnings.push(`Multiple entrypoints defined (${entrypoints.length}). Only one should be marked as entrypoint.`);
      }
    }
  }

  // === EXECUTION VALIDATION ===
  if (artifact.execution) {
    if (typeof artifact.execution !== 'object') {
      errors.push('execution must be an object');
    } else {
      if (artifact.execution.runtime && !VALID_RUNTIMES.has(artifact.execution.runtime)) {
        warnings.push(`Unknown runtime '${artifact.execution.runtime}'`);
      }
      if (artifact.execution.timeout && (typeof artifact.execution.timeout !== 'number' || artifact.execution.timeout < 0)) {
        errors.push('execution.timeout must be a positive number');
      }
      if (artifact.execution.args && !Array.isArray(artifact.execution.args)) {
        errors.push('execution.args must be an array of strings');
      }
      if (artifact.execution.setup && !Array.isArray(artifact.execution.setup)) {
        errors.push('execution.setup must be an array of strings');
      }
    }
  }

  // === DEPENDENCIES VALIDATION ===
  if (artifact.dependencies) {
    if (typeof artifact.dependencies !== 'object') {
      errors.push('dependencies must be an object');
    } else {
      if (artifact.dependencies.packages && typeof artifact.dependencies.packages !== 'object') {
        errors.push('dependencies.packages must be an object');
      }
      if (artifact.dependencies.dev && typeof artifact.dependencies.dev !== 'object') {
        errors.push('dependencies.dev must be an object');
      }
    }
  }

  // === ENV VALIDATION ===
  if (artifact.env) {
    if (!Array.isArray(artifact.env)) {
      errors.push('env must be an array');
    } else {
      artifact.env.forEach((envVar, idx) => {
        if (!envVar.name) {
          errors.push(`env[${idx}]: Missing required field 'name'`);
        }
        if (!envVar.description) {
          warnings.push(`env[${idx}]: Missing description for '${envVar.name}'`);
        }
      });
    }
  }

  // === RENDER VALIDATION ===
  if (artifact.render) {
    if (typeof artifact.render !== 'object') {
      errors.push('render must be an object');
    } else {
      if (artifact.render.display && !VALID_DISPLAY_MODES.has(artifact.render.display)) {
        warnings.push(`Unknown display mode '${artifact.render.display}'`);
      }
      if (artifact.render.theme && !VALID_THEMES.has(artifact.render.theme)) {
        warnings.push(`Unknown theme '${artifact.render.theme}'`);
      }
      if (artifact.render.dimensions) {
        const dims = artifact.render.dimensions;
        if (dims.width && (typeof dims.width !== 'number' || dims.width < 0)) {
          errors.push('render.dimensions.width must be a positive number');
        }
        if (dims.height && (typeof dims.height !== 'number' || dims.height < 0)) {
          errors.push('render.dimensions.height must be a positive number');
        }
      }
    }
  }

  // === VERSION VALIDATION ===
  if (artifact.version) {
    if (typeof artifact.version !== 'object') {
      errors.push('version must be an object');
    } else if (artifact.version.number && !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(artifact.version.number)) {
      warnings.push(`Version '${artifact.version.number}' does not follow semver format (x.y.z)`);
    }
  }

  // === TAGS VALIDATION ===
  if (artifact.tags) {
    if (!Array.isArray(artifact.tags)) {
      errors.push('tags must be an array of strings');
    } else if (artifact.tags.some(t => typeof t !== 'string')) {
      errors.push('All tags must be strings');
    }
  }

  // === CONTENT CHECK ===
  // Warn if neither files nor legacy content provided
  if ((!artifact.files || artifact.files.length === 0) && !artifact.content) {
    warnings.push('No content provided (neither files[] nor legacy content field)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    score: Math.max(0, 100 - (errors.length * 20) - (warnings.length * 5))
  };
}

// ==================== Tool Definitions ====================

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'execute_command',
      description: 'Execute a shell command. Use for running code, installing packages, git, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
          cwd: { type: 'string', description: 'Working directory (default: workspace)' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read contents of a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to file (relative to workspace)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file. IMPORTANT: Always use the correct file extension (.py for Python, .js for JavaScript, .tsx for React TypeScript, .html for HTML, etc.). Never use .txt for code files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to file with CORRECT extension (e.g., game.py, app.js, index.html). NEVER use .txt for code.' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files in a directory',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path' },
          recursive: { type: 'boolean', description: 'List recursively' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_artifact',
      description: `Create a structured code artifact conforming to the Artifact Schema Specification v1.0.
Use this to show code, visualizations, documents, and interactive content to users.

ARTIFACT TYPES:
- Code: 'code', 'code:module', 'code:script', 'code:snippet'
- Frontend: 'react', 'react:app', 'vue', 'svelte', 'html', 'html:app'
- Visual: 'svg', 'canvas', 'webgl', 'd3', 'chart', 'diagram', 'image'
- Document: 'markdown', 'document', 'slides', 'spreadsheet', 'notebook'
- Data: 'json', 'json:schema', 'yaml', 'csv', 'sql', 'graphql'
- API: 'api:rest', 'api:graphql', 'api:mock'
- Interactive: 'terminal', 'repl', 'form', 'dashboard'
- Infrastructure: 'docker', 'terraform', 'workflow', 'config'

RUNTIMES: 'browser', 'node', 'deno', 'bun', 'python', 'python:venv', 'rust', 'go', 'docker', 'shell'`,
      parameters: {
        type: 'object',
        properties: {
          // === IDENTITY ===
          type: {
            type: 'string',
            enum: [
              'code', 'code:module', 'code:script', 'code:snippet',
              'react', 'react:app', 'vue', 'svelte', 'html', 'html:app',
              'svg', 'canvas', 'webgl', 'd3', 'chart', 'diagram', 'image',
              'markdown', 'document', 'slides', 'spreadsheet', 'notebook',
              'json', 'json:schema', 'json:config', 'yaml', 'csv', 'sql', 'graphql',
              'api:rest', 'api:graphql', 'api:mock',
              'terminal', 'repl', 'form', 'dashboard',
              'docker', 'terraform', 'workflow', 'config',
              'project', 'workspace', 'bundle'
            ],
            description: 'Artifact type - determines rendering and execution behavior'
          },
          title: { type: 'string', description: 'Human-readable title' },
          description: { type: 'string', description: 'Brief description/summary of the artifact' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Searchable tags for categorization'
          },

          // === CONTENT ===
          files: {
            type: 'array',
            description: 'Array of files in this artifact',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Relative path from artifact root (e.g., "src/App.tsx")' },
                language: {
                  type: 'string',
                  enum: [
                    'typescript', 'javascript', 'python', 'rust', 'go', 'java', 'csharp', 'cpp', 'c',
                    'ruby', 'php', 'swift', 'kotlin', 'scala', 'elixir', 'haskell',
                    'html', 'css', 'scss', 'less', 'jsx', 'tsx', 'vue', 'svelte',
                    'json', 'yaml', 'toml', 'xml', 'csv', 'sql', 'graphql', 'prisma',
                    'dockerfile', 'makefile', 'nginx', 'terraform', 'hcl',
                    'bash', 'sh', 'powershell', 'fish', 'zsh',
                    'markdown', 'mdx', 'rst', 'latex', 'plaintext'
                  ],
                  description: 'Programming/markup language'
                },
                content: { type: 'string', description: 'File content (actual newlines, not escaped)' },
                role: {
                  type: 'string',
                  enum: ['source', 'test', 'config', 'asset', 'documentation', 'generated', 'schema', 'example'],
                  description: 'File purpose/role'
                },
                entrypoint: { type: 'boolean', description: 'Is this the main entry point?' }
              },
              required: ['path', 'language', 'content']
            }
          },

          // === EXECUTION ===
          execution: {
            type: 'object',
            description: 'Runtime configuration for executing the artifact',
            properties: {
              runtime: {
                type: 'string',
                enum: ['browser', 'browser:worker', 'node', 'node:esm', 'deno', 'bun', 'python', 'python:venv', 'rust', 'go', 'docker', 'shell'],
                description: 'Target runtime environment'
              },
              entrypoint: { type: 'string', description: 'Entry point file or command' },
              command: { type: 'string', description: 'Command to run (e.g., "python main.py")' },
              args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' },
              setup: { type: 'array', items: { type: 'string' }, description: 'Pre-run setup commands' },
              timeout: { type: 'number', description: 'Timeout in milliseconds' }
            }
          },

          // === DEPENDENCIES ===
          dependencies: {
            type: 'object',
            description: 'Package dependency manifest',
            properties: {
              manager: {
                type: 'string',
                enum: ['npm', 'yarn', 'pnpm', 'bun', 'pip', 'poetry', 'cargo', 'go', 'deno'],
                description: 'Package manager to use'
              },
              packages: {
                type: 'object',
                description: 'Production dependencies as {name: version}'
              },
              dev: {
                type: 'object',
                description: 'Development dependencies as {name: version}'
              }
            }
          },

          // === ENVIRONMENT ===
          env: {
            type: 'array',
            description: 'Required environment variables',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Variable name' },
                description: { type: 'string', description: 'What this variable is for' },
                default: { type: 'string', description: 'Default value if optional' },
                sensitive: { type: 'boolean', description: 'Is this a secret?' },
                example: { type: 'string', description: 'Example value' }
              },
              required: ['name', 'description']
            }
          },

          // === RENDER HINTS ===
          render: {
            type: 'object',
            description: 'UI rendering hints',
            properties: {
              display: {
                type: 'string',
                enum: ['inline', 'block', 'fullscreen', 'modal', 'panel'],
                description: 'Display mode'
              },
              theme: {
                type: 'string',
                enum: ['light', 'dark', 'system'],
                description: 'Theme preference'
              },
              show_code: { type: 'boolean', description: 'Show code toggle' },
              allow_edit: { type: 'boolean', description: 'Enable editing' },
              allow_download: { type: 'boolean', description: 'Enable download' },
              dimensions: {
                type: 'object',
                properties: {
                  width: { type: 'number', description: 'Width in pixels' },
                  height: { type: 'number', description: 'Height in pixels' },
                  min_height: { type: 'number', description: 'Minimum height' }
                }
              }
            }
          },

          // === VERSION ===
          version: {
            type: 'object',
            description: 'Version information',
            properties: {
              number: { type: 'string', description: 'Semantic version (e.g., "1.0.0")' },
              message: { type: 'string', description: 'Change description' }
            }
          },

          // === LEGACY SUPPORT ===
          content: { type: 'string', description: '[DEPRECATED] Single file content - use files[] instead' },
          lang: { type: 'string', description: '[DEPRECATED] Language - use files[].language instead' },
          run: { type: 'string', description: '[DEPRECATED] Run command - use execution.command instead' },
          runtime: { type: 'string', description: '[DEPRECATED] Runtime - use execution.runtime instead' }
        },
        required: ['type', 'title'],
      },
    },
  },
  // Git operations
  {
    type: 'function',
    function: {
      name: 'git_clone',
      description: 'Clone a GitHub repository into the workspace. Automatically handles HTTPS URLs, short-form (owner/repo), and GitHub URLs.',
      parameters: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: 'Repository to clone. Accepts: "owner/repo", "https://github.com/owner/repo", or full git URL' },
          branch: { type: 'string', description: 'Branch to checkout (optional, defaults to main)' },
          depth: { type: 'number', description: 'Shallow clone depth (optional, use 1 for fastest clone)' },
          target_dir: { type: 'string', description: 'Directory name in workspace (optional, defaults to repo name)' },
        },
        required: ['repo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_repo',
      description: 'Analyze a repository structure and provide insights. Returns file tree, language breakdown, and key files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to repository (relative to workspace)' },
          depth: { type: 'number', description: 'Max depth for file tree (default: 3)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_code',
      description: 'Search for patterns in code files using ripgrep (rg). Fast and respects .gitignore.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Search pattern (regex supported)' },
          path: { type: 'string', description: 'Directory to search in (relative to workspace)' },
          file_type: { type: 'string', description: 'Filter by file type: js, ts, py, rs, go, etc.' },
          context_lines: { type: 'number', description: 'Lines of context around matches (default: 2)' },
        },
        required: ['pattern'],
      },
    },
  },
  // Terminal-app integration tools
  {
    type: 'function',
    function: {
      name: 'editor_open',
      description: 'Open a file in the code editor buffer for viewing/editing. Use this to show code in the IDE-style editor.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to file (relative to workspace)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editor_save',
      description: 'Save the current editor buffer to disk',
      parameters: {
        type: 'object',
        properties: {
          buffer_id: { type: 'string', description: 'Buffer ID to save' },
        },
        required: ['buffer_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'terminal_create',
      description: 'Create a named terminal session that persists across commands. Use for long-running processes or when you need command history.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Terminal name (e.g., "dev", "build", "test")' },
          cwd: { type: 'string', description: 'Working directory' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'terminal_exec',
      description: 'Execute a command in a named terminal session. Output is captured in the terminal buffer.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Terminal name' },
          command: { type: 'string', description: 'Command to execute' },
        },
        required: ['name', 'command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'terminal_buffer',
      description: 'Get the output buffer from a named terminal. Use to check results of previous commands.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Terminal name' },
          lines: { type: 'number', description: 'Number of lines to retrieve (default: 50)' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'terminal_list',
      description: 'List all active terminal sessions',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  // Mission integration with Rust backend
  {
    type: 'function',
    function: {
      name: 'create_mission',
      description: 'Create a new development mission in the Rust backend. Use for complex multi-step tasks that should be tracked and orchestrated.',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'The mission goal/objective' },
          context: { type: 'object', description: 'Additional context for the mission' },
        },
        required: ['goal'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_missions',
      description: 'List all missions from the Rust backend',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_architect_status',
      description: 'Get the status of the ARCHITECT system including connected services and active resources',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  // === SEMANTIC SEARCH TOOLS ===
  {
    type: 'function',
    function: {
      name: 'semantic_search',
      description: 'Search your knowledge base using semantic similarity. Finds documents with similar meaning to your query, not just keyword matches. Use this to recall information from previously stored documents, find related content, or answer questions based on stored knowledge.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural language query to search for semantically similar documents' },
          collection: { type: 'string', description: 'Optional: limit search to a specific collection (e.g., "docs", "code", "notes")' },
          limit: { type: 'number', description: 'Maximum number of results (default: 5)' },
          threshold: { type: 'number', description: 'Minimum similarity score 0-1 (default: 0.7)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'store_knowledge',
      description: 'Store a document in the knowledge base for future semantic search. Use this to remember important information, save code snippets, documentation, notes, or any content that should be searchable later.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'The text content to store and make searchable' },
          collection: { type: 'string', description: 'Collection name to organize documents (e.g., "docs", "code", "notes")' },
          metadata: {
            type: 'object',
            description: 'Optional metadata like source, author, tags, etc.',
            properties: {
              title: { type: 'string' },
              source: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
            }
          },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_knowledge_collections',
      description: 'List all knowledge collections and their document counts. Use this to see what knowledge has been stored.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

// ==================== Tool Execution ====================

async function executeTool(name, args) {
  console.log(`[Tool] ${name}:`, JSON.stringify(args).slice(0, 100));

  switch (name) {
    case 'execute_command': {
      const cwd = args.cwd ? path.resolve(WORKSPACE_ABS, args.cwd) : WORKSPACE_ABS;
      const result = await runExec(args.command, cwd);
      return { success: result.success, output: (result.stdout + result.stderr).slice(0, 10000) };
    }

    case 'read_file': {
      const filePath = path.resolve(WORKSPACE_ABS, args.path);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return { success: true, content: content.slice(0, 50000) };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    case 'write_file': {
      const filePath = path.resolve(WORKSPACE_ABS, args.path);
      try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, args.content);
        return { success: true, path: args.path };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    case 'list_files': {
      const dirPath = path.resolve(WORKSPACE_ABS, args.path || '.');
      const cmd = args.recursive ? `find "${dirPath}" -type f | head -100` : `ls -la "${dirPath}"`;
      const result = await runExec(cmd);
      return { success: result.success, files: result.stdout };
    }

    case 'create_artifact': {
      // Generate unique artifact ID (ULID-like for sortability)
      const timestamp = Date.now().toString(36).padStart(9, '0');
      const random = Math.random().toString(36).slice(2, 9);
      const artifactId = `art_${timestamp}${random}`;

      const now = new Date().toISOString();

      // Infer file extension from language
      const LANG_EXTENSIONS = {
        typescript: 'ts', javascript: 'js', python: 'py', rust: 'rs', go: 'go',
        java: 'java', csharp: 'cs', cpp: 'cpp', c: 'c', ruby: 'rb', php: 'php',
        swift: 'swift', kotlin: 'kt', scala: 'scala', elixir: 'ex', haskell: 'hs',
        html: 'html', css: 'css', scss: 'scss', jsx: 'jsx', tsx: 'tsx', vue: 'vue', svelte: 'svelte',
        json: 'json', yaml: 'yaml', toml: 'toml', xml: 'xml', csv: 'csv',
        sql: 'sql', graphql: 'graphql', prisma: 'prisma',
        dockerfile: 'dockerfile', makefile: 'makefile', terraform: 'tf',
        bash: 'sh', sh: 'sh', powershell: 'ps1', markdown: 'md', mdx: 'mdx', plaintext: 'txt'
      };

      // Get base type for rendering (strip subtypes like 'code:module' → 'code')
      const baseType = args.type.split(':')[0];

      // Normalize files from either new format or legacy content/lang
      let files = args.files;
      if (!files && args.content) {
        const lang = args.lang || baseType || 'plaintext';
        const ext = LANG_EXTENSIONS[lang] || 'txt';
        const filename = args.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.' + ext;
        files = [{
          path: filename,
          language: lang,
          content: args.content,
          role: 'source',
          entrypoint: true
        }];
      }

      // Normalize execution config from either new format or legacy runtime/run
      let execution = args.execution;
      if (!execution && (args.runtime || args.run)) {
        execution = {
          runtime: args.runtime || 'browser',
          command: args.run || null,
          entrypoint: files?.[0]?.path
        };
      }

      // Build the full artifact conforming to spec
      const artifact = {
        // === IDENTITY ===
        id: artifactId,
        type: args.type,
        title: args.title,
        description: args.description || null,
        tags: args.tags || [],

        // === CONTENT ===
        files: files || [],

        // === EXECUTION ===
        execution: execution || null,
        dependencies: args.dependencies || null,
        env: args.env || null,

        // === VERSION ===
        version: args.version || { number: '1.0.0' },

        // === RENDER HINTS ===
        render: args.render || {
          display: 'block',
          theme: 'dark',
          show_code: true,
          allow_edit: true,
          allow_download: true
        },

        // === TIMESTAMPS ===
        created_at: now,
        updated_at: now,

        // === LEGACY COMPAT ===
        // These fields help the frontend render artifacts using older code
        content: files?.[0]?.content || args.content || null,
        lang: files?.[0]?.language || args.lang || null,
        run: execution?.command || args.run || null,
        runtime: execution?.runtime || args.runtime || null,

        // Checksum (simple hash for integrity)
        checksum: files ? `sha256:${Buffer.from(JSON.stringify(files)).toString('base64').slice(0, 16)}` : null
      };

      // Validate artifact against schema
      const validation = validateArtifact(artifact);

      // Add validation and status to artifact
      artifact.validation = {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        score: validation.score
      };
      artifact.status = validation.valid ? 'complete' : 'invalid';
      artifact.error = validation.errors.length > 0 ? validation.errors[0] : null;

      // Log validation results
      if (!validation.valid) {
        console.log(`[Artifact] Validation failed for '${artifact.title}':`, validation.errors);
      } else if (validation.warnings.length > 0) {
        console.log(`[Artifact] Warnings for '${artifact.title}':`, validation.warnings);
      }

      return { success: true, artifact, validation };
    }

    // ==================== Git & Repo Analysis ====================

    case 'git_clone': {
      let repoUrl = args.repo;

      // Handle short-form (owner/repo)
      if (!repoUrl.includes('://') && !repoUrl.startsWith('git@')) {
        repoUrl = `https://github.com/${repoUrl}.git`;
      }
      // Handle github.com URLs without .git
      if (repoUrl.includes('github.com') && !repoUrl.endsWith('.git')) {
        repoUrl = repoUrl.replace(/\/$/, '') + '.git';
      }

      // Extract repo name for target directory
      const repoName = args.target_dir || repoUrl.split('/').pop().replace('.git', '');
      const targetPath = path.resolve(WORKSPACE_ABS, repoName);

      // Check if already exists
      if (fs.existsSync(targetPath)) {
        return { success: false, error: `Directory '${repoName}' already exists. Use a different target_dir or delete it first.` };
      }

      // Build git clone command
      let cmd = `git clone`;
      if (args.depth) cmd += ` --depth ${args.depth}`;
      if (args.branch) cmd += ` --branch ${args.branch}`;
      cmd += ` "${repoUrl}" "${repoName}"`;

      const result = await runExec(cmd);

      if (result.success) {
        // Get quick stats about the cloned repo
        const statsCmd = `cd "${targetPath}" && find . -type f | head -50 | wc -l && git log --oneline -1 2>/dev/null || echo "no commits"`;
        const stats = await runExec(statsCmd);

        return {
          success: true,
          repo: repoUrl,
          cloned_to: repoName,
          path: targetPath,
          output: result.stdout + result.stderr,
          stats: stats.stdout,
        };
      }
      return { success: false, error: result.stderr || result.stdout };
    }

    case 'analyze_repo': {
      const repoPath = path.resolve(WORKSPACE_ABS, args.path || '.');
      const maxDepth = args.depth || 3;

      if (!fs.existsSync(repoPath)) {
        return { success: false, error: `Path '${args.path}' does not exist` };
      }

      // Get file tree
      const treeCmd = `cd "${repoPath}" && find . -maxdepth ${maxDepth} -type f ! -path '*/node_modules/*' ! -path '*/.git/*' ! -path '*/dist/*' ! -path '*/build/*' | sort | head -100`;
      const tree = await runExec(treeCmd);

      // Get language breakdown by extension
      const langCmd = `cd "${repoPath}" && find . -type f ! -path '*/node_modules/*' ! -path '*/.git/*' -name '*.*' | sed 's/.*\\.//' | sort | uniq -c | sort -rn | head -15`;
      const langs = await runExec(langCmd);

      // Get key files
      const keyFilesCmd = `cd "${repoPath}" && ls -la package.json Cargo.toml go.mod requirements.txt pyproject.toml Makefile Dockerfile README.md .env.example tsconfig.json 2>/dev/null || true`;
      const keyFiles = await runExec(keyFilesCmd);

      // Get git info if available
      const gitCmd = `cd "${repoPath}" && git remote -v 2>/dev/null | head -2 && echo "---" && git log --oneline -5 2>/dev/null || echo "not a git repo"`;
      const gitInfo = await runExec(gitCmd);

      // Get directory structure (just top-level)
      const dirsCmd = `cd "${repoPath}" && ls -la | head -20`;
      const dirs = await runExec(dirsCmd);

      return {
        success: true,
        path: args.path,
        file_tree: tree.stdout,
        language_breakdown: langs.stdout,
        key_files: keyFiles.stdout,
        git_info: gitInfo.stdout,
        directory_listing: dirs.stdout,
      };
    }

    case 'search_code': {
      const searchPath = path.resolve(WORKSPACE_ABS, args.path || '.');
      const context = args.context_lines || 2;

      // Build ripgrep command
      let cmd = `rg --color=never -n -C ${context}`;
      if (args.file_type) cmd += ` -t ${args.file_type}`;
      cmd += ` "${args.pattern}" "${searchPath}" 2>/dev/null | head -200`;

      const result = await runExec(cmd);

      // Count matches
      const countCmd = `rg --color=never -c "${args.pattern}" "${searchPath}" 2>/dev/null | head -50`;
      const counts = await runExec(countCmd);

      return {
        success: true,
        pattern: args.pattern,
        matches: result.stdout || 'No matches found',
        file_counts: counts.stdout,
      };
    }

    // ==================== Terminal-app Integration ====================

    case 'editor_open': {
      try {
        const filePath = path.resolve(WORKSPACE_ABS, args.path);
        const response = await fetch(`${TERMINAL_API}/api/editor/open`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath }),
        });
        const data = await response.json();
        return { success: response.ok, ...data };
      } catch (err) {
        return { success: false, error: `Editor API unavailable: ${err.message}` };
      }
    }

    case 'editor_save': {
      try {
        const response = await fetch(`${TERMINAL_API}/api/editor/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ buffer_id: args.buffer_id }),
        });
        const data = await response.json();
        return { success: response.ok, ...data };
      } catch (err) {
        return { success: false, error: `Editor API unavailable: ${err.message}` };
      }
    }

    case 'terminal_create': {
      try {
        const response = await fetch(`${TERMINAL_API}/api/terminals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: args.name,
            cwd: args.cwd ? path.resolve(WORKSPACE_ABS, args.cwd) : WORKSPACE_ABS
          }),
        });
        const data = await response.json();
        return { success: response.ok, terminal: data };
      } catch (err) {
        return { success: false, error: `Terminal API unavailable: ${err.message}` };
      }
    }

    case 'terminal_exec': {
      try {
        const response = await fetch(`${TERMINAL_API}/api/terminals/by-name/${encodeURIComponent(args.name)}/exec`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: args.command }),
        });
        const data = await response.json();
        // Give command time to produce output
        await new Promise(r => setTimeout(r, 500));
        return { success: response.ok, ...data };
      } catch (err) {
        return { success: false, error: `Terminal API unavailable: ${err.message}` };
      }
    }

    case 'terminal_buffer': {
      try {
        // First resolve name to get terminal info
        const infoResp = await fetch(`${TERMINAL_API}/api/terminals/by-name/${encodeURIComponent(args.name)}`);
        if (!infoResp.ok) return { success: false, error: `Terminal '${args.name}' not found` };
        const termInfo = await infoResp.json();

        const lines = args.lines || 50;
        const response = await fetch(`${TERMINAL_API}/api/terminals/${termInfo.id}/buffer?lines=${lines}`);
        const data = await response.json();
        return { success: response.ok, ...data };
      } catch (err) {
        return { success: false, error: `Terminal API unavailable: ${err.message}` };
      }
    }

    case 'terminal_list': {
      try {
        const response = await fetch(`${TERMINAL_API}/api/terminals`);
        const data = await response.json();
        return { success: response.ok, ...data };
      } catch (err) {
        return { success: false, error: `Terminal API unavailable: ${err.message}` };
      }
    }

    // ==================== Rust Backend Integration ====================

    case 'create_mission': {
      try {
        const response = await fetch(`${SPAWN_API}/api/missions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goal: args.goal,
            context: args.context || {},
          }),
        });
        const data = await response.json();
        return { success: response.ok, ...data };
      } catch (err) {
        return { success: false, error: `Spawn API unavailable: ${err.message}` };
      }
    }

    case 'list_missions': {
      try {
        const response = await fetch(`${SPAWN_API}/api/missions`);
        const data = await response.json();
        return { success: response.ok, missions: data };
      } catch (err) {
        return { success: false, error: `Spawn API unavailable: ${err.message}` };
      }
    }

    case 'get_architect_status': {
      try {
        const response = await fetch(`${SPAWN_API}/api/architect/status`);
        const data = await response.json();
        return { success: response.ok, ...data };
      } catch (err) {
        return { success: false, error: `Spawn API unavailable: ${err.message}` };
      }
    }

    // === SEMANTIC SEARCH TOOLS ===
    case 'semantic_search': {
      try {
        const results = await searchSimilar(args.query, {
          limit: args.limit || 5,
          collection: args.collection || null,
          threshold: args.threshold || 0.7
        });
        return {
          success: true,
          results,
          count: results.length,
          query: args.query,
          collection: args.collection || 'all'
        };
      } catch (err) {
        return { success: false, error: `Search failed: ${err.message}` };
      }
    }

    case 'store_knowledge': {
      try {
        const result = await storeDocument(
          args.content,
          args.metadata || {},
          args.collection || 'default'
        );
        return {
          success: true,
          id: result.id,
          collection: result.collection,
          preview: args.content.slice(0, 100) + (args.content.length > 100 ? '...' : '')
        };
      } catch (err) {
        return { success: false, error: `Store failed: ${err.message}` };
      }
    }

    case 'list_knowledge_collections': {
      try {
        const collections = listCollections();
        return {
          success: true,
          collections,
          total_documents: collections.reduce((sum, c) => sum + c.count, 0)
        };
      } catch (err) {
        return { success: false, error: `List failed: ${err.message}` };
      }
    }

    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}

// ==================== LLM ====================

const SYSTEM_PROMPT = `# ARCHITECT — AI Development Agent v2.0

You are ARCHITECT, an elite AI development agent operating within the spawn.new platform. You have full access to a Linux sandbox environment with terminal execution, file operations, and visual artifact rendering.

## ENVIRONMENT

- **Workspace**: ${WORKSPACE_ABS}
- **Python**: Use the virtual environment at \`.venv/\` - ALWAYS prefix Python commands with \`source .venv/bin/activate &&\`
- **Pre-installed Python packages**: pygame, numpy, pandas, matplotlib, requests
- **Terminal**: Full bash access via execute_command
- **File System**: Read/write/list operations in workspace
- **Artifacts**: Visual rendering of React, HTML, Mermaid diagrams, SVG, Canvas, P5.js, Three.js, Charts, and code

## CRITICAL: PYTHON VIRTUAL ENVIRONMENT

**ALWAYS use the virtual environment for Python:**
\`\`\`bash
# Installing packages:
source .venv/bin/activate && pip install <package>

# Running Python scripts:
source .venv/bin/activate && python game.py

# Or use the venv python directly:
.venv/bin/python game.py
.venv/bin/pip install <package>
\`\`\`

**NEVER run \`pip install\` without activating the venv first!**

## TOOLS

### Core Tools
| Tool | Purpose | When to Use |
|------|---------|-------------|
| \`execute_command\` | Run shell commands (npm, git, python, cargo, etc.) | Building, testing, installing, git operations |
| \`read_file\` | Read file contents | Understanding existing code before modifying |
| \`write_file\` | Create/update files | Implementing features, creating configs |
| \`list_files\` | Explore directory structure | Discovery phase, understanding project layout |
| \`create_artifact\` | Render visual content in UI | Showing diagrams, previews, documentation |

### Git & Repository Analysis
| Tool | Purpose | When to Use |
|------|---------|-------------|
| \`git_clone\` | Clone a GitHub repo into workspace | User provides a repo URL or "owner/repo" |
| \`analyze_repo\` | Get file tree, languages, key files | After cloning, to understand project structure |
| \`search_code\` | Search code with ripgrep | Find patterns, function definitions, usages |

**Repo Analysis Workflow:**
\`\`\`javascript
// 1. Clone the repo (handles short-form, URLs, etc.)
git_clone({ repo: "facebook/react", depth: 1 })  // Shallow clone for speed

// 2. Analyze structure
analyze_repo({ path: "react" })  // Returns file tree, languages, key files

// 3. Search for specific code
search_code({ pattern: "useState", path: "react", file_type: "ts" })

// 4. Read key files
read_file({ path: "react/README.md" })
read_file({ path: "react/package.json" })
\`\`\`

### Editor Integration (IDE-style code editing)
| Tool | Purpose | When to Use |
|------|---------|-------------|
| \`editor_open\` | Open file in code editor buffer | Show code in IDE for user to see/edit |
| \`editor_save\` | Save editor buffer to disk | Persist editor changes |

### Terminal Sessions (Persistent named terminals)
| Tool | Purpose | When to Use |
|------|---------|-------------|
| \`terminal_create\` | Create named terminal session | Long-running processes, dev servers |
| \`terminal_exec\` | Run command in named terminal | Build watch, test runs, server processes |
| \`terminal_buffer\` | Get terminal output buffer | Check command results, logs |
| \`terminal_list\` | List active terminals | See what's running |

**Pro Tip:** Use named terminals for development workflows:
\`\`\`javascript
terminal_create({ name: "dev" })           // Create dev terminal
terminal_exec({ name: "dev", command: "npm run dev" })  // Start dev server
terminal_buffer({ name: "dev", lines: 20 })  // Check output
\`\`\`

### Rust Backend Integration (Mission Orchestration)
| Tool | Purpose | When to Use |
|------|---------|-------------|
| \`create_mission\` | Create tracked development mission | Complex multi-step tasks needing orchestration |
| \`list_missions\` | List all missions from backend | Check task status and history |
| \`get_architect_status\` | Get system status | Verify service connectivity and resources |

**Integration:** You are connected to the spawn.new Rust backend which provides:
- **spawn-api** (port 3000): Mission orchestration, database, admin
- **terminal-app** (port 3001): PTY sessions, code editor buffers
- **sandbox-server** (port 3080): This instance - Grok AI + tools

## GROK ADVANCED CAPABILITIES

You are powered by Grok and have access to these advanced features:

### Live Search (Real-time Web/X/News Search)
Search the web, X (Twitter), and news sources for current information.

**Enable with \`search_parameters\` in API requests:**
\`\`\`javascript
// Auto mode - model decides when to search
search_parameters: { mode: "auto" }

// Force search on
search_parameters: { mode: "on" }

// Search specific sources
search_parameters: {
  mode: "auto",
  sources: [
    { type: "web" },           // Web search
    { type: "x" },             // X/Twitter posts
    { type: "news" },          // News articles
    { type: "rss", links: ["https://example.com/feed.xml"] }  // RSS feeds
  ],
  from_date: "2024-01-01",     // Optional date range
  to_date: "2024-12-31",
  max_search_results: 20,      // Limit sources (default 20)
  return_citations: true       // Include source URLs
}

// Web source options
{ type: "web", country: "US", allowed_websites: ["github.com", "stackoverflow.com"] }
{ type: "web", excluded_websites: ["wikipedia.org"] }

// X source options
{ type: "x", included_x_handles: ["elonmusk", "xai"] }
{ type: "x", post_favorite_count: 1000, post_view_count: 20000 }  // Filter by engagement
\`\`\`

**Use cases:**
- Current events and news
- Real-time market data
- Social media sentiment
- Research with up-to-date info

### Structured Outputs (Guaranteed JSON Schema)
Force responses to match a specific JSON schema - guaranteed type-safe output.

\`\`\`javascript
// Define schema with Pydantic-style structure
const schema = {
  type: "object",
  properties: {
    vendor_name: { type: "string", description: "Name of vendor" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "integer" },
          price: { type: "number" }
        }
      }
    },
    total: { type: "number" }
  },
  required: ["vendor_name", "items", "total"]
}

// Response will ALWAYS match this schema
\`\`\`

**Supported types:** string, number, integer, float, object, array, boolean, enum, anyOf

**Use cases:**
- Invoice/document parsing
- Entity extraction
- Data validation
- Structured reports

### Remote MCP Tools (External Tool Servers)
Connect to external MCP (Model Context Protocol) servers for additional capabilities.

\`\`\`javascript
// Add MCP server to tools
tools: [
  {
    type: "mcp",
    server_url: "https://mcp.deepwiki.com/mcp",
    server_label: "deepwiki",
    server_description: "Documentation and code analysis",
    allowed_tool_names: ["search_docs", "analyze_code"],  // Optional: filter tools
    authorization: "Bearer <token>",  // Optional auth
    extra_headers: { "X-Custom": "value" }
  }
]

// Multi-server setup
tools: [
  { type: "mcp", server_url: "https://mcp.deepwiki.com/mcp", server_label: "deepwiki" },
  { type: "mcp", server_url: "https://your-tools.com/mcp", server_label: "custom" },
  { type: "mcp", server_url: "https://api.example.com/tools", server_label: "api" }
]
\`\`\`

**Available MCP servers:**
- \`mcp.deepwiki.com\` - GitHub repo documentation and analysis
- Custom servers for your specific integrations

### Collections Search (RAG / Knowledge Base)
Search through uploaded document collections for retrieval-augmented generation.

\`\`\`javascript
// Enable collections search in tools
tools: [
  {
    type: "collections_search",
    collection_ids: ["collection_abc123"]  // Your uploaded collections
  }
]

// Workflow:
// 1. Create collection via API
// 2. Upload documents (PDF, text, CSV, etc.)
// 3. Wait for processing
// 4. Query with collections_search tool

// The model autonomously searches your documents and cites sources
// Citations use format: collections://collection_id/files/file_id
\`\`\`

**Use cases:**
- Enterprise knowledge bases
- Financial document analysis (SEC filings, reports)
- Customer support with product docs
- Research and due diligence
- Compliance and legal document search

### Code Execution (Server-Side)
Run Python code server-side for calculations and data processing.

\`\`\`javascript
// Enable code execution
tools: [
  { type: "code_execution" }
]
// or with xAI SDK:
tools: [...tools, { type: "code_interpreter" }]
\`\`\`

**Use cases:**
- Mathematical calculations
- Data analysis and visualization
- Algorithm prototyping
- Quick computations during reasoning

### Function Calling Best Practices
\`\`\`javascript
// Parallel tool calls (enabled by default)
parallel_tool_calls: true

// Tool choice modes
tool_choice: "auto"      // Model decides (default)
tool_choice: "required"  // Force tool use
tool_choice: "none"      // Disable tools
tool_choice: { type: "function", function: { name: "specific_tool" } }  // Force specific

// Tool result format
{
  role: "tool",
  tool_call_id: "<id from response>",
  content: JSON.stringify(result)
}
\`\`\`

### Combining Capabilities
Mix and match for powerful workflows:

\`\`\`javascript
// Example: Analyze internal docs + current market sentiment
tools: [
  collections_search({ collection_ids: ["company_docs"] }),
  web_search(),
  x_search(),
  code_execution()
]

// The model will:
// 1. Search your internal documents
// 2. Get current web/X data
// 3. Run calculations if needed
// 4. Synthesize with citations from all sources
\`\`\`

## MINDSET

Only think about a task if you have to, otherwise answer with conviction & professionalism.

Before modifying code: read the file first. Then act decisively.

## CRITICAL: USE THE SANDBOX

**You MUST actually execute code, not just generate artifacts.**

When building Python projects:
1. **write_file** - Save the code with correct extension (game.py, not game.txt)
2. **execute_command** - Install deps: \`source .venv/bin/activate && pip install <pkg>\`
3. **execute_command** - Run code: \`source .venv/bin/activate && python game.py\`
4. **create_artifact** - Show the code to the user with syntax highlighting

When building Node/React projects:
1. **write_file** - Save the code (app.js, index.html, etc.)
2. **execute_command** - Install deps: \`npm install\` or \`pnpm install\`
3. **execute_command** - Run: \`node app.js\` or \`npm run dev\`
4. **create_artifact** - Show live preview (type: react or html)

**WRONG:** Just creating an artifact with code and telling user to copy it
**RIGHT:** write_file → execute_command (install) → execute_command (run) → show results

You have a FULL LINUX SANDBOX. Use it! Run the code. Test it. Show real output.

## CRITICAL: BIAS TO ACTION

**NEVER ask clarifying questions when you can make a reasonable creative decision.**

- User says "make a snake game with a twist" → JUST BUILD IT with YOUR creative twist (power-ups, obstacles, AI enemies, etc.)
- User says "build me something cool" → JUST BUILD something impressive that showcases your abilities
- User gives vague requirements → INTERPRET CREATIVELY and deliver something working
- If truly ambiguous between 2-3 very different paths → pick the most interesting one and DO IT

**You are an ELITE AGENT. Elite agents:**
- Think out of the box and improvise
- Make creative decisions autonomously
- Deliver working code, not questions
- Surprise users with their ingenuity
- Ask questions ONLY when there's genuine technical ambiguity that would cause the wrong outcome

**Anti-pattern (BAD):** "What kind of twist would you like?"
**Good pattern:** "I'll create a snake game where the snake leaves a trail of fire that damages you if you touch it, plus power-ups that appear randomly. Let me build it..."

## CRITICAL: SINGLE-FILE, WELL-STRUCTURED OUTPUT

**ALWAYS prefer single-file solutions when possible.** Users want ONE artifact they can copy/download, not 6 scattered files.

**For games (Python/Pygame, etc.):**
- Put EVERYTHING in ONE file: classes, functions, game loop, config
- Structure with clear sections using comments: # === CONFIG ===, # === CLASSES ===, # === GAME LOGIC ===, # === MAIN ===
- Use classes to organize: Game, Player, Enemy, PowerUp, etc.
- Include docstrings and type hints
- Make it runnable with a single \`python game.py\`

**For web apps (React, HTML):**
- Single HTML file with embedded CSS and JS when possible
- Or single React component that contains everything
- Use the artifact system - don't write 10 separate files to disk

**Code Quality Requirements:**
- Clean separation of concerns (config at top, classes in middle, main logic at bottom)
- Consistent naming conventions (snake_case for Python, camelCase for JS)
- Proper error handling
- Comments for complex logic
- No magic numbers - use named constants

## CRITICAL: FILE STRUCTURE TEMPLATES

**Reference templates are in \`Example_File_Structure_Templates/\`:**
- \`python-template.py\` - Professional Python module structure
- \`javascript-template.js\` - Professional JavaScript structure
- \`typescript-template.ts\` - Professional TypeScript structure

**ALWAYS follow these template patterns when generating code:**
1. **Read the appropriate template FIRST** with \`read_file\` before writing any code
2. **Use the same header format** with module box, purpose, description, author, version
3. **Follow the section structure** with clear separators (═══════════════)
4. **Include architecture diagrams** in comments showing module structure
5. **Document dependencies, usage examples, and changelog**

Example workflow for a game request:
\`\`\`javascript
// 1. Read the template to understand structure
read_file({ path: "Example_File_Structure_Templates/python-template.py" })

// 2. Write code following that exact structure
write_file({ path: "space_shooter.py", content: <code following template format> })
\`\`\`

**The templates show PROFESSIONAL-GRADE code structure. Your output should match that quality.**

**Anti-pattern (BAD):** Creating main.py, config.py, player.py, enemy.py, utils.py, game.py for a simple snake game
**Good pattern:** One snake_game.py with Game, Snake, Food, PowerUp classes, all runnable with \`python snake_game.py\`

## PHASED DELIVERY

### Phase 1: Discovery
\`\`\`
list_files → read key files → understand patterns → create architecture artifact
\`\`\`

### Phase 2: Planning
\`\`\`
Design approach → identify affected files → create implementation plan artifact (Mermaid/Markdown)
\`\`\`

### Phase 3: Implementation
\`\`\`
write_file (incrementally) → execute_command (test/build) → iterate
\`\`\`

### Phase 4: Validation
\`\`\`
execute_command (full test suite) → create summary artifact → report results
\`\`\`

## ARTIFACT USAGE

**Always create artifacts for:**
- Architecture diagrams (type: mermaid)
- UI component previews (type: react or html) - LIVE PREVIEW!
- Code with syntax highlighting (type: code, lang: python/javascript/rust/etc)
- Visual flows and sequences (type: mermaid)
- SVG graphics and icons (type: svg)
- Interactive charts (type: chart) - Chart.js config
- Canvas/P5.js sketches (type: canvas or p5)
- 3D scenes (type: threejs)
- Data tables (type: csv)
- Structured data (type: json)
- Documents (type: markdown or docx)

**Showing Code to Users:**
When you write code with \`write_file\`, ALSO create an artifact so users can see it:
\`\`\`javascript
// After writing the file
create_artifact({
  type: "code",
  title: "snake_game.py",
  content: <the full code>,
  lang: "python"  // IMPORTANT: specify language for syntax highlighting!
})
\`\`\`

**Artifact Examples:**
\`\`\`javascript
// Architecture diagram
create_artifact({ type: "mermaid", title: "System Architecture", content: "graph TD\\n  A[Client] --> B[API]\\n  B --> C[Database]" })

// React component preview
create_artifact({ type: "react", title: "Button Component", content: "export default function Button() { return <button className='btn'>Click</button> }" })

// Implementation plan
create_artifact({ type: "markdown", title: "Implementation Plan", content: "## Steps\\n1. Create service\\n2. Add routes\\n3. Write tests" })
\`\`\`

## CODING STANDARDS

### TypeScript/JavaScript
- Strict mode, explicit types
- ESLint + Prettier compliance
- Functional patterns, avoid mutation
- Proper error handling with typed errors

### Rust
- Clippy clean, no warnings
- Proper Result/Option handling
- Document public APIs
- Use thiserror for error types

### General
- NEVER commit secrets or credentials
- ALWAYS read before modifying existing files
- Prefer editing over creating new files
- Keep changes minimal and focused
- Test after each significant change

## TERMINAL INTEGRATION

Use \`execute_command\` liberally for:
\`\`\`bash
# Project discovery
ls -la && git status && cat package.json

# Dependency management
npm install <package> && npm list

# Building and testing
npm run build && npm test
cargo build && cargo test

# Git operations
git add . && git commit -m "feat: description"
\`\`\`

## SAFETY RULES

### MUST
- Confirm destructive operations before executing
- Create backups or use git before major refactors
- Log actions and results clearly
- Report errors immediately with context

### MUST NOT
- \`rm -rf /\` or recursive delete from root
- \`sudo\` commands without explicit approval
- \`chmod 777\` or overly permissive modes
- Execute base64 encoded or obfuscated commands
- Access paths outside workspace
- Commit secrets, tokens, or API keys

## COMMUNICATION STYLE

- Be direct and technical
- Show, don't just tell — use artifacts
- Explain the "why" behind decisions
- Report progress at each phase
- Summarize results with metrics when applicable

## CRITICAL: OUTPUT FORMAT

**ALWAYS respond in plain natural language text, NOT JSON.**

Your responses to the user should be:
- Conversational, friendly, and readable
- Use markdown formatting for structure (headers, lists, code blocks)
- NEVER output raw JSON objects as your response
- NEVER wrap your response in \`\`\`json blocks unless showing data to the user

**BAD (don't do this):**
\`\`\`
{"status": "complete", "message": "I created the file", "files": ["app.py"]}
\`\`\`

**GOOD (do this):**
\`\`\`
Done! I created \`app.py\` with a Flask server. Run it with:
python app.py
\`\`\`

Tool results come back as JSON - that's fine. But YOUR message to the user must be natural language.

## CRITICAL: FILE NAMING

**ALWAYS use the correct file extension for the language:**
- Python: \`.py\` (game.py, app.py, main.py)
- JavaScript: \`.js\` (app.js, server.js, index.js)
- TypeScript: \`.ts\` or \`.tsx\` for React (App.tsx, utils.ts)
- HTML: \`.html\` (index.html, page.html)
- CSS: \`.css\` (styles.css, main.css)
- JSON: \`.json\` (config.json, package.json)
- Shell: \`.sh\` (setup.sh, deploy.sh)

**NEVER use \`.txt\` for code files.** A Python script MUST be \`game.py\`, not \`game.txt\`.

## MULTI-TOOL WORKFLOWS

You can call multiple tools in a single response. Chain tools for efficient workflows:

**Example: Building a Python game**
1. \`write_file\` → Save game.py (with .py extension!)
2. \`execute_command\` → \`source .venv/bin/activate && pip install pygame\`
3. \`execute_command\` → \`source .venv/bin/activate && python game.py\`
4. \`create_artifact\` → Show the code with syntax highlighting (type: code, lang: python)

**Example: Building a React app**
1. \`write_file\` → Save App.jsx or component code
2. \`create_artifact\` → type: react - shows LIVE PREVIEW in sandbox!

**Example: Analyzing a repo**
1. \`git_clone\` → Clone the repository
2. \`analyze_repo\` → Get file tree, languages, key files
3. \`read_file\` → Read important files
4. \`create_artifact\` → Architecture diagram (type: mermaid)

When tools don't depend on each other, call them in parallel for speed.

## DELIVERABLES CHECKLIST

At task completion, verify:
- [ ] All requested functionality implemented
- [ ] Tests passing (show with execute_command)
- [ ] Build succeeds (show with execute_command)
- [ ] Documentation updated if needed
- [ ] Summary artifact created
- [ ] Any follow-up items noted

## PHASED EXECUTION PROTOCOL

**For complex build requests (games, apps, features), follow this 5-phase protocol:**

### Phase 1: Template Discovery
\`\`\`javascript
// BEFORE writing any code, read the appropriate template
read_file({ path: "Example_File_Structure_Templates/python-template.py" })  // for Python
read_file({ path: "Example_File_Structure_Templates/javascript-template.js" })  // for JS
read_file({ path: "Example_File_Structure_Templates/typescript-template.ts" })  // for TS
\`\`\`

### Phase 2: Architecture Planning
- Review the template structure (9 sections: header, imports, config, types, classes, helpers, core logic, events, main)
- Plan your implementation following that exact structure
- Identify classes, methods, and data structures needed

### Phase 3: Implementation
- Write the complete code following the template format
- Use proper section separators (═══════════════)
- Include docstrings, type hints, and architecture diagrams in comments
- Single-file solutions when possible

### Phase 4: Execution
\`\`\`javascript
// For Python games/apps:
write_file({ path: "game.py", content: <your_code> })
execute_command({ command: "source .venv/bin/activate && pip install <deps>" })
execute_command({ command: "source .venv/bin/activate && python game.py" })

// For Node/React:
write_file({ path: "app.js", content: <your_code> })
execute_command({ command: "node app.js" })  // or npm commands
\`\`\`

### Phase 5: Artifact Display
\`\`\`javascript
// Show the code to the user with syntax highlighting
create_artifact({
  type: "code",
  title: "game.py",
  content: <the_full_code>,
  lang: "python"  // or "javascript", "typescript", etc.
})
\`\`\`

**CRITICAL: Template Reading is MANDATORY**
- NEVER skip Phase 1 (template discovery)
- The templates exist to ensure consistent, professional-grade output
- Your code MUST follow the 9-section structure from the templates

---

## CRITICAL: CANVAS OUTPUT REQUIREMENTS

**EVERY code file MUST be displayed on the canvas as an artifact.**

**Mandatory workflow for ALL code generation:**
\`\`\`
1. write_file → Save to sandbox filesystem
2. create_artifact → Display on canvas (REQUIRED!)
3. execute_command → Run/test the code
4. If changes needed → Update both file AND artifact
\`\`\`

**NEVER just write a file without showing it on the canvas.**

**Canvas Artifact Format for Code:**
\`\`\`javascript
create_artifact({
  type: "code",
  title: "filename.py",
  description: "Brief description",
  tags: ["python", "game"],
  files: [{
    path: "filename.py",
    language: "python",  // CRITICAL: correct language!
    content: fullCodeString,
    role: "source",
    entrypoint: true
  }],
  execution: { runtime: "python", command: "python filename.py" },
  render: {
    display: "block",
    theme: "dark",
    show_code: true,
    allow_edit: true,    // ENABLE EDITING!
    allow_download: true
  }
})
\`\`\`

**For React/HTML (Live Preview):**
\`\`\`javascript
create_artifact({
  type: "react",  // or "html"
  title: "App Component",
  files: [{
    path: "App.tsx",
    language: "tsx",
    content: componentCode,
    entrypoint: true
  }],
  execution: { runtime: "browser" },
  render: { display: "block", allow_edit: true }
})
\`\`\`

**Code Quality Checklist:**
□ Professional header with module name, purpose, author
□ Clear section separators (═══════════════)
□ Organized imports (stdlib → third-party → local)
□ Constants at top, no magic numbers
□ Functions have docstrings with Args/Returns
□ Type hints throughout
□ Error handling present
□ Main entry point exists
□ Code tested and runs
□ Artifact shown on canvas with allow_edit: true

---
Ready to architect. What would you like to build?`;


// Streaming LLM call with interleaved text + tool support
async function* streamLLM(messages, tools = null, options = {}) {
  const apiKey = process.env.XAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('No API key configured');

  const isXai = apiKey.startsWith('xai-');
  const endpoint = isXai ? 'https://api.x.ai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';

  const body = {
    model: isXai ? 'grok-4.1-fast' : 'x-ai/grok-4.1-fast',
    messages,
    temperature: 0.7,
    max_tokens: 8192,
    stream: true,  // Enable streaming!
    reasoning: { enabled: false }
  };

  // Enable Live Search if xAI (auto mode - model decides when to search)
  if (isXai && options.enableSearch !== false) {
    body.search_parameters = {
      mode: 'auto',
      sources: [
        { type: 'web' },
        { type: 'x' },
        { type: 'news' }
      ],
      return_citations: true,
      max_search_results: 10
    };
  }

  if (tools) {
    body.tools = tools;
    if (isXai) {
      body.tools = [...tools, { type: 'code_interpreter' }];
    }
    body.tool_choice = 'auto';
    body.parallel_tool_calls = true;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(isXai ? {} : { 'HTTP-Referer': process.env.OPENROUTER_REFERER || 'spawn-sandbox', 'X-Title': process.env.OPENROUTER_TITLE || 'spawn' }),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`LLM API error: ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // Accumulate the full message for tool calls
  let fullContent = '';
  let toolCalls = [];
  let finishReason = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') {
        yield { type: 'done', content: fullContent, tool_calls: toolCalls.length ? toolCalls : null, finish_reason: finishReason };
        return;
      }

      try {
        const chunk = JSON.parse(data);
        const delta = chunk.choices?.[0]?.delta;
        finishReason = chunk.choices?.[0]?.finish_reason || finishReason;

        if (delta?.content) {
          fullContent += delta.content;
          yield { type: 'text', content: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!toolCalls[idx]) {
              toolCalls[idx] = { id: tc.id, type: tc.type, function: { name: '', arguments: '' } };
            }
            if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;

            // Yield tool call updates as they come
            yield { type: 'tool_delta', index: idx, tool: toolCalls[idx] };
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }

  // Final yield if no [DONE] received
  yield { type: 'done', content: fullContent, tool_calls: toolCalls.length ? toolCalls : null, finish_reason: finishReason };
}

// Non-streaming fallback (for compatibility)
async function callLLM(messages, tools = null, options = {}) {
  const apiKey = process.env.XAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('No API key configured');

  const isXai = apiKey.startsWith('xai-');
  const endpoint = isXai ? 'https://api.x.ai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';

  const body = {
    model: isXai ? 'grok-4.1-fast' : 'x-ai/grok-4.1-fast',
    messages,
    temperature: 0.7,
    max_tokens: 8192,
    reasoning: { enabled: false }
  };

  // Enable Live Search if xAI (auto mode - model decides when to search)
  if (isXai && options.enableSearch !== false) {
    body.search_parameters = {
      mode: 'auto',
      sources: [
        { type: 'web' },
        { type: 'x' },
        { type: 'news' }
      ],
      return_citations: true,
      max_search_results: 10
    };
  }

  if (tools) {
    body.tools = tools;
    if (isXai) {
      body.tools = [...tools, { type: 'code_interpreter' }];
    }
    body.tool_choice = 'auto';
    body.parallel_tool_calls = true;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(isXai ? {} : { 'HTTP-Referer': process.env.OPENROUTER_REFERER || 'spawn-sandbox', 'X-Title': process.env.OPENROUTER_TITLE || 'spawn' }),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`LLM API error: ${response.status}`);
  return response.json();
}

// ==================== Embeddings Function ====================

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

/**
 * Get embeddings from Ollama (local)
 */
async function getOllamaEmbeddings(input) {
  const inputs = Array.isArray(input) ? input : [input];
  const embeddings = [];

  for (const text of inputs) {
    const response = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_EMBED_MODEL,
        input: text
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embed error: ${response.status}`);
    }

    const result = await response.json();
    // Ollama returns { embeddings: [[...]] } for single input
    embeddings.push(result.embeddings?.[0] || result.embedding);
  }

  return {
    embeddings,
    model: OLLAMA_EMBED_MODEL,
    usage: { prompt_tokens: inputs.join(' ').split(/\s+/).length },
    dimensions: embeddings[0]?.length || 0
  };
}

/**
 * Generate embeddings - tries Ollama first, falls back to cloud APIs
 * @param {string|string[]} input - Text or array of texts to embed
 * @param {string} model - Embedding model to use (default: 'v1' for xAI)
 * @returns {Promise<{embeddings: number[][], model: string, usage: object}>}
 */
async function getEmbeddings(input, model = 'v1') {
  // Try Ollama first if configured
  if (process.env.USE_OLLAMA_EMBEDDINGS !== 'false') {
    try {
      return await getOllamaEmbeddings(input);
    } catch (err) {
      console.log(`[Embeddings] Ollama failed (${err.message}), falling back to cloud API`);
    }
  }

  // Fallback to cloud APIs
  const apiKey = process.env.XAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('No API key configured');

  const isXai = apiKey.startsWith('xai-');

  // xAI uses their own endpoint, OpenRouter uses OpenAI-compatible
  const endpoint = isXai
    ? 'https://api.x.ai/v1/embeddings'
    : 'https://openrouter.ai/api/v1/embeddings';

  // Normalize input to array
  const inputs = Array.isArray(input) ? input : [input];

  const body = {
    model: isXai ? model : 'openai/text-embedding-3-small',
    input: inputs,
    encoding_format: 'float'
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(isXai ? {} : {
        'HTTP-Referer': process.env.OPENROUTER_REFERER || 'spawn-sandbox',
        'X-Title': process.env.OPENROUTER_TITLE || 'spawn'
      }),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embeddings API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  return {
    embeddings: result.data.map(d => d.embedding),
    model: result.model,
    usage: result.usage,
    dimensions: result.data[0]?.embedding?.length || 0
  };
}

// ==================== Embeddings Endpoint ====================

app.post('/api/embeddings', async (req, res) => {
  try {
    const { input, model } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Input text required' });
    }

    const result = await getEmbeddings(input, model);
    res.json(result);
  } catch (error) {
    console.error('Embeddings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Vector Store (SQLite + Embeddings) ====================

// Initialize SQLite database for vector storage
const VECTOR_DB_PATH = path.join(__dirname, 'vectors.db');
const vectorDb = new Database(VECTOR_DB_PATH);

// Create tables for storing embeddings
vectorDb.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    metadata TEXT,
    embedding BLOB NOT NULL,
    collection TEXT DEFAULT 'default',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_collection ON documents(collection);
`);

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Store a document with its embedding in the vector database
 */
async function storeDocument(content, metadata = {}, collection = 'default') {
  const { embeddings } = await getEmbeddings(content);
  const embedding = embeddings[0];

  const stmt = vectorDb.prepare(`
    INSERT INTO documents (content, metadata, embedding, collection)
    VALUES (?, ?, ?, ?)
  `);

  const result = stmt.run(
    content,
    JSON.stringify(metadata),
    Buffer.from(new Float32Array(embedding).buffer),
    collection
  );

  return { id: result.lastInsertRowid, content, metadata, collection };
}

/**
 * Search for similar documents using cosine similarity
 */
async function searchSimilar(query, options = {}) {
  const { limit = 5, collection = null, threshold = 0.7 } = options;

  // Get embedding for query
  const { embeddings } = await getEmbeddings(query);
  const queryEmbedding = embeddings[0];

  // Get all documents (optionally filtered by collection)
  let sql = 'SELECT id, content, metadata, embedding, collection FROM documents';
  const params = [];
  if (collection) {
    sql += ' WHERE collection = ?';
    params.push(collection);
  }

  const docs = vectorDb.prepare(sql).all(...params);

  // Calculate similarities
  const results = docs.map(doc => {
    const embedding = new Float32Array(doc.embedding.buffer);
    const similarity = cosineSimilarity(queryEmbedding, Array.from(embedding));
    return {
      id: doc.id,
      content: doc.content,
      metadata: JSON.parse(doc.metadata || '{}'),
      collection: doc.collection,
      similarity
    };
  });

  // Filter by threshold, sort by similarity, limit results
  return results
    .filter(r => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Delete documents from the vector store
 */
function deleteDocument(id) {
  const stmt = vectorDb.prepare('DELETE FROM documents WHERE id = ?');
  return stmt.run(id);
}

/**
 * List all collections
 */
function listCollections() {
  const stmt = vectorDb.prepare('SELECT DISTINCT collection, COUNT(*) as count FROM documents GROUP BY collection');
  return stmt.all();
}

/**
 * Clear a collection
 */
function clearCollection(collection) {
  const stmt = vectorDb.prepare('DELETE FROM documents WHERE collection = ?');
  return stmt.run(collection);
}

// ==================== Vector Store Endpoints ====================

// Store a document
app.post('/api/vectors/store', async (req, res) => {
  try {
    const { content, metadata, collection } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });

    const result = await storeDocument(content, metadata, collection);
    res.json(result);
  } catch (error) {
    console.error('Vector store error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch store documents
app.post('/api/vectors/store/batch', async (req, res) => {
  try {
    const { documents, collection } = req.body;
    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({ error: 'Documents array required' });
    }

    const results = [];
    for (const doc of documents) {
      const result = await storeDocument(
        doc.content,
        doc.metadata || {},
        collection || doc.collection || 'default'
      );
      results.push(result);
    }

    res.json({ stored: results.length, documents: results });
  } catch (error) {
    console.error('Batch store error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search for similar documents
app.post('/api/vectors/search', async (req, res) => {
  try {
    const { query, limit, collection, threshold } = req.body;
    if (!query) return res.status(400).json({ error: 'Query required' });

    const results = await searchSimilar(query, { limit, collection, threshold });
    res.json({ results, count: results.length });
  } catch (error) {
    console.error('Vector search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List collections
app.get('/api/vectors/collections', (req, res) => {
  try {
    const collections = listCollections();
    res.json({ collections });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear a collection
app.delete('/api/vectors/collections/:collection', (req, res) => {
  try {
    const result = clearCollection(req.params.collection);
    res.json({ deleted: result.changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a document
app.delete('/api/vectors/:id', (req, res) => {
  try {
    const result = deleteDocument(parseInt(req.params.id));
    res.json({ deleted: result.changes > 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Chat Endpoint ====================

app.post('/api/chat/stream', async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    let iterations = 0;
    while (iterations++ < 10) {
      send({ type: 'thinking', iteration: iterations });

      const response = await callLLM(messages, TOOLS);
      const msg = response.choices[0].message;
      console.log(`[Iteration ${iterations}] Tool calls:`, msg.tool_calls?.length || 0, msg.tool_calls?.map(t => t.function.name) || []);
      messages.push(msg);

      if (msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          // Skip server-side tools (code_interpreter) - xAI handles these automatically
          if (tc.type === 'code_interpreter' || !tc.function) {
            send({ type: 'tool_result', tool: 'code_interpreter', result: { success: true, note: 'Executed by xAI' } });
            continue;
          }

          const args = JSON.parse(tc.function.arguments || '{}');
          send({ type: 'tool_start', tool: tc.function.name, args });

          const result = await executeTool(tc.function.name, args);
          send({ type: 'tool_result', tool: tc.function.name, result });

          if (result.artifact) send({ type: 'artifact', artifact: result.artifact });

          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
        }
      } else {
        send({ type: 'response', content: msg.content || '' });
        send({ type: 'done', iterations });
        return res.end();
      }
    }
    send({ type: 'done', iterations, maxReached: true });
    res.end();
  } catch (err) {
    send({ type: 'error', message: err.message });
    res.end();
  }
});

// ==================== Basic Endpoints ====================

app.get('/health', (_req, res) => res.json({ status: 'healthy', mode: 'local', workspace: WORKSPACE_ABS }));

app.post('/api/sandbox/exec', async (req, res) => {
  const { command, cwd } = req.body;
  if (!command) return res.status(400).json({ error: 'Command required' });
  const result = await runExec(command, cwd || WORKSPACE_ABS);
  res.json({ command, ...result });
});

app.post('/api/sandbox/exec/stream', async (req, res) => {
  const { command, cwd } = req.body;
  if (!command) return res.status(400).json({ error: 'Command required' });
  runExecStream(command, cwd || WORKSPACE_ABS, res, req);
});

app.get('/api/workspaces', async (_req, res) => {
  const result = await runExec(`ls -1 "${WORKSPACE_ABS}"`);
  const names = result.stdout.split('\n').filter(n => n && !n.startsWith('.'));
  res.json({ projects: names.map(n => ({ name: n, path: path.join(WORKSPACE_ABS, n) })) });
});

// ==================== Workspace Management API ====================

// Get workspace info and installed tools
app.get('/api/workspace/info', async (_req, res) => {
  const checks = await Promise.all([
    runExec('python3 --version 2>&1 || echo "not installed"'),
    runExec('node --version 2>&1 || echo "not installed"'),
    runExec('pnpm --version 2>&1 || echo "not installed"'),
    runExec('cargo --version 2>&1 || echo "not installed"'),
    runExec('git --version 2>&1 || echo "not installed"'),
    runExec('rg --version 2>&1 | head -1 || echo "not installed"'),
    runExec(`du -sh "${WORKSPACE_ABS}" 2>/dev/null | cut -f1 || echo "unknown"`),
    runExec(`find "${WORKSPACE_ABS}" -type f | wc -l`),
  ]);

  res.json({
    workspace: WORKSPACE_ABS,
    tools: {
      python: checks[0].stdout.trim(),
      node: checks[1].stdout.trim(),
      pnpm: checks[2].stdout.trim(),
      rust: checks[3].stdout.trim(),
      git: checks[4].stdout.trim(),
      ripgrep: checks[5].stdout.trim(),
    },
    stats: {
      size: checks[6].stdout.trim(),
      files: parseInt(checks[7].stdout.trim()) || 0,
    },
  });
});

// Setup/provision workspace with dependencies
app.post('/api/workspace/setup', async (req, res) => {
  const { features = ['python', 'node'] } = req.body;
  const results = [];

  // Ensure workspace exists
  if (!fs.existsSync(WORKSPACE_ABS)) {
    fs.mkdirSync(WORKSPACE_ABS, { recursive: true });
    results.push({ action: 'create_workspace', success: true });
  }

  // Install requested features
  for (const feature of features) {
    switch (feature) {
      case 'python':
        // Check if venv exists, create if not
        const venvPath = path.join(WORKSPACE_ABS, '.venv');
        if (!fs.existsSync(venvPath)) {
          const venvResult = await runExec(`cd "${WORKSPACE_ABS}" && python3 -m venv .venv`);
          results.push({ action: 'python_venv', success: venvResult.success, output: venvResult.stderr });
        }
        // Install common packages
        const pipResult = await runExec(`cd "${WORKSPACE_ABS}" && source .venv/bin/activate && pip install pygame numpy pandas matplotlib requests 2>&1 | tail -5`);
        results.push({ action: 'python_packages', success: pipResult.success, output: pipResult.stdout });
        break;

      case 'node':
        // Initialize package.json if not exists
        const pkgPath = path.join(WORKSPACE_ABS, 'package.json');
        if (!fs.existsSync(pkgPath)) {
          fs.writeFileSync(pkgPath, JSON.stringify({ name: 'workspace', private: true, type: 'module' }, null, 2));
          results.push({ action: 'node_init', success: true });
        }
        break;

      case 'react':
        const reactResult = await runExec(`cd "${WORKSPACE_ABS}" && pnpm add react react-dom 2>&1 | tail -3`);
        results.push({ action: 'react_install', success: reactResult.success, output: reactResult.stdout });
        break;
    }
  }

  res.json({ success: true, results });
});

// Clean workspace (remove all files)
app.post('/api/workspace/clean', async (req, res) => {
  const { confirm } = req.body;
  if (confirm !== 'yes') {
    return res.status(400).json({ error: 'Must confirm with { confirm: "yes" }' });
  }

  // Remove contents but keep the directory
  const result = await runExec(`cd "${WORKSPACE_ABS}" && rm -rf ./* ./.[!.]* 2>/dev/null; echo "cleaned"`);
  res.json({ success: true, message: 'Workspace cleaned', output: result.stdout });
});

// List files in workspace with details
app.get('/api/workspace/files', async (req, res) => {
  const { path: subPath = '.', recursive = false } = req.query;
  const targetPath = path.resolve(WORKSPACE_ABS, subPath);

  // Security check - ensure path is within workspace
  if (!targetPath.startsWith(WORKSPACE_ABS)) {
    return res.status(403).json({ error: 'Path outside workspace' });
  }

  const cmd = recursive
    ? `find "${targetPath}" -type f ! -path '*/node_modules/*' ! -path '*/.git/*' | head -200`
    : `ls -la "${targetPath}" 2>/dev/null || echo "Directory not found"`;

  const result = await runExec(cmd);
  res.json({ path: subPath, files: result.stdout });
});

// Read a file from workspace
app.get('/api/workspace/file', async (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const fullPath = path.resolve(WORKSPACE_ABS, filePath);
  if (!fullPath.startsWith(WORKSPACE_ABS)) {
    return res.status(403).json({ error: 'Path outside workspace' });
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const stat = fs.statSync(fullPath);
    res.json({
      path: filePath,
      content: content.slice(0, 100000),
      size: stat.size,
      modified: stat.mtime,
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Write a file to workspace
app.post('/api/workspace/file', async (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) {
    return res.status(400).json({ error: 'path and content required' });
  }

  const fullPath = path.resolve(WORKSPACE_ABS, filePath);
  if (!fullPath.startsWith(WORKSPACE_ABS)) {
    return res.status(403).json({ error: 'Path outside workspace' });
  }

  try {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    res.json({ success: true, path: filePath, size: content.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a file/directory from workspace
app.delete('/api/workspace/file', async (req, res) => {
  const { path: filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const fullPath = path.resolve(WORKSPACE_ABS, filePath);
  if (!fullPath.startsWith(WORKSPACE_ABS)) {
    return res.status(403).json({ error: 'Path outside workspace' });
  }

  try {
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true });
    } else {
      fs.unlinkSync(fullPath);
    }
    res.json({ success: true, deleted: filePath });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ==================== Artifact API ====================

// In-memory artifact store (for demo purposes - use a real DB in production)
const artifactStore = new Map();

// Validate an artifact
app.post('/api/artifacts/validate', (req, res) => {
  const artifact = req.body;
  if (!artifact) {
    return res.status(400).json({ error: 'Artifact payload required' });
  }

  const validation = validateArtifact(artifact);
  res.json({
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings,
    score: validation.score
  });
});

// Create an artifact (non-streaming)
app.post('/api/artifacts', (req, res) => {
  const args = req.body;

  // Generate unique artifact ID
  const timestamp = Date.now().toString(36).padStart(9, '0');
  const random = Math.random().toString(36).slice(2, 9);
  const artifactId = `art_${timestamp}${random}`;
  const now = new Date().toISOString();

  // Build artifact
  const artifact = {
    id: artifactId,
    type: args.type,
    title: args.title,
    description: args.description || null,
    tags: args.tags || [],
    files: args.files || [],
    execution: args.execution || null,
    dependencies: args.dependencies || null,
    env: args.env || null,
    version: args.version || { number: '1.0.0' },
    render: args.render || { display: 'block', theme: 'dark' },
    created_at: now,
    updated_at: now
  };

  // Validate
  const validation = validateArtifact(artifact);
  artifact.validation = validation;
  artifact.status = validation.valid ? 'complete' : 'invalid';

  // Store
  artifactStore.set(artifactId, artifact);

  res.status(201).json({ success: true, artifact, validation });
});

// Get an artifact by ID
app.get('/api/artifacts/:id', (req, res) => {
  const artifact = artifactStore.get(req.params.id);
  if (!artifact) {
    return res.status(404).json({ error: 'Artifact not found' });
  }
  res.json(artifact);
});

// List all artifacts
app.get('/api/artifacts', (_req, res) => {
  const artifacts = [...artifactStore.values()].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  res.json({ artifacts, count: artifacts.length });
});

// Delete an artifact
app.delete('/api/artifacts/:id', (req, res) => {
  const deleted = artifactStore.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Artifact not found' });
  }
  res.json({ success: true, deleted: req.params.id });
});

// ==================== Streaming Artifact Emission ====================

/**
 * Streaming artifact emission conforming to Artifact Schema Spec v1.0
 * Protocol:
 *   1. 'create' - Initialize artifact with metadata
 *   2. 'update' - Update artifact fields
 *   3. 'stream' - Stream file content (chunk by chunk)
 *   4. 'finalize' - Mark artifact complete with validation
 */
app.post('/api/artifacts/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const { type, title, description, files = [], execution, dependencies, render } = req.body;

  // Phase 1: Create
  const timestamp = Date.now().toString(36).padStart(9, '0');
  const random = Math.random().toString(36).slice(2, 9);
  const artifactId = `art_${timestamp}${random}`;
  const now = new Date().toISOString();

  send('create', {
    id: artifactId,
    type,
    title,
    description,
    status: 'streaming',
    created_at: now
  });

  // Phase 2: Stream files
  let fileIndex = 0;
  const streamFile = () => {
    if (fileIndex >= files.length) {
      // Phase 3: Finalize
      const artifact = {
        id: artifactId,
        type,
        title,
        description,
        tags: req.body.tags || [],
        files,
        execution,
        dependencies,
        render: render || { display: 'block', theme: 'dark' },
        version: req.body.version || { number: '1.0.0' },
        status: 'complete',
        created_at: now,
        updated_at: new Date().toISOString()
      };

      const validation = validateArtifact(artifact);
      artifact.validation = validation;
      artifact.status = validation.valid ? 'complete' : 'invalid';

      // Store it
      artifactStore.set(artifactId, artifact);

      send('finalize', {
        id: artifactId,
        status: artifact.status,
        validation,
        files_count: files.length
      });

      res.end();
      return;
    }

    const file = files[fileIndex];
    const content = file.content || '';
    const chunkSize = 1000; // Characters per chunk
    let charIndex = 0;

    // Stream file metadata
    send('file_start', {
      index: fileIndex,
      path: file.path,
      language: file.language,
      total_length: content.length
    });

    // Simulate streaming chunks (in real use, content would come from an LLM)
    const streamChunk = () => {
      if (charIndex >= content.length) {
        send('file_end', { index: fileIndex, path: file.path });
        fileIndex++;
        setImmediate(streamFile);
        return;
      }

      const chunk = content.slice(charIndex, charIndex + chunkSize);
      send('stream', {
        file_index: fileIndex,
        offset: charIndex,
        content: chunk
      });

      charIndex += chunkSize;
      setImmediate(streamChunk);
    };

    streamChunk();
  };

  streamFile();
});

// Update artifact (partial update)
app.patch('/api/artifacts/:id', (req, res) => {
  const artifact = artifactStore.get(req.params.id);
  if (!artifact) {
    return res.status(404).json({ error: 'Artifact not found' });
  }

  // Merge updates
  const updates = req.body;
  const updatedArtifact = {
    ...artifact,
    ...updates,
    updated_at: new Date().toISOString()
  };

  // Re-validate
  const validation = validateArtifact(updatedArtifact);
  updatedArtifact.validation = validation;
  updatedArtifact.status = validation.valid ? 'complete' : 'invalid';

  artifactStore.set(req.params.id, updatedArtifact);

  res.json({ success: true, artifact: updatedArtifact, validation });
});

// Get artifact types and schema info
app.get('/api/artifacts/schema/types', (_req, res) => {
  res.json({
    types: [...VALID_ARTIFACT_TYPES],
    languages: [...VALID_LANGUAGES],
    runtimes: [...VALID_RUNTIMES],
    file_roles: [...VALID_FILE_ROLES],
    display_modes: [...VALID_DISPLAY_MODES],
    themes: [...VALID_THEMES]
  });
});

// ==================== Start ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🐧 Spawn Sandbox (Local Mode)                            ║
║                                                           ║
║  URL:       http://localhost:${PORT}                       ║
║  Workspace: ${WORKSPACE_ABS.slice(0, 43).padEnd(43)}║
║                                                           ║
║  Tools: execute_command, read_file, write_file,           ║
║         list_files, create_artifact                       ║
╚═══════════════════════════════════════════════════════════╝
`);
});
