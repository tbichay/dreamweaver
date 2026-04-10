/**
 * KoalaTree Prompt Composer
 *
 * Loads prompt blocks from the database, resolves variables,
 * and composes them into model-ready prompts.
 *
 * Key concepts:
 * - Blocks are identified by slug (e.g., "character:koda")
 * - Each block has a production version per scope
 * - Scope cascade: project → user → system (like CSS specificity)
 * - Variables use {{name}} syntax, resolved at composition time
 * - Metadata tracks which block versions were used (provenance)
 */

import { prisma } from "@/lib/db";

// ── Types ────────────────────────────────────────────────────────

export interface ComposedPrompt {
  system: string;
  user: string;
  metadata: PromptMetadata;
}

export interface PromptMetadata {
  blockVersions: Record<string, number>; // slug → version
  blockIds: Record<string, string>;      // slug → cuid
  composedAt: string;                    // ISO timestamp
  scope: string;
}

export interface ComposeOptions {
  /** Block slugs to include, in order */
  blockSlugs: string[];
  /** Variables to resolve: { alter: 7, name: "Max" } */
  variables?: Record<string, unknown>;
  /** Scope for block resolution (project:{id} or user:{id}) */
  scope?: string;
  /** Additional raw text to append to system prompt */
  systemSuffix?: string;
  /** The user prompt (task description) */
  userPrompt?: string;
}

// ── Block Loading ────────────────────────────────────────────────

interface LoadedBlock {
  id: string;
  slug: string;
  version: number;
  content: string;
  type: string;
}

/**
 * Load the production version of a prompt block.
 * Scope cascade: project → user → system
 */
async function loadBlock(slug: string, scope?: string): Promise<LoadedBlock | null> {
  // Try scopes in priority order
  const scopes: string[] = [];
  if (scope) scopes.push(scope);
  // Extract user scope from project scope
  if (scope?.startsWith("project:")) {
    // Could also check user scope, but for now project → system is enough
  }
  scopes.push("system");

  for (const s of scopes) {
    const block = await prisma.promptBlock.findFirst({
      where: { slug, scope: s, isProduction: true },
      select: { id: true, slug: true, version: true, content: true, type: true },
    });
    if (block) return block;
  }

  return null;
}

/**
 * Load multiple blocks by slugs, respecting scope cascade.
 */
async function loadBlocks(slugs: string[], scope?: string): Promise<LoadedBlock[]> {
  const blocks: LoadedBlock[] = [];
  for (const slug of slugs) {
    const block = await loadBlock(slug, scope);
    if (block) blocks.push(block);
    else console.warn(`[PromptComposer] Block not found: ${slug} (scope: ${scope || "system"})`);
  }
  return blocks;
}

// ── Variable Resolution ──────────────────────────────────────────

/**
 * Resolve {{variable}} placeholders in content.
 * Supports:
 * - {{name}} → simple replacement
 * - {{#if condition}}...{{/if}} → conditional blocks
 * - {{#if x and y}}...{{/if}} → compound conditions
 */
function resolveVariables(content: string, vars: Record<string, unknown>): string {
  let result = content;

  // Resolve conditional blocks: {{#if alter <= 5}}...{{/if}}
  result = result.replace(
    /\{\{#if\s+(.+?)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, condition: string, body: string) => {
      if (evaluateCondition(condition, vars)) return body;
      return "";
    },
  );

  // Resolve simple variables: {{name}}
  result = result.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, path: string) => {
    const value = getNestedValue(vars, path);
    return value !== undefined ? String(value) : "";
  });

  // Clean up empty lines from removed conditionals
  result = result.replace(/\n{3,}/g, "\n\n").trim();

  return result;
}

/**
 * Evaluate a simple condition against variables.
 * Supports: ==, !=, <=, >=, <, >, "and"
 */
function evaluateCondition(condition: string, vars: Record<string, unknown>): boolean {
  // Split on " and "
  const parts = condition.split(/\s+and\s+/);
  return parts.every((part) => evaluateSingleCondition(part.trim(), vars));
}

function evaluateSingleCondition(condition: string, vars: Record<string, unknown>): boolean {
  const match = condition.match(/^(\w+)\s*(<=|>=|<|>|==|!=)\s*(.+)$/);
  if (!match) return !!vars[condition]; // Just a truthy check

  const [, varName, op, rawValue] = match;
  const left = Number(vars[varName]);
  const right = Number(rawValue.trim());

  if (isNaN(left) || isNaN(right)) return false;

  switch (op) {
    case "<=": return left <= right;
    case ">=": return left >= right;
    case "<": return left < right;
    case ">": return left > right;
    case "==": return left === right;
    case "!=": return left !== right;
    default: return false;
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj as unknown);
}

// ── Composition ──────────────────────────────────────────────────

/** Block type ordering for system prompt */
const TYPE_ORDER: Record<string, number> = {
  rules: 0,
  character: 1,
  format: 2,
  mood: 3,
  style: 4,
  atmosphere: 5,
  camera: 6,
  visual: 7,
};

/**
 * Compose a prompt from blocks.
 * Returns the assembled system + user prompts with metadata.
 */
export async function composePrompt(opts: ComposeOptions): Promise<ComposedPrompt> {
  const { blockSlugs, variables = {}, scope, systemSuffix, userPrompt } = opts;

  // Load all blocks
  const blocks = await loadBlocks(blockSlugs, scope);

  // Sort by type order
  blocks.sort((a, b) => (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99));

  // Resolve variables in each block
  const resolvedBlocks = blocks.map((b) => ({
    ...b,
    resolvedContent: resolveVariables(b.content, variables),
  }));

  // Build system prompt
  const systemParts = resolvedBlocks.map((b) => b.resolvedContent);
  if (systemSuffix) systemParts.push(systemSuffix);
  const system = systemParts.join("\n\n");

  // Build metadata
  const blockVersions: Record<string, number> = {};
  const blockIds: Record<string, string> = {};
  for (const b of blocks) {
    blockVersions[b.slug] = b.version;
    blockIds[b.slug] = b.id;
  }

  return {
    system,
    user: userPrompt || "",
    metadata: {
      blockVersions,
      blockIds,
      composedAt: new Date().toISOString(),
      scope: scope || "system",
    },
  };
}

// ── Convenience Functions ────────────────────────────────────────

/**
 * Get a single block's resolved content.
 * Useful for injecting a single block (e.g., visual style) into an existing prompt.
 */
export async function getBlockContent(
  slug: string,
  variables?: Record<string, unknown>,
  scope?: string,
): Promise<{ content: string; version: number } | null> {
  const block = await loadBlock(slug, scope);
  if (!block) return null;

  const content = variables
    ? resolveVariables(block.content, variables)
    : block.content;

  return { content, version: block.version };
}

/**
 * List all available blocks of a given type.
 */
export async function listBlocks(type: string, scope?: string): Promise<Array<{
  slug: string;
  name: string;
  description: string | null;
  version: number;
  isProduction: boolean;
  scope: string;
}>> {
  const scopes = scope ? [scope, "system"] : ["system"];

  return prisma.promptBlock.findMany({
    where: { type, scope: { in: scopes }, isProduction: true },
    select: { slug: true, name: true, description: true, version: true, isProduction: true, scope: true },
    orderBy: { name: "asc" },
  });
}
