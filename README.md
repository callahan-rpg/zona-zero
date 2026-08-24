# 🧟 Zona Zero — RPG de Sobrevivência

Browser game RPG narrado com temática de apocalipse zumbi.  
**Stack**: React + Vite + Firebase (Auth, Firestore, Storage) + Vercel

---

## 🚀 Setup Rápido

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar o Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Crie um novo projeto (ex: `zona-zero-rpg`)
3. Ative os seguintes serviços:
   - **Authentication** → Email/senha
   - **Firestore Database** → Modo de teste inicialmente
   - **Storage** → Para avatares dos personagens
4. Clique em "Adicionar app" > Web (`</>`)
5. Copie as configurações

### 3. Criar o arquivo `.env`
```bash
cp .env.example .env
```
Edite `.env` com os dados do seu projeto Firebase.

### 4. Configurar Firestore

No painel do Firebase, vá em **Firestore > Regras** e cole o conteúdo de `firestore.rules`.

### 5. Criar configuração inicial do jogo

No **Firestore**, crie manualmente o documento:
- **Coleção**: `game_config`
- **Documento ID**: `global`
- **Dados**:
```json
{
  "title": "Zona Zero",
  "weather": {
    "condition": "rainy",
    "temperature": 16,
    "label": "Chovendo",
    "icon": "🌧️"
  },
  "time": {
    "mode": "manual",
    "value": "22:00",
    "period": "night"
  },
  "maintenance": false,
  "global_message": ""
}
```

### 6. Tornar sua conta administradora

Após criar sua conta no jogo, vá no Firestore:
- `users > {seu_uid} > role` → mude de `"player"` para `"admin"`

### 7. Rodar em desenvolvimento
```bash
npm run dev
```
Acesse: `http://localhost:5173`

---

## 📁 Estrutura do Projeto

```
src/
├── components/
│   ├── HUD.jsx          # Barra superior do jogo (clima, botões)
│   └── DiceRoller.jsx   # Sistema de dados com histórico em tempo real
├── contexts/
│   └── AuthContext.jsx  # Auth + dados do personagem
├── firebase/
│   └── config.js        # Inicialização Firebase
├── pages/
│   ├── Login.jsx        # Tela de login
│   ├── Register.jsx     # Cadastro + criação de personagem (2 etapas)
│   ├── Location.jsx     # Página principal do jogo (locação + chat)
│   ├── Character.jsx    # Perfil do personagem logado
│   └── Characters.jsx   # Diretório de todos os sobreviventes
└── styles/
    └── globals.css      # Todos os estilos (glassmorphism theme)
```

---

## 🎮 Funcionalidades do MVP

| Funcionalidade | Status |
|---|---|
| Login / Cadastro com Firebase Auth | ✅ |
| Criação de personagem (nome, idade, avatar, atributos) | ✅ |
| Página de personagem com inventário | ✅ |
| Diretório de sobreviventes | ✅ |
| HUD com clima/hora em tempo real | ✅ |
| Locação com chat xat.com (iframe) | ✅ |
| Sistema de busca de recursos (loot aleatório) | ✅ |
| Cooldown de loot por locação | ✅ |
| Sistema de dados: d4, d6, d10, d20, d100 | ✅ |
| Histórico de dados em tempo real | ✅ |
| Botões de navegação entre locações | ✅ |

---

## 🌐 Deploy no Vercel

1. Envie o projeto para um repositório GitHub
2. Acesse [vercel.com](https://vercel.com) e importe o repositório
3. Configure as variáveis de ambiente (as mesmas do `.env`)
4. Deploy automático! 🎉

---

## 📋 Próximas Funcionalidades (Fase 2)

- [ ] Dashboard admin para gerenciar locações sem mexer em código
- [ ] Transferência de itens entre jogadores
- [ ] Mapa interativo com locações clicáveis
- [ ] Sistema de XP e level up
- [ ] Página de perfil público de outros personagens

---

## 🎨 Estética

Glassmorphism com paleta verde pós-apocalíptico:
- **Acento principal**: `#5cff7a` (verde sobrevivente)
- **Fundo**: `#080e08` (quase preto esverdeado)
- **Glass panels**: `rgba(8, 20, 8, 0.70)` + `backdrop-filter: blur(18px)`
- **Fontes**: Inter (UI), Oswald (títulos), Share Tech Mono (números)
