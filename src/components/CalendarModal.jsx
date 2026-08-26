import { useState, useRef, useEffect } from 'react'
import { MONTHS } from '../utils/timeSystem'

export default function CalendarModal({ gameTime, events = [], onClose }) {
  const [selectedMonth, setSelectedMonth] = useState((gameTime?.month ? gameTime.month - 1 : 0))
  const [selectedYear, setSelectedYear] = useState(gameTime?.year || 2026)
  const [hoveredEvent, setHoveredEvent] = useState(null)
  const [selectedDayEvents, setSelectedDayEvents] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // Draggable window state
  const [pos, setPos] = useState({ x: Math.max(20, window.innerWidth / 2 - 260), y: 80 })
  const isDragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Sincroniza mês inicial com o in-game se mudar
  useEffect(() => {
    if (gameTime?.month) {
      setSelectedMonth(gameTime.month - 1)
      setSelectedYear(gameTime.year)
    }
  }, [gameTime?.month, gameTime?.year])

  const handleMouseDown = (e) => {
    // Só inicia drag se clicar na barra de cabeçalho
    if (e.target.closest('.calendar-header') && !e.target.closest('button')) {
      isDragging.current = true
      dragOffset.current = {
        x: e.clientX - pos.x,
        y: e.clientY - pos.y
      }
    }
  }

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return
      const newX = Math.max(10, Math.min(window.innerWidth - 440, e.clientX - dragOffset.current.x))
      const newY = Math.max(10, Math.min(window.innerHeight - 380, e.clientY - dragOffset.current.y))
      setPos({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      isDragging.current = false
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [pos])

  const currentMonthData = MONTHS[selectedMonth]
  const totalDays = currentMonthData?.days || 31

  // Descobre o primeiro dia da semana do mês para alinhar o grid
  const firstDayOfWeek = new Date(Date.UTC(selectedYear, selectedMonth, 1)).getUTCDay() // 0 = Domingo

  const prevMonth = () => {
    setSelectedDayEvents(null)
    if (selectedMonth === 0) {
      setSelectedMonth(11)
      setSelectedYear(y => y - 1)
    } else {
      setSelectedMonth(m => m - 1)
    }
  }

  const nextMonth = () => {
    setSelectedDayEvents(null)
    if (selectedMonth === 11) {
      setSelectedMonth(0)
      setSelectedYear(y => y + 1)
    } else {
      setSelectedMonth(m => m + 1)
    }
  }

  const handleMouseEnterDay = (e, dayEvents, dayNum) => {
    if (!dayEvents || dayEvents.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    })
    setHoveredEvent({ events: dayEvents, day: dayNum, monthName: currentMonthData.name, year: selectedYear })
  }

  const handleMouseLeaveDay = () => {
    setHoveredEvent(null)
  }

  const handleDayClick = (dayEvents, dayNum) => {
    if (selectedDayEvents?.day === dayNum) {
      setSelectedDayEvents(null) // Fecha se clicar no mesmo dia
    } else {
      setSelectedDayEvents({
        day: dayNum,
        monthName: currentMonthData.name,
        year: selectedYear,
        events: dayEvents
      })
    }
  }

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <div
      className="draggable-calendar-modal glass"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header com Drag Handle */}
      <div className="calendar-header">
        <div className="calendar-title-group">
          <span className="calendar-icon">📅</span>
          <div>
            <div className="calendar-title">Calendário de Sobrevivência</div>
            <div className="calendar-subtitle">Ano {selectedYear} · {currentMonthData?.name}</div>
          </div>
        </div>

        <div className="calendar-header-actions">
          <button className="calendar-nav-btn" onClick={prevMonth} title="Mês Anterior">◀</button>
          <button className="calendar-nav-btn" onClick={nextMonth} title="Próximo Mês">▶</button>
          <button className="calendar-close-btn" onClick={onClose} title="Fechar">✕</button>
        </div>
      </div>

      {/* Info da Estação, Clima, Fase da Lua e Zumbis no Calendário */}
      <div className="calendar-season-bar">
        <div className="calendar-badge" title={gameTime?.season?.desc}>
          <span>{gameTime?.season?.icon}</span>
          <span>{gameTime?.season?.name}</span>
        </div>
        <div className="calendar-badge" title={gameTime?.moonPhase?.zombieEffect}>
          <span>{gameTime?.moonPhase?.icon}</span>
          <span>{gameTime?.moonPhase?.name}</span>
        </div>
        <div className="calendar-badge current-time-badge">
          <span>⏰</span>
          <span>{gameTime?.timeString || '12:00'} ({gameTime?.period === 'day' ? 'Dia' : 'Noite'})</span>
        </div>
      </div>

      {/* Banner de Impacto nos Zumbis */}
      {gameTime?.moonPhase?.zombieEffect && (
        <div style={{ padding: '6px 14px', background: 'rgba(139, 92, 246, 0.1)', borderBottom: '1px solid rgba(139, 92, 246, 0.2)', fontSize: 10.5, color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🧟</span>
          <span>{gameTime.moonPhase.zombieEffect}</span>
        </div>
      )}

      {/* Grid do Calendário */}
      <div className="calendar-grid-container">
        {/* Dias da semana */}
        <div className="calendar-weekdays">
          {weekDays.map(wd => (
            <span key={wd} className="calendar-weekday">{wd}</span>
          ))}
        </div>

        {/* Células dos dias */}
        <div className="calendar-days-grid">
          {/* Espaçadores para o primeiro dia do mês */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="calendar-day empty" />
          ))}

          {/* Dias reais */}
          {Array.from({ length: totalDays }).map((_, i) => {
            const dayNum = i + 1
            const isToday =
              gameTime?.day === dayNum &&
              gameTime?.month === selectedMonth + 1 &&
              gameTime?.year === selectedYear

            const isSelected = selectedDayEvents?.day === dayNum

            // Eventos cadastrados para este dia
            const dayEvents = events.filter(ev => {
              const evDate = new Date(ev.date)
              if (ev.day && ev.month) {
                return Number(ev.day) === dayNum && Number(ev.month) === selectedMonth + 1 && (!ev.year || Number(ev.year) === selectedYear)
              }
              return (
                evDate.getUTCDate() === dayNum &&
                evDate.getUTCMonth() === selectedMonth &&
                evDate.getUTCFullYear() === selectedYear
              )
            })

            return (
              <div
                key={dayNum}
                className={`calendar-day ${isToday ? 'today' : ''} ${dayEvents.length > 0 ? 'has-event' : ''} ${isSelected ? 'selected-day' : ''}`}
                onClick={() => handleDayClick(dayEvents, dayNum)}
                onMouseEnter={(e) => handleMouseEnterDay(e, dayEvents, dayNum)}
                onMouseLeave={handleMouseLeaveDay}
                style={{ cursor: 'pointer' }}
                title={`Clique para ver detalhes do dia ${dayNum}`}
              >
                <span className="day-number">{dayNum}</span>
                {dayEvents.length > 0 && (
                  <div className="day-event-dots">
                    {dayEvents.slice(0, 3).map((ev, idx) => (
                      <span
                        key={idx}
                        className={`event-dot event-type-${ev.type || 'standard'}`}
                        style={ev.color ? { backgroundColor: ev.color } : {}}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* PAINEL DE DETALHES DO DIA AO CLICAR */}
      {selectedDayEvents && (
        <div className="calendar-day-details-panel">
          <div className="day-details-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>📌</span>
              <strong>{selectedDayEvents.day} de {selectedDayEvents.monthName}, {selectedDayEvents.year}</strong>
            </div>
            <button
              className="day-details-close"
              onClick={() => setSelectedDayEvents(null)}
              title="Fechar detalhes"
            >
              ✕
            </button>
          </div>

          <div className="day-details-content">
            {selectedDayEvents.events.length === 0 ? (
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '6px 0' }}>
                Nenhum evento registrado para este dia. Um dia relativamente calmo na Zona Zero.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedDayEvents.events.map((ev, idx) => (
                  <div key={idx} className="day-detail-card" style={{ borderLeft: `3px solid ${ev.color || 'var(--accent-red)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{ev.title}</strong>
                      <span className="event-tag" style={{ background: ev.color || 'var(--accent-blue)', fontSize: 9.5 }}>
                        {ev.type || 'Evento'}
                      </span>
                    </div>

                    {ev.description && (
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.35, margin: '4px 0' }}>
                        {ev.description}
                      </p>
                    )}

                    {ev.dangerLevel && (
                      <div style={{ fontSize: 10.5, color: 'var(--accent-yellow)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>⚠️ Nível de Perigo:</span>
                        <strong>{ev.dangerLevel}</strong>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tooltip flutuante de eventos ao passar o mouse */}
      {hoveredEvent && !selectedDayEvents && (
        <div
          className="calendar-event-tooltip glass"
          style={{
            position: 'fixed',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            zIndex: 1000
          }}
        >
          <div className="event-tooltip-header">
            📅 {hoveredEvent.day} de {hoveredEvent.monthName}, {hoveredEvent.year}
          </div>
          <div className="event-tooltip-list">
            {hoveredEvent.events.map((ev, idx) => (
              <div key={idx} className="event-tooltip-item">
                <div className="event-tooltip-title">
                  <span className="event-tag" style={{ background: ev.color || 'var(--accent-blue)' }}>
                    {ev.tag || ev.type || 'Evento'}
                  </span>
                  <strong>{ev.title}</strong>
                </div>
                {ev.description && (
                  <p className="event-tooltip-desc">{ev.description}</p>
                )}
                {ev.dangerLevel && (
                  <div className="event-danger-level">
                    ⚠️ Perigo: <span>{ev.dangerLevel}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rodapé explicativo */}
      <div className="calendar-footer">
        <span className="calendar-hint">💡 Clique em qualquer dia com evento para abrir os detalhes completos.</span>
      </div>
    </div>
  )
}
