// Project Analyzer - Generates CLAUDE.md and .claude/ config
// This is the "Claude-ify" magic ✨

import type { Repository } from '../components/GitHubPanel'

interface ProjectAnalysis {
  type: 'frontend' | 'backend' | 'fullstack' | 'library' | 'cli' | 'unknown'
  framework: string | null
  language: string
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'cargo' | 'pip' | null
  hasTests: boolean
  hasDocker: boolean
  hasCICD: boolean
  dependencies: string[]
  devDependencies: string[]
  scripts: Record<string, string>
  entryPoint: string | null
  structure: string[]
}

// Analyze project structure
export function analyzeProject(files: string[], packageJson?: any, _cargoToml?: string): ProjectAnalysis {
  const analysis: ProjectAnalysis = {
    type: 'unknown',
    framework: null,
    language: 'unknown',
    packageManager: null,
    hasTests: false,
    hasDocker: false,
    hasCICD: false,
    dependencies: [],
    devDependencies: [],
    scripts: {},
    entryPoint: null,
    structure: files.slice(0, 20), // First 20 files for overview
  }

  // Detect language
  if (files.some(f => f.endsWith('.rs') || f === 'Cargo.toml')) {
    analysis.language = 'Rust'
    analysis.packageManager = 'cargo'
  } else if (files.some(f => f.endsWith('.ts') || f.endsWith('.tsx'))) {
    analysis.language = 'TypeScript'
  } else if (files.some(f => f.endsWith('.js') || f.endsWith('.jsx'))) {
    analysis.language = 'JavaScript'
  } else if (files.some(f => f.endsWith('.py'))) {
    analysis.language = 'Python'
    analysis.packageManager = 'pip'
  } else if (files.some(f => f.endsWith('.go'))) {
    analysis.language = 'Go'
  }

  // Detect package manager (JS)
  if (files.includes('pnpm-lock.yaml')) analysis.packageManager = 'pnpm'
  else if (files.includes('yarn.lock')) analysis.packageManager = 'yarn'
  else if (files.includes('bun.lockb')) analysis.packageManager = 'bun'
  else if (files.includes('package-lock.json')) analysis.packageManager = 'npm'

  // Detect framework
  if (packageJson?.dependencies) {
    const deps = packageJson.dependencies
    if (deps.next) analysis.framework = 'Next.js'
    else if (deps.nuxt) analysis.framework = 'Nuxt'
    else if (deps.svelte || deps['@sveltejs/kit']) analysis.framework = 'SvelteKit'
    else if (deps.react) analysis.framework = 'React'
    else if (deps.vue) analysis.framework = 'Vue'
    else if (deps.express) analysis.framework = 'Express'
    else if (deps.fastify) analysis.framework = 'Fastify'
    else if (deps.hono) analysis.framework = 'Hono'
    
    analysis.dependencies = Object.keys(deps)
    analysis.devDependencies = Object.keys(packageJson.devDependencies || {})
    analysis.scripts = packageJson.scripts || {}
  }

  // Detect project type
  if (analysis.framework?.match(/Next|Nuxt|SvelteKit/)) {
    analysis.type = 'fullstack'
  } else if (analysis.framework?.match(/React|Vue|Svelte/) || files.some(f => f.includes('src/App'))) {
    analysis.type = 'frontend'
  } else if (analysis.framework?.match(/Express|Fastify|Hono/) || files.includes('server.ts')) {
    analysis.type = 'backend'
  } else if (files.includes('src/lib.rs') || files.includes('src/index.ts')) {
    analysis.type = 'library'
  } else if (files.includes('src/main.rs') || files.includes('src/cli.ts')) {
    analysis.type = 'cli'
  }

  // Detect testing
  analysis.hasTests = files.some(f => 
    f.includes('.test.') || 
    f.includes('.spec.') || 
    f.includes('__tests__') ||
    f.includes('tests/')
  )

  // Detect Docker
  analysis.hasDocker = files.some(f => f.toLowerCase().includes('dockerfile') || f === 'docker-compose.yml')

  // Detect CI/CD
  analysis.hasCICD = files.some(f => 
    f.includes('.github/workflows') || 
    f.includes('.gitlab-ci') ||
    f.includes('Jenkinsfile')
  )

  // Detect entry point
  if (analysis.scripts.dev) analysis.entryPoint = 'dev'
  else if (analysis.scripts.start) analysis.entryPoint = 'start'
  else if (files.includes('src/main.rs')) analysis.entryPoint = 'src/main.rs'
  else if (files.includes('src/index.ts')) analysis.entryPoint = 'src/index.ts'

  return analysis
}

// Generate CLAUDE.md content
export function generateClaudeMd(repo: Repository, analysis: ProjectAnalysis): string {
  const pm = analysis.packageManager || 'npm'
  const installCmd = {
    npm: 'npm install',
    pnpm: 'pnpm install',
    yarn: 'yarn',
    bun: 'bun install',
    cargo: 'cargo build',
    pip: 'pip install -r requirements.txt',
  }[pm]

  const devCmd = analysis.scripts.dev 
    ? `${pm} run dev` 
    : analysis.language === 'Rust' 
      ? 'cargo run' 
      : null

  return `# ${repo.name}

${repo.description || 'No description provided.'}

## Project Overview

| Property | Value |
|----------|-------|
| **Type** | ${analysis.type} |
| **Language** | ${analysis.language} |
| **Framework** | ${analysis.framework || 'None'} |
| **Package Manager** | ${pm} |

## Quick Start

\`\`\`bash
# Clone the repository
git clone ${repo.clone_url}
cd ${repo.name}

# Install dependencies
${installCmd}
${devCmd ? `\n# Start development server\n${devCmd}` : ''}
\`\`\`

## Project Structure

\`\`\`
${analysis.structure.map(f => f.startsWith('/') ? f.slice(1) : f).join('\n')}
\`\`\`

## Available Scripts

${Object.entries(analysis.scripts).length > 0 
  ? Object.entries(analysis.scripts).map(([name, cmd]) => `- \`${pm} run ${name}\` - ${cmd}`).join('\n')
  : 'No scripts defined in package.json'}

## Key Dependencies

${analysis.dependencies.slice(0, 10).map(dep => `- \`${dep}\``).join('\n') || 'None'}

## Development Guidelines

### Code Style
- Follow existing patterns in the codebase
- Use ${analysis.language} best practices
${analysis.framework ? `- Follow ${analysis.framework} conventions` : ''}

### Testing
${analysis.hasTests 
  ? `Tests are available. Run with \`${pm} test\` or equivalent.`
  : 'No tests detected. Consider adding tests for critical functionality.'}

### Git Workflow
- Create feature branches from \`${repo.default_branch}\`
- Use conventional commits (feat:, fix:, docs:, etc.)
- Keep PRs focused and reviewable

## AI Assistant Notes

When helping with this project:
1. **Understand first** - Read relevant files before making changes
2. **Small changes** - Make incremental, testable modifications  
3. **Explain reasoning** - Share your thought process
4. **Verify** - Run tests/linting after changes
5. **Ask questions** - Clarify requirements when ambiguous

## Links

- Repository: ${repo.html_url}
- Issues: ${repo.html_url}/issues
- Pull Requests: ${repo.html_url}/pulls
`
}

// Generate .claude/settings.json
export function generateClaudeSettings(repo: Repository, analysis: ProjectAnalysis): object {
  return {
    version: 1,
    project: {
      name: repo.name,
      type: analysis.type,
      language: analysis.language,
      framework: analysis.framework,
    },
    agent: {
      defaultModel: 'claude-sonnet-4-20250514',
      maxTokens: 8192,
      temperature: 0.7,
    },
    permissions: {
      allowFileCreation: true,
      allowFileModification: true,
      allowFileDeletion: false,
      allowShellCommands: true,
      allowedCommands: [
        `${analysis.packageManager} install`,
        `${analysis.packageManager} run *`,
        'git status',
        'git diff',
        'git add',
        'git commit',
        analysis.language === 'Rust' ? 'cargo *' : null,
        analysis.language === 'Python' ? 'python *' : null,
      ].filter(Boolean),
      deniedPaths: [
        '.env',
        '.env.*',
        '*.pem',
        '*.key',
        'secrets/*',
      ],
    },
    context: {
      alwaysInclude: [
        'CLAUDE.md',
        'README.md',
        'package.json',
        analysis.language === 'Rust' ? 'Cargo.toml' : null,
      ].filter(Boolean),
      ignorePatterns: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '.git/**',
        '*.lock',
        '*.log',
      ],
    },
    tools: {
      terminal: {
        enabled: true,
        shell: '/bin/bash',
        workingDirectory: '.',
      },
      browser: {
        enabled: true,
        allowedDomains: ['localhost', '127.0.0.1'],
      },
      fileSystem: {
        enabled: true,
        watchPatterns: ['src/**', 'lib/**', 'app/**'],
      },
    },
  }
}

// Setup commands for different project types
export function getSetupCommands(analysis: ProjectAnalysis): string[] {
  const commands: string[] = []
  const pm = analysis.packageManager || 'npm'

  // Install dependencies
  if (pm === 'cargo') {
    commands.push('cargo build')
  } else if (pm === 'pip') {
    commands.push('python -m venv .venv')
    commands.push('source .venv/bin/activate')
    commands.push('pip install -r requirements.txt')
  } else {
    commands.push(`${pm} install`)
  }

  // Start dev server if available
  if (analysis.scripts.dev) {
    commands.push(`${pm} run dev`)
  } else if (analysis.scripts.start) {
    commands.push(`${pm} run start`)
  } else if (analysis.language === 'Rust' && analysis.type !== 'library') {
    commands.push('cargo run')
  }

  return commands
}

// Full Claude-ify flow
export async function claudifyProject(
  repo: Repository,
  files: string[],
  packageJson?: any
): Promise<{
  claudeMd: string
  settings: object
  commands: string[]
}> {
  const analysis = analyzeProject(files, packageJson)
  
  return {
    claudeMd: generateClaudeMd(repo, analysis),
    settings: generateClaudeSettings(repo, analysis),
    commands: getSetupCommands(analysis),
  }
}
