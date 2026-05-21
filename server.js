import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3001
const DATA_FILE = path.join(__dirname, 'data', 'schedules.json')

app.use(cors())
app.use(express.json())

// Read schedules
app.get('/api/schedules', (req, res) => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8')
    console.log('GET /api/schedules - returning', data)
    res.json(JSON.parse(data))
  } catch (err) {
    console.log('GET /api/schedules - file not found or error, returning []')
    res.json([])
  }
})

// Write schedules
app.post('/api/schedules', (req, res) => {
  try {
    console.log('POST /api/schedules - saving', req.body.length, 'schedules')
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2))
    console.log('POST /api/schedules - saved successfully')
    res.json({ success: true })
  } catch (err) {
    console.error('POST /api/schedules - error:', err)
    res.status(500).json({ error: 'Failed to save schedules' })
  }
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
