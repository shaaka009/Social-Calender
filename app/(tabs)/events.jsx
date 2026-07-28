import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Modal, PanResponder, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-root-toast';
import EventCard from '../../components/events/EventCard';
import LoadingState from '../../components/LoadingState';
import ScreenWrapper from '../../components/ScreenWrapper';
import AnimatedTagFilterChip from '../../components/tags/AnimatedTagFilterChip';
import TagEditModal from '../../components/tags/TagEditModal';
import { TAG_COLOR_OPTIONS } from '../../constants/tagColors';
import { theme } from '../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../helpers/api';
import { parseDateLocal, wp } from '../../helpers/common';
import { tagStripStyles } from '../../helpers/tagStripStyles';
import { useCreateTag, useTags } from '../../helpers/useTags';

const getStart = (e) => (
  parseDateLocal(e?.start_date || e?.date) || new Date(0)
);
const getEnd = (e) => (
  parseDateLocal(e?.end_date || e?.start_date || e?.date) || getStart(e)
);
const getStartOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const getEndOfWeek = (date) => {
  const start = getStartOfDay(date);
  const day = start.getDay();
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + (6 - day));
};
const getEndOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const formatMonthDay = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const formatMonthDayRange = (event) => {
  const start = getStart(event);
  const end = getEnd(event);
  if (start.toDateString() === end.toDateString()) {
    return formatMonthDay(start);
  }
  return `${formatMonthDay(start)} - ${formatMonthDay(end)}`;
};

const Events = () => {
  const queryClient = useQueryClient();
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiFetch(ENDPOINTS.EVENTS),
    staleTime: 60 * 1000,
  });

  /* --------------------------------------------------
   * Event type selection (upcoming/past)
   * -------------------------------------------------- */
  const [selectedIndex, setSelectedIndex] = useState(0);
  const eventTypes = ['Upcoming', 'Past'];
  const [pagerWidth, setPagerWidth] = useState(0);
  const pagerTranslateX = useRef(new Animated.Value(0)).current;
  const dragStartTranslateX = useRef(0);
  const clampTranslateX = useCallback((value) => {
    if (!pagerWidth) return 0;
    const minX = -(eventTypes.length - 1) * pagerWidth;
    return Math.max(minX, Math.min(0, value));
  }, [eventTypes.length, pagerWidth]);
  const snapToIndex = useCallback((index) => {
    if (!pagerWidth) return;
    const clampedIndex = Math.max(0, Math.min(eventTypes.length - 1, index));
    Animated.spring(pagerTranslateX, {
      toValue: -clampedIndex * pagerWidth,
      useNativeDriver: true,
      damping: 22,
      stiffness: 240,
      mass: 0.8,
    }).start();
    if (clampedIndex !== selectedIndex) {
      setSelectedIndex(clampedIndex);
    }
  }, [eventTypes.length, pagerTranslateX, pagerWidth, selectedIndex]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => (
      pagerWidth > 0
      && Math.abs(gesture.dx) > 10
      && Math.abs(gesture.dx) > Math.abs(gesture.dy) + 4
    ),
    onPanResponderGrant: () => {
      pagerTranslateX.stopAnimation((value) => {
        dragStartTranslateX.current = value;
      });
    },
    onPanResponderMove: (_, gesture) => {
      const nextTranslateX = clampTranslateX(dragStartTranslateX.current + gesture.dx);
      pagerTranslateX.setValue(nextTranslateX);
    },
    onPanResponderRelease: (_, gesture) => {
      if (!pagerWidth) return;
      const projectedTranslateX = clampTranslateX(
        dragStartTranslateX.current + gesture.dx + (gesture.vx * 35)
      );
      const rawIndex = -projectedTranslateX / pagerWidth;
      const nextIndex = Math.max(0, Math.min(eventTypes.length - 1, Math.round(rawIndex)));
      snapToIndex(nextIndex);
    },
    onPanResponderTerminate: () => {
      snapToIndex(selectedIndex);
    },
  }), [clampTranslateX, eventTypes.length, pagerTranslateX, pagerWidth, selectedIndex, snapToIndex]);

  useEffect(() => {
    if (!pagerWidth) return;
    snapToIndex(selectedIndex);
  }, [pagerWidth, selectedIndex, snapToIndex]);

  /* --------------------------------------------------
   * Tag filtering (event types)
   * -------------------------------------------------- */
  const [selectedTags, setSelectedTags] = useState([]);

  const { data: tags = [] } = useTags();
  const createTagMutation = useCreateTag();

  const COLOR_OPTIONS = TAG_COLOR_OPTIONS;
  const [modalVisible, setModalVisible] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: COLOR_OPTIONS[0] });
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState(() => new Set());
  const [bulkDeleteModalVisible, setBulkDeleteModalVisible] = useState(false);
  const [bulkDeleteTargetIds, setBulkDeleteTargetIds] = useState([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [tagEditVisible, setTagEditVisible] = useState(false);
  const [tagEditTarget, setTagEditTarget] = useState(null);

  const toggleTag = useCallback((tag) => {
    setSelectedTags(prev => (
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    ));
  }, []);

  const handleTagFilterAfterEdit = useCallback(
    (updated) => {
      if (!tagEditTarget) return;
      const oldName = tagEditTarget.name;
      if (updated == null) {
        setSelectedTags((prev) => prev.filter((t) => t !== oldName));
        return;
      }
      const newName = updated.name;
      setSelectedTags((prev) => {
        if (!prev.includes(oldName)) return prev;
        return [...prev.filter((t) => t !== oldName), newName];
      });
    },
    [tagEditTarget]
  );

  /* --------------------------------------------------
   * Derived list
   * -------------------------------------------------- */
  const eventsByType = useMemo(() => {
    const buildEventsForType = (typeIndex) => {
      const today = new Date(new Date().setHours(0, 0, 0, 0));
      const timeFilteredEvents = events.filter(event => {
        const eventEndDate = getEnd(event);
        return typeIndex === 0 ? eventEndDate >= today : eventEndDate < today;
      });

      // Filter by tags if any are selected
      const tagFilteredEvents = selectedTags.length === 0
        ? timeFilteredEvents
        : timeFilteredEvents.filter(event =>
          selectedTags.every(tagName =>
            event.tags?.some(tag => tag.name === tagName)
          )
        );

      // Sort events based on their dates.
      // Birthday windowing now comes from backend virtual birthday events.
      return tagFilteredEvents.sort((a, b) => {
        const dateA = getStart(a);
        const dateB = getStart(b);
        return typeIndex === 0
          ? dateA.getTime() - dateB.getTime()
          : dateB.getTime() - dateA.getTime();
      });
    };

    return [buildEventsForType(0), buildEventsForType(1)];
  }, [events, selectedTags]);

  const getEventId = useCallback((event) => (
    event?.id != null ? String(event.id) : null
  ), []);
  const isSelectableEvent = useCallback((event) => (
    Boolean(getEventId(event)) && !event?.is_virtual
  ), [getEventId]);

  const upcomingListItems = useMemo(() => {
    const upcomingEvents = eventsByType[0] || [];
    if (upcomingEvents.length === 0) return [];

    const today = getStartOfDay(new Date());
    const endOfWeek = getEndOfWeek(today);
    const endOfMonth = getEndOfMonth(today);

    const buckets = {
      today: [],
      thisWeek: [],
      thisMonth: [],
      later: [],
    };

    upcomingEvents.forEach((event) => {
      const eventDate = getStartOfDay(getStart(event));
      if (eventDate.getTime() === today.getTime()) {
        buckets.today.push(event);
      } else if (eventDate <= endOfWeek) {
        buckets.thisWeek.push(event);
      } else if (eventDate <= endOfMonth) {
        buckets.thisMonth.push(event);
      } else {
        buckets.later.push(event);
      }
    });

    const orderedSections = [
      { key: 'today', title: 'Today' },
      { key: 'thisWeek', title: 'This Week' },
      { key: 'thisMonth', title: 'This Month' },
      { key: 'later', title: 'Later' },
    ];

    return orderedSections.flatMap((section) => {
      const sectionEvents = buckets[section.key];
      if (!sectionEvents || sectionEvents.length === 0) return [];
      return [
        { type: 'header', key: `header-${section.key}`, title: section.title },
        ...sectionEvents.map((event) => ({ type: 'event', key: `event-${event.id}`, event })),
      ];
    });
  }, [eventsByType]);
  const pastListItems = useMemo(() => {
    const pastEvents = eventsByType[1] || [];
    if (pastEvents.length === 0) return [];

    const today = getStartOfDay(new Date());
    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastMonthStart = new Date(today);
    lastMonthStart.setDate(lastMonthStart.getDate() - 30);

    const buckets = {
      lastWeek: [],
      lastMonth: [],
      everythingPastThat: [],
    };

    pastEvents.forEach((event) => {
      const eventDate = getStartOfDay(getStart(event));
      if (eventDate >= lastWeekStart) {
        buckets.lastWeek.push(event);
      } else if (eventDate >= lastMonthStart) {
        buckets.lastMonth.push(event);
      } else {
        buckets.everythingPastThat.push(event);
      }
    });

    const orderedSections = [
      { key: 'lastWeek', title: 'Last Week' },
      { key: 'lastMonth', title: 'Last Month' },
      { key: 'everythingPastThat', title: 'Earlier' },
    ];

    return orderedSections.flatMap((section) => {
      const sectionEvents = buckets[section.key];
      if (!sectionEvents || sectionEvents.length === 0) return [];
      return [
        { type: 'header', key: `header-${section.key}`, title: section.title },
        ...sectionEvents.map((event) => ({ type: 'event', key: `event-${event.id}`, event })),
      ];
    });
  }, [eventsByType]);

  const selectedCount = selectedEventIds.size;
  const modalTargetIds = useMemo(
    () => (bulkDeleteTargetIds.length > 0 ? bulkDeleteTargetIds : [...selectedEventIds]),
    [bulkDeleteTargetIds, selectedEventIds]
  );
  const modalTargetCount = modalTargetIds.length;
  const selectedEventsPreview = useMemo(() => {
    if (modalTargetIds.length === 0) return [];

    const selectedLookup = new Set(modalTargetIds);
    const combinedEvents = [...(eventsByType[0] || []), ...(eventsByType[1] || [])];
    const uniqueSelected = new Map();

    combinedEvents.forEach((event) => {
      const eventId = getEventId(event);
      if (!eventId || !selectedLookup.has(eventId) || uniqueSelected.has(eventId)) return;
      uniqueSelected.set(eventId, event);
    });

    return [...uniqueSelected.values()].sort((a, b) => getStart(a).getTime() - getStart(b).getTime());
  }, [eventsByType, getEventId, modalTargetIds]);
  const allSelectableIds = useMemo(() => {
    const ids = new Set();

    // Upcoming page contains section header rows + event rows.
    upcomingListItems.forEach((item) => {
      if (item?.type === 'header') return;
      const event = item?.event || item;
      if (!isSelectableEvent(event)) return;
      const eventId = getEventId(event);
      if (eventId) ids.add(eventId);
    });

    // Past page contains section header rows + event rows.
    pastListItems.forEach((item) => {
      if (item?.type === 'header') return;
      const event = item?.event || item;
      if (!isSelectableEvent(event)) return;
      const eventId = getEventId(event);
      if (eventId) ids.add(eventId);
    });

    return ids;
  }, [getEventId, isSelectableEvent, pastListItems, upcomingListItems]);

  useEffect(() => {
    if (!isSelectionMode) return;

    setSelectedEventIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((id) => allSelectableIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [allSelectableIds, isSelectionMode]);

  const handleToggleSelection = useCallback((event) => {
    const eventId = getEventId(event);
    if (!eventId || !isSelectableEvent(event)) return;

    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, [getEventId, isSelectableEvent]);

  const handleSelectionDisabledPress = useCallback((event) => {
    if (event?.type === 'birthday' || event?.is_virtual) {
      Toast.show(
        'Birthday events are auto-generated from contacts and cannot be deleted here.',
        {
          duration: Toast.durations.LONG,
          position: Toast.positions.BOTTOM,
          backgroundColor: theme.colors.text,
        }
      );
      return;
    }

    Toast.show('This event cannot be deleted from bulk selection.', {
      duration: Toast.durations.SHORT,
      position: Toast.positions.BOTTOM,
      backgroundColor: theme.colors.text,
    });
  }, []);

  const handleEnterSelectionMode = useCallback(() => {
    setSelectedEventIds(new Set());
    setIsSelectionMode(true);
  }, []);

  const handleExitSelectionMode = useCallback(() => {
    setBulkDeleteModalVisible(false);
    setBulkDeleteTargetIds([]);
    setIsBulkDeleting(false);
    setSelectedEventIds(new Set());
    setIsSelectionMode(false);
  }, []);

  const handleBulkDelete = useCallback(async () => {
    const idsToDelete = [...modalTargetIds];
    if (idsToDelete.length === 0 || isBulkDeleting) return;

    setIsBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        idsToDelete.map((id) => apiFetch(`${ENDPOINTS.EVENTS}${id}/`, { method: 'DELETE' }))
      );

      const failedIds = [];
      let deletedCount = 0;
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          deletedCount += 1;
        } else {
          failedIds.push(idsToDelete[index]);
        }
      });

      if (deletedCount > 0) {
        await Promise.all([
          queryClient.invalidateQueries(['events']),
          queryClient.invalidateQueries(['dashboard']),
        ]);
      }

      if (failedIds.length === 0) {
        Toast.show(
          deletedCount === 1
            ? 'Deleted 1 event'
            : `Deleted ${deletedCount} events`,
          {
            duration: Toast.durations.LONG,
            position: Toast.positions.BOTTOM,
            backgroundColor: theme.colors.success,
          }
        );
        handleExitSelectionMode();
        return;
      }

      if (deletedCount > 0) {
        Toast.show(
          `Deleted ${deletedCount} events, ${failedIds.length} failed`,
          {
            duration: Toast.durations.LONG,
            position: Toast.positions.BOTTOM,
            backgroundColor: theme.colors.warning || '#f59e0b',
          }
        );
      } else {
        Toast.show('Failed to delete selected events', {
          duration: Toast.durations.LONG,
          position: Toast.positions.BOTTOM,
          backgroundColor: theme.colors.error,
        });
      }

      setSelectedEventIds(new Set(failedIds));
      setBulkDeleteModalVisible(false);
      setBulkDeleteTargetIds([]);
      setIsSelectionMode(true);
    } finally {
      setIsBulkDeleting(false);
    }
  }, [handleExitSelectionMode, isBulkDeleting, modalTargetIds, queryClient]);

  const openBulkDeleteModal = useCallback(() => {
    const targetIds = [...selectedEventIds];
    if (targetIds.length === 0) return;
    setBulkDeleteTargetIds(targetIds);
    setBulkDeleteModalVisible(true);
  }, [selectedEventIds]);

  const renderEventItem = useCallback(({ item }) => {
    if (item?.type === 'header') {
      return (
        <View style={styles.sectionDivider}>
          <View style={styles.sectionDividerLine} />
          <Text style={styles.sectionDividerText}>{item.title}</Text>
          <View style={styles.sectionDividerLine} />
        </View>
      );
    }
    const event = item.event || item;
    const eventId = getEventId(event);
    return (
      <EventCard
        event={event}
        isSelectionMode={isSelectionMode}
        isSelected={Boolean(eventId && selectedEventIds.has(eventId))}
        isSelectionDisabled={!isSelectableEvent(event)}
        onToggleSelect={handleToggleSelection}
        onSelectionDisabledPress={handleSelectionDisabledPress}
      />
    );
  }, [
    getEventId,
    handleSelectionDisabledPress,
    handleToggleSelection,
    isSelectableEvent,
    isSelectionMode,
    selectedEventIds,
  ]);
  const eventKeyExtractor = useCallback((item, index) => (
    item.key || item.id?.toString() || `list-item-${index}`
  ), []);

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.titleContainer}>
        <Text style={styles.title}>Events</Text>
        <View style={styles.titleActions}>
          {isSelectionMode ? (
            <>
              <TouchableOpacity
                style={styles.selectionActionButton}
                onPress={handleExitSelectionMode}
                disabled={isBulkDeleting}
              >
                <Text style={styles.selectionActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.selectionDeleteButton,
                  (selectedCount === 0 || isBulkDeleting) && styles.selectionDeleteButtonDisabled,
                ]}
                onPress={openBulkDeleteModal}
                disabled={selectedCount === 0 || isBulkDeleting}
              >
                <Ionicons name="trash-outline" size={wp(5)} color="#fff" />
                <Text style={styles.selectionDeleteText}>
                  {isBulkDeleting ? 'Deleting...' : `Delete (${selectedCount})`}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleEnterSelectionMode}
            >
              <Ionicons
                name="trash-outline"
                size={wp(7)}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Event type selector */}
      <View style={styles.segmentContainer}>
        <View style={styles.headingTabs}>
          {eventTypes.map((type, index) => {
            const isActive = index === selectedIndex;
            return (
              <Pressable
                key={type}
                style={styles.headingTab}
                onPress={() => snapToIndex(index)}
              >
                <Text style={[styles.headingTabText, isActive && styles.headingTabTextActive]}>
                  {type}
                </Text>
                <View style={[styles.headingTabUnderline, isActive && styles.headingTabUnderlineActive]} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Tag filter strip */}
      <View style={styles.tagStrip}>
        <Pressable style={styles.plusButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={wp(5)} color="#fff" />
        </Pressable>

        <View style={styles.tagScroll}>
          {tags.length === 0 ? (
            <View style={styles.chipRow}>
              <View style={styles.ghostTag} pointerEvents="none">
                <Text style={styles.ghostTagText}>Create tags to organize events</Text>
              </View>
            </View>
          ) : (
            <FlatList
              data={tags}
              horizontal
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              removeClippedSubviews
              renderItem={({ item: tag }) => {
                const isSelected = selectedTags.includes(tag.name);
                return (
                  <AnimatedTagFilterChip
                    label={tag.name}
                    borderColor={tag.color || theme.colors.primary}
                    backgroundColor={isSelected ? tag.color || theme.colors.primary : 'transparent'}
                    textColor={isSelected ? '#fff' : theme.colors.textLight}
                    onPress={() => toggleTag(tag.name)}
                    onLongPress={() => {
                      setTagEditTarget(tag);
                      setTagEditVisible(true);
                    }}
                    delayLongPress={300}
                  />
                );
              }}
            />
          )}
          {/* right-edge fade */}
          {tags.length > 0 && (
            <LinearGradient
              colors={["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 1)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.tagFade}
              pointerEvents="none"
            />
          )}
        </View>

      <TagEditModal
        visible={tagEditVisible}
        tag={tagEditTarget}
        onClose={() => {
          setTagEditVisible(false);
          setTagEditTarget(null);
        }}
        onAfterChange={handleTagFilterAfterEdit}
      />

      {/* Create Tag Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Tag</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Tag name"
              value={newTag.name}
              onChangeText={(text) => setNewTag((prev) => ({ ...prev, name: text }))}
            />
            <View style={styles.colorsRow}>
              {COLOR_OPTIONS.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, newTag.color === c && styles.colorDotSelected]}
                  onPress={() => setNewTag((prev) => ({ ...prev, color: c }))}
                />
              ))}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalBtn}
                onPress={() => {
                  if (!newTag.name.trim()) return;
                  createTagMutation.mutate(newTag, {
                    onSuccess: () => {
                      setModalVisible(false);
                      setNewTag({ name: '', color: COLOR_OPTIONS[0] });
                    },
                  });
                }}
              >
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      </View>

      <View
        style={styles.listSwipeArea}
        onLayout={({ nativeEvent }) => {
          const nextWidth = nativeEvent.layout.width;
          if (!nextWidth || Math.abs(nextWidth - pagerWidth) < 1) return;
          setPagerWidth(nextWidth);
          pagerTranslateX.setValue(-selectedIndex * nextWidth);
        }}
      >
        <LoadingState isLoading={isLoading}>
          <View style={styles.pagerViewport}>
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.pagerTrack,
                {
                  width: pagerWidth ? pagerWidth * eventTypes.length : '200%',
                  transform: [{ translateX: pagerTranslateX }],
                },
              ]}
            >
              {eventTypes.map((_, pageIndex) => {
                const currentPageEvents = eventsByType[pageIndex] || [];
                const currentPageData = pageIndex === 0 ? upcomingListItems : pastListItems;
                return (
                  <View
                    key={`events-page-${pageIndex}`}
                    style={[styles.pagerPage, pagerWidth ? { width: pagerWidth } : null]}
                  >
                    {currentPageEvents.length > 0 ? (
                      <FlatList
                        data={currentPageData}
                        keyExtractor={eventKeyExtractor}
                        renderItem={renderEventItem}
                        contentContainerStyle={styles.listContent}
                        removeClippedSubviews
                        initialNumToRender={8}
                        maxToRenderPerBatch={8}
                        windowSize={7}
                      />
                    ) : !isLoading && (
                      <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No events yet</Text>
                        <Text style={styles.emptySubtext}>
                          Add your first event to start tracking important dates
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </Animated.View>
          </View>
        </LoadingState>
      </View>
      </View>

      {!isSelectionMode && (
        <View style={styles.addEventFabContainer} pointerEvents="box-none">
          <Pressable
            style={styles.addEventFab}
            onPress={() => router.push('/events/new')}
            accessibilityRole="button"
            accessibilityLabel="Add event"
          >
            <Ionicons name="add" size={wp(8)} color="#fff" />
          </Pressable>
        </View>
      )}

      <Modal
        visible={bulkDeleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setBulkDeleteModalVisible(false);
          setBulkDeleteTargetIds([]);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Selected Events</Text>
            <Text style={styles.bulkDeleteMessage}>
              {isBulkDeleting
                ? `Deleting ${modalTargetCount} event${modalTargetCount === 1 ? '' : 's'}...`
                : `Delete ${modalTargetCount} selected event${modalTargetCount === 1 ? '' : 's'}? This action cannot be undone.`}
            </Text>
            {selectedEventsPreview.length > 0 && (
              <View style={styles.bulkDeleteList}>
                {selectedEventsPreview.slice(0, 5).map((event) => (
                  <View key={`delete-preview-${event.id}`} style={styles.bulkDeleteListItemRow}>
                    <Text style={styles.bulkDeleteListItemTitle} numberOfLines={1}>
                      {event.display_title || event.title}
                    </Text>
                    <Text style={styles.bulkDeleteListItemDate} numberOfLines={1}>
                      {formatMonthDayRange(event)}
                    </Text>
                  </View>
                ))}
                {selectedEventsPreview.length > 5 && (
                  <Text style={styles.bulkDeleteListMore}>
                    +{selectedEventsPreview.length - 5} more
                  </Text>
                )}
              </View>
            )}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalBtn}
                onPress={() => {
                  setBulkDeleteModalVisible(false);
                  setBulkDeleteTargetIds([]);
                }}
                disabled={isBulkDeleting}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalBtn}
                onPress={handleBulkDelete}
                disabled={isBulkDeleting}
              >
                <Text style={styles.deleteText}>{isBulkDeleting ? 'Deleting...' : 'Delete'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  ...tagStripStyles,
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: wp(12),
    marginBottom: wp(4),
    paddingHorizontal: wp(5),
  },
  title: {
    fontSize: wp(9),
    fontWeight: '600',
    color: theme.colors.text,
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
  },
  actionButton: {
    height: wp(10),
    paddingHorizontal: wp(3),
    borderRadius: wp(2),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  selectionActionButton: {
    height: wp(10),
    paddingHorizontal: wp(2),
    justifyContent: 'center',
  },
  selectionActionText: {
    color: theme.colors.primary,
    fontSize: wp(4),
    fontWeight: '600',
  },
  selectionDeleteButton: {
    height: wp(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(1.5),
    backgroundColor: theme.colors.error,
    borderRadius: wp(4),
    paddingHorizontal: wp(3),
  },
  selectionDeleteButtonDisabled: {
    opacity: 0.5,
  },
  selectionDeleteText: {
    color: '#fff',
    fontSize: wp(3.5),
    fontWeight: '600',
  },
  badge: {
    backgroundColor: theme.colors.error,
    borderRadius: wp(4),
    minWidth: wp(4),
    height: wp(4),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -wp(1),
    right: -wp(1),
    paddingHorizontal: wp(1),
  },
  badgeText: {
    color: '#fff',
    fontSize: wp(3),
    fontWeight: '600',
  },
  segmentContainer: {
    paddingTop: wp(2),
  },
  headingTabs: {
    marginHorizontal: wp(5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: wp(2),
  },
  headingTab: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: wp(1.5),
  },
  headingTabText: {
    fontSize: wp(4.2),
    fontWeight: '600',
    color: theme.colors.textLight,
  },
  headingTabTextActive: {
    color: theme.colors.primary,
  },
  headingTabUnderline: {
    marginTop: wp(1.5),
    width: '100%',
    height: 2,
    backgroundColor: 'transparent',
    borderRadius: 999,
  },
  headingTabUnderlineActive: {
    backgroundColor: theme.colors.primary,
  },
  container: {
    flex: 1,
    paddingTop: wp(5),
  },
  listContent: {
    paddingBottom: wp(28),
  },
  addEventFabContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: wp(3),
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  addEventFab: {
    width: wp(14),
    height: wp(14),
    borderRadius: wp(7),
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    paddingHorizontal: wp(5),
    paddingTop: wp(4),
    paddingBottom: wp(2),
    backgroundColor: theme.colors.background,
  },
  sectionDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  sectionDividerText: {
    fontSize: wp(3.2),
    fontWeight: '700',
    color: theme.colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  listSwipeArea: {
    flex: 1,
  },
  pagerViewport: {
    flex: 1,
    overflow: 'hidden',
  },
  pagerTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  pagerPage: {
    flex: 1,
  },
  monthSection: {
    marginBottom: wp(6),
  },
  monthTitle: {
    fontSize: wp(4.5),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(3),
  },
  eventList: {
    gap: wp(3),
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: wp(3),
    paddingHorizontal: wp(5),
  },
  emptyText: {
    fontSize: wp(4.5),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: wp(2),
  },
  emptySubtext: {
    fontSize: wp(4),
    color: theme.colors.textLight,
    textAlign: 'center',
    marginBottom: wp(4),
  },
  emptyButton: {
    minWidth: wp(40),
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: wp(3),
    padding: wp(5),
    width: '80%',
  },
  modalTitle: {
    fontSize: wp(5),
    fontWeight: '600',
    marginBottom: wp(3),
    color: theme.colors.text,
  },
  modalInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(2),
    padding: wp(3),
    marginBottom: wp(3),
    color: theme.colors.text,
  },
  colorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
    marginBottom: wp(4),
  },
  colorDot: {
    width: wp(7),
    height: wp(7),
    borderRadius: wp(3.5),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderColor: theme.colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: wp(3),
  },
  modalBtn: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(1),
  },
  cancelText: {
    color: theme.colors.text,
    fontSize: wp(4),
  },
  saveText: {
    color: theme.colors.primary,
    fontSize: wp(4),
    fontWeight: '600',
  },
  deleteText: {
    color: theme.colors.error,
    fontSize: wp(4),
    fontWeight: '700',
  },
  bulkDeleteMessage: {
    color: theme.colors.text,
    fontSize: wp(3.8),
    lineHeight: wp(5.5),
    marginBottom: wp(3),
  },
  bulkDeleteList: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(2.5),
    paddingHorizontal: wp(3),
    paddingVertical: wp(2.5),
    marginBottom: wp(3),
    gap: wp(1),
  },
  bulkDeleteListItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  bulkDeleteListItemTitle: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.text,
    fontSize: wp(3.4),
  },
  bulkDeleteListItemDate: {
    color: theme.colors.textLight,
    fontSize: wp(3.2),
    textAlign: 'right',
  },
  bulkDeleteListMore: {
    color: theme.colors.textLight,
    fontSize: wp(3.3),
    fontStyle: 'italic',
    marginTop: wp(0.5),
  },
});

export default Events;