-- ═══════════════════════════════════════════════════════════════════════════════
-- SPAWN LOGGING & KNOWLEDGE DATABASE
-- PostgreSQL with pgvector for semantic search
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: LOGS TABLE
-- Stores all agent activity logs with timestamps and categories
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    level VARCHAR(10) NOT NULL,  -- DEBUG, INFO, WARN, ERROR
    category VARCHAR(50) NOT NULL,  -- REQUEST, TOOL, LLM, ARTIFACT, EMBED, VECTOR
    message TEXT NOT NULL,
    data JSONB,
    session_id VARCHAR(100),
    request_id VARCHAR(100)
);

CREATE INDEX idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_category ON logs(category);
CREATE INDEX idx_logs_session ON logs(session_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: SCOPES TABLE
-- Defines operational scopes the agent can reference
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scopes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    tools TEXT[] NOT NULL,  -- Array of tool names
    workflow TEXT NOT NULL,  -- Step-by-step workflow
    quality_gates TEXT[],  -- Array of quality requirements
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    embedding vector(896)  -- Ollama qwen3-embedding dimension
);

CREATE INDEX idx_scopes_name ON scopes(name);
CREATE INDEX idx_scopes_embedding ON scopes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: EXAMPLES TABLE
-- Stores code examples, workflows, and patterns for agent reference
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS examples (
    id SERIAL PRIMARY KEY,
    scope_id INTEGER REFERENCES scopes(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    code TEXT NOT NULL,
    language VARCHAR(50),  -- python, javascript, typescript, etc.
    tags TEXT[],
    user_request TEXT,  -- Original user request that led to this example
    success BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    embedding vector(896)
);

CREATE INDEX idx_examples_scope ON examples(scope_id);
CREATE INDEX idx_examples_language ON examples(language);
CREATE INDEX idx_examples_tags ON examples USING gin(tags);
CREATE INDEX idx_examples_embedding ON examples USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 4: KNOWLEDGE TABLE
-- General knowledge store with vector embeddings for semantic search
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS knowledge (
    id SERIAL PRIMARY KEY,
    collection VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    embedding vector(896)
);

CREATE INDEX idx_knowledge_collection ON knowledge(collection);
CREATE INDEX idx_knowledge_embedding ON knowledge USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 5: ARTIFACTS TABLE
-- Tracks all artifacts created by the agent
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS artifacts (
    id SERIAL PRIMARY KEY,
    artifact_id VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,  -- code, react, html, mermaid, etc.
    title VARCHAR(200),
    description TEXT,
    files JSONB,  -- Array of file objects
    execution JSONB,
    render JSONB,
    version JSONB,
    session_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_artifacts_type ON artifacts(type);
CREATE INDEX idx_artifacts_session ON artifacts(session_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 6: SESSIONS TABLE
-- Tracks user sessions and conversations
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(100) PRIMARY KEY,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    message_count INTEGER DEFAULT 0,
    tool_calls INTEGER DEFAULT 0,
    artifacts_created INTEGER DEFAULT 0,
    metadata JSONB
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 7: SEED DATA - OPERATIONAL SCOPES
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO scopes (name, description, tools, workflow, quality_gates) VALUES
(
    'FILE_OPERATIONS',
    'Read, write, and explore filesystem. Use for file manipulation, code editing, and directory navigation.',
    ARRAY['read_file', 'write_file', 'list_files'],
    '1. DISCOVER: list_files({ path: ".", recursive: true })
2. READ: read_file({ path: "target.py" })
3. UNDERSTAND: Parse structure, identify patterns
4. MODIFY: write_file({ path: "target.py", content: updated })
5. VERIFY: read_file to confirm changes',
    ARRAY['ALWAYS read before modifying', 'NEVER overwrite without understanding content', 'Prefer single-file solutions', 'Use correct file extensions']
),
(
    'CODE_EXECUTION',
    'Run commands, manage processes, test code. Use for running scripts, installing dependencies, and testing.',
    ARRAY['execute_command', 'terminal_create', 'terminal_exec', 'terminal_buffer', 'terminal_list'],
    '1. SETUP: Create venv or install deps
2. EXECUTE: Run the code
3. CAPTURE: Get output/errors
4. ITERATE: Fix issues, re-run',
    ARRAY['Python: ALWAYS use .venv/bin/python or source .venv/bin/activate', 'Node: Install deps before running', 'Test after changes', 'Check exit codes']
),
(
    'GIT_REPO_ANALYSIS',
    'Clone repos, analyze codebases, search patterns. Use for understanding external code and reviewing repositories.',
    ARRAY['git_clone', 'analyze_repo', 'search_code'],
    '1. CLONE: git_clone({ repo: "owner/repo", depth: 1 })
2. ANALYZE: analyze_repo({ path: "repo" })
3. SEARCH: search_code({ pattern: "function.*auth", path: "repo" })
4. READ: read_file key files identified
5. SYNTHESIZE: Create understanding artifact',
    ARRAY['Use shallow clones (depth: 1) for speed', 'Analyze structure before diving into code', 'Use ripgrep patterns efficiently', 'Document findings in artifacts']
),
(
    'ARTIFACTS_VISUALIZATION',
    'Create visual outputs, previews, documentation. Use for displaying code, diagrams, charts, and live previews.',
    ARRAY['create_artifact'],
    '1. GENERATE: Create content (code, diagram, chart)
2. VALIDATE: Check against schema
3. RENDER: Use create_artifact with correct type
4. ITERATE: Update based on feedback',
    ARRAY['ALWAYS show code after writing files', 'Use correct lang for syntax highlighting', 'Include render hints', 'Validate artifact schema before sending']
),
(
    'KNOWLEDGE_MANAGEMENT',
    'Store, retrieve, and search information semantically. Use for building persistent memory across sessions.',
    ARRAY['store_knowledge', 'semantic_search', 'list_knowledge_collections'],
    '1. STORE: Save important information with metadata
2. ORGANIZE: Use collections to group related content
3. SEARCH: Query using natural language
4. RECALL: Use retrieved context to inform responses',
    ARRAY['Use descriptive collection names', 'Include metadata (title, source, tags)', 'Set appropriate similarity thresholds', 'Review results before using']
),
(
    'EXTERNAL_INTEGRATION',
    'Orchestrate missions, manage state, coordinate with backend services.',
    ARRAY['create_mission', 'list_missions', 'get_architect_status'],
    '1. STATUS: get_architect_status() to verify connectivity
2. PLAN: Break complex tasks into mission steps
3. CREATE: create_mission({ goal: "...", context: {...} })
4. TRACK: list_missions() to monitor progress
5. REPORT: Summarize mission outcomes',
    ARRAY['Verify services are up before starting', 'Break complex tasks into steps', 'Track progress systematically', 'Report outcomes clearly']
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 8: SEED DATA - EXAMPLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- File Operations Examples
INSERT INTO examples (scope_id, title, description, code, language, tags, user_request) VALUES
(1, 'Bug Fix Workflow', 'Fixing a bug in an existing file by reading, understanding, and modifying',
'// User: "Fix the authentication bug in auth.py"
list_files({ path: "." })                    // Find auth files
read_file({ path: "src/auth.py" })           // Understand current code
write_file({ path: "src/auth.py", content: fixedCode })
execute_command({ command: "python -m pytest tests/test_auth.py" })',
'javascript', ARRAY['bug-fix', 'file-edit', 'testing'], 'Fix the authentication bug in auth.py'),

(1, 'Create New Module', 'Creating a new Python module with proper structure',
'// User: "Create a utils module for string helpers"
const moduleCode = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""String utility functions."""

def capitalize_words(text: str) -> str:
    """Capitalize first letter of each word."""
    return " ".join(word.capitalize() for word in text.split())

def truncate(text: str, length: int = 100) -> str:
    """Truncate text to specified length with ellipsis."""
    return text[:length] + "..." if len(text) > length else text
`;

write_file({ path: "src/utils/strings.py", content: moduleCode });
create_artifact({
  type: "code",
  title: "strings.py",
  files: [{ path: "strings.py", language: "python", content: moduleCode }]
});',
'javascript', ARRAY['new-file', 'module', 'python'], 'Create a utils module for string helpers');

-- Code Execution Examples
INSERT INTO examples (scope_id, title, description, code, language, tags, user_request) VALUES
(2, 'Python Game Development', 'Creating and running a pygame application',
'// User: "Make a snake game"
const gameCode = `...full pygame code...`;
write_file({ path: "snake.py", content: gameCode });
execute_command({ command: "source .venv/bin/activate && pip install pygame" });
execute_command({ command: "source .venv/bin/activate && python snake.py" });
create_artifact({ type: "code", title: "snake.py", files: [...] });',
'javascript', ARRAY['game', 'pygame', 'python'], 'Make a snake game'),

(2, 'Node.js Dev Server', 'Setting up and running a development server',
'// User: "Start the dev server"
terminal_create({ name: "dev" });
terminal_exec({ name: "dev", command: "npm run dev" });
// ... user makes changes ...
terminal_buffer({ name: "dev", lines: 50 });  // Check for errors',
'javascript', ARRAY['node', 'dev-server', 'terminal'], 'Start the dev server');

-- Artifacts Examples
INSERT INTO examples (scope_id, title, description, code, language, tags, user_request) VALUES
(4, 'Architecture Diagram', 'Creating a Mermaid diagram for system architecture',
'create_artifact({
  type: "mermaid",
  title: "System Architecture",
  files: [{
    path: "architecture.mmd",
    language: "mermaid",
    content: `graph TD
      A[Client] --> B[API Gateway]
      B --> C[Auth Service]
      B --> D[Data Service]
      C --> E[(User DB)]
      D --> F[(Main DB)]`
  }]
});',
'javascript', ARRAY['diagram', 'mermaid', 'architecture'], 'Show me the system architecture'),

(4, 'React Component Preview', 'Creating a live React component preview',
'create_artifact({
  type: "react",
  title: "Button Component",
  files: [{
    path: "Button.tsx",
    language: "tsx",
    content: `export default function Button({ label }) {
      return <button className="px-4 py-2 bg-blue-500 text-white rounded">{label}</button>
    }`,
    entrypoint: true
  }],
  execution: { runtime: "browser" }
});',
'javascript', ARRAY['react', 'component', 'preview'], 'Create a button component');

-- Git/Repo Analysis Examples
INSERT INTO examples (scope_id, title, description, code, language, tags, user_request) VALUES
(3, 'Repository Analysis', 'Analyzing an external GitHub repository',
'// User: "Analyze facebook/react for me"
git_clone({ repo: "facebook/react", depth: 1 });
analyze_repo({ path: "react" });
search_code({ pattern: "useState", path: "react", file_type: "ts" });
read_file({ path: "react/packages/react/src/ReactHooks.js" });
create_artifact({ type: "mermaid", title: "React Architecture", content: diagram });',
'javascript', ARRAY['github', 'analysis', 'react'], 'Analyze facebook/react for me');

-- Knowledge Management Examples
INSERT INTO examples (scope_id, title, description, code, language, tags, user_request) VALUES
(5, 'Store Project Context', 'Storing project documentation for later retrieval',
'// Store project context
store_knowledge({
  content: "The Spawn project uses Grok AI via OpenRouter. It has a sandbox server...",
  collection: "project-docs",
  metadata: { title: "Project Overview", tags: ["architecture", "setup"] }
});

// Later, recall relevant info
semantic_search({
  query: "how does the AI integration work",
  collection: "project-docs",
  threshold: 0.6
});',
'javascript', ARRAY['knowledge', 'semantic-search', 'documentation'], 'Remember the project architecture');

-- Advanced Visualization Examples (D3.js, Three.js, WebGL)
INSERT INTO examples (scope_id, title, description, code, language, tags, user_request) VALUES
(4, 'D3.js Bar Chart', 'Creating an animated bar chart with D3.js',
'// User: "Create a bar chart showing sales data"
const data = [
  { month: "Jan", sales: 65 },
  { month: "Feb", sales: 59 },
  { month: "Mar", sales: 80 },
  { month: "Apr", sales: 81 },
  { month: "May", sales: 56 },
  { month: "Jun", sales: 95 }
];

const { svg, g, innerWidth, innerHeight } = createChart({ width: 700, height: 400 });

const x = d3.scaleBand()
  .domain(data.map(d => d.month))
  .range([0, innerWidth])
  .padding(0.2);

const y = d3.scaleLinear()
  .domain([0, d3.max(data, d => d.sales)])
  .nice()
  .range([innerHeight, 0]);

// Add grid
addGrid(g, x, y, innerWidth, innerHeight);

// Add axes
g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x));
g.append("g").attr("class", "axis").call(d3.axisLeft(y));

// Add bars with animation
g.selectAll(".bar")
  .data(data)
  .enter().append("rect")
  .attr("class", "bar")
  .attr("x", d => x(d.month))
  .attr("width", x.bandwidth())
  .attr("y", innerHeight)
  .attr("height", 0)
  .attr("fill", (d, i) => colors.categorical[i % 10])
  .on("mouseover", (event, d) => showTooltip(`${d.month}: $${d.sales}k`, event))
  .on("mouseout", hideTooltip)
  .transition()
  .duration(800)
  .delay((d, i) => i * 100)
  .attr("y", d => y(d.sales))
  .attr("height", d => innerHeight - y(d.sales));',
'javascript', ARRAY['d3', 'bar-chart', 'data-visualization', 'animation'], 'Create a bar chart showing sales data'),

(4, 'D3.js Force-Directed Graph', 'Creating an interactive network graph',
'// User: "Show a network diagram of connections"
const nodes = [
  { id: "A", group: 1 }, { id: "B", group: 1 }, { id: "C", group: 2 },
  { id: "D", group: 2 }, { id: "E", group: 3 }, { id: "F", group: 3 }
];
const links = [
  { source: "A", target: "B" }, { source: "A", target: "C" },
  { source: "B", target: "D" }, { source: "C", target: "E" },
  { source: "D", target: "E" }, { source: "E", target: "F" }
];

const width = 600, height = 400;
const svg = d3.select("#chart").append("svg")
  .attr("width", width).attr("height", height);

const color = d3.scaleOrdinal(d3.schemeCategory10);

const simulation = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(links).id(d => d.id).distance(100))
  .force("charge", d3.forceManyBody().strength(-200))
  .force("center", d3.forceCenter(width / 2, height / 2));

const link = svg.append("g").selectAll("line")
  .data(links).enter().append("line")
  .attr("stroke", "#666").attr("stroke-width", 2);

const node = svg.append("g").selectAll("circle")
  .data(nodes).enter().append("circle")
  .attr("r", 20).attr("fill", d => color(d.group))
  .call(d3.drag()
    .on("start", (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
    .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
    .on("end", (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

const labels = svg.append("g").selectAll("text")
  .data(nodes).enter().append("text")
  .text(d => d.id).attr("fill", "#fff").attr("text-anchor", "middle").attr("dy", 5);

simulation.on("tick", () => {
  link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
  node.attr("cx", d => d.x).attr("cy", d => d.y);
  labels.attr("x", d => d.x).attr("y", d => d.y);
});',
'javascript', ARRAY['d3', 'network', 'force-directed', 'interactive'], 'Show a network diagram of connections'),

(4, 'Three.js 3D Scene', 'Creating an interactive 3D scene with Three.js',
'// User: "Create a 3D rotating cube"
const { scene, camera, renderer, controls } = createScene();
addLighting(scene);

// Create a cube with gradient material
const geometry = new THREE.BoxGeometry(2, 2, 2);
const material = new THREE.MeshStandardMaterial({
  color: 0xa855f7,
  metalness: 0.3,
  roughness: 0.5
});
const cube = new THREE.Mesh(geometry, material);
cube.castShadow = true;
scene.add(cube);

// Add a floor
const floorGeometry = new THREE.PlaneGeometry(10, 10);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2;
floor.receiveShadow = true;
scene.add(floor);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  controls.update();
  updateStats();
  renderer.render(scene, camera);
}
animate();',
'javascript', ARRAY['threejs', '3d', 'cube', 'animation'], 'Create a 3D rotating cube'),

(4, 'Three.js Particle System', 'Creating a particle system with Three.js',
'// User: "Create a particle animation"
const { scene, camera, renderer, controls } = createScene({ background: 0x000000 });
camera.position.z = 50;

// Create particles
const particleCount = 5000;
const positions = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount * 3; i += 3) {
  positions[i] = (Math.random() - 0.5) * 100;
  positions[i + 1] = (Math.random() - 0.5) * 100;
  positions[i + 2] = (Math.random() - 0.5) * 100;

  colors[i] = Math.random();
  colors[i + 1] = Math.random() * 0.5 + 0.5;
  colors[i + 2] = 1.0;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
  size: 0.5,
  vertexColors: true,
  transparent: true,
  opacity: 0.8
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

function animate() {
  requestAnimationFrame(animate);
  particles.rotation.x += 0.001;
  particles.rotation.y += 0.002;
  controls.update();
  updateStats();
  renderer.render(scene, camera);
}
animate();',
'javascript', ARRAY['threejs', 'particles', '3d', 'animation'], 'Create a particle animation'),

(4, 'Diagram Flowchart', 'Creating a system architecture flowchart',
'// User: "Create a flowchart for user authentication"
addCluster("auth", "Authentication Flow");

addNode("start", "User Login");
addNode("validate", "Validate Credentials");
addNode("check", "Check 2FA");
addNode("success", "Grant Access");
addNode("fail", "Deny Access");
addNode("retry", "Retry?");

addToCluster("validate", "auth");
addToCluster("check", "auth");

addEdge("start", "validate", "submit");
addEdge("validate", "check", "valid");
addEdge("validate", "fail", "invalid");
addEdge("check", "success", "passed");
addEdge("check", "retry", "failed");
addEdge("retry", "start", "yes");
addEdge("retry", "fail", "no");',
'javascript', ARRAY['diagram', 'flowchart', 'authentication', 'architecture'], 'Create a flowchart for user authentication'),

(4, 'Professional Word Document', 'Creating a corporate-style Word document from rough text',
'// User: "Format this into a professional report"
// Agent formats content using markdown with YAML front matter

create_artifact({
  type: "docx",
  title: "Quarterly Business Report",
  files: [{
    path: "report.md",
    language: "markdown",
    content: `---
title: Q4 2024 Business Performance Report
subtitle: Strategic Analysis and Recommendations
author: Strategy Team
date: December 2024
version: 1.0
department: Business Intelligence
classification: Internal
---

# Executive Summary

This report provides a comprehensive analysis of Q4 2024 performance across all business units. **Key findings indicate a 23% revenue increase** compared to Q3, with significant growth in the enterprise segment.

> [NOTE] This document contains confidential business information.

## Key Metrics

| Metric | Q3 2024 | Q4 2024 | Change |
|--------|---------|---------|--------|
| Revenue | $12.4M | $15.2M | +23% |
| New Customers | 145 | 198 | +37% |
| Retention Rate | 92% | 94% | +2% |
| NPS Score | 67 | 72 | +5 |

## Strategic Initiatives

### 1. Product Development

The engineering team successfully delivered:
- New API gateway with 99.9% uptime
- Mobile app v2.0 with redesigned UX
- AI-powered recommendation engine

### 2. Market Expansion

Our expansion into APAC markets has shown promising results:

1. Partnership with 3 regional distributors
2. Localized product offerings for Japan and Singapore
3. Established local support teams

===

# Recommendations

Based on our analysis, we recommend the following actions for Q1 2025:

* **Increase investment** in the enterprise sales team
* Expand cloud infrastructure capacity by 40%
* Launch customer success program for mid-market segment

> [SUCCESS] All Q4 targets were met or exceeded.

## Next Steps

The leadership team should review these recommendations at the January planning session.`
  }]
});',
'javascript', ARRAY['docx', 'word', 'document', 'report', 'corporate'], 'Format this rough report into a professional document');

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 9: HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Function to search similar scopes
CREATE OR REPLACE FUNCTION search_similar_scopes(query_embedding vector(896), match_count int DEFAULT 3)
RETURNS TABLE(id int, name varchar, description text, similarity float) AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.name, s.description,
           1 - (s.embedding <=> query_embedding) as similarity
    FROM scopes s
    WHERE s.embedding IS NOT NULL
    ORDER BY s.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function to search similar examples
CREATE OR REPLACE FUNCTION search_similar_examples(query_embedding vector(896), scope_filter varchar DEFAULT NULL, match_count int DEFAULT 5)
RETURNS TABLE(id int, title varchar, description text, code text, language varchar, similarity float) AS $$
BEGIN
    RETURN QUERY
    SELECT e.id, e.title, e.description, e.code, e.language,
           1 - (e.embedding <=> query_embedding) as similarity
    FROM examples e
    LEFT JOIN scopes s ON e.scope_id = s.id
    WHERE e.embedding IS NOT NULL
      AND (scope_filter IS NULL OR s.name = scope_filter)
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function to log with auto-cleanup (keep last 10000 entries)
CREATE OR REPLACE FUNCTION insert_log(
    p_level varchar,
    p_category varchar,
    p_message text,
    p_data jsonb DEFAULT NULL,
    p_session_id varchar DEFAULT NULL,
    p_request_id varchar DEFAULT NULL
) RETURNS int AS $$
DECLARE
    new_id int;
    log_count int;
BEGIN
    INSERT INTO logs (level, category, message, data, session_id, request_id)
    VALUES (p_level, p_category, p_message, p_data, p_session_id, p_request_id)
    RETURNING id INTO new_id;

    -- Cleanup old logs if over 10000
    SELECT COUNT(*) INTO log_count FROM logs;
    IF log_count > 10000 THEN
        DELETE FROM logs WHERE id IN (
            SELECT id FROM logs ORDER BY timestamp ASC LIMIT (log_count - 10000)
        );
    END IF;

    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO spawn;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO spawn;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO spawn;

SELECT 'Database initialized successfully with pgvector!' as status;
