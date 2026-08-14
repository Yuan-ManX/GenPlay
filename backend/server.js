import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import { requestLogger } from './middlewares/logger.js';
import { authGuard } from './middlewares/auth.js';
import { errorHandler, notFound } from './middlewares/validate.js';
import { GameService } from './services/GameService.js';
import { AgentService } from './services/AgentService.js';
import { gameRoutes } from './routes/games.js';
import { chatRoutes } from './routes/chat.js';

const app = express();

// 全局中间件
app.use(cors({ origin: config.frontendOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(requestLogger);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'GenPlay Backend', ts: new Date().toISOString() });
});

// 实例化服务
const gameService = new GameService(config.dataDir);
const agentService = new AgentService(gameService);

// 权限 + 路由
app.use('/api/games', authGuard, gameRoutes(gameService));
app.use('/api/chat', authGuard, chatRoutes(agentService));

// 404 + 异常
app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`\n  GenPlay Backend running at:  http://localhost:${config.port}\n`);
  console.log(`  Frontend origin: ${config.frontendOrigin}`);
  console.log(`  LLM: ${config.llm.apiKey ? config.llm.model : 'fallback (no API key)'}\n`);
});
