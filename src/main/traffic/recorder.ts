import {
  TRAFFIC_USAGE_FLUSH_THRESHOLD,
  TrafficUsageAccumulator,
  type TrafficUsageSample,
  type TrafficUsageWriteBatch
} from '../../shared/trafficUsage'
import { closeTrafficUsageDatabase, writeTrafficUsage } from './database'

const FLUSH_DELAY_MS = 5000
const accumulator = new TrafficUsageAccumulator()

let enabled = false
let flushTimer: NodeJS.Timeout | null = null
let inFlight: Promise<void> | null = null
let retryBatch: TrafficUsageWriteBatch | null = null
let batchSequence = 0
let lastDroppedCount = 0
let shuttingDown = false

function clearFlushTimer(): void {
  if (!flushTimer) return
  clearTimeout(flushTimer)
  flushTimer = null
}

function scheduleFlush(delay = FLUSH_DELAY_MS): void {
  if (!enabled || shuttingDown || flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushTrafficUsage()
  }, delay)
  flushTimer.unref()
}

function nextBatch(samples: TrafficUsageSample[]): TrafficUsageWriteBatch {
  return {
    id: `${process.pid}-${Date.now()}-${batchSequence++}`,
    samples
  }
}

export function setTrafficUsageEnabled(nextEnabled: boolean): void {
  if (enabled === nextEnabled) return
  enabled = nextEnabled
  clearFlushTimer()
  accumulator.setEnabled(nextEnabled)
  if (!nextEnabled) retryBatch = null
}

export function recordTrafficUsage(info: ControllerConnections): void {
  if (!enabled) return
  const shouldFlush = accumulator.addSnapshot(info)
  if (accumulator.droppedCount !== lastDroppedCount) {
    lastDroppedCount = accumulator.droppedCount
    void import('../utils/log').then(({ appendAppLog }) =>
      appendAppLog(
        `[TrafficUsage]: dropped ${lastDroppedCount} records after reaching the pending limit\n`
      )
    )
  }
  if (shouldFlush && !retryBatch) void flushTrafficUsage()
  else if (retryBatch || accumulator.pendingSize > 0) scheduleFlush()
}

export async function flushTrafficUsage(): Promise<void> {
  if (!enabled || inFlight) return inFlight ?? Promise.resolve()

  const batch = retryBatch ?? nextBatch(accumulator.takePending())
  if (batch.samples.length === 0) return
  retryBatch = batch
  inFlight = writeTrafficUsage(batch)
    .then(() => {
      if (retryBatch?.id === batch.id) retryBatch = null
    })
    .catch((error) => {
      void import('../utils/log').then(({ appendAppLog }) =>
      appendAppLog(`[TrafficUsage]: failed to persist traffic usage, ${error}\n`)
    )
    })
    .finally(() => {
      inFlight = null
      if (enabled && (retryBatch || accumulator.pendingSize > 0)) {
        scheduleFlush(
          accumulator.pendingSize >= TRAFFIC_USAGE_FLUSH_THRESHOLD && !retryBatch
            ? 0
            : FLUSH_DELAY_MS
        )
      }
    })
  return inFlight
}

export async function closeTrafficUsage(): Promise<void> {
  shuttingDown = true
  clearFlushTimer()
  if (inFlight) await inFlight
  clearFlushTimer()
  if (enabled && (retryBatch || accumulator.pendingSize > 0)) {
    await flushTrafficUsage()
    if (inFlight) await inFlight
  }
  enabled = false
  accumulator.setEnabled(false)
  await closeTrafficUsageDatabase()
}
