'use client'

import { useTrade } from '@/store/TradeStore'

export default function LogsPage() {
  const { state: trade } = useTrade()
  const logs = trade.logs

  const counts = {
    ERROR:   logs.filter(l => l.level === 'ERROR').length,
    WARNING: logs.filter(l => l.level === 'WARNING').length,
    INFO:    logs.filter(l => l.level === 'INFO').length,
    DEBUG:   logs.filter(l => l.level === 'DEBUG').length,
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-raised">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-surface border-b border-edge px-8 py-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-bold text-settings-600 uppercase tracking-widest mb-1">System</p>
            <h1 className="font-display text-3xl font-bold text-ink">Logs</h1>
          </div>
          <p className="text-sm text-muted">{logs.length} entries</p>
        </div>
      </div>

      {/* ── Level strip ───────────────────────────────────────────────────── */}
      <div className="shrink-0 grid grid-cols-4 border-b border-edge">
        <LevelCard label="Errors"   count={counts.ERROR}   cls="text-loss"         bg="bg-loss-bg"     border={false} />
        <LevelCard label="Warnings" count={counts.WARNING} cls="text-warn"         bg="bg-warn-bg"     border />
        <LevelCard label="Info"     count={counts.INFO}    cls="text-brand-600"    bg="bg-brand-50"    border />
        <LevelCard label="Debug"    count={counts.DEBUG}   cls="text-subtle"       bg="bg-sunken"      border />
      </div>

      {/* ── Log stream ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <span className="text-5xl text-ghost">◎</span>
            <p className="text-base font-semibold text-muted">No logs yet</p>
            <p className="text-sm text-subtle">Start the engine on the Dashboard to stream logs</p>
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-edge overflow-hidden">
            <div className="font-mono text-xs divide-y divide-edge">
              {logs.map((log, i) => (
                <div key={i} className={`flex gap-4 px-5 py-2.5 hover:bg-sunken transition-colors ${
                  log.level === 'ERROR' ? 'bg-loss-bg/40' : ''
                }`}>
                  {/* Timestamp */}
                  <span className="text-subtle shrink-0 tabular-nums w-24">
                    {log.timestamp.slice(0, 19).replace('T', ' ')}
                  </span>

                  {/* Level badge */}
                  <span className={`shrink-0 w-16 font-bold text-center px-1.5 py-0.5 rounded text-2xs self-start ${
                    log.level === 'ERROR'   ? 'bg-loss-bg text-loss'         :
                    log.level === 'WARNING' ? 'bg-warn-bg text-warn'         :
                    log.level === 'DEBUG'   ? 'bg-sunken text-subtle'        :
                                             'bg-brand-50 text-brand-600'
                  }`}>{log.level}</span>

                  {/* Logger */}
                  <span className="text-subtle shrink-0 w-28 truncate">{log.logger}</span>

                  {/* Message */}
                  <span className={`flex-1 leading-relaxed ${
                    log.level === 'ERROR'   ? 'text-loss'    :
                    log.level === 'WARNING' ? 'text-warn'    :
                    log.level === 'DEBUG'   ? 'text-subtle'  :
                                             'text-ink'
                  }`}>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function LevelCard({ label, count, cls, bg, border }: {
  label: string; count: number; cls: string; bg: string; border: boolean
}) {
  return (
    <div className={`bg-surface px-8 py-5 ${border ? 'border-l border-edge' : ''}`}>
      <p className="text-xs text-muted uppercase tracking-widest mb-2">{label}</p>
      <p className={`font-display text-2xl font-bold tabular-nums ${cls}`}>{count}</p>
      <div className={`mt-2 h-1 rounded-full ${count > 0 ? bg : 'bg-edge'}`} style={{ width: `${Math.min(count * 4, 100)}%` }} />
    </div>
  )
}
