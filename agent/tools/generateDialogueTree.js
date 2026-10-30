/**
 * generate_dialogue_tree - Generate a branching dialogue tree for narrative games.
 * Creates a graph of dialogue nodes with speaker text, player choices (2-4 per
 * node), optional conditions (stat checks), and multiple endings (combat, ally,
 * info, quest, death). Tailored to the game's scenario and genre.
 *
 * Distinct from generate_story (which produces linear chapters) — this tool
 * produces interactive branching dialogue for visual novels, RPGs, adventures.
 *
 * AI-native: when LLM is available, asks the model to enrich speaker lines
 * with more flavor; otherwise uses template-based generation.
 */

import { generateDialogueTree } from '../narrative/dialogueEngine.js';

export function generateDialogueTreeTool({ gameService, provider }) {
  return {
    name: 'generate_dialogue_tree',
    description: 'Generate a branching dialogue tree for narrative games (visual novel, RPG, adventure). Produces nodes with speaker text, player choices (2-4), conditions (stat checks), effects, and multiple endings. Distinct from generate_story (linear chapters) — this creates interactive branching dialogue.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string', description: 'Target game id' },
        character: { type: 'string', description: 'Primary speaker name (uses scenario default if omitted)' },
        topic: { type: 'string', description: 'Dialogue topic (auto-selected from scenario if omitted)' },
        branches: { type: 'number', description: 'Max choices per node, 2-4 (default 3)' },
        depth: { type: 'number', description: 'Max tree depth, 2-4 (default 3)' },
        seed: { type: 'number', description: 'Random seed for deterministic output' },
        title: { type: 'string', description: 'Dialogue tree title (auto-generated if omitted)' },
      },
      required: ['gameId'],
    },
    async execute({ gameId, character, topic, branches, depth, seed, title, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      // Defaults tuned so the generated tree stays compact and readable:
      // branches=2, depth=2 -> ~7 nodes with ~4 endings; max 4x4 for epics.
      const useBranches = typeof branches === 'number' ? Math.max(2, Math.min(4, branches)) : 2;
      const useDepth = typeof depth === 'number' ? Math.max(2, Math.min(4, depth)) : 2;
      const useSeed = typeof seed === 'number' ? seed : Math.floor(Math.random() * 100000);

      const tree = generateDialogueTree({
        genre: game.genre || 'adventure',
        scenario: game.scenario || 'fantasy',
        character,
        topic,
        branches: useBranches,
        depth: useDepth,
        seed: useSeed,
        title,
      });

      // LLM: enrich a few speaker lines with more flavor.
      let llmEnriched = false;
      if (provider?.enabled && provider.chat) {
        try {
          const nodeIds = Object.keys(tree.nodes).slice(0, 3);
          const prompt = `For a ${game.genre} game dialogue, rewrite this NPC line with more flavor (max 60 chars, Chinese): "${tree.nodes[nodeIds[0]]?.text || ''}". Just return the rewritten line.`;
          const resp = await provider.chat([{ role: 'user', content: prompt }], { maxTokens: 80 });
          if (resp?.content?.trim()) {
            const enriched = resp.content.trim().split('\n')[0].slice(0, 60);
            if (tree.nodes[nodeIds[0]]) tree.nodes[nodeIds[0]].text = enriched;
            llmEnriched = true;
          }
        } catch (_) { /* fall back to template */ }
      }

      // Persist to game.dialogueTrees array.
      const existing = Array.isArray(game.dialogueTrees) ? game.dialogueTrees : [];
      const dialogueTrees = [...existing, tree];
      const updated = await gameService.update(gameId, { dialogueTrees });

      return {
        ok: true,
        game: updated,
        tree,
        llmEnriched,
        summary: `已生成对话树「${tree.title}」共 ${tree.nodeCount} 节点 ${tree.endings.length} 结局${llmEnriched ? '，AI 润色' : ''}`,
        editorActions: [{ type: 'studio:patch-dialogue', gameId, payload: { tree, action: 'generate' } }],
      };
    },
  };
}
