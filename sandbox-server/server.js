#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3080;
const CONTAINER_NAME = process.env.CONTAINER_NAME || 'spawn-sandbox';
const WORKSPACE_PATH = process.env.WORKSPACE_PATH || '/workspace';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ==================== Container Helpers ====================

async function isContainerRunning() {
  try {
    const { stdout } = await execAsync(`podman ps --filter "name=${CONTAINER_NAME}" --format "{{.Names}}"`);
    return stdout.trim() === CONTAINER_NAME;
  } catch {
    return false;
  }
}

async function ensureContainerRunning() {
  if (await isContainerRunning()) return true;
  try {
    await execAsync(`podman start ${CONTAINER_NAME}`);
    return true;
  } catch (err) {
    console.error(`Failed to start container: ${err.message}`);
    return false;
  }
}

async function podmanExec(command, cwd = WORKSPACE_PATH) {
  await ensureContainerRunning();
  const full = cwd ? `cd ${cwd} 2>/dev/null; ${command}` : command;
  try {
    const { stdout, stderr } = await execAsync(
      `podman exec ${CONTAINER_NAME} sh -c ${JSON.stringify(full)}`,
      { maxBuffer: 50 * 1024 * 1024, timeout: 60000 }
    );
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

function podmanExecStream(command, cwd, res, req) {
  const full = cwd ? `cd ${cwd} && ${command}` : command;
  const proc = spawn('podman', ['exec', CONTAINER_NAME, 'sh', '-c', full]);

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

// ==================== Tool Definitions ====================

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'execute_command',
      description: 'Execute a shell command in the sandbox container. Use for running code, installing packages, file operations, git commands, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
          cwd: { type: 'string', description: 'Working directory (default: /workspace)' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file in the sandbox',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file (relative to /workspace or absolute)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file in the sandbox. Creates parent directories if needed.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' },
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
      description: 'List files and directories in a path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (default: /workspace)' },
          recursive: { type: 'boolean', description: 'List recursively (default: false)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clone_repo',
      description: 'Clone a GitHub repository into the sandbox',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'GitHub repository URL' },
          name: { type: 'string', description: 'Optional: custom directory name' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_artifact',
      description: 'Create a visual artifact (React component, HTML, diagram, etc.) that will be rendered in the UI. Use this to show the user interactive components, visualizations, or formatted content.',
      parameters: {
        type: 'object',
        properties: {
          type: { 
            type: 'string', 
            enum: ['react', 'html', 'mermaid', 'svg', 'markdown', 'code'],
            description: 'Type of artifact' 
          },
          title: { type: 'string', description: 'Title for the artifact' },
          content: { type: 'string', description: 'The code/content for the artifact' },
          lang: { type: 'string', description: 'Language for code artifacts (e.g., javascript, python, rust)' },
        },
        required: ['type', 'title', 'content'],
      },
    },
  },
];

// ==================== Tool Execution ====================

async function executeTool(name, args) {
  console.log(`[Tool] ${name}:`, JSON.stringify(args).slice(0, 200));
  
  switch (name) {
    case 'execute_command': {
      const result = await podmanExec(args.command, args.cwd || WORKSPACE_PATH);
      const output = result.stdout + (result.stderr ? `\nSTDERR: ${result.stderr}` : '');
      return {
        success: result.success,
        output: output.slice(0, 10000), // Limit output size
        code: result.code,
      };
    }
    
    case 'read_file': {
      const filePath = args.path.startsWith('/') ? args.path : `${WORKSPACE_PATH}/${args.path}`;
      const result = await podmanExec(`cat "${filePath}"`);
      return {
        success: result.success,
        content: result.stdout.slice(0, 50000),
        error: result.stderr,
      };
    }
    
    case 'write_file': {
      const filePath = args.path.startsWith('/') ? args.path : `${WORKSPACE_PATH}/${args.path}`;
      const dir = path.dirname(filePath);
      await podmanExec(`mkdir -p "${dir}"`);
      
      // Use base64 to handle special characters safely
      const b64 = Buffer.from(args.content).toString('base64');
      const result = await podmanExec(`echo "${b64}" | base64 -d > "${filePath}"`);
      
      return {
        success: result.success,
        path: filePath,
        error: result.stderr,
      };
    }
    
    case 'list_files': {
      const dirPath = args.path || WORKSPACE_PATH;
      const cmd = args.recursive 
        ? `find "${dirPath}" -type f | head -100`
        : `ls -la "${dirPath}"`;
      const result = await podmanExec(cmd);
      return {
        success: result.success,
        files: result.stdout,
        error: result.stderr,
      };
    }
    
    case 'clone_repo': {
      const match = args.url.match(/github\.com\/([^\/]+)\/([^\/\s\.]+)/);
      if (!match) return { success: false, error: 'Invalid GitHub URL' };
      
      const [, , repo] = match;
      const projectName = args.name || repo.replace('.git', '');
      const projectPath = `${WORKSPACE_PATH}/${projectName}`;
      
      const result = await podmanExec(`git clone "${args.url}" "${projectPath}" 2>&1`);
      return {
        success: result.success,
        path: projectPath,
        output: result.stdout + result.stderr,
      };
    }
    
    case 'create_artifact': {
      // Artifacts are returned directly to be rendered in the UI
      return {
        success: true,
        artifact: {
          type: args.type,
          title: args.title,
          content: args.content,
          lang: args.lang || 'javascript',
        },
      };
    }
    
    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}

// ==================== Agentic Chat ====================

const SYSTEM_PROMPT = `You are Grok, an AI coding assistant with access to a Linux sandbox environment. You can execute commands, read/write files, clone repos, and create visual artifacts.

## Your Capabilities:
1. **execute_command** - Run any shell command (install packages, run code, git, etc.)
2. **read_file / write_file** - Read and write files in the sandbox
3. **list_files** - Explore the filesystem
4. **clone_repo** - Clone GitHub repositories
5. **create_artifact** - Create visual React components, diagrams, or formatted content

## Guidelines:
- Be proactive: if the user wants something built, just build it
- Use tools to verify your work (e.g., run tests, check file contents)
- Create artifacts for visual output (React components, charts, diagrams)
- Keep responses concise but informative
- Show your work: include relevant command outputs
- If something fails, debug it and try again

## Artifact Types:
- **react**: Interactive React components with Tailwind CSS
- **html**: Static HTML with Tailwind
- **mermaid**: Diagrams and flowcharts
- **markdown**: Formatted documentation
- **svg**: Vector graphics
- **code**: Syntax-highlighted code blocks

When creating React artifacts, export a function called \`App\`.

## Example Artifact:
\`\`\`
create_artifact({
  type: "react",
  title: "Counter",
  content: "function App() { const [count, setCount] = React.useState(0); return <button onClick={() => setCount(c => c+1)} className='px-4 py-2 bg-purple-600 text-white rounded'>{count}</button>; }"
})
\`\`\`

The workspace is at /workspace. Be helpful, creative, and get things done!`;

async function callLLM(messages, tools = null) {
  const apiKey = process.env.XAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('No API key configured');

  const isXai = apiKey.startsWith('xai-');
  const endpoint = isXai
    ? 'https://api.x.ai/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';

  const body = {
    model: isXai ? 'grok-3-mini-fast-beta' : 'anthropic/claude-sonnet-4-20250514',
    messages,
    temperature: 0.7,
    max_tokens: 4096,
  };

  if (tools) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(isXai ? {} : { 'HTTP-Referer': 'http://localhost', 'X-Title': 'spawn-sandbox' }),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${err}`);
  }

  return response.json();
}

// Agentic chat endpoint with tool calling loop
app.post('/api/chat', async (req, res) => {
  const { message, history = [], model } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }

  try {
    // Build messages array
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    const artifacts = [];
    const toolResults = [];
    let iterations = 0;
    const maxIterations = 10;

    // Tool calling loop
    while (iterations < maxIterations) {
      iterations++;
      
      const response = await callLLM(messages, TOOLS);
      const choice = response.choices[0];
      const assistantMessage = choice.message;

      // Add assistant message to history
      messages.push(assistantMessage);

      // Check for tool calls
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs;
          
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            toolArgs = {};
          }

          // Execute the tool
          const result = await executeTool(toolName, toolArgs);
          
          // Collect artifacts
          if (result.artifact) {
            artifacts.push(result.artifact);
          }

          toolResults.push({
            tool: toolName,
            args: toolArgs,
            result,
          });

          // Add tool result to messages
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      } else {
        // No more tool calls, we're done
        return res.json({
          response: assistantMessage.content || '',
          artifacts,
          toolResults,
          model: response.model,
          iterations,
        });
      }
    }

    // Max iterations reached
    const lastMessage = messages[messages.length - 1];
    return res.json({
      response: lastMessage.content || 'Max iterations reached',
      artifacts,
      toolResults,
      model: 'unknown',
      iterations,
    });

  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Streaming chat endpoint (SSE)
app.post('/api/chat/stream', async (req, res) => {
  const { message, history = [] } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      iterations++;
      send({ type: 'thinking', iteration: iterations });

      const response = await callLLM(messages, TOOLS);
      const choice = response.choices[0];
      const assistantMessage = choice.message;

      messages.push(assistantMessage);

      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs;
          
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            toolArgs = {};
          }

          send({ type: 'tool_start', tool: toolName, args: toolArgs });

          const result = await executeTool(toolName, toolArgs);

          send({ type: 'tool_result', tool: toolName, result });

          if (result.artifact) {
            send({ type: 'artifact', artifact: result.artifact });
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      } else {
        send({ type: 'response', content: assistantMessage.content || '' });
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

// ==================== Health & Status ====================

app.get('/health', async (_req, res) => {
  const running = await isContainerRunning();
  res.json({
    status: running ? 'healthy' : 'unhealthy',
    container: CONTAINER_NAME,
    running,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/status', async (_req, res) => {
  try {
    if (!(await isContainerRunning())) {
      return res.json({ status: 'stopped', container: CONTAINER_NAME });
    }
    const { stdout } = await execAsync(`podman inspect ${CONTAINER_NAME} --format '{{json .}}'`);
    const info = JSON.parse(stdout);
    res.json({
      status: 'running',
      container: CONTAINER_NAME,
      created: info.Created,
      state: info.State,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== GitHub Clone ====================

app.post('/api/github/clone', async (req, res) => {
  const { url, name } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  const match = url.match(/github\.com\/([^\/]+)\/([^\/\s\.]+)/);
  if (!match) return res.status(400).json({ error: 'Invalid GitHub URL' });

  const [, owner, repo] = match;
  const projectName = name || repo.replace('.git', '');
  const projectPath = `${WORKSPACE_PATH}/${projectName}`;

  const { stdout: exists } = await podmanExec(`test -d ${projectPath} && echo "exists" || echo ""`);
  if (exists.trim() === 'exists') {
    return res.json({ success: true, message: 'Project already exists', projectPath, projectName });
  }

  const result = await podmanExec(`git clone ${url} ${projectPath} 2>&1`);
  if (!result.success) {
    return res.status(500).json({ error: 'Clone failed', details: result.stderr });
  }

  res.json({ success: true, projectPath, projectName, owner, repo });
});

// ==================== Workspaces ====================

app.get('/api/workspaces', async (_req, res) => {
  const result = await podmanExec(`ls -1 ${WORKSPACE_PATH} 2>/dev/null || echo ""`);
  const names = result.stdout.split('\n').filter((n) => n && !n.startsWith('.'));
  res.json({ projects: names.map((n) => ({ name: n, path: `${WORKSPACE_PATH}/${n}` })) });
});

// ==================== Sandbox Exec ====================

app.post('/api/sandbox/exec', async (req, res) => {
  const { command, cwd } = req.body;
  if (!command) return res.status(400).json({ error: 'Command required' });
  const result = await podmanExec(command, cwd || WORKSPACE_PATH);
  res.json({ command, ...result });
});

app.post('/api/sandbox/exec/stream', async (req, res) => {
  const { command, cwd } = req.body;
  if (!command) return res.status(400).json({ error: 'Command required' });
  await ensureContainerRunning();
  podmanExecStream(command, cwd || WORKSPACE_PATH, res, req);
});

// ==================== File Operations ====================

app.get('/api/sandbox/files/*', async (req, res) => {
  const filePath = req.params[0];
  const full = filePath.startsWith('/') ? filePath : `${WORKSPACE_PATH}/${filePath}`;
  const result = await podmanExec(`cat "${full}"`);
  if (!result.success) {
    return res.status(404).json({ error: 'File not found', details: result.stderr });
  }
  res.json({ path: filePath, content: result.stdout });
});

app.post('/api/sandbox/files/*', async (req, res) => {
  const filePath = req.params[0];
  const { content } = req.body;
  const full = filePath.startsWith('/') ? filePath : `${WORKSPACE_PATH}/${filePath}`;
  const dir = path.dirname(full);
  
  await podmanExec(`mkdir -p "${dir}"`);
  const b64 = Buffer.from(content).toString('base64');
  const result = await podmanExec(`echo "${b64}" | base64 -d > "${full}"`);
  
  res.json({ path: filePath, success: result.success });
});

// ==================== Start Server ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🐧 Spawn Sandbox Server (with Grok Tools)               ║
║                                                           ║
║   Local:    http://localhost:${PORT}                       ║
║   Network:  http://0.0.0.0:${PORT}                         ║
║                                                           ║
║   Container: ${CONTAINER_NAME.padEnd(40)}║
║   Workspace: ${WORKSPACE_PATH.padEnd(40)}║
║                                                           ║
║   Tools: execute_command, read_file, write_file,          ║
║          list_files, clone_repo, create_artifact          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

  isContainerRunning().then((r) => {
    if (r) {
      console.log(`✅ Container "${CONTAINER_NAME}" is running`);
    } else {
      console.log(`⚠️  Container not running. Create with:`);
      console.log(`   podman run -d --name ${CONTAINER_NAME} -v spawn-workspace:/workspace ubuntu:22.04 sleep infinity`);
    }
  });
});
