import { AgentOrchestrator } from './core/orchestrator.js';
import { MemoryStore } from './core/memory.js';
import { ArtifactMemory } from './core/artifactMemory.js';
import { SelfReflector } from './core/reflector.js';
import { TaskPlanner } from './core/planner.js';
import { ToolRegistry } from './tools/registry.js';
import { LLMProvider } from './providers/llm.js';
import { SharedAssetLibrary } from './templates/assetLibrary.js';

export {
  AgentOrchestrator,
  MemoryStore,
  ArtifactMemory,
  SelfReflector,
  TaskPlanner,
  ToolRegistry,
  LLMProvider,
  SharedAssetLibrary,
};

/**
 * GenPlay Agent Core factory.
 * Wires together: session memory, artifact memory, reflector,
 * shared asset library, LLM provider, tool registry, planner, and
 * returns a fully-configured AgentOrchestrator.
 */
export function createAgent(config = {}) {
  const memory = config.memory || new MemoryStore();
  const artifactMemory = config.artifactMemory || new ArtifactMemory();
  const provider = config.provider instanceof LLMProvider
    ? config.provider
    : new LLMProvider(config.provider || {});
  const reflector = config.reflector || new SelfReflector({ provider });
  const assetLibrary = config.assetLibrary || new SharedAssetLibrary();

  const services = {
    gameService: config.gameService || null,
    provider,
    reflector,
    artifactMemory,
    assetLibrary,
    ...(config.extraServices || {}),
  };
  const tools = new ToolRegistry(services);
  tools.setProvider(provider);
  tools.setReflector(reflector);
  tools.setArtifactMemory(artifactMemory);
  tools.setAssetLibrary(assetLibrary);

  const planner = config.planner || new TaskPlanner();

  const agent = new AgentOrchestrator({
    memory,
    artifactMemory,
    reflector,
    tools,
    planner,
    provider,
    systemPrompt: config.systemPrompt,
    maxSteps: config.maxSteps || 6,
  });

  return agent;
}

export default { createAgent };
