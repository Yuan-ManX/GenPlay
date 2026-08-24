/**
 * apply_style_theme - 视觉风格主题工具
 * 将预设主题包（颜色、字体、动效参数）写入 game.theme 字段，
 * 供 GamePreview 引擎在运行时渲染为不同观感。
 */
const STYLE_THEMES = {
  cyberpunk: {
    name: '赛博朋克',
    palette: { bg: '#0a001f', primary: '#ff2a6d', secondary: '#05d9e8', accent: '#d1f7ff', muted: '#2a0944' },
    effects: { scanlines: true, glitch: true, bloom: 1.2, chromatic: 0.8 },
    font: { family: "'Orbitron', monospace", weight: '700' },
    mood: '霓虹、故障艺术、高科技低生活',
  },
  retro_pixel: {
    name: '像素复古',
    palette: { bg: '#1a1a2e', primary: '#e94560', secondary: '#16c79a', accent: '#f6c90e', muted: '#3a3a5c' },
    effects: { scanlines: false, pixelated: true, bloom: 0.4, shake: 0.2 },
    font: { family: "'Press Start 2P', monospace", weight: '400' },
    mood: '8-bit 街机、像素风、怀旧',
  },
  sakura: {
    name: '樱花物语',
    palette: { bg: '#fff0f5', primary: '#ff8fab', secondary: '#c38d9e', accent: '#ffd1dc', muted: '#ffe4ec' },
    effects: { petals: true, bloom: 0.7, soft: 1.0 },
    font: { family: "'Ma Shan Zheng', serif", weight: '500' },
    mood: '温柔、粉紫、花瓣漂浮、治愈系',
  },
  arcade: {
    name: '黄金街机',
    palette: { bg: '#0b132b', primary: '#ffbe0b', secondary: '#fb5607', accent: '#8338ec', muted: '#1c2541' },
    effects: { scanlines: true, crt: true, bloom: 1.0, shake: 0.5 },
    font: { family: "'VT323', monospace", weight: '400' },
    mood: '90s 街机厅、CRT 扫描线、高对比',
  },
  sunset: {
    name: '日落狂想',
    palette: { bg: '#1f0331', primary: '#ff595e', secondary: '#ffca3a', accent: '#ff924c', muted: '#4a1942' },
    effects: { gradient: 'sunset', bloom: 0.9, haze: 0.5 },
    font: { family: "'Bungee', sans-serif", weight: '400' },
    mood: '橙红黄昏、热浪、公路电影',
  },
  ocean: {
    name: '深海秘境',
    palette: { bg: '#03045e', primary: '#00b4d8', secondary: '#48cae4', accent: '#caf0f8', muted: '#023e8a' },
    effects: { bubbles: true, caustics: true, bloom: 0.6, wave: 0.4 },
    font: { family: "'Space Grotesk', sans-serif", weight: '500' },
    mood: '深海蓝、珊瑚礁、水下光线、气泡',
  },
  forest: {
    name: '绿林深处',
    palette: { bg: '#0f241b', primary: '#52b788', secondary: '#95d5b2', accent: '#d8f3dc', muted: '#1b4332' },
    effects: { leaves: true, bloom: 0.5, soft: 0.6 },
    font: { family: "'Lora', serif", weight: '500' },
    mood: '自然森林、翠绿、生机、飘叶',
  },
};

export function applyStyleThemeTool({ gameService }) {
  return {
    name: 'apply_style_theme',
    description: '为游戏应用视觉主题：赛博朋克/像素复古/樱花/街机/日落/深海/绿林',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string', description: '目标游戏 ID' },
        theme: { type: 'string', description: '主题名称：cyberpunk / retro_pixel / sakura / arcade / sunset / ocean / forest，或中文名' },
      },
    },
    async execute({ gameId, theme }) {
      if (!gameService) return { ok: false, error: '游戏数据服务未就绪' };
      if (!gameId) return { ok: false, error: '缺少 gameId' };
      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `未找到游戏：${gameId}` };

      const key = resolveThemeKey(theme || game.genre);
      const pack = STYLE_THEMES[key];
      if (!pack) {
        return { ok: false, error: `未知主题：${theme}。可用：${Object.keys(STYLE_THEMES).join('、')}` };
      }

      const updated = await gameService.update(gameId, {
        theme: pack,
        updatedAt: new Date().toISOString(),
      });

      const editorActions = [{
        type: 'studio:set-theme',
        gameId,
        payload: pack,
      }];

      return {
        ok: true,
        game: updated,
        theme: pack,
        editorActions,
        summary: `已为「${game.name}」应用「${pack.name}」主题。风格：${pack.mood}。创作工坊预览已同步刷新。`,
      };
    },
  };
}

function resolveThemeKey(input) {
  if (!input) return 'retro_pixel';
  const s = String(input).toLowerCase();
  if (STYLE_THEMES[s]) return s;
  if (/赛博|cyberpunk|neon/i.test(s)) return 'cyberpunk';
  if (/像素|复古|retro|pixel|8.?bit|街机黄金/i.test(s)) return 'retro_pixel';
  if (/樱花|sakura|粉/i.test(s)) return 'sakura';
  if (/街机|arcade/i.test(s)) return 'arcade';
  if (/日落|sunset|橙/i.test(s)) return 'sunset';
  if (/深海|海洋|ocean|蓝/i.test(s)) return 'ocean';
  if (/森林|forest|绿|自然/i.test(s)) return 'forest';
  return 'retro_pixel';
}
