'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Flame,
  Target,
  BookOpen,
  Clock,
  BarChart3,
  Loader2,
  TrendingUp,
  Settings2,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ResponsivePanel, PanelHeader } from '@/components/responsive-panel'
import { usePDFStore } from '@/store/use-pdf-store'
import { authFetch } from '@/lib/api'

export function ReadingStatsPanel() {
  const {
    showReadingStats,
    setShowReadingStats,
    setShowReadingAnalytics,
    todayPages,
    todayMinutes,
    streakCount,
    dailyGoalEnabled,
    dailyGoalPages,
    dailyGoalMinutes,
    setTodayStats,
    setStreakCount,
    setDailyGoal,
  } = usePDFStore()

  const [history, setHistory] = useState<{ date: string; pagesRead: number; timeSpentMs: number }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [goalPages, setGoalPages] = useState(dailyGoalPages)
  const [goalMinutes, setGoalMinutes] = useState(dailyGoalMinutes)
  const [goalEnabled, setGoalEnabled] = useState(dailyGoalEnabled)
  const [isSaving, setIsSaving] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [statsRes, goalRes] = await Promise.all([
        authFetch('/api/reading-stats?days=30'),
        authFetch('/api/reading-goal'),
      ])

      if (statsRes.ok) {
        const data = await statsRes.json()
        setTodayStats(data.today?.pagesRead || 0, data.today?.timeSpentMs ? Math.round(data.today.timeSpentMs / 60000) : 0)
        setStreakCount(data.streak || 0)
        setHistory(data.history || [])
      }

      if (goalRes.ok) {
        const goal = await goalRes.json()
        setDailyGoal(goal.enabled || false, goal.pages || 10, goal.minutes || 30)
        setGoalPages(goal.pages || 10)
        setGoalMinutes(goal.minutes || 30)
        setGoalEnabled(goal.enabled || false)
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false)
    }
  }, [setTodayStats, setStreakCount, setDailyGoal])

  useEffect(() => {
    if (showReadingStats) loadData()
  }, [showReadingStats, loadData])

  const handleSaveGoal = useCallback(async () => {
    setIsSaving(true)
    try {
      await authFetch('/api/reading-goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: goalEnabled, pages: goalPages, minutes: goalMinutes }),
      })
      setDailyGoal(goalEnabled, goalPages, goalMinutes)
      setShowSettings(false)
    } catch {
      // silent
    } finally {
      setIsSaving(false)
    }
  }, [goalEnabled, goalPages, goalMinutes, setDailyGoal])

  const pageProgress = dailyGoalPages > 0 ? Math.min(100, Math.round((todayPages / dailyGoalPages) * 100)) : 0
  const minuteProgress = dailyGoalMinutes > 0 ? Math.min(100, Math.round((todayMinutes / dailyGoalMinutes) * 100)) : 0
  const goalMet = dailyGoalEnabled && pageProgress >= 100 && minuteProgress >= 100

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const today = new Date()
  const mondayOffset = (today.getDay() + 6) % 7
  const weekHistory = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - mondayOffset + i)
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const record = history.find((r) => r.date === ds)
    return { date: ds, day: weekDays[d.getDay()], pages: record?.pagesRead || 0, active: !!record }
  })

  if (!showReadingStats) return null

  return (
    <ResponsivePanel
      open={showReadingStats}
      onClose={() => setShowReadingStats(false)}
      ariaLabel="Reading stats"
      header={
        <PanelHeader
          icon={BarChart3}
          iconClassName="text-sky-500"
          title="Reading Stats"
          actions={
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => { setShowSettings(!showSettings); setShowReadingStats(false); setTimeout(() => setShowReadingStats(true), 50) }}
              title="Goal settings"
              aria-label="Goal settings"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          }
          onClose={() => setShowReadingStats(false)}
        />
      }
    >

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
            </div>
          ) : showSettings ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-sky-500" />
                  <span className="text-sm font-semibold">Daily Goal</span>
                </div>
                <Switch checked={goalEnabled} onCheckedChange={setGoalEnabled} />
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Pages per day</Label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={goalPages}
                    onChange={(e) => setGoalPages(Math.max(1, parseInt(e.target.value) || 1))}
                    className="mt-1 h-8 text-xs"
                    disabled={!goalEnabled}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Minutes per day</Label>
                  <Input
                    type="number"
                    min={1}
                    max={480}
                    value={goalMinutes}
                    onChange={(e) => setGoalMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                    className="mt-1 h-8 text-xs"
                    disabled={!goalEnabled}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => { setGoalEnabled(dailyGoalEnabled); setGoalPages(dailyGoalPages); setGoalMinutes(dailyGoalMinutes); setShowSettings(false) }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs bg-sky-600 hover:bg-sky-700"
                  onClick={handleSaveGoal}
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save Goal'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-5">
              {/* Streak */}
              <div className="rounded-xl border bg-gradient-to-br from-orange-50 to-amber-50 p-4 dark:from-orange-950/20 dark:to-amber-950/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className={`h-5 w-5 ${streakCount > 0 ? 'text-orange-500' : 'text-muted-foreground/40'}`} />
                    <span className="text-sm font-semibold text-foreground">Streak</span>
                  </div>
                  <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {streakCount}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                  {streakCount === 0
                    ? 'Read today to start a streak!'
                    : streakCount === 1
                      ? '1 day streak — keep it going!'
                      : `${streakCount}-day streak — on fire!`}
                </p>

                {/* Week mini-chart */}
                <div className="mt-3 flex items-end gap-1">
                  {weekHistory.map((d) => (
                    <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-sm transition-all ${
                          d.active ? 'bg-orange-400 dark:bg-orange-500' : 'bg-muted/50'
                        }`}
                        style={{ height: `${Math.max(d.pages > 0 ? 4 : 2, d.pages * 4)}px` }}
                      />
                      <span className="text-[8px] text-muted-foreground/60">{d.day[0]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Today's Progress */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-semibold text-foreground">Today</span>
                  {goalMet && (
                    <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Goal met!
                    </span>
                  )}
                </div>

                {dailyGoalEnabled && (
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">Pages</span>
                        </div>
                        <span className="text-[10px] font-medium text-foreground">
                          {todayPages} / {dailyGoalPages}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-sky-500 transition-all"
                          style={{ width: `${pageProgress}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">Minutes</span>
                        </div>
                        <span className="text-[10px] font-medium text-foreground">
                          {todayMinutes} / {dailyGoalMinutes}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${minuteProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {!dailyGoalEnabled && (
                  <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground">
                      Set a daily reading goal to track progress
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 h-7 gap-1 text-xs"
                      onClick={() => setShowSettings(true)}
                    >
                      <Target className="h-3 w-3" />
                      Set Goal
                    </Button>
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              {history.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Recent Activity
                    </span>
                  </div>
                  <div className="space-y-1">
                    {history.slice(0, 7).map((entry) => {
                      const d = new Date(entry.date + 'T00:00:00')
                      const mins = Math.round(entry.timeSpentMs / 60000)
                      return (
                        <div
                          key={entry.date}
                          className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs hover:bg-muted/30"
                        >
                          <span className="text-muted-foreground">
                            {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-foreground">{entry.pagesRead} pages</span>
                            {mins > 0 && <span className="text-muted-foreground">{mins}m</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Link to full analytics */}
              <div className="border-t pt-3">
                <button
                  onClick={() => {
                    setShowReadingStats(false)
                    setShowReadingAnalytics(true)
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/20 transition-colors"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  View Full Analytics
                </button>
              </div>
            </div>
          )}
      </div>
    </ResponsivePanel>
  )
}
