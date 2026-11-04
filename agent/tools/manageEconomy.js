/**
 * manage_economy - Design the in-game economy: currencies and shop items.
 * Stored on game.economy as { currencies: [{ id, name, icon, initial }],
 * shop: [{ id, name, desc, price, currency, icon }] }. The studio systems
 * panel renders the full economy, and the data ships with export bundles.
 */

export function manageEconomyTool({ gameService }) {
  return {
    name: 'manage_economy',
    description: 'Manage in-game economy: add/update/remove currencies and shop items with prices. Persists on game.economy { currencies, shop }.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        action: {
          type: 'string',
          description: 'list | add_currency | update_currency | remove_currency | add_item | update_item | remove_item',
        },
        entryId: { type: 'string', description: 'currency or item id for update/remove' },
        name: { type: 'string' },
        desc: { type: 'string', description: 'shop item description' },
        icon: { type: 'string' },
        initial: { type: 'number', description: 'starting amount for a currency' },
        price: { type: 'number', description: 'shop item price' },
        currency: { type: 'string', description: 'currency id the price is paid in' },
      },
      required: ['gameId', 'action'],
    },
    async execute({ gameId, action, entryId, name, desc, icon, initial, price, currency }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };
      const act = (action || '').toLowerCase().replace(/-/g, '_');
      const valid = ['list', 'add_currency', 'update_currency', 'remove_currency', 'add_item', 'update_item', 'remove_item'];
      if (!valid.includes(act)) {
        return { ok: false, error: `action must be one of: ${valid.join(' | ')}` };
      }

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const economy = game.economy && typeof game.economy === 'object'
        ? structuredClone(game.economy)
        : { currencies: [], shop: [] };
      if (!Array.isArray(economy.currencies)) economy.currencies = [];
      if (!Array.isArray(economy.shop)) economy.shop = [];

      if (act === 'list') {
        return {
          ok: true,
          economy,
          summary: `经济系统：${economy.currencies.length} 种货币，${economy.shop.length} 件商品`,
          editorActions: [{ type: 'studio:patch-economy', gameId, payload: { action: 'list', economy } }],
        };
      }

      const isCurrency = act.endsWith('_currency');
      const bucket = isCurrency ? economy.currencies : economy.shop;
      const noun = isCurrency ? '货币' : '商品';
      let target = null;
      let summary = '';

      if (act.startsWith('add_')) {
        if (isCurrency) {
          target = {
            id: entryId || `cur_${Date.now().toString(36)}`,
            name: name || '金币',
            icon: icon || '🪙',
            initial: Math.max(0, Number(initial) || 0),
          };
        } else {
          const curId = currency || economy.currencies[0]?.id || 'cur_coin';
          target = {
            id: entryId || `item_${Date.now().toString(36)}`,
            name: name || '新道具',
            desc: desc || '商店出售的道具',
            icon: icon || '🎁',
            price: Math.max(0, Number(price) || 0),
            currency: curId,
          };
        }
        bucket.push(target);
        summary = isCurrency
          ? `已添加货币「${target.name}」${target.icon}，初始数量 ${target.initial}`
          : `已上架商品「${target.name}」${target.icon}，售价 ${target.price}（${target.currency}）`;
      } else {
        const idx = bucket.findIndex((e) => e.id === entryId || e.name === entryId);
        if (idx === -1) return { ok: false, error: `${noun} not found: ${entryId}` };
        target = bucket[idx];
        if (act.startsWith('update_')) {
          if (name) target.name = name;
          if (icon) target.icon = icon;
          if (isCurrency) {
            if (initial !== undefined) target.initial = Math.max(0, Number(initial) || 0);
          } else {
            if (desc) target.desc = desc;
            if (price !== undefined) target.price = Math.max(0, Number(price) || 0);
            if (currency) target.currency = currency;
          }
          summary = `已更新${noun}「${target.name}」`;
        } else { // remove
          bucket.splice(idx, 1);
          summary = `已移除${noun}「${target.name}」`;
        }
      }

      const updated = await gameService.update(gameId, { economy });
      return {
        ok: true,
        game: updated,
        economy,
        entry: target,
        summary,
        editorActions: [{
          type: 'studio:patch-economy',
          gameId,
          payload: { action: act, entry: target, economy },
        }],
      };
    },
  };
}
