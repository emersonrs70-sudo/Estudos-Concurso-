import React, { useState } from 'react';
import { Subject, StudyLog } from '../types';
import { formatLocalDate } from '../mockData';
import { BarChart3, PieChart } from 'lucide-react';

interface PerformanceChartsProps {
  mode: 'weekly' | 'monthly';
  days: Date[];
  logs: StudyLog[];
  subjects: Subject[];
  selectedDateStr: string;
  onSelectDay: (dateStr: string) => void;
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  mode,
  days,
  logs,
  subjects,
  selectedDateStr,
  onSelectDay,
}) => {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const dayStrings = new Set(days.map(formatLocalDate));
  const periodLogs = logs.filter((l) => dayStrings.has(l.date));
  const totalPeriodMinutes = periodLogs.reduce((acc, l) => acc + l.durationMinutes, 0);

  // Build daily stacked bar data
  const dailyData = days.map((d) => {
    const dateStr = formatLocalDate(d);
    const dayLogs = periodLogs.filter((l) => l.date === dateStr);
    const totalMinutes = dayLogs.reduce((acc, l) => acc + l.durationMinutes, 0);

    const bySubject: Record<string, number> = {};
    dayLogs.forEach((l) => {
      bySubject[l.subjectId] = (bySubject[l.subjectId] || 0) + l.durationMinutes;
    });

    const segments = Object.entries(bySubject).map(([subjectId, minutes]) => {
      const sub = subjects.find((s) => s.id === subjectId);
      return {
        subjectId,
        name: sub?.name || 'Matéria',
        color: sub?.color || '#4f46e5',
        minutes,
      };
    });

    return {
      date: d,
      dateStr,
      totalMinutes,
      segments,
      logsCount: dayLogs.length,
    };
  });

  const maxDailyMinutes = Math.max(
    120,
    ...dailyData.map((d) => d.totalMinutes)
  );

  // Build subject distribution for the selected period
  const goalMultiplier = mode === 'weekly' ? 1 : 4.3;
  const subjectStats = subjects.map((sub) => {
    const subMins = periodLogs
      .filter((l) => l.subjectId === sub.id)
      .reduce((acc, l) => acc + l.durationMinutes, 0);
    const targetHours = Math.round(sub.weeklyGoalHours * goalMultiplier * 10) / 10;
    const hours = subMins / 60;
    const pct = targetHours > 0 ? Math.min(Math.round((hours / targetHours) * 100), 100) : 0;
    const share = totalPeriodMinutes > 0 ? Math.round((subMins / totalPeriodMinutes) * 100) : 0;

    return {
      ...sub,
      minutes: subMins,
      hours,
      targetHours,
      pct,
      share,
    };
  });

  // Donut chart segments
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  const activeHoverDay = hoveredDate
    ? dailyData.find((d) => d.dateStr === hoveredDate)
    : null;

  const studiedDaysCount = dailyData.filter((d) => d.totalMinutes > 0).length;
  const unstudiedDaysCount = dailyData.length - studiedDaysCount;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Daily Stacked Bar Chart */}
      <div className="lg:col-span-2 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Desempenho Diário ({mode === 'weekly' ? 'Semana' : 'Mês'})
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {studiedDaysCount} {studiedDaysCount === 1 ? 'dia estudado' : 'dias estudados'} · {unstudiedDaysCount} {unstudiedDaysCount === 1 ? 'dia sem registro' : 'dias sem registro'}
            </p>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
            {activeHoverDay ? (
              <span>
                {activeHoverDay.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {activeHoverDay.totalMinutes > 0
                    ? `${(activeHoverDay.totalMinutes / 60).toFixed(1)}h (${activeHoverDay.totalMinutes} min)`
                    : 'Não estudado'}
                </strong>
              </span>
            ) : (
              <span>
                Total no período:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {(totalPeriodMinutes / 60).toFixed(1)}h
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="relative pt-4">
          {/* Horizontal reference gridlines */}
          <div className="absolute inset-x-0 top-4 bottom-7 flex flex-col justify-between pointer-events-none">
            {[1, 0.5, 0].map((ratio) => (
              <div key={ratio} className="flex items-center gap-2">
                <span className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-500 w-8 text-right shrink-0">
                  {((maxDailyMinutes * ratio) / 60).toFixed(1)}h
                </span>
                <div className="flex-1 border-b border-dashed border-slate-200 dark:border-slate-800" />
              </div>
            ))}
          </div>

          {/* Bars Container */}
          <div className="pl-10 flex items-end gap-1 sm:gap-1.5 h-48 relative z-10">
            {dailyData.map((day) => {
              const isSelected = day.dateStr === selectedDateStr;
              const isStudied = day.totalMinutes > 0;
              const heightPct = isStudied
                ? Math.max(8, Math.round((day.totalMinutes / maxDailyMinutes) * 100))
                : 0;

              const shortLabel =
                mode === 'weekly'
                  ? day.date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
                  : String(day.date.getDate());

              return (
                <button
                  key={day.dateStr}
                  type="button"
                  onClick={() => onSelectDay(day.dateStr)}
                  onMouseEnter={() => setHoveredDate(day.dateStr)}
                  onMouseLeave={() => setHoveredDate(null)}
                  title={`${day.date.toLocaleDateString('pt-BR')} — ${
                    isStudied ? `${day.totalMinutes} min estudados` : 'Não estudado'
                  }`}
                  className="flex-1 h-full flex flex-col justify-end items-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-md"
                >
                  <div className="w-full flex-1 flex flex-col justify-end items-center px-0.5">
                    {isStudied ? (
                      <div
                        className={`w-full max-w-[34px] rounded-t-md overflow-hidden flex flex-col-reverse transition-transform duration-150 group-hover:scale-x-105 ${
                          isSelected ? 'ring-2 ring-indigo-600 dark:ring-indigo-400 ring-offset-1 dark:ring-offset-slate-900' : ''
                        }`}
                        style={{ height: `${heightPct}%` }}
                      >
                        {day.segments.map((seg) => {
                          const segPct = (seg.minutes / day.totalMinutes) * 100;
                          return (
                            <div
                              key={seg.subjectId}
                              style={{
                                height: `${segPct}%`,
                                backgroundColor: seg.color,
                              }}
                              className="w-full"
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        className={`w-full max-w-[34px] h-1.5 rounded-full transition-colors ${
                          isSelected
                            ? 'bg-indigo-400 dark:bg-indigo-500'
                            : 'bg-slate-200 dark:bg-slate-800 group-hover:bg-slate-300 dark:group-hover:bg-slate-700'
                        }`}
                      />
                    )}
                  </div>

                  <span
                    className={`mt-2 text-[10px] font-mono tabular-nums leading-none ${
                      isSelected
                        ? 'font-bold text-indigo-600 dark:text-indigo-400'
                        : isStudied
                          ? 'font-medium text-slate-700 dark:text-slate-300'
                          : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {mode === 'monthly' && day.date.getDate() % 2 === 0 && dailyData.length > 20 && !isSelected && !isStudied
                      ? ''
                      : shortLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          {subjects.map((sub) => (
            <span key={sub.id} className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: sub.color }}
                aria-hidden="true"
              />
              <span className="truncate max-w-[140px]">{sub.name}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Subject Allocation & Goal Progress */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between gap-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Tempo por Matéria
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {mode === 'weekly' ? 'Progresso frente à meta semanal' : 'Progresso acumulado no mês'}
            </p>
          </div>
        </div>

        {/* SVG Donut Summary */}
        <div className="flex items-center gap-5">
          <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
              <circle
                cx="64"
                cy="64"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-slate-100 dark:text-slate-800"
              />
              {totalPeriodMinutes > 0 &&
                subjectStats
                  .filter((s) => s.minutes > 0)
                  .map((s) => {
                    const strokeLength = (s.minutes / totalPeriodMinutes) * circumference;
                    const dashArray = `${strokeLength} ${circumference}`;
                    const dashOffset = -cumulativeOffset;
                    cumulativeOffset += strokeLength;

                    return (
                      <circle
                        key={s.id}
                        cx="64"
                        cy="64"
                        r={radius}
                        fill="none"
                        stroke={s.color}
                        strokeWidth="12"
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                      />
                    );
                  })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {(totalPeriodMinutes / 60).toFixed(1)}h
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                no período
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {subjectStats.slice(0, 4).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-slate-700 dark:text-slate-300 flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ backgroundColor: s.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{s.name}</span>
                </span>
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                  {s.share}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Per-Subject Goal Bars */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {subjectStats.map((sub) => (
            <div key={sub.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                  {sub.name}
                </span>
                <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400 shrink-0">
                  {sub.hours.toFixed(1)}h / {sub.targetHours}h ({sub.pct}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${sub.pct}%`, backgroundColor: sub.color }}
                />
              </div>
            </div>
          ))}
          {subjectStats.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nenhuma matéria cadastrada.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
