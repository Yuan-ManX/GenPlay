export const config = {
  port: Number(process.env.PORT) || 7500,
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:4500',
  dataDir: process.env.DATA_DIR || new URL('../data/', import.meta.url).pathname,
  llm: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};

export default config;
