import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { GameConfigProvider } from './contexts/GameConfigContext.jsx'
import { initTheme } from './utils/themeSystem.js'
import './styles/globals.css'

// Inicializa o tema salvo pelo usuário (cores e tint do glassmorphism)
initTheme()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <GameConfigProvider>
        <App />
      </GameConfigProvider>
    </AuthProvider>
  </React.StrictMode>
)


