/**
 * 权限校验中间件
 * 简易 API Key 校验：配置了 API_KEY 时要求 Authorization 头匹配。
 */
import config from '../config/index.js';

export function authGuard(req, res, next) {
  const apiKey = process.env.API_KEY || '';
  if (!apiKey) return next(); // 未配置则开放
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token !== apiKey) {
    return res.status(401).json({ ok: false, error: '未授权访问' });
  }
  next();
}
