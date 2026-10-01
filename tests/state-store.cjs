const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { isStatePayload, readStateFile, writeStateFile } = require('../electron/state-store.cjs')

const validState = {
  schemaVersion: 3,
  tasks: [],
  focusMinutes: 0,
  feeds: [],
  groups: [],
  articles: [],
  focusSessions: [],
  activeTimer: null,
  dailyReflections: [],
}

async function temporaryStateFile(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deskflow-state-'))
  t.after(async () => {
    if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith('deskflow-state-')) {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })
  return path.join(directory, 'deskflow-state.json')
}

test('missing state returns an independent fallback value', async (t) => {
  const filePath = await temporaryStateFile(t)
  const loaded = await readStateFile(filePath, validState)
  assert.deepEqual(loaded, validState)
  assert.notEqual(loaded, validState)
})

test('atomic writes retain the previous valid state as a backup', async (t) => {
  const filePath = await temporaryStateFile(t)
  const firstState = { ...validState, focusMinutes: 25 }
  const secondState = { ...validState, focusMinutes: 50 }
  await writeStateFile(filePath, firstState)
  await writeStateFile(filePath, secondState)
  assert.deepEqual(await readStateFile(filePath, validState), secondState)

  await fs.writeFile(filePath, '{broken json', 'utf8')
  assert.deepEqual(await readStateFile(filePath, validState), firstState)
})

test('IPC state validation requires the current top-level schema', () => {
  assert.equal(isStatePayload(validState, 3), true)
  assert.equal(isStatePayload({ ...validState, schemaVersion: 2 }, 3), false)
  assert.equal(isStatePayload({ ...validState, focusSessions: null }, 3), false)
  assert.equal(isStatePayload({ ...validState, focusMinutes: -1 }, 3), false)
  assert.equal(isStatePayload({ ...validState, activeTimer: {} }, 3), false)
  assert.equal(isStatePayload({
    ...validState,
    activeTimer: {
      mode: 'focus',
      taskId: 'task-1',
      taskTitle: '任务快照',
      startedAt: '2026-10-01T08:00:00.000Z',
      elapsedMilliseconds: 12_000,
      runningSince: null,
    },
  }, 3), true)
})
