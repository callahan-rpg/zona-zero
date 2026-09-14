import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function apiDevMiddlewarePlugin() {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/')) {
          const url = new URL(req.url, 'http://localhost')
          
          // Coleta o corpo da requisição
          let rawBody = ''
          for await (const chunk of req) {
            rawBody += chunk
          }

          let body = {}
          if (rawBody) {
            try {
              body = JSON.parse(rawBody)
            } catch {
              body = {}
            }
          }

          // Injeta helper status e json compatíveis com Vercel/Express
          res.status = (code) => {
            res.statusCode = code
            return res
          }
          res.json = (data) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(data))
            return res
          }
          req.body = body

          if (url.pathname === '/api/upload') {
            try {
              const { default: uploadHandler } = await import('./api/upload.js')
              return await uploadHandler(req, res)
            } catch (err) {
              console.error('[Vite Dev API] Erro no /api/upload:', err)
              return res.status(500).json({ error: err.message })
            }
          }

          if (url.pathname === '/api/discord-webhook') {
            try {
              const { default: webhookHandler } = await import('./api/discord-webhook.js')
              return await webhookHandler(req, res)
            } catch (err) {
              console.error('[Vite Dev API] Erro no /api/discord-webhook:', err)
              return res.status(500).json({ error: err.message })
            }
          }
        }
        next()
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  // Carrega variáveis do .env para process.env para que os handlers em /api acessem
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
    plugins: [react(), apiDevMiddlewarePlugin()],
    server: {
      port: 5173,
    },
  }
})
