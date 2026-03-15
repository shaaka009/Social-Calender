import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Modal, PanResponder, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import EventCard from '../../components/events/EventCard';
import LoadingState from '../../components/LoadingState';
import ScreenWrapper from '../../components/ScreenWrapper';
import { theme } from '../../constants/theme';
import { ENDPOINTS, apiFetch } from '../../helpers/api';
import { wp } from '../../helpers/common';
import { useCreateTag, useTags } from '../../helpers/useTags';

// Helper utils for new date fields parsed in local timezone to avoid off-by-one issues
const parseLocalDate = (isoStr) => {
  if (!isoStr) return new Date();
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const getStart = (e) => parseLocalDate(e.start_date || e.date);

const Events = () => {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiFetch(ENDPOINTS.EVENTS),
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
  }), [clampTranslateX, eventTypes.length, pagerWidth, selectedIndex, snapToIndex]);

  useEffect(() => {
    if (!pagerWidth) return;
    snapToIndex(selectedIndex);
  }, [pagerWidth, selectedIndex, snapToIndex]);

  /* --------------------------------------------------
   * Tag filtering (event types)
   * -------------------------------------------------- */
  const [selectedTags, setSelectedTags] = useState([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const { data: tags = [] } = useTags();
  const createTagMutation = useCreateTag();

  const COLOR_OPTIONS = ['#ff8c00', '#ff4d4f', '#40a9ff', '#52c41a', '#faad14', '#722ed1', '#13c2c2'];
  const [modalVisible, setModalVisible] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: COLOR_OPTIONS[0] });

  const toggleTag = useCallback((tag) => {
    setSelectedTags(prev => (
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    ));
  }, []);

  /* --------------------------------------------------
   * Derived list
   * -------------------------------------------------- */
  const eventsByType = useMemo(() => {
    const buildEventsForType = (typeIndex) => {
      const today = new Date(new Date().setHours(0, 0, 0, 0));

      // First filter by upcoming/past with special handling for birthdays
      const timeFilteredEvents = events.filter(event => {
        const eventDate = getStart(event);

        // For birthday events, compare only month and day
        if (event.type === 'birthday') {
          // Get month and day for comparison (1-based month)
          const todayMonth = today.getMonth() + 1;
          const todayDay = today.getDate();
          const eventMonth = eventDate.getMonth() + 1;
          const eventDay = eventDate.getDate();

          // Calculate month-day combinations for comparison (e.g., "12-25" for December 25)
          const todayValue = todayMonth * 100 + todayDay;
          const eventValue = eventMonth * 100 + eventDay;

          // Calculate 6 months forward and backward
          let sixMonthsForward = todayMonth + 6;
          let sixMonthsBackward = todayMonth - 6;

          // Adjust for year wrap-around
          if (sixMonthsForward > 12) sixMonthsForward = sixMonthsForward - 12;
          if (sixMonthsBackward <= 0) sixMonthsBackward = sixMonthsBackward + 12;

          if (typeIndex === 0) {
            // Upcoming: Show if date is within next 6 months
            if (sixMonthsForward > todayMonth) {
              // No year wrap-around case
              return (eventValue >= todayValue && eventMonth <= sixMonthsForward);
            }
            // Year wrap-around case (e.g., today is October, show events until March)
            return (eventValue >= todayValue || eventMonth <= sixMonthsForward);
          }

          // Past: Show if date is within last 6 months
          if (sixMonthsBackward < todayMonth) {
            // No year wrap-around case
            return (eventValue < todayValue && eventMonth >= sixMonthsBackward);
          }
          // Year wrap-around case (e.g., today is March, show events since October)
          return (eventValue < todayValue || eventMonth >= sixMonthsBackward);
        }

        // For non-birthday events, use standard today cutoff
        return typeIndex === 0
          ? eventDate >= today  // Upcoming events
          : eventDate < today;  // Past events
      });

      // Filter by tags if any are selected
      const tagFilteredEvents = selectedTags.length === 0
        ? timeFilteredEvents
        : timeFilteredEvents.filter(event =>
          selectedTags.every(tagName =>
            event.tags?.some(tag => tag.name === tagName)
          )
        );

      // Sort events based on their dates
      return tagFilteredEvents.sort((a, b) => {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth(); // 0-11
      
      // Create comparison dates, handling year boundaries
      const getComparisonDate = (event) => {
        const eventDate = getStart(event);
        const eventMonth = eventDate.getMonth(); // 0-11
        
        // Determine if we should use current year or next/previous year
        let yearToUse = currentYear;
        
        if (typeIndex === 0) { // Upcoming events
          // If event month is earlier than current month, it must be next year
          if (eventMonth < currentMonth) {
            yearToUse = currentYear + 1;
          }
        } else { // Past events
          // If event month is later than current month, it must be previous year
          if (eventMonth > currentMonth) {
            yearToUse = currentYear - 1;
          }
        }
        
        if (event.type === 'birthday') {
          return new Date(
            yearToUse,
            eventMonth,
            eventDate.getDate()
          );
        }
        
        // For non-birthday events, use actual date but adjust year if needed
        if (typeIndex === 0 && eventMonth < currentMonth) {
          return new Date(
            currentYear + 1,
            eventMonth,
            eventDate.getDate()
          );
        } else if (typeIndex === 1 && eventMonth > currentMonth) {
          return new Date(
            currentYear - 1,
            eventMonth,
            eventDate.getDate()
          );
        }
        return eventDate;
      };

      const dateA = getComparisonDate(a);
      const dateB = getComparisonDate(b);

      // For upcoming events, sort in ascending order (nearest future date first)
      // For past events, sort in descending order (most recent past date first)
      return typeIndex === 0
        ? dateA.getTime() - dateB.getTime()  // Upcoming: ascending
        : dateB.getTime() - dateA.getTime(); // Past: descending
    });
    };

    return [buildEventsForType(0), buildEventsForType(1)];
  }, [events, selectedTags]);

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.titleContainer}>
        <Text style={styles.title}>Events</Text>
        <View style={styles.titleActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/home')}
          >
            <Ionicons 
              name="notifications-outline" 
              size={wp(7)} 
              color={theme.colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/events/new')}
          >
            <Ionicons 
              name="add" 
              size={wp(8)} 
              color={theme.colors.text} 
            />
          </TouchableOpacity>
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

      {/* Tags row */}
      <View style={styles.tagsRow}>
        <Pressable style={styles.plusButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={wp(6)} color="#fff" />
        </Pressable>

        {/* Wrap FlatList to allow fade overlay */}
        <View style={styles.tagsList}>
          {tags.length === 0 ? (
            <View style={styles.tagsContainer}>
              <View style={styles.ghostTag} pointerEvents="none">
                <Text style={styles.ghostTagText}>Create tags to organize events</Text>
              </View>
            </View>
          ) : (
            <FlatList
              data={tags}
              horizontal
              keyExtractor={(item) => item.name}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagsContainer}
              renderItem={({ item: tag }) => {
                const isSelected = selectedTags.includes(tag.name);
                return (
                  <Pressable
                    onPress={() => toggleTag(tag.name)}
                    style={[styles.tagButton, {
                      backgroundColor: isSelected ? tag.color || theme.colors.primary : 'transparent',
                      borderColor: tag.color || theme.colors.primary,
                    }]}
                  >
                    <Text style={[styles.tagText, { color: isSelected ? '#fff' : theme.colors.textLight }]}> {tag.name} </Text>
                  </Pressable>
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
              style={styles.tagsFade}
              pointerEvents="none"
            />
          )}
        </View>

        {/* spacing between tags and filter */}
        <View style={{ width: wp(2) }} />
        <TouchableOpacity style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
          <Ionicons name="filter" size={wp(6)} color={theme.colors.text} />
        </TouchableOpacity>
       
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

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Events</Text>
            <Text style={{ color: theme.colors.text, marginBottom: wp(3) }}>Filter options coming soon...</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtn} onPress={() => setFilterModalVisible(false)}>
                <Text style={styles.cancelText}>Close</Text>
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
                const pageEvents = eventsByType[pageIndex] || [];
                return (
                  <View
                    key={`events-page-${pageIndex}`}
                    style={[styles.pagerPage, pagerWidth ? { width: pagerWidth } : null]}
                  >
                    {pageEvents.length > 0 ? (
                      <FlatList
                        data={pageEvents}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={({ item }) => <EventCard event={item} />}
                        contentContainerStyle={styles.listContent}
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
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    gap: wp(0),
  },
  actionButton: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(2),
    borderRadius: wp(2),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
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
    paddingVertical: wp(5),
  },
  listContent: {
    paddingBottom: wp(10),
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
  /* Tags */
  tagsContainer: {
    paddingHorizontal: wp(5),
    flexDirection: 'row',
    gap: wp(2),
    marginTop: wp(2),
    marginBottom: wp(2),
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: wp(2),
    marginBottom: wp(2),
    paddingRight: wp(3.5),
  },
  tagsList: {
    flexShrink: 1,
    flexGrow: 1,
    overflow: 'hidden',
  },
  tagsFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: wp(12),
  },
  filterButton: {
    paddingHorizontal: wp(2),
    paddingVertical: wp(2),
  },
  tagButton: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(1.5),
    borderRadius: wp(4),
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: wp(8),
    justifyContent: 'center',
  },
  tagButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tagText: {
    color: theme.colors.textLight,
    fontSize: wp(3.5),
  },
  tagTextSelected: {
    color: '#fff',
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
  plusButton: {
    backgroundColor: theme.colors.primary,
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: wp(5),
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
  ghostTag: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(1.5),
    borderRadius: wp(4),
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    minHeight: wp(8),
    justifyContent: 'center',
    opacity: 0.5,
  },
  ghostTagText: {
    color: theme.colors.textLight,
    fontSize: wp(3.5),
    fontStyle: 'italic',
  },
});

export default Events;