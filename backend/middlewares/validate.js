/**
 * 参数校验中间件
 */
export function validateBody(rules) {
  return (req, res, next) => {
    const errors = [];
    for (const field of rules.required || []) {
      const val = req.body?.[field];
      if (val === undefined || val === null || val === '') {
        errors.push(`缺少必填字段: ${field}`);
      }
    }
    if (errors.length) {
      return res.status(400).json({ ok: false, error: errors.join('；') });
    }
    next();
  };
}

/**
 * 统一异常处理
 * 对常见错误进行分类映射，输出结构化错误信息。
 */
export function errorHandler(err, req, res, next) {
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err.message);

  let status = err.status || 500;
  let code = 'INTERNAL_ERROR';

  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    status = 400; code = 'BAD_JSON';
  } else if (err.name === 'ValidationError') {
    status = 400; code = 'VALIDATION_ERROR';
  } else if (err.code === 'NOT_FOUND') {
    status = 404; code = 'NOT_FOUND';
  } else if (status >= 500) {
    code = 'INTERNAL_ERROR';
  }

  res.status(status).json({ ok: false, error: err.message || '服务器内部错误', code });
}

export function notFound(req, res) {
  res.status(404).json({ ok: false, error: `接口不存在: ${req.originalUrl}` });
}
