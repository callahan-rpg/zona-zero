import { useEffect, useRef, useState } from 'react'
import { extractYouTubeId } from '../utils/audioSystem'

/**
 * Verifica se uma URL é um arquivo direto de áudio (MP3, WAV, OGG, Web, Base64, etc.)
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

/**
 * NarrativeOpeningModal
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal de abertura narrativa — exibido uma única vez após a criação da ficha.
 * Suporta áudio direto (MP3 / WAV / OGG / Web Audio) e fallback para YouTube.
 */
export default function NarrativeOpeningModal({
  config = {},
  previewMode = false,
  onComplete,
  onClose,
}) {
  const {
    title       = 'O Começo',
    imageUrl    = '',
    content     = '',
    musicUrl    = '',
    musicVolume = 70,
    buttonText  = 'Continuar',
  } = config

  const [volume, setVolume]   = useState(Number(musicVolume) || 70)
  const [muted, setMuted]     = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [completing, setCompleting] = useState(false)

  const playerContainerRef = useRef(null)
  const ytPlayerRef        = useRef(null)
  const html5AudioRef      = useRef(null)
  const volumeBeforeMute   = useRef(volume)

  const isDirectAudio = isDirectAudioUrl(musicUrl)
  const ytVideoId = !isDirectAudio ? extractYouTubeId(musicUrl) : null
  const hasAudioSource = Boolean(musicUrl?.trim() && (isDirectAudio || ytVideoId))

  // ── 1. Inicializa Áudio Direto (HTML5 Audio) ────────────────────────────────
  useEffect(() => {
    if (!isDirectAudio || !musicUrl) return

    const audio = new Audio()
    html5AudioRef.current = audio
    audio.src = musicUrl.trim()
    audio.loop = true
    audio.volume = Math.max(0, Math.min(1, volume / 100))
    audio.preload = 'auto'

    const playPromise = audio.play()
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true)
        })
        .catch((err) => {
          console.warn('Autoplay direto bloqueado pelo navegador, aguardando clique:', err)
          setIsPlaying(false)
        })
    }

    return () => {
      audio.pause()
      audio.src = ''
      html5AudioRef.current = null
    }
  }, [isDirectAudio, musicUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. Inicializa YouTube Player (Fallback) ──────────────────────────────────
  useEffect(() => {
    if (isDirectAudio || !ytVideoId) return

    let intervalId = null
    let destroyed = false

    function initPlayer() {
      if (destroyed || !playerContainerRef.current || ytPlayerRef.current) return

      try {
        const placeholder = document.createElement('div')
        placeholder.id = 'narrative-yt-player-' + Date.now()
        playerContainerRef.current.appendChild(placeholder)

        ytPlayerRef.current = new window.YT.Player(placeholder.id, {
          height: '200',
          width: '200',
          videoId: ytVideoId,
          playerVars: {
            autoplay:       1,
            controls:       0,
            disablekb:      1,
            fs:             0,
            modestbranding: 1,
            playsinline:    1,
            rel:            0,
            loop:           1,
            playlist:       ytVideoId,
            iv_load_policy: 3,
            origin:         window.location.origin,
            enablejsapi:    1,
          },
          events: {
            onReady: (event) => {
              try {
                event.target.setVolume(volume)
                event.target.unMute()
                event.target.playVideo()
                setIsPlaying(true)
              } catch (e) {
                console.warn('Erro onReady YouTube:', e)
              }
            },
            onStateChange: (event) => {
              if (event.data === window.YT?.PlayerState?.ENDED) {
                try { event.target.playVideo() } catch (_) {}
              }
              if (event.data === window.YT?.PlayerState?.PLAYING) {
                setIsPlaying(true)
              }
            },
          },
        })
      } catch (err) {
        console.warn('Erro ao instanciar YT.Player:', err)
      }
    }

    function checkAndInit() {
      if (window.YT && typeof window.YT.Player === 'function') {
        if (intervalId) {
          clearInterval(intervalId)
          intervalId = null
        }
        initPlayer()
      }
    }

    if (window.YT && typeof window.YT.Player === 'function') {
      initPlayer()
    } else {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        const firstScriptTag = document.getElementsByTagName('script')[0]
        if (firstScriptTag && firstScriptTag.parentNode) {
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
        } else {
          document.head.appendChild(tag)
        }
      }

      intervalId = setInterval(checkAndInit, 100)
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === 'function') prev()
        checkAndInit()
      }
    }

    return () => {
      destroyed = true
      if (intervalId) clearInterval(intervalId)
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.stopVideo()
          ytPlayerRef.current.destroy()
        } catch (_) {}
        ytPlayerRef.current = null
      }
    }
  }, [isDirectAudio, ytVideoId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Controle de Volume ─────────────────────────────────────────────────────
  function handleVolumeChange(newVol) {
    const v = Number(newVol)
    setVolume(v)
    setMuted(v === 0)

    // HTML5 Audio
    if (html5AudioRef.current) {
      html5AudioRef.current.volume = Math.max(0, Math.min(1, v / 100))
      html5AudioRef.current.muted = v === 0
      if (v > 0 && html5AudioRef.current.paused) {
        html5AudioRef.current.play().then(() => setIsPlaying(true)).catch(() => {})
      }
    }

    // YouTube Player
    if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
      try {
        ytPlayerRef.current.setVolume(v)
        if (v > 0) ytPlayerRef.current.unMute()
      } catch (_) {}
    }
  }

  function toggleMute() {
    if (muted) {
      const restore = volumeBeforeMute.current || 70
      handleVolumeChange(restore)
    } else {
      volumeBeforeMute.current = volume
      handleVolumeChange(0)
    }
  }

  // Desbloqueia reprodução garantida ao primeiro toque/clique no modal
  function ensureAudioPlaying() {
    if (html5AudioRef.current && html5AudioRef.current.paused) {
      html5AudioRef.current.volume = Math.max(0, Math.min(1, volume / 100))
      html5AudioRef.current.muted = muted
      html5AudioRef.current.play().then(() => setIsPlaying(true)).catch(() => {})
    }

    if (ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
      try {
        ytPlayerRef.current.setVolume(volume)
        ytPlayerRef.current.unMute()
        ytPlayerRef.current.playVideo()
        setIsPlaying(true)
      } catch (_) {}
    }
  }

  // ── Concluir abertura ──────────────────────────────────────────────────────
  async function handleContinue() {
    if (completing) return
    setCompleting(true)
    if (html5AudioRef.current) {
      try {
        html5AudioRef.current.pause()
        html5AudioRef.current.src = ''
      } catch (_) {}
    }
    if (previewMode) {
      onClose?.()
    } else {
      await onComplete?.()
    }
    setCompleting(false)
  }

  return (
    <div className="narrative-overlay" onClick={ensureAudioPlaying} onTouchStart={ensureAudioPlaying}>
      {/* Container YouTube (apenas se for link do YouTube) */}
      {!isDirectAudio && ytVideoId && (
        <div
          ref={playerContainerRef}
          style={{
            position: 'fixed',
            bottom: 10,
            right: 10,
            width: 10,
            height: 10,
            opacity: 0.001,
            pointerEvents: 'none',
            zIndex: -1,
            overflow: 'hidden'
          }}
          aria-hidden="true"
        />
      )}

      {/* Modal */}
      <div className="narrative-modal" role="dialog" aria-modal="true" aria-label={title}>

        {/* Header com título, badge de preview e botão de fechar */}
        <div className="narrative-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <h2 className="narrative-title">{title}</h2>
            {previewMode && (
              <span className="narrative-preview-badge">👁️ Pré-visualização</span>
            )}
          </div>

          <button
            type="button"
            className="narrative-close-btn"
            onClick={handleContinue}
            disabled={completing}
            title="Fechar"
            aria-label="Fechar popup"
          >
            ✕
          </button>
        </div>

        {/* Corpo: imagem + texto */}
        <div className="narrative-body">

          {/* Coluna Esquerda — Imagem */}
          <div className="narrative-image-col">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Abertura"
                className="narrative-image"
              />
            ) : (
              <div className="narrative-image-placeholder">
                <span>🖼️</span>
                <span>Imagem não configurada</span>
              </div>
            )}
          </div>

          {/* Coluna Direita — Texto scrollável + ações */}
          <div className="narrative-text-col">

            {/* Texto da narração (área scrollável) */}
            <div className="narrative-content">
              {content ? (
                <p className="narrative-content-text">{content}</p>
              ) : (
                <p className="narrative-content-text narrative-content-empty">
                  Nenhuma narração configurada ainda...
                </p>
              )}
            </div>

            {/* Rodapé da coluna: controle de áudio + botão */}
            <div className="narrative-footer">
              {/* Controle de Áudio */}
              {hasAudioSource && (
                <div className="narrative-audio-ctrl">
                  <button
                    type="button"
                    className="narrative-mute-btn"
                    onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                    title={muted ? 'Ativar som' : 'Silenciar'}
                  >
                    {muted || volume === 0 ? '🔇' : volume < 40 ? '🔉' : '🔊'}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => { e.stopPropagation(); handleVolumeChange(e.target.value); }}
                    onClick={(e) => e.stopPropagation()}
                    className="narrative-volume-slider"
                    title={`Volume: ${volume}%`}
                  />
                  <span className="narrative-volume-label">{volume}%</span>
                </div>
              )}

              {/* Botão Continuar */}
              <button
                type="button"
                className="narrative-continue-btn"
                onClick={handleContinue}
                disabled={completing}
              >
                {completing ? '⏳ Aguarde...' : buttonText || 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
