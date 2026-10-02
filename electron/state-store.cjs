const fs = require('node:fs/promises')
const path = require('node:path')

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isActiveTimerPayload(value) {
  if (value === null) return true
  if (!isRecord(value) || (value.mode !== 'focus' && value.mode !== 'break')) return false
  if (value.taskId !== null && (typeof value.taskId !== 'string' || !value.taskId.trim())) return false
  if (typeof value.taskTitle !== 'string' || !isTimestamp(value.startedAt)) return false
  if (typeof value.elapsedMilliseconds !== 'number' || !Number.isFinite(value.elapsedMilliseconds) || value.elapsedMilliseconds < 0) return false
  return value.runningSince === null || isTimestamp(value.runningSince)
}

function isStatePayload(value, schemaVersion) {
  if (!isRecord(value) || value.schemaVersion !== schemaVersion) return false
  if (typeof value.focusMinutes !== 'number' || !Number.isFinite(value.focusMinutes) || value.focusMinutes < 0) return false
  if (!isActiveTimerPayload(value.activeTimer)) return false
  return ['tasks', 'feeds', 'groups', 'articles', 'readingActions', 'focusSessions', 'dailyReflections']
    .every((key) => Array.isArray(value[key]))
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value))
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  const value = JSON.parse(raw)
  if (!isRecord(value)) throw new SyntaxError('State file must contain a JSON object')
  return value
}

async function readStateFile(filePath, fallbackState) {
  for (const candidate of [filePath, `${filePath}.bak`]) {
    try {
      return await readJson(candidate)
    } catch {
      // Try the backup, then fall back to a fresh state.
    }
  }
  return cloneValue(fallbackState)
}

async function backupValidState(filePath) {
  try {
    await readJson(filePath)
    await fs.copyFile(filePath, `${filePath}.bak`)
  } catch (error) {
    if (error instanceof SyntaxError || error?.code === 'ENOENT') return
    throw error
  }
}

async function writeStateFile(filePath, state) {
  const serialized = JSON.stringify(state, null, 2)
  const tempFile = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  try {
    const handle = await fs.open(tempFile, 'w')
    try {
      await handle.writeFile(serialized, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await backupValidState(filePath)
    await fs.rename(tempFile, filePath)
    return state
  } finally {
    await fs.rm(tempFile, { force: true }).catch(() => undefined)
  }
}

module.exports = {
  isStatePayload,
  readStateFile,
  writeStateFile,
}
