import { useState, useEffect } from 'react'
import './App.css'

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function App() {
  const [schedules, setSchedules] = useState([])
  const [timeLefts, setTimeLefts] = useState({})

  const [scheduleType, setScheduleType] = useState('day')
  const [time, setTime] = useState('')
  const [weekDay, setWeekDay] = useState('Monday')
  const [count, setCount] = useState('1')

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

  // Update time left every second
  useEffect(() => {
    const interval = setInterval(() => {
      const newTimeLefts = {}
      schedules.forEach(schedule => {
        newTimeLefts[schedule.id] = calculateTimeLeft(schedule.datetime)
      })
      setTimeLefts(newTimeLefts)
    }, 1000)

    return () => clearInterval(interval)
  }, [schedules])

  const addSchedule = () => {
    if (!time || !count) return

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
      count: parseInt(count),
      datetime
    }

    setSchedules([...schedules, newSchedule].sort((a, b) => a.datetime - b.datetime))
    setTime('')
    setWeekDay('Monday')
    setCount('1')
  }

  const removeSchedule = (id) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      setSchedules(schedules.filter(s => s.id !== id))
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
          <label className="section-label">Actions</label>
          <div className="action-inputs">
            <input
              type="number"
              placeholder="Count"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="input"
              min="1"
            />

            <button onClick={addSchedule} className="add-btn">
              Add Schedule
            </button>
          </div>
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
              return (
                <li key={schedule.id} className="schedule-item">
                  <div className="schedule-info">
                    <div className="schedule-header">
                      <span className="schedule-type">
                        {schedule.type === 'day' ? 'Every Day' : schedule.weekDay}
                      </span>
                      <span className="schedule-time">{formatTime(schedule.time)}</span>
                    </div>
                    <span className="count-badge">Count: {schedule.count}</span>
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
