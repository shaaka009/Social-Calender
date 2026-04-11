import * as Haptics from "expo-haptics";
import React, { useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text } from "react-native";
import { theme } from "../../constants/theme";
import { wp } from "../../helpers/common";

/** Scale while finger is down before long-press fires (quick ramp). */
const RAMP_MS = 480;
const RAMP_PEAK = 1.1;

/** After long-press is recognized: ramp to this scale over `delayLongPress` ms (same as gesture delay). */
const LONG_HOLD_PEAK = 1.14;

/** Tap bounce after release (short press). */
const SCALE_TAP = 1.07;
const BUMP_UP_MS = 85;

/*
 * --- Edit modal timing (long-press) — tune here ---
 *
 * 1) `delayLongPress` prop (default 300) on Pressable below: milliseconds you must hold before
 *    long-press fires. Parent can pass it from contacts/events (e.g. delayLongPress={300}).
 *
 * 2) Long-hold ramp: `duration: delayLongPress` in handleLongPress — ramp to LONG_HOLD_PEAK takes
 *    the same time as (1). Change that duration here if you want the ramp faster/slower than
 *    the gesture delay.
 *
 * 3) OPEN_EDIT_AFTER_SETTLE_SPRING — if true (default), the edit modal opens only after the
 *    settle spring finishes (chip back to normal size). If false, the modal opens right after
 *    haptic at peak, *before* the settle spring; that feels noticeably earlier.
 *
 * 4) Spring friction / tension on the settle spring — lower friction or higher tension = quicker
 *    settle = modal appears sooner *only when* OPEN_EDIT_AFTER_SETTLE_SPRING is true.
 *
 * 5) MODAL_OPEN_EXTRA_DELAY_MS — extra wait *after* the settle spring completes before calling
 *    onLongPressEdit (only when OPEN_EDIT_AFTER_SETTLE_SPRING is true). Use 0 for none; small
 *    positive values delay the modal slightly more.
 */

/** @see comment block above */
const OPEN_EDIT_AFTER_SETTLE_SPRING = false;

/** @see comment block above */
const MODAL_OPEN_EXTRA_DELAY_MS = 0;

/**
 * Tag chip: scale ramps up while pressed. On release (short tap), the bump continues
 * from the current ramp scale (no reset to 1). Long-press runs a slower ramp to peak, then
 * light haptic + spring back to 1 without waiting for release; early release still settles.
 * Long-hold ramp duration matches `delayLongPress`. Edit modal timing: see constants above.
 */
const AnimatedTagFilterChip = ({
  label,
  borderColor,
  backgroundColor,
  textColor,
  onPress,
  onLongPress: onLongPressEdit,
  delayLongPress = 300,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const longPressHandledRef = useRef(false);
  const modalOpenedRef = useRef(false);

  const handlePressIn = () => {
    longPressHandledRef.current = false;
    scale.stopAnimation();
    scale.setValue(1);
    Animated.timing(scale, {
      toValue: RAMP_PEAK,
      duration: RAMP_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    // Long-press path: do not stopAnimation — that was cancelling the settle spring before
    // its completion callback ran, so the modal never opened. Let timing + spring finish.
    if (longPressHandledRef.current) {
      return;
    }

    scale.stopAnimation((current) => {
      const start =
        typeof current === "number" && Number.isFinite(current) ? current : 1;

      const releasePeak = Math.max(start, SCALE_TAP);
      const needBumpPhase = releasePeak > start + 0.002;

      if (needBumpPhase) {
        Animated.sequence([
          Animated.timing(scale, {
            toValue: releasePeak,
            duration: BUMP_UP_MS,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            friction: 7,
            tension: 200,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 200,
          useNativeDriver: true,
        }).start();
      }
    });
  };

  const handleLongPress = () => {
    if (!onLongPressEdit) return;
    longPressHandledRef.current = true;
    modalOpenedRef.current = false;
    scale.stopAnimation();
    Animated.timing(scale, {
      toValue: LONG_HOLD_PEAK,
      duration: delayLongPress,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || !longPressHandledRef.current) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // Open modal at peak (before settle) — earlier than waiting for spring; see OPEN_EDIT_AFTER_SETTLE_SPRING
      if (!OPEN_EDIT_AFTER_SETTLE_SPRING && !modalOpenedRef.current) {
        modalOpenedRef.current = true;
        onLongPressEdit();
      }

      // Settle spring — tune friction/tension in comment block above for how long until modal if OPEN_EDIT_AFTER_SETTLE_SPRING
      Animated.spring(scale, {
        toValue: 1,
        friction: 8,
        tension: 200,
        useNativeDriver: true,
      }).start(() => {
        if (!longPressHandledRef.current || modalOpenedRef.current) return;
        if (!OPEN_EDIT_AFTER_SETTLE_SPRING) return;

        const openModal = () => {
          if (!longPressHandledRef.current || modalOpenedRef.current) return;
          modalOpenedRef.current = true;
          onLongPressEdit();
        };

        if (MODAL_OPEN_EXTRA_DELAY_MS > 0) {
          setTimeout(openModal, MODAL_OPEN_EXTRA_DELAY_MS);
        } else {
          openModal();
        }
      });
    });
  };

  const animatedStyle = {
    transform: [{ scale }],
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      onLongPress={onLongPressEdit ? handleLongPress : undefined}
      delayLongPress={delayLongPress}
    >
      <Animated.View
        style={[
          styles.tagButton,
          {
            backgroundColor,
            borderColor: borderColor || theme.colors.primary,
          },
          animatedStyle,
        ]}
      >
        <Text style={[styles.tagText, { color: textColor }]}>{` ${label} `}</Text>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  tagButton: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(1.5),
    borderRadius: wp(4),
    borderWidth: 1,
    minHeight: wp(8),
    justifyContent: "center",
  },
  tagText: {
    fontSize: wp(3.5),
  },
});

export default AnimatedTagFilterChip;
