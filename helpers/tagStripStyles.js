import { theme } from '../constants/theme';
import { wp } from './common';

/**
 * Shared layout for the tag strip (+ button + horizontal tag list) on Contacts and Events.
 * Single source of truth so tab switches do not shift the add button or chips.
 */
export const tagStripStyles = {
  tagsContainer: {
    paddingHorizontal: wp(5),
    flexDirection: 'row',
    gap: wp(2),
    marginBottom: wp(2),
    alignItems: 'center',
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: wp(1),
    marginBottom: wp(2),
    paddingRight: wp(3.5),
  },
  tagsList: {
    flexShrink: 1,
    flexGrow: 1,
    overflow: 'hidden',
    marginLeft: wp(0),
    paddingLeft: wp(0),
  },
  tagsFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: wp(12),
  },
  /* Match AnimatedTagFilterChip: minHeight wp(8), borderRadius wp(4); no border so use same box */
  plusButton: {
    backgroundColor: theme.colors.primary,
    minWidth: wp(8),
    minHeight: wp(8),
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: wp(5),
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
