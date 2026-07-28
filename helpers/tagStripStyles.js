import { theme } from '../constants/theme';
import { wp } from './common';

/** Top inset for chip scale animation; + uses the same offset so it stays aligned with chips. */
const TAG_STRIP_TOP_INSET = wp(1);

/**
 * Tag filter strip (Contacts / Events tabs).
 *
 * - tagStrip: single wrapper — tweak padding/margin here; + and chips move together.
 * - tagScroll: clips horizontal list + edge fade (flexes; minWidth 0 avoids row overflow).
 * - chipRow: FlatList content only (row of chips / ghost), not the strip chrome.
 * - plusButton: hit target only; vertical offset matches chipRow via TAG_STRIP_TOP_INSET.
 */
export const tagStripStyles = {
  tagStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: wp(1),
    marginBottom: wp(2),
    // Whole strip: changing these moves + and chip list together.
    paddingLeft: wp(5),
    paddingRight: wp(3.5),
  },
  tagScroll: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    overflow: 'hidden'
  },
  chipRow: {
    flexDirection: 'row',
    gap: wp(2),
    alignItems: 'center',
    marginBottom: wp(2),
    paddingLeft: wp(5),
    paddingRight: wp(5),
    paddingTop: TAG_STRIP_TOP_INSET,
  },
  tagFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: wp(12),
  },
  plusButton: {
    backgroundColor: theme.colors.primary,
    minWidth: wp(8),
    minHeight: wp(8),
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: TAG_STRIP_TOP_INSET,
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
};
