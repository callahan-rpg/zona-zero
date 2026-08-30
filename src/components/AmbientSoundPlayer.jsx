import { useEffect, useRef, useState } from 'react'
import { extractYouTubeId } from '../utils/audioSystem'

/**
 * AmbientSoundPlayer: Gerencia reprodução contínua e simultânea de:
 * 1. Som de Clima (Chuva, Tempestade, Vento, etc.) com distinção Indoor/Outdoor e Crossfade de 3.8s
 * 2. Som Específico do Local / Sala (ex: feira, mercado, corredores de hospital, barulho de máquinas)
 * 
 * Ambos os sons tocam em harmonia e simultaneamente com volume balanceado e respeitando o controle do usuário.
 */
export default function AmbientSoundPlayer({ condition = 'sunny', isIndoor = false, weatherSounds = {}, locationSoundUrl = '', disableWeatherSound = false }) {
  const [ambientAudioEnabled, setAmbientAudioEnabled] = useState(() => {
    return localStorage.getItem('zz_ambient_audio') === 'true'
  })
  const [userVolume, setUserVolume] = useState(() => {
    const saved = localStorage.getItem('zz_audio_volume')
    return saved ? Number(saved) : 50
  })

  const containerRef = useRef(null)
  
  // Players de Clima (Deck A e Deck B para crossfade suave)
  const weatherPlayersRef = useRef({ A: null, B: null })
  const activeWeatherDeckRef = useRef('A')
  
  // Player dedicado para o Som Específico do Local
  const locationPlayerRef = useRef(null)
  const isInitializedRef = useRef(false)

  const currentWeatherVideoIdRef = useRef(null)
  const currentLocationVideoIdRef = useRef(null)
  const targetVolumeRef = useRef(userVolume)
  const weatherFadeIntervalRef = useRef(null)
  const locationFadeIntervalRef = useRef(null)

  targetVolumeRef.current = userVolume

  // 1. Escuta eventos customizados de configuração (toggle e volume)
  useEffect(() => {
    const handleToggle = (e) => {
      const isEnabled = e.detail !== undefined ? e.detail : localStorage.getItem('zz_ambient_audio') === 'true'
      setAmbientAudioEnabled(isEnabled)
    }

    const handleVolume = (e) => {
      const vol = e.detail !== undefined ? Number(e.detail) : Number(localStorage.getItem('zz_audio_volume') || 50)
      setUserVolume(vol)
      
      // Atualiza volume do clima
      if (!weatherFadeIntervalRef.current) {
        const activePlayer = weatherPlayersRef.current[activeWeatherDeckRef.current]
        if (activePlayer && typeof activePlayer.setVolume === 'function') {
          activePlayer.setVolume(vol)
        }
      }

      // Atualiza volume do som da locação
      if (!locationFadeIntervalRef.current && locationPlayerRef.current && typeof locationPlayerRef.current.setVolume === 'function') {
        locationPlayerRef.current.setVolume(vol)
      }
    }

    window.addEventListener('ambient_audio_toggle', handleToggle)
    window.addEventListener('audio_volume_change', handleVolume)

    return () => {
      window.removeEventListener('ambient_audio_toggle', handleToggle)
      window.removeEventListener('audio_volume_change', handleVolume)
    }
  }, [])

  // 2. Desbloqueador de Autoplay para navegadores
  useEffect(() => {
    const unlockAudio = () => {
      if (!ambientAudioEnabled) return

      // Tenta retomar som de clima
      const activeWeatherPlayer = weatherPlayersRef.current[activeWeatherDeckRef.current]
      if (activeWeatherPlayer && typeof activeWeatherPlayer.getPlayerState === 'function') {
        const state = activeWeatherPlayer.getPlayerState()
        if (state !== window.YT?.PlayerState?.PLAYING && currentWeatherVideoIdRef.current) {
          try {
            activeWeatherPlayer.playVideo()
            activeWeatherPlayer.setVolume(targetVolumeRef.current)
          } catch (e) {}
        }
      }

      // Tenta retomar som da locação
      if (locationPlayerRef.current && typeof locationPlayerRef.current.getPlayerState === 'function') {
        const state = locationPlayerRef.current.getPlayerState()
        if (state !== window.YT?.PlayerState?.PLAYING && currentLocationVideoIdRef.current) {
          try {
            locationPlayerRef.current.playVideo()
            locationPlayerRef.current.setVolume(targetVolumeRef.current)
          } catch (e) {}
        }
      }
    }

    window.addEventListener('pointerdown', unlockAudio, { once: true })
    window.addEventListener('keydown', unlockAudio, { once: true })

    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [ambientAudioEnabled])

  // 3. Inicialização dos Players na API do YouTube
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)

      window.onYouTubeIframeAPIReady = () => {
        initAllPlayers()
      }
    } else if (window.YT && window.YT.Player) {
      initAllPlayers()
    }
  }, [])

  function createPlayerInstance(elementId, onReadyCallback) {
    const placeholder = document.createElement('div')
    placeholder.id = elementId
    containerRef.current.appendChild(placeholder)

    return new window.YT.Player(elementId, {
      height: '10',
      width: '10',
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        loop: 1,
        iv_load_policy: 3
      },
      events: {
        onReady: (event) => {
          event.target.setVolume(0)
          if (onReadyCallback) onReadyCallback(event)
        },
        onStateChange: (event) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            event.target.playVideo()
          }
        }
      }
    })
  }

  function initAllPlayers() {
    if (isInitializedRef.current || !containerRef.current) return
    isInitializedRef.current = true

    try {
      // Players de Clima (Deck A e Deck B)
      weatherPlayersRef.current.A = createPlayerInstance('ambient-yt-weather-a', () => {
        updateWeatherPlayback()
      })
      weatherPlayersRef.current.B = createPlayerInstance('ambient-yt-weather-b')

      // Player de Som Específico da Sala/Locação
      locationPlayerRef.current = createPlayerInstance('ambient-yt-location', () => {
        updateLocationPlayback()
      })
    } catch (err) {
      console.warn('Erro ao inicializar YouTube Players:', err)
    }
  }

  // ============================================================
  // LÓGICA DE ÁUDIO DO CLIMA (WEATHER)
  // ============================================================
  const soundConfig = weatherSounds?.[condition]
  const rawWeatherUrl = isIndoor
    ? (soundConfig?.indoor || soundConfig?.outdoor)
    : (soundConfig?.outdoor || soundConfig?.indoor)
  // Se a locação atual tiver desativado o som do clima, anula o targetVideoId
  const targetWeatherVideoId = disableWeatherSound ? null : extractYouTubeId(rawWeatherUrl)

  function executeWeatherCrossfade(fromPlayer, toPlayer, targetVol, durationMs = 3800, onComplete) {
    if (weatherFadeIntervalRef.current) {
      clearInterval(weatherFadeIntervalRef.current)
      weatherFadeIntervalRef.current = null
    }

    const steps = 30
    const stepTime = durationMs / steps
    let currentStep = 0

    let fromStartVol = targetVol
    try {
      if (fromPlayer && typeof fromPlayer.getVolume === 'function') {
        fromStartVol = fromPlayer.getVolume()
      }
    } catch (e) {}

    if (toPlayer) {
      try {
        toPlayer.setVolume(0)
        toPlayer.playVideo()
      } catch (e) {}
    }

    weatherFadeIntervalRef.current = setInterval(() => {
      currentStep++
      const progress = Math.min(1, currentStep / steps)
      const fadeOutVol = Math.max(0, Math.round(fromStartVol * Math.cos(progress * 0.5 * Math.PI)))
      const fadeInVol = Math.min(100, Math.round(targetVol * Math.sin(progress * 0.5 * Math.PI)))

      try {
        if (fromPlayer && typeof fromPlayer.setVolume === 'function') fromPlayer.setVolume(fadeOutVol)
      } catch (e) {}

      try {
        if (toPlayer && typeof toPlayer.setVolume === 'function') toPlayer.setVolume(fadeInVol)
      } catch (e) {}

      if (currentStep >= steps) {
        clearInterval(weatherFadeIntervalRef.current)
        weatherFadeIntervalRef.current = null

        try {
          if (fromPlayer && typeof fromPlayer.pauseVideo === 'function') {
            fromPlayer.pauseVideo()
            fromPlayer.setVolume(0)
          }
        } catch (e) {}

        try {
          if (toPlayer && typeof toPlayer.setVolume === 'function') toPlayer.setVolume(targetVol)
        } catch (e) {}

        if (onComplete) onComplete()
      }
    }, stepTime)
  }

  function executeWeatherFadeOut(player, durationMs = 3000, onComplete) {
    if (weatherFadeIntervalRef.current) {
      clearInterval(weatherFadeIntervalRef.current)
      weatherFadeIntervalRef.current = null
    }

    if (!player || typeof player.setVolume !== 'function') {
      if (onComplete) onComplete()
      return
    }

    let startVol = targetVolumeRef.current
    try { startVol = player.getVolume() } catch (e) {}

    const steps = 25
    const stepTime = durationMs / steps
    let currentStep = 0

    weatherFadeIntervalRef.current = setInterval(() => {
      currentStep++
      const progress = Math.min(1, currentStep / steps)
      const currentVol = Math.max(0, Math.round(startVol * (1 - progress)))

      try {
        if (player && typeof player.setVolume === 'function') player.setVolume(currentVol)
      } catch (e) {}

      if (currentStep >= steps) {
        clearInterval(weatherFadeIntervalRef.current)
        weatherFadeIntervalRef.current = null
        try {
          player.pauseVideo()
          player.setVolume(0)
        } catch (e) {}
        if (onComplete) onComplete()
      }
    }, stepTime)
  }

  const updateWeatherPlayback = () => {
    const currentDeck = activeWeatherDeckRef.current
    const nextDeck = currentDeck === 'A' ? 'B' : 'A'

    const activePlayer = weatherPlayersRef.current[currentDeck]
    const nextPlayer = weatherPlayersRef.current[nextDeck]

    if (!activePlayer || typeof activePlayer.getPlayerState !== 'function') return

    if (!ambientAudioEnabled || !targetWeatherVideoId) {
      if (currentWeatherVideoIdRef.current) {
        currentWeatherVideoIdRef.current = null
        executeWeatherFadeOut(activePlayer, 3200)
      }
      return
    }

    if (currentWeatherVideoIdRef.current !== targetWeatherVideoId) {
      const isInitialPlay = currentWeatherVideoIdRef.current === null
      currentWeatherVideoIdRef.current = targetWeatherVideoId

      if (isInitialPlay) {
        try {
          activePlayer.setVolume(0)
          activePlayer.loadVideoById({ videoId: targetWeatherVideoId, startSeconds: 0 })
          activePlayer.playVideo()
          executeWeatherCrossfade(null, activePlayer, targetVolumeRef.current, 2500)
        } catch (e) {}
      } else if (nextPlayer && typeof nextPlayer.loadVideoById === 'function') {
        try {
          nextPlayer.setVolume(0)
          nextPlayer.loadVideoById({ videoId: targetWeatherVideoId, startSeconds: 0 })
          executeWeatherCrossfade(activePlayer, nextPlayer, targetVolumeRef.current, 3800, () => {
            activeWeatherDeckRef.current = nextDeck
          })
        } catch (err) {
          console.warn('Erro crossfade clima:', err)
        }
      }
    } else {
      try {
        const state = activePlayer.getPlayerState()
        if (state !== window.YT?.PlayerState?.PLAYING && state !== window.YT?.PlayerState?.BUFFERING) {
          activePlayer.playVideo()
          executeWeatherCrossfade(null, activePlayer, targetVolumeRef.current, 2500)
        }
      } catch (e) {}
    }
  }

  useEffect(() => {
    updateWeatherPlayback()
  }, [ambientAudioEnabled, targetWeatherVideoId, condition, isIndoor])

  // ============================================================
  // LÓGICA DE ÁUDIO ESPECÍFICO DO LUGAR (LOCATION SOUND)
  // ============================================================
  const targetLocationVideoId = extractYouTubeId(locationSoundUrl)

  function executeLocationFade(player, targetVol, durationMs = 2800, onComplete) {
    if (locationFadeIntervalRef.current) {
      clearInterval(locationFadeIntervalRef.current)
      locationFadeIntervalRef.current = null
    }

    if (!player || typeof player.setVolume !== 'function') {
      if (onComplete) onComplete()
      return
    }

    let startVol = 0
    try { startVol = player.getVolume() } catch (e) {}

    const steps = 25
    const stepTime = durationMs / steps
    let currentStep = 0

    locationFadeIntervalRef.current = setInterval(() => {
      currentStep++
      const progress = Math.min(1, currentStep / steps)
      const currentVol = Math.round(startVol + (targetVol - startVol) * progress)

      try {
        if (player && typeof player.setVolume === 'function') player.setVolume(currentVol)
      } catch (e) {}

      if (currentStep >= steps) {
        clearInterval(locationFadeIntervalRef.current)
        locationFadeIntervalRef.current = null
        try {
          player.setVolume(targetVol)
          if (targetVol === 0) player.pauseVideo()
        } catch (e) {}
        if (onComplete) onComplete()
      }
    }, stepTime)
  }

  const updateLocationPlayback = () => {
    const player = locationPlayerRef.current
    if (!player || typeof player.getPlayerState !== 'function') return

    // Se áudio desativado ou lugar não tiver som específico configurado
    if (!ambientAudioEnabled || !targetLocationVideoId) {
      if (currentLocationVideoIdRef.current) {
        currentLocationVideoIdRef.current = null
        executeLocationFade(player, 0, 2500)
      }
      return
    }

    // Se mudou de sala e o novo lugar tem outro som específico
    if (currentLocationVideoIdRef.current !== targetLocationVideoId) {
      currentLocationVideoIdRef.current = targetLocationVideoId

      try {
        // Fade out rápido do anterior e carrega o novo
        executeLocationFade(player, 0, 1200, () => {
          try {
            player.loadVideoById({ videoId: targetLocationVideoId, startSeconds: 0 })
            player.playVideo()
            executeLocationFade(player, targetVolumeRef.current, 2800)
          } catch (e) {}
        })
      } catch (err) {
        console.warn('Erro ao reproduzir som específico do lugar:', err)
      }
    } else {
      try {
        const state = player.getPlayerState()
        if (state !== window.YT?.PlayerState?.PLAYING && state !== window.YT?.PlayerState?.BUFFERING) {
          player.playVideo()
          executeLocationFade(player, targetVolumeRef.current, 2000)
        }
      } catch (e) {}
    }
  }

  useEffect(() => {
    updateLocationPlayback()
  }, [ambientAudioEnabled, targetLocationVideoId])

  // Limpeza geral
  useEffect(() => {
    return () => {
      if (weatherFadeIntervalRef.current) clearInterval(weatherFadeIntervalRef.current)
      if (locationFadeIntervalRef.current) clearInterval(locationFadeIntervalRef.current)
      
      Object.values(weatherPlayersRef.current).forEach(p => {
        if (p && typeof p.destroy === 'function') {
          try { p.destroy() } catch (e) {}
        }
      })
      weatherPlayersRef.current = { A: null, B: null }

      if (locationPlayerRef.current && typeof locationPlayerRef.current.destroy === 'function') {
        try { locationPlayerRef.current.destroy() } catch (e) {}
        locationPlayerRef.current = null
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        bottom: -9999,
        left: -9999,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
        zIndex: -1
      }}
      aria-hidden="true"
    />
  )
}
