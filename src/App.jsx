import { useState, useEffect, useRef } from 'react'
import './App.css'

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const API_URL = 'http://localhost:3001/api/schedules'
const BLYNK_API_URL = import.meta.env.VITE_BLYNK_API_URL || 'https://blynk.cloud/external/api'
const BLYNK_TOKEN = import.meta.env.VITE_BLYNK_TOKEN || ''
const BLYNK_PIN = import.meta.env.VITE_BLYNK_PIN || 'V0'

function App() {
  const [schedules, setSchedules] = useState([])
  const [timeLefts, setTimeLefts] = useState({})
  const [triggeredSchedules, setTriggeredSchedules] = useState(new Set())
  const isLoaded = useRef(false)

  // Load schedules from file on mount
  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(data => {
        const parsed = data.map(s => ({
          ...s,
          datetime: new Date(s.datetime)
        }))
        setSchedules(parsed)
        isLoaded.current = true
      })
      .catch(() => {
        setSchedules([])
        isLoaded.current = true
      })
  }, [])

  const [scheduleType, setScheduleType] = useState('day')
  const [time, setTime] = useState('')
  const [weekDay, setWeekDay] = useState('Monday')

  // Helper to get next occurrence of a weekday at specific time
  const getNextWeekDayDateTime = (dayName, timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const now = new Date()
    const targetDay = WEEK_DAYS.indexOf(dayName)

    const nextDate = new Date()
    nextDate.setHours(hours, minutes, 0, 0)

    const currentDay = now.getDay()
    const adjustedCurrentDay = currentDay === 0 ? 6 : currentDay - 1
    const adjustedTargetDay = targetDay

    let daysUntil = adjustedTargetDay - adjustedCurrentDay
    if (daysUntil < 0 || (daysUntil === 0 && nextDate <= now)) {
      daysUntil += 7
    }

    nextDate.setDate(now.getDate() + daysUntil)
    return nextDate
  }

  // Helper to get today's time
  const getTodayDateTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const now = new Date()
    const result = new Date()
    result.setHours(hours, minutes, 0, 0)

    if (result <= now) {
      result.setDate(result.getDate() + 1)
    }
    return result
  }

  // Call Blynk API to set pin value
  const setBlynkPin = async (value) => {
    if (!BLYNK_TOKEN) return
    try {
      await fetch(`${BLYNK_API_URL}/update?token=${BLYNK_TOKEN}&pin=${BLYNK_PIN}&value=${value}`)
    } catch (err) {
      console.error('Blynk API error:', err)
    }
  }

  // Trigger Blynk pulse when schedule reaches zero
  const triggerSchedule = async (scheduleId) => {
    if (triggeredSchedules.has(scheduleId)) return
    setTriggeredSchedules(prev => new Set(prev).add(scheduleId))
    await setBlynkPin(1)

    // After 1 second: set pin to 0, reset triggered flag, and reschedule
    setTimeout(() => {
      setBlynkPin(0)
      setTriggeredSchedules(prev => {
        const next = new Set(prev)
        next.delete(scheduleId)
        return next
      })

      // Reschedule for next occurrence
      setSchedules(prev => prev.map(s => {
        if (s.id !== scheduleId) return s
        const nextDatetime = s.type === 'day'
          ? getTodayDateTime(s.time)
          : getNextWeekDayDateTime(s.weekDay, s.time)
        return { ...s, datetime: nextDatetime }
      }))
    }, 1000)
  }


  // Calculate time left for a schedule
  const calculateTimeLeft = (datetime) => {
    const now = new Date()
    const diff = datetime - now
    if (diff <= 0) return null
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    return { days, hours, minutes, seconds }
  }

  // Initialize time lefts when schedules change
  useEffect(() => {
    const newTimeLefts = {}
    schedules.forEach(schedule => {
      newTimeLefts[schedule.id] = calculateTimeLeft(schedule.datetime)
    })
    setTimeLefts(newTimeLefts)
  }, [schedules])

  // Save schedules to file whenever they change (after initial load)
  useEffect(() => {
    if (!isLoaded.current) return
    const toSave = schedules.map(s => ({
      ...s,
      datetime: s.datetime.toISOString()
    }))
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSave)
    }).catch(err => console.error('Save failed:', err))
  }, [schedules])

  // Update time left every second
  useEffect(() => {
    const interval = setInterval(() => {
      const newTimeLefts = {}
      schedules.forEach(schedule => {
        const timeLeft = calculateTimeLeft(schedule.datetime)
        newTimeLefts[schedule.id] = timeLeft
        // Trigger Blynk when schedule reaches zero
        if (timeLeft === null && !triggeredSchedules.has(schedule.id)) {
          triggerSchedule(schedule.id)
        }
      })
      setTimeLefts(newTimeLefts)
    }, 1000)

    return () => clearInterval(interval)
  }, [schedules, triggeredSchedules])

  const addSchedule = () => {
    if (!time) return

    let datetime
    if (scheduleType === 'day') {
      datetime = getTodayDateTime(time)
    } else {
      datetime = getNextWeekDayDateTime(weekDay, time)
    }

    const newSchedule = {
      id: Date.now(),
      type: scheduleType,
      time,
      weekDay: scheduleType === 'week' ? weekDay : null,
      datetime
    }

    setSchedules([...schedules, newSchedule].sort((a, b) => a.datetime - b.datetime))
    setTime('')
    setWeekDay('Monday')
  }

  const removeSchedule = (id) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      setSchedules(schedules.filter(s => s.id !== id))
      setTriggeredSchedules(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const formatTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  const formatTimeLeft = (timeLeft) => {
    if (!timeLeft) return 'Past due'
    const { days, hours, minutes, seconds } = timeLeft
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  return (
    <div className="app">
      <h1>Schedule Manager</h1>
      {!BLYNK_TOKEN && (
        <p className="blynk-warning">Blynk not configured - Add BLYNK_TOKEN in App.jsx</p>
      )}

      <div className="add-schedule">
        <div className="time-section">
          <label className="section-label">Time Settings</label>
          <div className="time-inputs">
            <select
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value)}
              className="input select-input"
            >
              <option value="day">Per Day</option>
              <option value="week">Per Week</option>
            </select>

            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input"
            />

            {scheduleType === 'week' && (
              <select
                value={weekDay}
                onChange={(e) => setWeekDay(e.target.value)}
                className="input select-input"
              >
                {WEEK_DAYS.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="action-section">
          <button onClick={addSchedule} className="add-btn">
            Add Schedule
          </button>
        </div>
      </div>

      <div className="schedule-list">
        <h2>Schedules ({schedules.length})</h2>
        {schedules.length === 0 ? (
          <p className="empty">No schedules yet. Add one above!</p>
        ) : (
          <ul>
            {schedules.map(schedule => {
              const timeLeft = timeLefts[schedule.id]
              const triggered = triggeredSchedules.has(schedule.id)
              return (
                <li key={schedule.id} className={`schedule-item ${triggered ? 'triggered' : ''}`}>
                  <div className="schedule-info">
                    <div className="schedule-header">
                      <span className="schedule-type">
                        {schedule.type === 'day' ? 'Every Day' : schedule.weekDay}
                      </span>
                      <span className="schedule-time">{formatTime(schedule.time)}</span>
                      {triggered && <span className="triggered-badge">Triggered</span>}
                    </div>
                    <span className={`time-left ${timeLeft ? 'active' : 'past'}`}>
                      {timeLeft ? `Time left: ${formatTimeLeft(timeLeft)}` : 'Past due'}
                    </span>
                  </div>
                  <button
                    onClick={() => removeSchedule(schedule.id)}
                    className="delete-x-btn"
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default App
