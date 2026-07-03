import { useMemo, useState } from 'react';
import './ActivityCalendar.css';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function toKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * ActivityCalendar
 * Renders a month-view heatmap of a student's study activity.
 *
 * Expects `activity` as an array of records from the backend, one per day
 * that has any recorded lesson progress, e.g.:
 *   [{ date: '2026-06-30', lessons_completed: 2 }, { date: '2026-07-01', lessons_completed: 1 }]
 *
 * Days not present in the array are treated as "not studied".
 * See backend notes in the chat response for the endpoint shape this expects.
 */
export default function ActivityCalendar({ activity = [], loading = false }) {
    const today = new Date();
    const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

    const activityMap = useMemo(() => {
        const map = new Map();
        activity.forEach((a) => {
            if (a && a.date) map.set(a.date, a.lessons_completed ?? (a.studied ? 1 : 0));
        });
        return map;
    }, [activity]);

    const earliestRecord = useMemo(() => {
        if (!activity.length) return null;
        return activity.reduce((min, a) => (a.date < min ? a.date : min), activity[0].date);
    }, [activity]);

    const cells = useMemo(() => {
        const year = cursor.getFullYear();
        const month = cursor.getMonth();
        const firstDay = new Date(year, month, 1);
        const startOffset = firstDay.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const out = [];
        for (let i = 0; i < startOffset; i++) out.push(null);
        for (let d = 1; d <= daysInMonth; d++) out.push(new Date(year, month, d));
        return out;
    }, [cursor]);

    const { activeCount, trackedCount, streak } = useMemo(() => {
        let active = 0;
        let tracked = 0;
        cells.forEach((d) => {
            if (!d || d > today) return;
            tracked += 1;
            if ((activityMap.get(toKey(d)) ?? 0) > 0) active += 1;
        });

        // Current streak, counting back from today across all known activity (not just this month)
        let s = 0;
        const cursor2 = new Date(today);
        while (true) {
            const key = toKey(cursor2);
            if ((activityMap.get(key) ?? 0) > 0) {
                s += 1;
                cursor2.setDate(cursor2.getDate() - 1);
            } else if (key === toKey(today)) {
                // today not yet studied — don't break the streak, just don't count it
                cursor2.setDate(cursor2.getDate() - 1);
                continue;
            } else {
                break;
            }
        }
        return { activeCount: active, trackedCount: tracked, streak: s };
    }, [cells, activityMap, today]);

    const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const isCurrentMonth = cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth();
    const canGoPrev = !earliestRecord || `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}` > earliestRecord.slice(0, 7);

    const goPrev = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
    const goNext = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));

    return (
        <div className="activity-cal">
            <div className="activity-cal-hd">
                <div>
                    <h3>Study Activity</h3>
                    <p className="activity-cal-sub">
                        {loading ? 'Loading…' : `${activeCount}/${trackedCount} active days`}
                        {!loading && streak > 0 ? ` · ${streak} day streak` : ''}
                    </p>
                </div>
                <div className="activity-cal-nav">
                    <button type="button" onClick={goPrev} disabled={!canGoPrev} aria-label="Previous month">
                        <i className="ti ti-chevron-left" />
                    </button>
                    <span className="activity-cal-month">{monthLabel}</span>
                    <button type="button" onClick={goNext} disabled={isCurrentMonth} aria-label="Next month">
                        <i className="ti ti-chevron-right" />
                    </button>
                </div>
            </div>

            <div className="activity-cal-weekdays">
                {WEEKDAYS.map((w, i) => (
                    <span key={i}>{w}</span>
                ))}
            </div>

            <div className="activity-cal-grid">
                {loading
                    ? Array.from({ length: 35 }).map((_, i) => <span key={i} className="activity-cal-cell skeleton-cell" />)
                    : cells.map((d, i) => {
                        if (!d) return <span key={i} className="activity-cal-cell is-empty" />;
                        const key = toKey(d);
                        const count = activityMap.get(key) ?? 0;
                        const isFuture = d > today;
                        const isToday = key === toKey(today);
                        const level = isFuture ? 'future' : count > 2 ? 'high' : count > 0 ? 'active' : 'none';
                        return (
                            <span
                                key={i}
                                className={`activity-cal-cell level-${level}${isToday ? ' is-today' : ''}`}
                                title={
                                    isFuture
                                        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                        : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${count > 0 ? `${count} lesson${count === 1 ? '' : 's'} studied` : 'No activity'
                                        }`
                                }
                            >
                                {d.getDate()}
                            </span>
                        );
                    })}
            </div>

            {!loading && trackedCount > 0 && activeCount === 0 && (
                <p className="activity-cal-empty-hint">No lessons studied yet this month — start one to begin a streak.</p>
            )}

            <div className="activity-cal-legend">
                <span className="legend-swatch level-none" /> <span>None</span>
                <span className="legend-swatch level-active" /> <span>Studied</span>
                <span className="legend-swatch level-high" /> <span>Active day</span>
            </div>
        </div>
    );
}