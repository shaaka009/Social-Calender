const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_EVENT_SPAN_DAYS = 366;

const daysInMonth = (year, monthOneBased) => new Date(year, monthOneBased, 0).getDate();

export const toIsoDate = (year, monthOneBased, day) => {
  const safeDay = Math.min(day, daysInMonth(year, monthOneBased));
  return `${year}-${String(monthOneBased).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
};

const isIsoDate = (value) => typeof value === 'string' && ISO_DATE_REGEX.test(value);

export const parseIsoDateUtc = (isoDate) => {
  if (!isIsoDate(isoDate)) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
};

const formatIsoDateUtc = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getEventRange = (event) => {
  const startDate = event?.start_date || event?.date || null;
  if (!isIsoDate(startDate)) return null;

  const candidateEndDate = event?.end_date || startDate;
  const endDate = isIsoDate(candidateEndDate) ? candidateEndDate : startDate;

  if (endDate < startDate) {
    return { startDate, endDate: startDate };
  }

  return { startDate, endDate };
};

export const expandEventDates = (startDate, endDate) => {
  const startUtc = parseIsoDateUtc(startDate);
  const endUtc = parseIsoDateUtc(endDate);
  if (!startUtc || !endUtc || endUtc < startUtc) return [];

  const dates = [];
  const cursor = new Date(startUtc);

  while (cursor <= endUtc && dates.length < MAX_EVENT_SPAN_DAYS) {
    dates.push(formatIsoDateUtc(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
};

export const buildEventsByDate = (calendarEvents) => {
  const groupedEvents = {};
  const seenEventIdsByDate = {};

  calendarEvents.forEach((event) => {
    const dateRange = getEventRange(event);
    if (!dateRange) return;

    const eventDates = expandEventDates(dateRange.startDate, dateRange.endDate);
    const fallbackEventId = `${event.title || 'event'}-${dateRange.startDate}-${dateRange.endDate}`;
    const eventId = event?.id != null ? String(event.id) : fallbackEventId;

    eventDates.forEach((dateStr) => {
      if (!groupedEvents[dateStr]) {
        groupedEvents[dateStr] = [];
        seenEventIdsByDate[dateStr] = new Set();
      }

      if (seenEventIdsByDate[dateStr].has(eventId)) return;

      seenEventIdsByDate[dateStr].add(eventId);
      groupedEvents[dateStr].push(event);
    });
  });

  return groupedEvents;
};

export const buildMultiDayPillsByDate = (calendarEvents, { getEventColor, getEventBorderColor }) => {
  const multiDayRanges = [];

  calendarEvents.forEach((event) => {
    const dateRange = getEventRange(event);
    if (!dateRange || dateRange.startDate === dateRange.endDate) return;

    const eventDates = expandEventDates(dateRange.startDate, dateRange.endDate);
    if (eventDates.length === 0) return;

    const fallbackEventId = `${event.title || 'event'}-${dateRange.startDate}-${dateRange.endDate}`;
    const eventId = event?.id != null ? String(event.id) : fallbackEventId;

    multiDayRanges.push({
      eventId,
      title: event?.title || '',
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      dates: eventDates,
      duration: eventDates.length,
      color: getEventColor(event),
      borderColor: getEventBorderColor(event),
      createdAt: event?.created_at || null,
    });
  });

  const tierByEventId = Object.fromEntries(multiDayRanges.map((range) => [range.eventId, 'small']));
  const intersectionsByIndex = Array.from({ length: multiDayRanges.length }, () => []);
  const rangesIntersect = (a, b) => !(a.endDate < b.startDate || b.endDate < a.startDate);

  for (let i = 0; i < multiDayRanges.length; i += 1) {
    for (let j = i + 1; j < multiDayRanges.length; j += 1) {
      if (!rangesIntersect(multiDayRanges[i], multiDayRanges[j])) continue;
      intersectionsByIndex[i].push(j);
      intersectionsByIndex[j].push(i);
    }
  }

  const visited = new Set();
  const sortByPriority = (a, b) => {
    if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
    if (a.duration !== b.duration) return b.duration - a.duration;
    const createdTimeA = Date.parse(a.createdAt || '') || Number.POSITIVE_INFINITY;
    const createdTimeB = Date.parse(b.createdAt || '') || Number.POSITIVE_INFINITY;
    if (createdTimeA !== createdTimeB) return createdTimeA - createdTimeB;
    return a.eventId.localeCompare(b.eventId);
  };

  for (let i = 0; i < multiDayRanges.length; i += 1) {
    if (visited.has(i)) continue;

    const stack = [i];
    const componentIndexes = [];
    visited.add(i);

    while (stack.length > 0) {
      const current = stack.pop();
      componentIndexes.push(current);
      intersectionsByIndex[current].forEach((next) => {
        if (visited.has(next)) return;
        visited.add(next);
        stack.push(next);
      });
    }

    if (componentIndexes.length <= 1) continue;

    const sortedRanges = componentIndexes
      .map((index) => multiDayRanges[index])
      .sort(sortByPriority);

    const overlapCountByDate = {};
    let maxConcurrentOnAnyDate = 0;
    sortedRanges.forEach((range) => {
      range.dates.forEach((dateStr) => {
        overlapCountByDate[dateStr] = (overlapCountByDate[dateStr] || 0) + 1;
        if (overlapCountByDate[dateStr] > maxConcurrentOnAnyDate) {
          maxConcurrentOnAnyDate = overlapCountByDate[dateStr];
        }
      });
    });

    const tierPool = maxConcurrentOnAnyDate >= 3
      ? ['large', 'middle', 'small']
      : maxConcurrentOnAnyDate === 2
        ? ['middle', 'small']
        : ['small'];

    const activeRanges = [];
    sortedRanges.forEach((range) => {
      const stillActive = activeRanges.filter((activeRange) => activeRange.endDate >= range.startDate);
      activeRanges.length = 0;
      activeRanges.push(...stillActive);

      const usedTiers = new Set(activeRanges.map((activeRange) => activeRange.tier));
      const nextTier = tierPool.find((tier) => !usedTiers.has(tier)) || tierPool[tierPool.length - 1];
      tierByEventId[range.eventId] = nextTier;

      activeRanges.push({
        endDate: range.endDate,
        tier: nextTier,
      });
    });
  }

  const byDate = {};
  multiDayRanges.forEach((range) => {
    const tier = tierByEventId[range.eventId] || 'small';
    range.dates.forEach((dateStr, index) => {
      if (!byDate[dateStr]) byDate[dateStr] = [];
      byDate[dateStr].push({
        eventId: range.eventId,
        title: range.title,
        tier,
        color: range.color,
        borderColor: range.borderColor,
        isStart: index === 0,
        isEnd: index === range.dates.length - 1,
        duration: range.duration,
      });
    });
  });

  const tierRank = { large: 0, middle: 1, small: 2 };
  Object.keys(byDate).forEach((dateStr) => {
    byDate[dateStr].sort((a, b) => {
      if (tierRank[a.tier] !== tierRank[b.tier]) return tierRank[a.tier] - tierRank[b.tier];
      if (a.duration !== b.duration) return b.duration - a.duration;
      return a.eventId.localeCompare(b.eventId);
    });
  });

  return byDate;
};

export const buildMarkedDates = (eventsByDate, multiDayPillsByDate, colors) => Object.entries(eventsByDate).reduce((acc, [dateStr, eventsOnThisDate]) => {
  const seenDotKeys = new Set();
  const dots = eventsOnThisDate.flatMap((event) => {
    if (event.tags && event.tags.length > 0) {
      return event.tags
        .map((tag) => ({
          color: tag.color,
          key: `${event.id}-${tag.id}`,
        }))
        .filter((dot) => {
          if (seenDotKeys.has(dot.key)) return false;
          seenDotKeys.add(dot.key);
          return true;
        });
    }

    const defaultDot = {
      color: event.type === 'birthday' ? colors.rose : colors.primary,
      key: event.id?.toString() || `${event.title}-${dateStr}`,
    };

    if (seenDotKeys.has(defaultDot.key)) {
      return [];
    }
    seenDotKeys.add(defaultDot.key);
    return [defaultDot];
  });

  const singleDayEventsOnThisDate = eventsOnThisDate.filter((event) => {
    const dateRange = getEventRange(event);
    return dateRange && dateRange.startDate === dateRange.endDate;
  });
  const singleDayDots = singleDayEventsOnThisDate.flatMap((event) => {
    if (event.tags && event.tags.length > 0) {
      return event.tags
        .map((tag) => ({
          color: tag.color,
          key: `${event.id}-${tag.id}`,
        }));
    }

    return [{
      color: event.type === 'birthday' ? colors.rose : colors.primary,
      key: event.id?.toString() || `${event.title}-${dateStr}`,
    }];
  });

  const hasRange = Boolean(multiDayPillsByDate[dateStr]?.length);
  const primaryDotColor = dots[0]?.color || colors.primary;
  const singleDayDotColor = singleDayDots[0]?.color || primaryDotColor;
  const hasSingleDayDot = singleDayDots.length > 0;

  acc[dateStr] = hasRange ? {
    marked: hasSingleDayDot,
    dotColor: singleDayDotColor,
  } : {
    marked: true,
    dotColor: primaryDotColor,
  };

  return acc;
}, {});
