import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { uploadImageFree } from '../utils/imageUpload'
import { extractYouTubeId } from '../utils/audioSystem'
import NarrativeOpeningModal from './NarrativeOpeningModal.jsx'

/**
 * Verifica se a URL é link direto de áudio (MP3/WAV/OGG/AAC/Catbox/Cloud)
 */
function isDirectAudioUrl(url) {
  if (!url || typeof url !== 'string') return false
  const clean = url.trim().toLowerCase()
  if (clean.includes('youtube.com') || clean.includes('youtu.be')) return false
  return (
    clean.startsWith('http://') ||
    clean.startsWith('https://') ||
    clean.startsWith('data:audio/') ||
    clean.startsWith('blob:')
  )
}

export default function AdminNarrativeEditor() {
  const [openingConfig, setOpeningConfig] = useState({
    active: true,
    title: 'O Despertar em Varezhia',
    imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1920&q=80',
    content: 'O som distante de sirenes há muito cessou. As ruas de Varezhia, outrora vibrantes, agora pertencem às sombras e àqueles que não descansam em paz.\n\nVocê acorda entre os escombros, com poucas memórias do colapso e apenas o instinto básico de respirar. Cada esquina esconde perigos inimagináveis, mas também a esperança tênue de sobrevivência.\n\nReúna seus pertences, mantenha o silêncio e prepare-se. Seu destino começa agora.',
    musicUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=dark-ambient-atmospheric-background-112194.mp3',
    musicVolume: 70,
    buttonText: 'Entrar em Varezhia',
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Testador de áudio no próprio painel
  const [isPlayingTestAudio, setIsPlayingTestAudio] = useState(false)
  const testAudioRef = useRef(null)

  // Escuta configurações do Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'game_config', 'opening'), (snap) => {
      if (snap.exists()) {
        setOpeningConfig(prev => ({ ...prev, ...snap.data() }))
      }
      setLoading(false)
    }, (err) => {
      console.warn('Erro ao escutar game_config/opening:', err)
      setLoading(false)
    })
    return () => {
      unsub()
      if (testAudioRef.current) {
        testAudioRef.current.pause()
        testAudioRef.current = null
      }
    }
  }, [])

  // Parar teste de áudio se URL mudar
  useEffect(() => {
    if (testAudioRef.current) {
      testAudioRef.current.pause()
      testAudioRef.current = null
      setIsPlayingTestAudio(false)
    }
  }, [openingConfig.musicUrl])

  // Upload gratuito de imagem
  async function handleImageFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const url = await uploadImageFree(file)
      setOpeningConfig(prev => ({ ...prev, imageUrl: url }))
    } catch (err) {
      alert('Erro no upload da imagem: ' + err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  // Alterna teste de reprodução de áudio direto no painel
  function toggleTestAudio() {
    if (isPlayingTestAudio) {
      if (testAudioRef.current) {
        testAudioRef.current.pause()
        testAudioRef.current = null
      }
      setIsPlayingTestAudio(false)
      return
    }

    if (!openingConfig.musicUrl?.trim()) {
      alert('Insira uma URL de áudio ou link de música primeiro.')
      return
    }

    if (isDirectAudioUrl(openingConfig.musicUrl)) {
      try {
        const audio = new Audio(openingConfig.musicUrl.trim())
        testAudioRef.current = audio
        audio.volume = Math.max(0, Math.min(1, (openingConfig.musicVolume || 70) / 100))
        audio.play()
          .then(() => setIsPlayingTestAudio(true))
          .catch((err) => {
            alert('Não foi possível reproduzir este áudio. Verifique se o link direto está acessível: ' + err.message)
            setIsPlayingTestAudio(false)
          })

        audio.onended = () => setIsPlayingTestAudio(false)
      } catch (err) {
        alert('Erro ao criar player de áudio: ' + err.message)
      }
    } else {
      alert('Para testar links do YouTube ou ver o resultado final completo, use o botão "👁️ Testar / Pré-visualizar" no topo!')
    }
  }

  // Salvar no Firestore
  async function handleSave(e) {
    if (e) e.preventDefault()
    setSaving(true)
    setSavedSuccess(false)
    try {
      await setDoc(doc(db, 'game_config', 'opening'), {
        active: Boolean(openingConfig.active),
        title: openingConfig.title?.trim() || 'O Começo',
        imageUrl: openingConfig.imageUrl?.trim() || '',
        content: openingConfig.content || '',
        musicUrl: openingConfig.musicUrl?.trim() || '',
        musicVolume: Number(openingConfig.musicVolume) || 70,
        buttonText: openingConfig.buttonText?.trim() || 'Continuar',
        updatedAt: new Date().toISOString(),
      }, { merge: true })

      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 4000)
    } catch (err) {
      alert('Erro ao salvar abertura narrativa: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const isDirectAudio = isDirectAudioUrl(openingConfig.musicUrl)
  const ytId = !isDirectAudio ? extractYouTubeId(openingConfig.musicUrl) : null

  if (loading) {
    return (
      <div className="glass" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
        Carregando configurações da abertura narrativa...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Modal de Pré-visualização */}
      {showPreview && (
        <NarrativeOpeningModal
          config={openingConfig}
          previewMode={true}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Banner de Apresentação e Status */}
      <div className="glass" style={{ padding: 20, borderRadius: 12, border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(245, 158, 11, 0.05))',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24
          }}>
            📖
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
              Abertura Narrativa (Pós-Criação de Ficha)
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Apresentação cinematográfica com imagem, música e texto narrativo exibida <strong>uma única vez</strong> logo após o jogador concluir a criação da ficha.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setShowPreview(true)}
            style={{
              borderColor: 'rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.1)',
              fontWeight: 700,
              padding: '8px 16px'
            }}
          >
            👁️ Testar / Pré-visualizar Modal
          </button>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 20,
            background: openingConfig.active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${openingConfig.active ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            fontSize: 12,
            fontWeight: 700,
            color: openingConfig.active ? '#4ade80' : '#f87171'
          }}>
            <span>{openingConfig.active ? '🟢 ATIVA' : '🔴 DESATIVADA'}</span>
          </div>
        </div>
      </div>

      {/* Formulário Principal */}
      <form onSubmit={handleSave} className="glass" style={{ padding: 24, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Toggle Ativar/Desativar */}
        <div style={{
          padding: '14px 18px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--glass-border)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <strong style={{ fontSize: 14, color: '#fff', display: 'block' }}>
              Exibir Abertura Narrativa aos Novos Jogadores
            </strong>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              Se desativado, o jogador irá direto para o local de nascimento logo após criar o personagem.
            </span>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
            <input
              type="checkbox"
              checked={openingConfig.active}
              onChange={(e) => setOpeningConfig(prev => ({ ...prev, active: e.target.checked }))}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#eab308' }}
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: openingConfig.active ? '#fde047' : '#9ca3af' }}>
              {openingConfig.active ? 'Ativada' : 'Desativada'}
            </span>
          </label>
        </div>

        {/* Título & Botão */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
              🏷️ Título da Abertura
            </label>
            <input
              type="text"
              value={openingConfig.title}
              onChange={(e) => setOpeningConfig(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: O Despertar em Varezhia"
              style={{ padding: '10px 14px', fontSize: 13 }}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
              🔘 Texto do Botão de Avançar
            </label>
            <input
              type="text"
              value={openingConfig.buttonText}
              onChange={(e) => setOpeningConfig(prev => ({ ...prev, buttonText: e.target.value }))}
              placeholder="Ex: Entrar em Varezhia"
              style={{ padding: '10px 14px', fontSize: 13 }}
            />
          </div>
        </div>

        {/* Seção Imagem de Destaque */}
        <div style={{
          padding: 16,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--glass-border)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#facc15', margin: 0 }}>
              🖼️ Imagem da Abertura (Upload ou URL)
            </label>
            {uploadingImage && <span style={{ fontSize: 11, color: '#fbbf24' }}>Enviando imagem...</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 14, alignItems: 'center' }}>
            {/* Thumbnail Preview */}
            <div style={{
              width: '100%',
              height: 100,
              borderRadius: 8,
              background: '#0a0a0c',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative'
            }}>
              {openingConfig.imageUrl ? (
                <img
                  src={openingConfig.imageUrl}
                  alt="Prévia"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.onerror = null; e.target.src = ''; }}
                />
              ) : (
                <span style={{ fontSize: 28, color: '#6b7280' }}>🖼️</span>
              )}
            </div>

            {/* Inputs de Imagem */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="text"
                value={openingConfig.imageUrl}
                onChange={(e) => setOpeningConfig(prev => ({ ...prev, imageUrl: e.target.value }))}
                placeholder="https://exemplo.com/imagem-abertura.jpg"
                style={{ padding: '8px 12px', fontSize: 12 }}
              />

              <div style={{ display: 'flex', gap: 8 }}>
                <label className="btn btn-sm" style={{ cursor: 'pointer', fontSize: 11, padding: '4px 12px', background: 'rgba(255,255,255,0.06)' }}>
                  📁 Escolher Imagem do Computador
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageFileChange}
                    disabled={uploadingImage}
                  />
                </label>
                {openingConfig.imageUrl && (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => setOpeningConfig(prev => ({ ...prev, imageUrl: '' }))}
                    style={{ fontSize: 11, padding: '4px 10px' }}
                  >
                    🗑️ Remover
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Seção Música / Áudio */}
        <div style={{
          padding: 16,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--glass-border)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#facc15', margin: 0 }}>
              🎵 Música de Fundo (Áudio Direto MP3 / OGG ou YouTube)
            </label>
            {isDirectAudio && (
              <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700 }}>
                ⚡ Modo Áudio Direto HTML5 Ativo (Mais Estável e Rápido)
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 200px', gap: 12, alignItems: 'center' }}>
            <div>
              <input
                type="text"
                value={openingConfig.musicUrl}
                onChange={(e) => setOpeningConfig(prev => ({ ...prev, musicUrl: e.target.value }))}
                placeholder="https://exemplo.com/musica.mp3 ou link do YouTube"
                style={{ padding: '8px 12px', fontSize: 12, width: '100%' }}
              />
              <span style={{ fontSize: 10.5, color: isDirectAudio ? '#4ade80' : ytId ? '#38bdf8' : 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                {isDirectAudio
                  ? '✅ Link direto de áudio detectado (MP3/WAV/OGG/Web). Reprodução instantânea!'
                  : ytId
                  ? `ℹ️ Link do YouTube detectado (ID: ${ytId})`
                  : 'Cole o link direto do arquivo (.mp3, .ogg, .wav, Discord, Catbox) ou link do YouTube.'}
              </span>
            </div>

            {/* Botão de Testar Áudio no Painel */}
            {isDirectAudio && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={toggleTestAudio}
                style={{
                  background: isPlayingTestAudio ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                  borderColor: isPlayingTestAudio ? '#ef4444' : '#22c55e',
                  color: isPlayingTestAudio ? '#fca5a5' : '#86efac',
                  padding: '8px 14px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
              >
                {isPlayingTestAudio ? '⏹️ Parar' : '▶️ Ouvir'}
              </button>
            )}

            {/* Slider de Volume */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--text-muted)' }}>Volume Padrão:</span>
                <strong style={{ color: '#fff' }}>{openingConfig.musicVolume}%</strong>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={openingConfig.musicVolume}
                onChange={(e) => {
                  const newVol = Number(e.target.value)
                  setOpeningConfig(prev => ({ ...prev, musicVolume: newVol }))
                  if (testAudioRef.current) {
                    testAudioRef.current.volume = newVol / 100
                  }
                }}
                style={{ accentColor: '#eab308' }}
              />
            </div>
          </div>

          {/* Dica de Hospedagem Gratuita de Áudio */}
          <div style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: 6,
            padding: '10px 14px',
            fontSize: 11.5,
            color: '#bae6fd',
            lineHeight: 1.5
          }}>
            <strong>💡 Recomendação de Áudio:</strong> Links diretos de arquivo (como <code>.mp3</code>) tocam sem restrições ou bloqueios dos navegadores.
            Você pode hospedar seus áudios gratuitamente em sites como <strong>Catbox.moe</strong> (basta arrastar o MP3 e copiar o link <code>files.catbox.moe/...mp3</code>), <strong>Discord</strong> (enviando o arquivo e copiando o link do anexo) ou qualquer servidor na nuvem.
          </div>
        </div>

        {/* Texto da Narração */}
        <div className="form-group" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0 }}>
              📜 Texto da Ambientação / Narração
            </label>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {openingConfig.content?.length || 0} caracteres
            </span>
          </div>
          <textarea
            rows={8}
            value={openingConfig.content}
            onChange={(e) => setOpeningConfig(prev => ({ ...prev, content: e.target.value }))}
            placeholder="Escreva aqui a narrativa de ambientação que o jogador lerá ao entrar no mundo..."
            style={{
              padding: '12px 14px',
              fontSize: 13,
              lineHeight: 1.6,
              resize: 'vertical',
              minHeight: 160,
              fontFamily: 'inherit'
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
            💡 Dica: Dê enter duplo entre parágrafos para uma leitura mais fluida e cinematográfica.
          </span>
        </div>

        {/* Rodapé com Botões de Ação */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTop: '1px solid var(--glass-border)', paddingTop: 16 }}>
          <button
            type="button"
            className="btn"
            onClick={() => setShowPreview(true)}
            style={{
              borderColor: 'rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.08)',
              padding: '10px 20px',
              fontSize: 13
            }}
          >
            👁️ Pré-visualizar no Modal Real
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {savedSuccess && (
              <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 700 }}>
                ✅ Configurações salvas com sucesso!
              </span>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ padding: '10px 28px', fontSize: 13, fontWeight: 700 }}
            >
              {saving ? '⏳ Salvando...' : '💾 Salvar Configurações'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
