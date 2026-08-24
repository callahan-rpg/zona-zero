# 📋 Lista de Tarefas — Fase 2 (Mecânicas Core)

- [x] **Transferência de Itens**
  - [x] Criar modal de transferência no inventário do jogador (`Character.jsx`)
  - [x] Implementar busca de sobreviventes destinatários
  - [x] Validar quantidade e itens no Firestore (transação ou escrita atômica)
  - [x] Testar fluxo de envio de item

- [x] **Rota e Proteção de Administrador**
  - [x] Criar `AdminRoute` no `App.jsx` para restringir acesso baseado no campo `role`
  - [x] Criar página principal do dashboard admin (`/admin`) com layout glassmorphism

- [x] **Painel Administrativo: Clima e Hora**
  - [x] Adicionar controles para alterar a condição do tempo, temperatura e horário
  - [x] Conectar os inputs diretamente ao documento `game_config/global` no Firestore

- [x] **Painel Administrativo: Gestão de Locações (CRUD)**
  - [x] Tela de listagem e criação de locações no admin
  - [x] Formulário para configurar slug, nome, imagem de fundo, URL do xat.com e botões de navegação

- [x] **Painel Administrativo: Gestão de Sobreviventes**
  - [x] Exibir lista de jogadores cadastrados no painel admin
  - [x] Permitir conceder XP, alterar nível e manipular inventário (adicionar/remover itens)

- [x] **Mapa Interativo**
  - [x] Criar página do mapa (`/map`)
  - [x] Exibir marcadores para cada locação ativa do Firestore
  - [x] Atualizar a localização atual do jogador no Firestore ao clicar em um ponto do mapa
