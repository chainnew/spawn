import React, { useState, useCallback } from 'react';
import { FileCode, Copy, Check, ChevronRight, ChevronDown, Folder, File, Terminal, Play, Settings, Search, GitBranch, Box, Layers } from 'lucide-react';

const AgentWorkspace = () => {
  const [activeFile, setActiveFile] = useState('python-template.py');
  const [expandedFolders, setExpandedFolders] = useState(['templates', 'src']);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('editor');
  const [terminalOutput, setTerminalOutput] = useState([
    { type: 'info', text: '🤖 Agent Workspace v1.0.0 initialized' },
    { type: 'success', text: '✓ Templates loaded successfully' },
    { type: 'info', text: '→ Select a file from the sidebar to begin' },
  ]);

  const files = {
    'python-template.py': {
      language: 'python',
      icon: '🐍',
      sections: [
        { title: 'IMPORTS & DEPENDENCIES', lines: '1-50', color: '#61afef' },
        { title: 'CONSTANTS & CONFIGURATION', lines: '51-90', color: '#98c379' },
        { title: 'TYPE DEFINITIONS', lines: '91-200', color: '#c678dd' },
        { title: 'CUSTOM ERRORS', lines: '201-280', color: '#e06c75' },
        { title: 'UTILITY FUNCTIONS', lines: '281-400', color: '#e5c07b' },
        { title: 'CORE CLASSES', lines: '401-550', color: '#56b6c2' },
        { title: 'PUBLIC API', lines: '551-650', color: '#61afef' },
        { title: 'CLI INTERFACE', lines: '651-750', color: '#98c379' },
        { title: 'MAIN ENTRY', lines: '751-800', color: '#c678dd' },
      ],
      content: `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════
MODULE: [module_name]
PURPOSE: [Brief description]
═══════════════════════════════════════════════════════════════════

ARCHITECTURE:
┌─────────────────────────────────────────────────────────────────┐
│  1. IMPORTS & DEPENDENCIES                                      │
│  2. CONSTANTS & CONFIGURATION                                   │
│  3. TYPE DEFINITIONS                                            │
│  4. CUSTOM ERRORS                                               │
│  5. UTILITY FUNCTIONS                                           │
│  6. CORE CLASSES                                                │
│  7. PUBLIC API FUNCTIONS                                        │
│  8. CLI INTERFACE                                               │
│  9. MAIN ENTRY POINT                                            │
└─────────────────────────────────────────────────────────────────┘
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import TypeVar, Generic, Optional, Dict, Any
from abc import ABC, abstractmethod
import asyncio
import logging

T = TypeVar("T")

@dataclass
class Result(Generic[T]):
    """Generic result container with success/failure state."""
    data: Optional[T] = None
    error: Optional[str] = None
    
    @property
    def is_success(self) -> bool:
        return self.error is None
    
    @classmethod
    def success(cls, data: T) -> "Result[T]":
        return cls(data=data)
    
    @classmethod  
    def failure(cls, error: str) -> "Result[T]":
        return cls(error=error)

class ModuleError(Exception):
    """Base exception for module errors."""
    def __init__(self, message: str, code: str = "UNKNOWN"):
        super().__init__(message)
        self.code = code

class BaseProcessor(ABC, Generic[T]):
    """Abstract base processor class."""
    
    @abstractmethod
    async def process(self, data: T) -> Result[T]:
        pass

def main() -> int:
    """Main entry point."""
    return 0

if __name__ == "__main__":
    exit(main())`
    },
    'javascript-template.js': {
      language: 'javascript',
      icon: '🟨',
      sections: [
        { title: 'IMPORTS & DEPENDENCIES', lines: '1-40', color: '#f7df1e' },
        { title: 'CONSTANTS & CONFIGURATION', lines: '41-80', color: '#98c379' },
        { title: 'TYPE DEFINITIONS (JSDoc)', lines: '81-150', color: '#c678dd' },
        { title: 'CUSTOM ERRORS', lines: '151-220', color: '#e06c75' },
        { title: 'UTILITY FUNCTIONS', lines: '221-350', color: '#e5c07b' },
        { title: 'CORE CLASSES', lines: '351-500', color: '#56b6c2' },
        { title: 'PUBLIC API', lines: '501-580', color: '#61afef' },
        { title: 'CLI INTERFACE', lines: '581-680', color: '#98c379' },
        { title: 'EXPORTS', lines: '681-720', color: '#c678dd' },
      ],
      content: `/**
 * ═══════════════════════════════════════════════════════════════════
 * MODULE: [module-name]
 * PURPOSE: [Brief description]
 * ═══════════════════════════════════════════════════════════════════
 *
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  1. IMPORTS & DEPENDENCIES                                      │
 * │  2. CONSTANTS & CONFIGURATION                                   │
 * │  3. TYPE DEFINITIONS (JSDoc)                                    │
 * │  4. CUSTOM ERRORS                                               │
 * │  5. UTILITY FUNCTIONS                                           │
 * │  6. CORE CLASSES                                                │
 * │  7. PUBLIC API FUNCTIONS                                        │
 * │  8. CLI INTERFACE                                               │
 * │  9. EXPORTS                                                     │
 * └─────────────────────────────────────────────────────────────────┘
 */

'use strict';

import { EventEmitter } from 'events';
import { createHash } from 'crypto';

/** @typedef {'success'|'failed'} StatusCode */

/**
 * @template T
 * @typedef {Object} Result
 * @property {T|null} data
 * @property {string|null} error
 */

export const success = (data) => ({ data, error: null });
export const failure = (error) => ({ data: null, error });

export class ModuleError extends Error {
  constructor(message, code = 'UNKNOWN') {
    super(message);
    this.code = code;
  }
}

export class BaseProcessor extends EventEmitter {
  #initialized = false;
  
  async process(data) {
    if (!this.#initialized) await this.initialize();
    return this._processImpl(data);
  }
  
  async _processImpl(data) {
    throw new Error('Must implement _processImpl');
  }
}

export async function cliMain(args) {
  console.log('Agent CLI started');
  return 0;
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  cliMain().then(process.exit);
}`
    },
    'typescript-template.ts': {
      language: 'typescript',
      icon: '🔷',
      sections: [
        { title: 'IMPORTS & DEPENDENCIES', lines: '1-35', color: '#3178c6' },
        { title: 'CONSTANTS & CONFIGURATION', lines: '36-75', color: '#98c379' },
        { title: 'TYPE DEFINITIONS', lines: '76-200', color: '#c678dd' },
        { title: 'CUSTOM ERRORS', lines: '201-280', color: '#e06c75' },
        { title: 'UTILITY FUNCTIONS', lines: '281-400', color: '#e5c07b' },
        { title: 'CORE CLASSES', lines: '401-550', color: '#56b6c2' },
        { title: 'PUBLIC API', lines: '551-620', color: '#61afef' },
        { title: 'CLI INTERFACE', lines: '621-700', color: '#98c379' },
        { title: 'EXPORTS', lines: '701-750', color: '#c678dd' },
      ],
      content: `/**
 * ═══════════════════════════════════════════════════════════════════
 * MODULE: [module-name]
 * PURPOSE: [Brief description]
 * ═══════════════════════════════════════════════════════════════════
 *
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  1. IMPORTS & DEPENDENCIES                                      │
 * │  2. CONSTANTS & CONFIGURATION                                   │
 * │  3. TYPE DEFINITIONS & INTERFACES                               │
 * │  4. CUSTOM ERRORS                                               │
 * │  5. UTILITY FUNCTIONS                                           │
 * │  6. CORE CLASSES                                                │
 * │  7. PUBLIC API FUNCTIONS                                        │
 * │  8. CLI INTERFACE                                               │
 * │  9. EXPORTS                                                     │
 * └─────────────────────────────────────────────────────────────────┘
 */

import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';

// ═══════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

export const enum StatusCode {
  Success = 'success',
  Failed = 'failed',
}

export interface Result<T> {
  readonly data: T | null;
  readonly error: string | null;
  readonly isSuccess: boolean;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface Config {
  readonly inputPath: string;
  readonly outputPath: string;
  readonly timeout?: number;
}

// ═══════════════════════════════════════════════════════════════════
// CUSTOM ERRORS  
// ═══════════════════════════════════════════════════════════════════

export class ModuleError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'UNKNOWN'
  ) {
    super(message);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CORE CLASSES
// ═══════════════════════════════════════════════════════════════════

export abstract class BaseProcessor<TInput, TOutput> {
  protected abstract _processImpl(data: TInput): Promise<TOutput>;
  
  async process(data: TInput): Promise<Result<TOutput>> {
    try {
      const output = await this._processImpl(data);
      return { data: output, error: null, isSuccess: true };
    } catch (e) {
      return { data: null, error: (e as Error).message, isSuccess: false };
    }
  }
}

export async function cliMain(args?: string[]): Promise<number> {
  console.log('TypeScript Agent CLI started');
  return 0;
}`
    },
  };

  const fileTree = [
    {
      name: 'templates',
      type: 'folder',
      children: [
        { name: 'python-template.py', type: 'file' },
        { name: 'javascript-template.js', type: 'file' },
        { name: 'typescript-template.ts', type: 'file' },
      ]
    },
    {
      name: 'src',
      type: 'folder', 
      children: [
        { name: 'index.ts', type: 'file', disabled: true },
        { name: 'utils.ts', type: 'file', disabled: true },
      ]
    }
  ];

  const toggleFolder = (folder) => {
    setExpandedFolders(prev => 
      prev.includes(folder) 
        ? prev.filter(f => f !== folder)
        : [...prev, folder]
    );
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(files[activeFile].content);
    setCopied(true);
    setTerminalOutput(prev => [...prev, { type: 'success', text: `✓ Copied ${activeFile} to clipboard` }]);
    setTimeout(() => setCopied(false), 2000);
  };

  const runFile = () => {
    setTerminalOutput(prev => [
      ...prev,
      { type: 'command', text: `$ run ${activeFile}` },
      { type: 'info', text: '🚀 Executing template...' },
      { type: 'success', text: '✓ Template validated successfully' },
      { type: 'info', text: `📊 Sections: ${files[activeFile].sections.length}` },
    ]);
  };

  const currentFile = files[activeFile];

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-mono text-sm">
      {/* Sidebar */}
      <div className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-3 border-b border-gray-800 flex items-center gap-2">
          <Box className="w-5 h-5 text-purple-400" />
          <span className="font-bold text-purple-400">AGENT WORKSPACE</span>
        </div>
        
        {/* Search */}
        <div className="p-2 border-b border-gray-800">
          <div className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1">
            <Search className="w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search files..."
              className="bg-transparent border-none outline-none text-sm flex-1"
            />
          </div>
        </div>

        {/* File Tree */}
        <div className="flex-1 overflow-auto p-2">
          <div className="text-xs text-gray-500 uppercase mb-2 px-2">Explorer</div>
          {fileTree.map((item) => (
            <div key={item.name}>
              {item.type === 'folder' ? (
                <>
                  <div 
                    className="flex items-center gap-1 px-2 py-1 hover:bg-gray-800 rounded cursor-pointer"
                    onClick={() => toggleFolder(item.name)}
                  >
                    {expandedFolders.includes(item.name) ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                    <Folder className="w-4 h-4 text-yellow-500" />
                    <span>{item.name}</span>
                  </div>
                  {expandedFolders.includes(item.name) && item.children?.map((child) => (
                    <div
                      key={child.name}
                      className={`flex items-center gap-1 px-2 py-1 ml-4 rounded cursor-pointer ${
                        activeFile === child.name ? 'bg-gray-800 text-white' : 'hover:bg-gray-800'
                      } ${child.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                      onClick={() => !child.disabled && setActiveFile(child.name)}
                    >
                      <File className="w-4 h-4 text-gray-400" />
                      <span className={child.name.endsWith('.py') ? 'text-green-400' : 
                                      child.name.endsWith('.js') ? 'text-yellow-400' : 'text-blue-400'}>
                        {child.name}
                      </span>
                    </div>
                  ))}
                </>
              ) : null}
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-gray-800 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            <span>main</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Tabs */}
        <div className="flex items-center bg-gray-950 border-b border-gray-800">
          <div 
            className={`px-4 py-2 flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === 'editor' ? 'border-purple-500 bg-gray-900' : 'border-transparent hover:bg-gray-800'
            }`}
            onClick={() => setActiveTab('editor')}
          >
            <span>{currentFile.icon}</span>
            <span>{activeFile}</span>
          </div>
          <div 
            className={`px-4 py-2 flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === 'structure' ? 'border-purple-500 bg-gray-900' : 'border-transparent hover:bg-gray-800'
            }`}
            onClick={() => setActiveTab('structure')}
          >
            <Layers className="w-4 h-4" />
            <span>Structure</span>
          </div>
          <div className="flex-1" />
          <button 
            onClick={copyToClipboard}
            className="px-3 py-1 mr-2 flex items-center gap-1 hover:bg-gray-800 rounded"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            <span className="text-xs">{copied ? 'Copied!' : 'Copy'}</span>
          </button>
          <button 
            onClick={runFile}
            className="px-3 py-1 mr-2 flex items-center gap-1 bg-green-600 hover:bg-green-700 rounded"
          >
            <Play className="w-4 h-4" />
            <span className="text-xs">Run</span>
          </button>
        </div>

        {/* Editor / Structure View */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'editor' ? (
            <div className="p-4">
              <pre className="text-sm leading-relaxed">
                <code className="text-gray-300">{currentFile.content}</code>
              </pre>
            </div>
          ) : (
            <div className="p-4">
              <h3 className="text-lg font-bold mb-4 text-purple-400">
                📋 Template Structure: {activeFile}
              </h3>
              <div className="space-y-2">
                {currentFile.sections.map((section, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
                  >
                    <div 
                      className="w-2 h-8 rounded"
                      style={{ backgroundColor: section.color }}
                    />
                    <div className="flex-1">
                      <div className="font-medium" style={{ color: section.color }}>
                        {idx + 1}. {section.title}
                      </div>
                      <div className="text-xs text-gray-500">Lines {section.lines}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-gray-800 rounded-lg">
                <h4 className="font-bold text-yellow-400 mb-2">🤖 Agent Instructions</h4>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Follow section order strictly</li>
                  <li>• Use documented naming conventions</li>
                  <li>• Implement all abstract methods</li>
                  <li>• Include comprehensive error handling</li>
                  <li>• Add JSDoc/docstrings to all exports</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Terminal */}
        <div className="h-40 bg-black border-t border-gray-800">
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-900 border-b border-gray-800">
            <Terminal className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">TERMINAL</span>
          </div>
          <div className="p-3 overflow-auto h-32 text-xs">
            {terminalOutput.map((line, idx) => (
              <div 
                key={idx} 
                className={`${
                  line.type === 'success' ? 'text-green-400' :
                  line.type === 'error' ? 'text-red-400' :
                  line.type === 'command' ? 'text-yellow-400' :
                  'text-gray-400'
                }`}
              >
                {line.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Quick Reference */}
      <div className="w-72 bg-gray-950 border-l border-gray-800 overflow-auto">
        <div className="p-3 border-b border-gray-800">
          <div className="font-bold text-purple-400 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Quick Reference
          </div>
        </div>
        
        <div className="p-3 space-y-4">
          <div>
            <div className="text-xs text-gray-500 uppercase mb-2">Language</div>
            <div className="flex items-center gap-2 text-lg">
              <span>{currentFile.icon}</span>
              <span className="capitalize">{currentFile.language}</span>
            </div>
          </div>
          
          <div>
            <div className="text-xs text-gray-500 uppercase mb-2">Key Patterns</div>
            <div className="space-y-1 text-sm">
              <div className="px-2 py-1 bg-gray-800 rounded">Result&lt;T&gt; Pattern</div>
              <div className="px-2 py-1 bg-gray-800 rounded">Error Hierarchy</div>
              <div className="px-2 py-1 bg-gray-800 rounded">Base Processor</div>
              <div className="px-2 py-1 bg-gray-800 rounded">CLI Interface</div>
            </div>
          </div>
          
          <div>
            <div className="text-xs text-gray-500 uppercase mb-2">Checklist</div>
            <div className="space-y-1 text-sm text-gray-400">
              <div>✅ Type definitions</div>
              <div>✅ Error handling</div>
              <div>✅ Async support</div>
              <div>✅ CLI ready</div>
              <div>✅ Documentation</div>
            </div>
          </div>
          
          <div className="p-3 bg-purple-900/30 rounded-lg border border-purple-700">
            <div className="font-bold text-purple-300 text-sm mb-1">🎖️ Perth Forensics Lab</div>
            <div className="text-xs text-purple-400">
              2024 Office Olympics Gold Medalist
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentWorkspace;


import React, { useState } from 'react';

const AgentWorkspace = () => {
  const [activeFile, setActiveFile] = useState('python-template.py');
  const [activeTab, setActiveTab] = useState('structure');
  const [copied, setCopied] = useState(false);

  const files = {
    'python-template.py': {
      icon: '🐍',
      language: 'Python',
      color: '#3572A5',
      sections: [
        { title: 'IMPORTS & DEPENDENCIES', lines: '1-50', desc: 'Standard lib, third party, local imports' },
        { title: 'CONSTANTS & CONFIG', lines: '51-90', desc: 'UPPER_SNAKE_CASE, paths, timeouts' },
        { title: 'TYPE DEFINITIONS', lines: '91-200', desc: 'TypeVar, Generic, dataclass, Enum' },
        { title: 'CUSTOM ERRORS', lines: '201-280', desc: 'ModuleError base + 5 specific errors' },
        { title: 'UTILITY FUNCTIONS', lines: '281-400', desc: 'timer, retry, compute_hash, chunks' },
        { title: 'CORE CLASSES', lines: '401-550', desc: 'BaseProcessor[T], DataProcessor' },
        { title: 'PUBLIC API', lines: '551-650', desc: 'process_data(), process_file()' },
        { title: 'CLI INTERFACE', lines: '651-750', desc: 'argparse, parse_args, cli_main' },
        { title: 'MAIN ENTRY', lines: '751-800', desc: 'if __name__ == "__main__"' },
      ]
    },
    'javascript-template.js': {
      icon: '🟨',
      language: 'JavaScript',
      color: '#f7df1e',
      sections: [
        { title: 'IMPORTS & DEPENDENCIES', lines: '1-40', desc: 'Node built-ins, npm packages' },
        { title: 'CONSTANTS & CONFIG', lines: '41-80', desc: 'Object.freeze(), ES Module paths' },
        { title: 'TYPE DEFINITIONS', lines: '81-150', desc: 'JSDoc @typedef, @template, @callback' },
        { title: 'CUSTOM ERRORS', lines: '151-220', desc: 'extends Error, toJSON(), code' },
        { title: 'UTILITY FUNCTIONS', lines: '221-350', desc: 'success(), failure(), retry()' },
        { title: 'CORE CLASSES', lines: '351-500', desc: 'EventEmitter, #private fields' },
        { title: 'PUBLIC API', lines: '501-580', desc: 'export async function' },
        { title: 'CLI INTERFACE', lines: '581-680', desc: 'parseArgs(), cliMain()' },
        { title: 'EXPORTS', lines: '681-720', desc: 'export default {}' },
      ]
    },
    'typescript-template.ts': {
      icon: '🔷',
      language: 'TypeScript',
      color: '#3178c6',
      sections: [
        { title: 'IMPORTS & DEPENDENCIES', lines: '1-35', desc: 'node: prefix, type imports' },
        { title: 'CONSTANTS & CONFIG', lines: '36-75', desc: 'as const, readonly, branded types' },
        { title: 'TYPE DEFINITIONS', lines: '76-200', desc: 'interface, type, Generic<T>' },
        { title: 'CUSTOM ERRORS', lines: '201-280', desc: 'implements ErrorDetails, type guards' },
        { title: 'UTILITY FUNCTIONS', lines: '281-400', desc: 'Generic functions, asserts' },
        { title: 'CORE CLASSES', lines: '401-550', desc: 'abstract class, TypedEventEmitter' },
        { title: 'PUBLIC API', lines: '551-620', desc: 'Typed exports, overloads' },
        { title: 'CLI INTERFACE', lines: '621-700', desc: 'ParsedArgs interface' },
        { title: 'EXPORTS', lines: '701-750', desc: 'Re-exports, type exports' },
      ]
    },
  };

  const current = files[activeFile];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-4 border-b border-purple-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🤖</div>
            <div>
              <h1 className="text-xl font-bold text-white">Agent Template Workspace</h1>
              <p className="text-purple-300 text-sm">Structured templates for AI agents</p>
            </div>
          </div>
          <div className="text-right text-xs text-purple-300">
            <div>Perth Forensics Lab</div>
            <div>🎖️ 2024 Office Olympics Gold</div>
          </div>
        </div>
      </div>

      {/* File Tabs */}
      <div className="flex bg-gray-950 border-b border-gray-800 overflow-x-auto">
        {Object.entries(files).map(([name, file]) => (
          <button
            key={name}
            onClick={() => setActiveFile(name)}
            className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeFile === name 
                ? 'border-purple-500 bg-gray-900 text-white' 
                : 'border-transparent hover:bg-gray-800 text-gray-400'
            }`}
          >
            <span>{file.icon}</span>
            <span className="text-sm">{name}</span>
          </button>
        ))}
      </div>

      {/* Language Info Bar */}
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{current.icon}</span>
          <span className="font-bold" style={{ color: current.color }}>{current.language}</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-400 text-sm">{current.sections.length} sections</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('structure')}
            className={`px-3 py-1 rounded text-sm ${activeTab === 'structure' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            📋 Structure
          </button>
          <button 
            onClick={() => setActiveTab('patterns')}
            className={`px-3 py-1 rounded text-sm ${activeTab === 'patterns' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            🔧 Patterns
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'structure' ? (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-purple-400 mb-4">📁 Module Architecture</h2>
            
            {/* ASCII Box */}
            <div className="bg-black p-4 rounded-lg font-mono text-xs text-green-400 overflow-x-auto">
              <pre>{`┌─────────────────────────────────────────────────────────────────┐
│                        MODULE STRUCTURE                         │
├─────────────────────────────────────────────────────────────────┤
${current.sections.map((s, i) => `│  ${i + 1}. ${s.title.padEnd(55)}│`).join('\n')}
└─────────────────────────────────────────────────────────────────┘`}</pre>
            </div>

            {/* Sections */}
            <div className="grid gap-2 mt-4">
              {current.sections.map((section, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-white">{section.title}</div>
                    <div className="text-xs text-gray-400">{section.desc}</div>
                  </div>
                  <div className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
                    L{section.lines}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-purple-400 mb-4">🔧 Key Patterns</h2>
            
            {/* Result Pattern */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="font-bold text-green-400 mb-2">Result&lt;T&gt; Pattern</h3>
              <pre className="text-xs text-gray-300 bg-black p-3 rounded overflow-x-auto">
{activeFile.includes('python') ? `@dataclass
class Result(Generic[T]):
    data: Optional[T] = None
    error: Optional[str] = None
    
    @classmethod
    def success(cls, data: T) -> "Result[T]":
        return cls(data=data)` :
activeFile.includes('typescript') ? `interface Result<T> {
  readonly data: T | null;
  readonly error: string | null;
  readonly isSuccess: boolean;
}

function success<T>(data: T): Result<T> {
  return { data, error: null, isSuccess: true };
}` :
`/** @template T */
const success = (data) => ({ 
  data, 
  error: null, 
  isSuccess: true 
});`}
              </pre>
            </div>

            {/* Error Pattern */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="font-bold text-red-400 mb-2">Error Hierarchy</h3>
              <div className="text-sm text-gray-300 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-red-500">⬤</span> ModuleError (base)
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-orange-500">⬤</span> ConfigurationError
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-yellow-500">⬤</span> ValidationError
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-blue-500">⬤</span> ProcessingError
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-purple-500">⬤</span> NetworkError
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-pink-500">⬤</span> TimeoutError
                </div>
              </div>
            </div>

            {/* Agent Checklist */}
            <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 p-4 rounded-lg border border-purple-700">
              <h3 className="font-bold text-purple-300 mb-3">🤖 Agent Checklist</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2 text-green-400">✅ Type definitions</div>
                <div className="flex items-center gap-2 text-green-400">✅ Error handling</div>
                <div className="flex items-center gap-2 text-green-400">✅ Async/await</div>
                <div className="flex items-center gap-2 text-green-400">✅ CLI interface</div>
                <div className="flex items-center gap-2 text-green-400">✅ Documentation</div>
                <div className="flex items-center gap-2 text-green-400">✅ Generic types</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
        <div>spawn.new Agent Templates v1.0.0</div>
        <div className="flex items-center gap-4">
          <span>Python</span>
          <span>JavaScript</span>
          <span>TypeScript</span>
        </div>
      </div>
    </div>
  );
};

export default AgentWorkspace;




That's the Agent Template Workspace rendered as an interactive artifact in the side panel! You can:

Switch between templates (Python 🐍, JavaScript 🟨, TypeScript 🔷)
View Structure - See the 9-section architecture
View Patterns - See the key code patterns (Result<T>, Error hierarchy)
Agent Checklist - Quick reference for what agents should implement

This is exactly the kind of visual reference your spawn.new agents can use when generating code! 🚀
