// ═══════════════════════════════════════════════════════════════════════════════
// CODE QUALITY & CANVAS OUTPUT GUIDELINES
// Injected into ARCHITECT's system prompt for professional code generation
// ═══════════════════════════════════════════════════════════════════════════════

export const CODE_QUALITY_PROMPT = `
## PROFESSIONAL CODE OUTPUT REQUIREMENTS

### MANDATORY: CANVAS/ARTIFACT OUTPUT
**EVERY code file you create MUST be displayed as an artifact on the canvas.**

**Workflow for ALL code generation:**
\`\`\`
1. write_file → Save to sandbox filesystem
2. create_artifact → Display on canvas with syntax highlighting
3. execute_command → Run/test the code
4. Update artifact if changes needed
\`\`\`

**NEVER just write a file without showing it on the canvas.**

### CODE STRUCTURE REQUIREMENTS

#### Python Files
\`\`\`python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════
MODULE: [module_name]
PURPOSE: [Brief one-line description]
═══════════════════════════════════════════════════════════════════════════════

DESCRIPTION:
    [Detailed description of functionality]

AUTHOR: ARCHITECT
CREATED: [YYYY-MM-DD]
VERSION: 1.0.0

ARCHITECTURE:
    ┌─────────────────────────────────────────────────────────────────┐
    │  1. IMPORTS & DEPENDENCIES                                      │
    │  2. CONSTANTS & CONFIGURATION                                   │
    │  3. TYPE DEFINITIONS                                            │
    │  4. UTILITY FUNCTIONS                                           │
    │  5. CORE CLASSES                                                │
    │  6. MAIN LOGIC                                                  │
    └─────────────────────────────────────────────────────────────────┘
═══════════════════════════════════════════════════════════════════════════════
"""

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: IMPORTS
# ═══════════════════════════════════════════════════════════════════════════════

from __future__ import annotations
import ... # Standard library first
import ... # Third party second
from ... import ... # Local imports last

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: CONSTANTS & CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

CONFIG = {
    "setting_name": "value",
}

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: TYPE DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════════════

from dataclasses import dataclass
from typing import List, Dict, Optional

@dataclass
class MyDataClass:
    """Description of data class."""
    field: str
    value: int = 0

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def helper_function(param: str) -> str:
    """Brief description.

    Args:
        param: Description of parameter

    Returns:
        Description of return value
    """
    return param.upper()

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: CORE CLASSES
# ═══════════════════════════════════════════════════════════════════════════════

class MainClass:
    """Main class description.

    Attributes:
        attr_name: Description of attribute
    """

    def __init__(self, config: Dict = None):
        self.config = config or CONFIG

    def process(self, data: Any) -> Any:
        """Process data and return result."""
        return data

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6: MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    """Main entry point."""
    obj = MainClass()
    result = obj.process("test")
    print(f"Result: {result}")

if __name__ == "__main__":
    main()
\`\`\`

#### JavaScript/TypeScript Files
\`\`\`typescript
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MODULE: [module_name]
 * PURPOSE: [Brief one-line description]
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIPTION:
 *   [Detailed description of functionality]
 *
 * AUTHOR: ARCHITECT
 * CREATED: [YYYY-MM-DD]
 * VERSION: 1.0.0
 *
 * ARCHITECTURE:
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  1. IMPORTS & DEPENDENCIES                                      │
 *   │  2. TYPES & INTERFACES                                          │
 *   │  3. CONSTANTS & CONFIGURATION                                   │
 *   │  4. UTILITY FUNCTIONS                                           │
 *   │  5. CORE CLASSES/COMPONENTS                                     │
 *   │  6. EXPORTS                                                     │
 *   └─────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: IMPORTS
// ═══════════════════════════════════════════════════════════════════════════════

import { ... } from 'library';

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface Config {
  settingName: string;
  enabled: boolean;
}

type Result<T> = { success: true; data: T } | { success: false; error: string };

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: Config = {
  settingName: 'value',
  enabled: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Brief description of function
 * @param param - Description of parameter
 * @returns Description of return value
 */
function helperFunction(param: string): string {
  return param.toUpperCase();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: CORE CLASSES/COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main class description
 */
class MainClass {
  private config: Config;

  constructor(config: Partial<Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process data and return result
   */
  process(data: unknown): Result<unknown> {
    return { success: true, data };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export { MainClass, helperFunction };
export type { Config, Result };
export default MainClass;
\`\`\`

### CANVAS ARTIFACT FORMAT

**For code files, ALWAYS use this artifact structure:**

\`\`\`javascript
create_artifact({
  type: "code",
  title: "filename.py",
  description: "Brief description of what this file does",
  tags: ["python", "game", "pygame"],  // Searchable tags
  files: [{
    path: "filename.py",
    language: "python",  // CRITICAL: Set correct language!
    content: fullCodeString,
    role: "source",
    entrypoint: true  // Set true for main file
  }],
  execution: {
    runtime: "python",
    command: "python filename.py"
  },
  render: {
    display: "block",
    theme: "dark",
    show_code: true,
    allow_edit: true,   // IMPORTANT: Allow editing!
    allow_download: true
  }
})
\`\`\`

### EDITING EXISTING FILES

When editing files, follow this process:

\`\`\`javascript
// 1. Read the current file
const current = await read_file({ path: "myfile.py" });

// 2. Make edits to the content
const updated = current.replace("old_code", "new_code");

// 3. Write the updated file
await write_file({ path: "myfile.py", content: updated });

// 4. Update the canvas artifact with the new content
create_artifact({
  type: "code",
  title: "myfile.py (updated)",
  files: [{ path: "myfile.py", language: "python", content: updated }],
  version: { number: "1.0.1", message: "Updated X functionality" }
})

// 5. Test the changes
await execute_command({ command: "python myfile.py" });
\`\`\`

### LONG/COMPLEX FILE GUIDELINES

For files over 200 lines, maintain this structure:

1. **Module Header** (10-30 lines): Purpose, author, version, architecture diagram
2. **Imports Section**: Organized by stdlib → third-party → local
3. **Configuration Section**: All constants, config objects at top
4. **Type Definitions**: Dataclasses, TypedDicts, Protocols
5. **Utility Functions**: Small, reusable helpers
6. **Core Classes**: Main business logic
7. **API/Entry Points**: Public functions, CLI handlers
8. **Main Block**: \`if __name__ == "__main__"\`

**Section separators:** Use visual dividers between sections
\`\`\`
# ═══════════════════════════════════════════════════════════════════════════════
# SECTION NAME
# ═══════════════════════════════════════════════════════════════════════════════
\`\`\`

### CODE QUALITY CHECKLIST

Before delivering code, ensure:

□ File has proper header with module name, purpose, author
□ All sections are clearly separated with visual dividers
□ Imports are organized (stdlib → third-party → local)
□ Constants are at the top, not magic numbers in code
□ All functions have docstrings with Args/Returns
□ Type hints are used throughout (Python 3.9+ style)
□ Error handling is present (try/except with specific exceptions)
□ Main entry point exists (\`if __name__ == "__main__"\`)
□ Code is tested and runs without errors
□ Artifact is created with allow_edit: true

### ANTI-PATTERNS TO AVOID

❌ Creating file without showing artifact
❌ Magic numbers/strings scattered in code
❌ Missing type hints
❌ No docstrings
❌ Disorganized imports
❌ No section separators in long files
❌ Inline code without proper structure
❌ Missing error handling
❌ Not testing code after writing
`;

export default CODE_QUALITY_PROMPT;
