import {
    parseISO,
    isToday,
    isYesterday,
    isThisWeek,
    isThisISOWeek,
    isThisMonth,
    isThisQuarter,
    isThisYear,
} from 'date-fns';

// TODO
class TimestampIndex {

    static isWithinTimeframe(dateString, timeframe) {
        const date = parseISO(dateString);
        const timeframeChecks = {
            today: isToday,
            yesterday: isYesterday,
            thisWeek: isThisWeek,
            thisISOWeek: isThisISOWeek,
            thisMonth: isThisMonth,
            thisQuarter: isThisQuarter,
            thisYear: isThisYear,
        };

        return timeframeChecks[timeframe]?.(date) ?? false;
    }

}

export default TimestampIndex;
