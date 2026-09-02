/**
 * editNodeGraph tool - Allows the Agent to edit a game's visual node graph.
 * Supports: add node, remove node, connect (edge), disconnect, auto-import from DSL, validate.
 * Returns diff + the updated graph so studio can live-reload the node editor tab.
 */
import { NodeDSLEngine } from '../templates/nodeDsl.js';

export function editNodeGraphTool(services = {}) {
  const { gameService } = services;
  return {
    name: 'edit_node_graph',
    description: 'Modify a game visual-scripting node graph: add/remove nodes, connect/disconnect edges, auto-import logic from a DSL script string, or validate the graph.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        op: { type: 'string', description: 'add_node | remove_node | connect | disconnect | import_dsl | validate | clear' },
        payload: { type: 'object', description: 'Depends on op: { node } for add, { nodeId } for remove, { from,to } for edges, { script } for import_dsl' },
      },
      required: ['gameId', 'op'],
    },
    async execute(params = {}) {
      const { gameId, sessionId } = params;
      // Accept both `op` (canonical) and `action` (planner alias) parameter names
      let rawOp = params.op || params.action || '';
      // Map planner-friendly action strings to canonical ops
      const actionMap = {
        add_node: 'add_node', add: 'add_node', create_node: 'add_node',
        remove_node: 'remove_node', delete_node: 'remove_node', rm_node: 'remove_node',
        connect: 'connect', link: 'connect', edge: 'connect',
        disconnect: 'disconnect', unlink: 'disconnect',
        import_dsl: 'import_dsl', dsl_to_graph: 'import_dsl', parse_dsl: 'import_dsl',
        validate: 'validate', check: 'validate',
        clear: 'clear', reset: 'clear', empty: 'clear',
      };
      const op = actionMap[rawOp] || rawOp;

      // Build payload from both canonical `payload` and planner flat params
      // (type, name, desc, dsl, node, nodeId, from, to, script, id)
      let payload = params.payload || {};
      if (op === 'add_node' && !payload.node) {
        payload = {
          node: {
            type: params.type || params.nodeType || 'event',
            data: {
              name: params.name || '',
              description: params.desc || params.description || '',
            },
          },
        };
      }
      if (op === 'remove_node' && !payload.nodeId) {
        payload = { nodeId: params.nodeId };
      }
      if ((op === 'connect' || op === 'disconnect') && (!payload.from || !payload.to)) {
        payload = { ...payload, from: params.from || payload.from, to: params.to || payload.to, id: params.id || payload.id };
      }
      if (op === 'import_dsl' && !payload.script) {
        payload = { script: params.dsl || params.script || '' };
      }

      const game = await gameService?.getById?.(gameId);
      if (!game) return { ok: false, error: '未找到游戏' };
      const graph = game.config?.nodeGraph || { nodes: [], edges: [] };

      let changes = [];
      const before = { nodes: graph.nodes.length, edges: graph.edges.length };
      let next = { nodes: [...graph.nodes], edges: [...graph.edges] };
      let validation = null;

      switch (op) {
        case 'add_node': {
          if (!payload.node) return err('缺少 node');
          const n = { id: payload.node.id || `n_${Date.now()}_${Math.floor(Math.random()*1000)}`, type: payload.node.type, data: payload.node.data || {} };
          next.nodes.push(n);
          changes.push(`+node ${n.id} (${n.type})`);
          break;
        }
        case 'remove_node': {
          const id = payload.nodeId;
          next.nodes = next.nodes.filter((n) => n.id !== id);
          const beforeE = next.edges.length;
          next.edges = next.edges.filter((e) => e.from !== id && e.to !== id);
          changes.push(`-node ${id} (清理 ${beforeE - next.edges.length} 条边)`);
          break;
        }
        case 'connect': {
          if (!payload.from || !payload.to) return err('缺少 from/to');
          const e = { from: payload.from, to: payload.to, id: payload.id || `e_${Date.now()}` };
          next.edges.push(e);
          changes.push(`+edge ${e.from} → ${e.to}`);
          break;
        }
        case 'disconnect': {
          const L = next.edges.length;
          next.edges = next.edges.filter((e) => !(e.from === payload.from && e.to === payload.to) && e.id !== payload.id);
          changes.push(`-edges 共 ${L - next.edges.length} 条`);
          break;
        }
        case 'import_dsl': {
          const script = payload.script || game.scripts || '';
          const imported = NodeDSLEngine.fromDslScript(script, `imp_${Date.now()}`);
          next = { nodes: [...next.nodes, ...imported.nodes], edges: [...next.edges, ...imported.edges] };
          changes.push(`导入 DSL → ${imported.nodes.length} 节点, ${imported.edges.length} 边`);
          break;
        }
        case 'validate': {
          validation = NodeDSLEngine.validate(next);
          changes.push(`校验完成：${validation.length} 项`);
          break;
        }
        case 'clear': {
          next = { nodes: [], edges: [] };
          changes.push('清空节点图');
          break;
        }
        default:
          return err(`未知操作 ${op}`);
      }

      if (!validation && op !== 'validate') validation = NodeDSLEngine.validate(next);

      if (op !== 'validate') {
        await gameService.update(gameId, {
          config: { ...(game.config || {}), nodeGraph: next },
        });
      }

      return {
        ok: true,
        summary: changes.join(' · ') || '节点图操作完成',
        graph: next,
        before,
        after: { nodes: next.nodes.length, edges: next.edges.length },
        changes,
        validation,
        editorActions: [
          {
            type: 'studio:update-nodes',
            payload: { gameId, graph: next, changes },
          },
          {
            type: 'studio:patch-config',
            payload: { gameId, after: { nodeGraph: next }, changes },
          },
        ],
      };

      function err(m) { return { ok: false, error: m, summary: m }; }
    },
  };
}
