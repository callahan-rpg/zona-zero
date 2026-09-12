import { useState, useEffect } from 'react'
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { uploadImageFree } from '../utils/imageUpload'

// Presets padrões inspirados na imagem de referência do fórum
export const DEFAULT_FORUM_TOPICS = [
  {
    id: 'anuncios-oficiais',
    title: 'Anúncios Oficiais',
    icon: '📢',
    subtitle: 'Público · Informações Importantes',
    coverImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    description: 'Comunicados oficiais, atualizações, notas de patch e avisos da administração do RPG.',
    pinnedMessage: '👋 Bem-vindos ao canal de Anúncios Oficiais! Aqui publicamos todas as atualizações de mecânicas, avisos de manutenções e novidades do Zona Zero RPG. Acompanhem com frequência!',
    pinnedAuthorName: 'Mestre / Administração',
    order: 1
  },
  {
    id: 'sugestoes-melhorias',
    title: 'Sugestões & Melhorias',
    icon: '💡',
    subtitle: 'Público · Comunidade Criativa',
    coverImage: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=1200&q=80',
    description: 'Espaço aberto para compartilhar ideias de novas mecânicas, itens, balanceamento e melhorias no sistema.',
    pinnedMessage: '💡 Tem alguma ideia incrível para o RPG? Novas receitas, profissões, locais ou balanceamento? Deixe sua sugestão abaixo comentando neste tópico para a equipe avaliar!',
    pinnedAuthorName: 'Mestre / Administração',
    order: 2
  },
  {
    id: 'reportar-bugs',
    title: 'Reportar Bugs',
    icon: '🐞',
    subtitle: 'Público · Suporte Técnico',
    coverImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    description: 'Encontrou algum erro, botão quebrado ou comportamento inesperado? Descreva para que possamos corrigir rapidamente.',
    pinnedMessage: '🐞 Encontrou um problema ou falha técnica no RPG? Por favor, detalhe abaixo: 1) O que você estava fazendo, 2) Qual erro apareceu, 3) Se possível print ou o dispositivo que estava usando.',
    pinnedAuthorName: 'Mestre / Administração',
    order: 3
  },
  {
    id: 'duvidas-ajuda',
    title: 'Dúvidas & Ajuda',
    icon: '❓',
    subtitle: 'Público · Guia de Sobrevivência',
    coverImage: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=80',
    description: 'Tire dúvidas sobre regras, cálculos, inventário, sobrevivência e funcionamento das salas do jogo.',
    pinnedMessage: '❓ Não sabe como funciona o sistema de pesca, hortas, combate ou transferências? Pergunte aqui abaixo e outros jogadores e narradores responderão suas dúvidas!',
    pinnedAuthorName: 'Mestre / Administração',
    order: 4
  },
  {
    id: 'bate-papo-geral',
    title: 'SOM RPG - Bate Papo Geral',
    icon: '👥',
    subtitle: 'Público · Conversas Off-Topic',
    coverImage: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
    description: 'Área de convivência off-topic da comunidade para conversas descontraídas entre os jogadores.',
    pinnedMessage: '👥 Espaço livre para interagir com a comunidade fora do roleplay! Lembre-se sempre de manter o respeito mútuo e a cordialidade com todos os participantes.',
    pinnedAuthorName: 'Mestre / Administração',
    order: 5
  }
]

const EMPTY_FORM = {
  id: '',
  title: '',
  icon: '💬',
  subtitle: 'Público',
  coverImage: '',
  description: '',
  pinnedMessage: '',
  pinnedAuthorName: 'Mestre / Administração',
  order: 1
}

export default function AdminForumEditor() {
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Escuta tópicos de /forum_topics
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'forum_topics'), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      docs.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      setTopics(docs)
      setLoading(false)
    }, (err) => {
      console.error('Erro ao carregar tópicos do fórum:', err)
      setLoading(false)
    })
    return unsub
  }, [])

  function handleStartEdit(topic) {
    setEditingId(topic.id)
    setForm({
      id: topic.id,
      title: topic.title || '',
      icon: topic.icon || '💬',
      subtitle: topic.subtitle || 'Público',
      coverImage: topic.coverImage || '',
      description: topic.description || '',
      pinnedMessage: topic.pinnedMessage || '',
      pinnedAuthorName: topic.pinnedAuthorName || 'Mestre / Administração',
      order: topic.order !== undefined ? Number(topic.order) : 1
    })
  }

  function handleCancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.title.trim()) return alert('Informe o título do tópico/grupo.')
    
    const cleanId = (form.id || form.title)
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-_]/g, '-')

    const payload = {
      id: cleanId,
      title: form.title.trim(),
      icon: form.icon.trim() || '💬',
      subtitle: form.subtitle.trim() || 'Público',
      coverImage: form.coverImage.trim(),
      description: form.description.trim(),
      pinnedMessage: form.pinnedMessage.trim(),
      pinnedAuthorName: form.pinnedAuthorName.trim() || 'Mestre / Administração',
      order: Number(form.order) || 1,
      updatedAt: new Date().toISOString()
    }

    try {
      setSaving(true)
      await setDoc(doc(db, 'forum_topics', cleanId), payload, { merge: true })
      alert(`Tópico "${payload.title}" salvo com sucesso!`)
      handleCancelEdit()
    } catch (err) {
      alert('Erro ao salvar tópico: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(topic) {
    if (!confirm(`Deseja realmente excluir o tópico "${topic.title}"? Todas as postagens dele continuarão salvas ou poderão ser arquivadas.`)) return
    try {
      await deleteDoc(doc(db, 'forum_topics', topic.id))
      alert('Tópico excluído!')
      if (editingId === topic.id) handleCancelEdit()
    } catch (err) {
      alert('Erro ao excluir: ' + err.message)
    }
  }

  // Semeador de 1-clique dos 5 tópicos padrão da referência
  async function handleSeedDefaults() {
    if (!confirm('Deseja criar/atualizar os 5 tópicos principais do Fórum (Anúncios, Sugestões, Bugs, Dúvidas e Bate-Papo)?')) return
    try {
      setSaving(true)
      const batch = writeBatch(db)
      DEFAULT_FORUM_TOPICS.forEach(topic => {
        const ref = doc(db, 'forum_topics', topic.id)
        batch.set(ref, {
          ...topic,
          updatedAt: new Date().toISOString()
        }, { merge: true })
      })
      await batch.commit()
      alert('Tópicos criados com sucesso!')
    } catch (err) {
      alert('Erro ao semear tópicos: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Cabeçalho da Tab */}
      <div className="glass-light" style={{ padding: '16px 20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: 1 }}>
            💬 Gerenciador do Fórum & Grupos da Comunidade
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
            Crie e organize os tópicos onde os sobreviventes podem conversar, postar sugestões, reportar bugs e tirar dúvidas.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href="/forum"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm"
            style={{
              background: 'rgba(56, 189, 248, 0.15)',
              borderColor: '#38bdf8',
              color: '#7dd3fc',
              fontWeight: 700,
              fontSize: 11,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            ↗ Abrir Fórum no Jogo
          </a>

          <button
            type="button"
            className="btn btn-sm"
            onClick={handleSeedDefaults}
            disabled={saving}
            style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.3) 100%)',
              borderColor: '#f59e0b',
              color: '#fde047',
              fontWeight: 700,
              fontSize: 11
            }}
          >
            ⚡ Criar Tópicos Padrão da Imagem (1-Click)
          </button>
        </div>
      </div>

      {/* Grid Principal: Listagem à Esquerda, Formulário à Direita */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
        
        {/* Coluna Esquerda: Tópicos Cadastrados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
              Tópicos e Grupos Ativos ({topics.length})
            </span>
          </div>

          {loading ? (
            <div className="glass-light" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
              ⏳ Carregando tópicos do fórum...
            </div>
          ) : topics.length === 0 ? (
            <div className="glass-light" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhum tópico cadastrado. Clique no botão <strong>"Criar Tópicos Padrão"</strong> acima para preencher instantaneamente!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '650px', overflowY: 'auto' }}>
              {topics.map(topic => {
                const isEditing = editingId === topic.id
                return (
                  <div
                    key={topic.id}
                    className="glass-light"
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: isEditing ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.06)',
                      background: isEditing ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255,255,255,0.02)',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center'
                    }}
                  >
                    {/* Capa */}
                    <div style={{
                      width: 80,
                      height: 50,
                      borderRadius: 6,
                      overflow: 'hidden',
                      background: 'rgba(0,0,0,0.5)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      flexShrink: 0
                    }}>
                      {topic.coverImage ? (
                        <img src={topic.coverImage} alt={topic.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 20 }}>
                          {topic.icon || '💬'}
                        </div>
                      )}
                    </div>

                    {/* Informações */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{topic.icon || '💬'}</span>
                        <strong style={{ fontSize: 13, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {topic.title}
                        </strong>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        Ordem: #{topic.order || 1} · {topic.subtitle || 'Público'}
                      </div>
                      {topic.description && (
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {topic.description}
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => handleStartEdit(topic)}
                        style={{ fontSize: 10, padding: '4px 8px' }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(topic)}
                        style={{ fontSize: 10, padding: '4px 8px' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Coluna Direita: Formulário de Criação / Edição */}
        <form
          onSubmit={handleSave}
          className="glass-light"
          style={{
            padding: 18,
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            height: 'fit-content'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: '#38bdf8', margin: 0 }}>
              {editingId ? '✏️ Editar Tópico' : '➕ Novo Tópico de Fórum'}
            </h4>
            {editingId && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleCancelEdit}
                style={{ fontSize: 10, padding: '2px 8px' }}
              >
                Cancelar
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 8 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 10 }}>Ícone/Emoji</label>
              <input
                type="text"
                value={form.icon}
                onChange={e => setForm(prev => ({ ...prev, icon: e.target.value }))}
                style={{ textAlign: 'center' }}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 10 }}>Título do Tópico / Grupo</label>
              <input
                type="text"
                placeholder="Ex: Anúncios Oficiais"
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 10 }}>Subtítulo / Rótulo (Ex: Público)</label>
              <input
                type="text"
                placeholder="Ex: Público · Comunidade"
                value={form.subtitle}
                onChange={e => setForm(prev => ({ ...prev, subtitle: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 10 }}>Ordem</label>
              <input
                type="number"
                value={form.order}
                onChange={e => setForm(prev => ({ ...prev, order: e.target.value }))}
                style={{ textAlign: 'center' }}
              />
            </div>
          </div>

          {/* Imagem de Capa do Card */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span>🖼️ Imagem de Capa (Card)</span>
              {form.coverImage && <span style={{ color: '#4ade80' }}>✓ Imagem Definida</span>}
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Cole a URL ou faça upload..."
                value={form.coverImage}
                onChange={e => setForm(prev => ({ ...prev, coverImage: e.target.value }))}
                style={{ flex: 1, fontSize: 11 }}
              />
              <label
                className="btn btn-sm"
                style={{
                  cursor: uploadingImage ? 'wait' : 'pointer',
                  fontSize: 10,
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(14, 165, 233, 0.3) 100%)',
                  border: '1px solid #38bdf8',
                  color: '#7dd3fc',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
              >
                {uploadingImage ? '⏳ Enviando...' : '📤 Upload'}
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingImage}
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      setUploadingImage(true)
                      const url = await uploadImageFree(file)
                      if (url) {
                        setForm(prev => ({ ...prev, coverImage: url }))
                      }
                    } catch (err) {
                      alert('Falha no upload: ' + err.message)
                    } finally {
                      setUploadingImage(false)
                    }
                  }}
                />
              </label>
            </div>
            {form.coverImage && (
              <div style={{ marginTop: 6, borderRadius: 6, overflow: 'hidden', height: 75, background: '#000', border: '1px solid rgba(255,255,255,0.1)' }}>
                <img src={form.coverImage} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 10 }}>Descrição Breve do Grupo</label>
            <textarea
              rows={2}
              placeholder="Ex: Espaço para sugestões de mecânicas e melhorias..."
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              style={{ fontSize: 11 }}
            />
          </div>

          {/* Postagem Fixada (Pinned) da Administração */}
          <div style={{ background: 'rgba(251, 191, 36, 0.05)', border: '1px solid rgba(251, 191, 36, 0.25)', borderRadius: 8, padding: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', display: 'block', marginBottom: 4 }}>
              📌 Mensagem Fixada da Administração (Exibida no Topo)
            </label>
            <div className="form-group" style={{ marginBottom: 6 }}>
              <input
                type="text"
                placeholder="Nome do Autor (ex: Mestre / Administração)"
                value={form.pinnedAuthorName}
                onChange={e => setForm(prev => ({ ...prev, pinnedAuthorName: e.target.value }))}
                style={{ fontSize: 11 }}
              />
            </div>
            <textarea
              rows={3}
              placeholder="Texto da mensagem fixada de boas-vindas ou instruções..."
              value={form.pinnedMessage}
              onChange={e => setForm(prev => ({ ...prev, pinnedMessage: e.target.value }))}
              style={{ fontSize: 11 }}
            />
            <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
              Esta mensagem ficará destacada no início do tópico e os jogadores comentarão logo abaixo.
            </span>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ width: '100%', marginTop: 4 }}
          >
            {saving ? 'Gravando...' : editingId ? '💾 Salvar Alterações do Tópico' : '➕ Criar Tópico'}
          </button>
        </form>
      </div>
    </div>
  )
}
