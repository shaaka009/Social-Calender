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
const addDaysToIsoDate = (isoDate, daysToAdd) => {
  const parsed = parseIsoDateUtc(isoDate);
  if (!parsed) return isoDate;
  parsed.setUTCDate(parsed.getUTCDate() + daysToAdd);
  return formatIsoDateUtc(parsed);
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
  const hiddenEventIds = new Set();

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

  const tierByEventId = Object.fromEntries(multiDayRanges.map((range) => [range.eventId, 'large']));
  const intersectionsByIndex = Array.from({ length: multiDayRanges.length }, () => []);
  const sortedRangeIndexes = multiDayRanges
    .map((_, index) => index)
    .sort((a, b) => {
      const rangeA = multiDayRanges[a];
      const rangeB = multiDayRanges[b];
      if (rangeA.startDate !== rangeB.startDate) return rangeA.startDate.localeCompare(rangeB.startDate);
      if (rangeA.endDate !== rangeB.endDate) return rangeA.endDate.localeCompare(rangeB.endDate);
      return rangeA.eventId.localeCompare(rangeB.eventId);
    });
  const activeIndexes = [];
  sortedRangeIndexes.forEach((rangeIndex) => {
    const currentRange = multiDayRanges[rangeIndex];
    for (let i = activeIndexes.length - 1; i >= 0; i -= 1) {
      const activeRange = multiDayRanges[activeIndexes[i]];
      if (activeRange.endDate < currentRange.startDate) {
        activeIndexes.splice(i, 1);
      }
    }

    activeIndexes.forEach((activeIndex) => {
      intersectionsByIndex[rangeIndex].push(activeIndex);
      intersectionsByIndex[activeIndex].push(rangeIndex);
    });

    activeIndexes.push(rangeIndex);
  });

  const visited = new Set();
  const sortByPriority = (a, b) => {
    if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
    if (a.duration !== b.duration) return b.duration - a.duration;
    const createdTimeA = Date.parse(a.createdAt || '') || Number.POSITIVE_INFINITY;
    const createdTimeB = Date.parse(b.createdAt || '') || Number.POSITIVE_INFINITY;
    if (createdTimeA !== createdTimeB) return createdTimeA - createdTimeB;
    return a.eventId.localeCompare(b.eventId);
  };
  const pickGreedyNonOverlapping = (ranges) => {
    const orderedRanges = [...ranges].sort((a, b) => {
      if (a.endDate !== b.endDate) return a.endDate.localeCompare(b.endDate);
      if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
      if (a.duration !== b.duration) return b.duration - a.duration;
      return a.eventId.localeCompare(b.eventId);
    });

    const selectedEventIds = new Set();
    let lastAcceptedEndDate = null;

    orderedRanges.forEach((range) => {
      if (lastAcceptedEndDate && range.startDate <= lastAcceptedEndDate) return;
      selectedEventIds.add(range.eventId);
      lastAcceptedEndDate = range.endDate;
    });

    return selectedEventIds;
  };
  const minimizeTiersInComponent = (componentIndexes, hiddenEventIdsSet) => {
    const visibleComponentIndexes = componentIndexes.filter(
      (index) => !hiddenEventIdsSet.has(multiDayRanges[index].eventId)
    );
    if (visibleComponentIndexes.length === 0) return;

    const visibleIndexSet = new Set(visibleComponentIndexes);
    let changed = true;

    while (changed) {
      changed = false;

      // First pass: if a middle tier has no overlapping small tier, shrink it.
      visibleComponentIndexes.forEach((index) => {
        const eventId = multiDayRanges[index].eventId;
        if (tierByEventId[eventId] !== 'middle') return;

        const hasOverlappingSmall = intersectionsByIndex[index].some((neighborIndex) => {
          if (!visibleIndexSet.has(neighborIndex)) return false;
          const neighborEventId = multiDayRanges[neighborIndex].eventId;
          return tierByEventId[neighborEventId] === 'small';
        });

        if (!hasOverlappingSmall) {
          tierByEventId[eventId] = 'small';
          changed = true;
        }
      });

      // Second pass: if a large tier has no overlapping middle tier, shrink it.
      visibleComponentIndexes.forEach((index) => {
        const eventId = multiDayRanges[index].eventId;
        if (tierByEventId[eventId] !== 'large') return;

        const hasOverlappingMiddle = intersectionsByIndex[index].some((neighborIndex) => {
          if (!visibleIndexSet.has(neighborIndex)) return false;
          const neighborEventId = multiDayRanges[neighborIndex].eventId;
          return tierByEventId[neighborEventId] === 'middle';
        });

        if (!hasOverlappingMiddle) {
          tierByEventId[eventId] = 'middle';
          changed = true;
        }
      });
    }
  };
  const getMaxConcurrencyForComponent = (componentIndexes) => {
    const boundaryDeltas = [];
    componentIndexes.forEach((index) => {
      const range = multiDayRanges[index];
      boundaryDeltas.push({ date: range.startDate, delta: 1 });
      boundaryDeltas.push({ date: addDaysToIsoDate(range.endDate, 1), delta: -1 });
    });

    boundaryDeltas.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.delta - b.delta;
    });

    let runningOverlap = 0;
    let maxOverlap = 0;
    boundaryDeltas.forEach((point) => {
      runningOverlap += point.delta;
      if (runningOverlap > maxOverlap) {
        maxOverlap = runningOverlap;
      }
    });

    return maxOverlap;
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

    const sortedRanges = componentIndexes
      .map((index) => multiDayRanges[index])
      .sort(sortByPriority);

    const maxConcurrentOnAnyDate = getMaxConcurrencyForComponent(componentIndexes);

    const tierPool = maxConcurrentOnAnyDate >= 3
      ? ['large', 'middle', 'small']
      : maxConcurrentOnAnyDate === 2
        ? ['large', 'middle']
        : ['large'];

    let unassignedRanges = [...sortedRanges];
    tierPool.forEach((tier) => {
      if (unassignedRanges.length === 0) return;
      const selectedEventIds = pickGreedyNonOverlapping(unassignedRanges);
      if (selectedEventIds.size === 0) return;

      unassignedRanges.forEach((range) => {
        if (selectedEventIds.has(range.eventId)) {
          tierByEventId[range.eventId] = tier;
        }
      });

      unassignedRanges = unassignedRanges.filter((range) => !selectedEventIds.has(range.eventId));
    });

    // Any overflow beyond available tiers is hidden from pill rendering.
    if (unassignedRanges.length > 0) {
      unassignedRanges.forEach((range) => {
        hiddenEventIds.add(range.eventId);
      });
    }

    minimizeTiersInComponent(componentIndexes, hiddenEventIds);
  }

  const byDate = {};
  multiDayRanges.forEach((range) => {
    if (hiddenEventIds.has(range.eventId)) return;
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
