/**
 * Core type definitions for PromptG
 */

/**
 * A saved prompt (either from template or user-created)
 */
export interface Prompt {
  /** Discriminator for the document kind */
  kind: 'prompt';
  /** Prompt schema version */
  schemaVersion: string;
  /** User-facing identifier (kebab-case) */
  name: string;
  /** Human-readable name (shown in UIs); defaults to `name` */
  displayName?: string;
  /** Optional description shown in selection */
  description?: string;
  /** The actual prompt text */
  content: string;
  /** Optional shareable default values for {{variables}} (used for injection) */
  defaults?: Record<string, string>;
  /** Optional author/attribution for community sharing */
  author?: string;
  /** Categories for organization */
  tags?: string[];

  /** PromptG extension: interactive UX metadata for filling variables */
  'x-promptg-interactive'?: Record<string, InteractiveVar>;
  /** PromptG extension: time metadata */
  'x-promptg-time'?: PromptGTime;

  // Extension fields (tool/vendor-specific).
  [key: `x-${string}`]: unknown;
}

/**
 * A prompt template
 */
export interface Template {
  /** Discriminator for the document kind */
  kind: 'template';
  /** Template schema version */
  schemaVersion: string;
  /** User-facing identifier (kebab-case) */
  name: string;
  /** Human-readable name (shown in UIs) */
  displayName: string;
  /** Shown in template selection UIs */
  description: string;
  /** Embedded Prompt document payload */
  prompt: Prompt;
  /** Optional author/attribution for community sharing (template wrapper metadata) */
  author?: string;
  /** Categories for organization (template wrapper metadata) */
  tags?: string[];
  /** PromptG extension: time metadata (wrapper metadata) */
  'x-promptg-time'?: PromptGTime;

  // Extension fields (tool/vendor-specific).
  [key: `x-${string}`]: unknown;
}

export interface InteractiveVar {
  /** CLI question to ask for this variable */
  question?: string;
  /** Optional helper text shown under the question */
  help?: string;
  /** If true, disallow empty input when no default exists */
  required?: boolean;
}

export interface PromptGTime {
  /** RFC 3339 date-time string (UTC recommended, e.g. 2024-01-15T10:30:00Z) */
  createdAt?: string;
}

/**
 * Configuration (future use)
 */
export interface Config {
  version: string;
  preferences?: {
    defaultEditor?: string;
    defaultOutputFormat?: 'raw' | 'json';
    colorScheme?: 'auto' | 'light' | 'dark' | 'none';
  };
}

/**
 * A prompt pack (bundles many prompts/templates in a single file for sharing).
 */
export interface PromptPack {
  /** Discriminator for the document kind */
  kind: 'pack';
  /** Pack schema version (currently "1") */
  schemaVersion: string;
  /** Optional JSON Schema identifier for editor tooling */
  $schema?: string;
  /** Pack name (kebab-case) */
  name: string;
  /** Pack version (semver string) */
  version: string;
  /** Human-readable name for display */
  displayName?: string;
  /** Optional description */
  description?: string;
  /** Optional homepage URL */
  homepage?: string;
  /** Optional author/maintainer */
  author?: string;
  /** Optional tags */
  tags?: string[];
  /** Prompts included in this pack */
  prompts?: Prompt[];
  /** Templates included in this pack */
  templates?: Template[];

  // Extension fields (tool/vendor-specific).
  [key: `x-${string}`]: unknown;
}
