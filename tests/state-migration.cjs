const assert = require('node:assert/strict')
const childProcess = require('node:child_process')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

async function loadStateModule(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deskflow-migration-'))
  const outputPath = path.join(directory, 'lib/state.js')
  t.after(async () => {
    if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith('deskflow-migration-')) {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })
  const compilerPath = path.join(path.dirname(require.resolve('typescript/package.json')), 'bin/tsc')
  childProcess.execFileSync(process.execPath, [
    compilerPath,
    '--ignoreConfig',
    '--target', 'ES2022',
    '--module', 'commonjs',
    '--outDir', directory,
    '--rootDir', 'src',
    '--skipLibCheck',
    'src/lib/state.ts',
    'src/features/focus/timer.ts',
    'src/types.ts',
  ], { cwd: path.join(__dirname, '..') })
  return require(outputPath)
}

function statePayload(overrides = {}) {
  return {
    schemaVersion: 1,
    tasks: [],
    focusMinutes: 0,
    feeds: [],
    groups: [],
    articles: [],
    focusSessions: [],
    dailyReflections: [],
    ...overrides,
  }
}

test('schema version 1 state migrates to the current schema with no active timer', async (t) => {
  const { migrateAppState } = await loadStateModule(t)
  const migrated = migrateAppState(statePayload())
  assert.equal(migrated.schemaVersion, 3)
  assert.equal(migrated.activeTimer, null)
})

test('schema version 2 tasks receive a safe creation timestamp based on their existing date', async (t) => {
  const { migrateAppState } = await loadStateModule(t)
  const migrated = migrateAppState(statePayload({
    schemaVersion: 2,
    tasks: [{ id: 'task-1', title: '旧任务', completed: false, priority: 'medium', date: '2026-09-30', notes: '' }],
    activeTimer: null,
  }))

  assert.equal(migrated.schemaVersion, 3)
  assert.equal(migrated.tasks[0].date, '2026-09-30')
  assert.equal(new Date(migrated.tasks[0].createdAt).getTime(), new Date('2026-09-30T00:00:00').getTime())
})

test('active timers are normalized and invalid values are discarded', async (t) => {
  const { migrateAppState } = await loadStateModule(t)
  const activeTimer = {
    mode: 'focus',
    taskId: 'task-1',
    taskTitle: '',
    startedAt: '2026-10-01T08:00:00.000Z',
    elapsedMilliseconds: 12_000,
    runningSince: null,
  }
  const migrated = migrateAppState(statePayload({
    schemaVersion: 3,
    tasks: [{ id: 'task-1', title: '迁移后的任务标题', createdAt: '2026-10-01T00:00:00.000Z', completed: false, priority: 'high', date: '2026-10-01', notes: '' }],
    activeTimer,
  }))
  assert.equal(migrated.activeTimer?.taskTitle, '迁移后的任务标题')

  const invalid = migrateAppState(statePayload({ schemaVersion: 3, activeTimer: { ...activeTimer, runningSince: 'not-a-date' } }))
  assert.equal(invalid.activeTimer, null)
})
