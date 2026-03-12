import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { HapticTouchable } from './GlobalHaptic';
import { nz, rs } from '../utils/constant';

const GREEN = '#03954E';
const LIGHT_GREEN = `${GREEN}18`;
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const startOfDay = (d) => {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
};
const isSameDay = (a, b) =>
  a && b && startOfDay(a).getTime() === startOfDay(b).getTime();

const isBetween = (d, start, end) => {
  if (!start || !end) return false;
  const t = startOfDay(d).getTime();
  return t > startOfDay(start).getTime() && t < startOfDay(end).getTime();
};

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const fmtShort = (d) =>
  d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

const RangeCalendar = ({ startDate, endDate, onRangeChange }) => {
  const today = startOfDay(new Date());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  useEffect(() => {
    if (startDate) {
      setViewYear(startDate.getFullYear());
      setViewMonth(startDate.getMonth());
    }
  }, []);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    const next = new Date(viewYear, viewMonth + 1, 1);
    if (next <= today) {
      if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
      else setViewMonth(m => m + 1);
    }
  };

  const canGoNext = useMemo(
    () => new Date(viewYear, viewMonth + 1, 1) <= today,
    [viewYear, viewMonth],
  );

  const handleDayPress = useCallback((day) => {
    const selected = startOfDay(new Date(viewYear, viewMonth, day));
    if (selected > today) return;

    if (!startDate) {
      onRangeChange(selected, null);
    } else if (startDate && !endDate) {
      if (isSameDay(selected, startDate)) {
        onRangeChange(selected, selected);
      } else if (selected < startDate) {
        onRangeChange(selected, startDate);
      } else {
        onRangeChange(startDate, selected);
      }
    } else {
      onRangeChange(selected, null);
    }
  }, [startDate, endDate, viewYear, viewMonth, today, onRangeChange]);

  const cells = useMemo(() => {
    const result = [];
    for (let i = 0; i < firstDay; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(d);
    return result;
  }, [firstDay, daysInMonth]);

  return (
    <View style={cal.container}>
      <View style={cal.nav}>
        <TouchableOpacity
          onPress={prevMonth}
          style={cal.navBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="chevron-left" size={nz(20)} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={cal.monthTitle}>{MONTHS[viewMonth]} {viewYear}</Text>
        <TouchableOpacity
          onPress={nextMonth}
          style={[cal.navBtn, !canGoNext && cal.navBtnDisabled]}
          disabled={!canGoNext}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="chevron-right" size={nz(20)} color={canGoNext ? '#1A1A1A' : '#CCC'} />
        </TouchableOpacity>
      </View>
      <View style={cal.weekRow}>
        {DAYS.map((d) => (
          <Text key={d} style={cal.dayLabel}>{d}</Text>
        ))}
      </View>

      <View style={cal.grid}>
        {cells.map((day, idx) => {
          if (!day) return <View key={`empty-${idx}`} style={cal.cell} />;

          const thisDate = startOfDay(new Date(viewYear, viewMonth, day));
          const isDisabled = thisDate > today;
          const isStart = isSameDay(thisDate, startDate);
          const isEnd = isSameDay(thisDate, endDate);
          const isInRange = isBetween(thisDate, startDate, endDate);
          const isSingleDay = isStart && isEnd;
          const isToday = isSameDay(thisDate, today);

          const showRangeBg =
            isInRange ||
            (isStart && endDate && !isSingleDay) ||
            (isEnd && startDate && !isSingleDay);
          const isRangeStart = isStart && endDate && !isSingleDay;
          const isRangeEnd = isEnd && startDate && !isSingleDay;

          return (
            <TouchableOpacity
              key={day}
              onPress={() => !isDisabled && handleDayPress(day)}
              activeOpacity={isDisabled ? 1 : 0.7}
              style={[
                cal.cell,
                showRangeBg && cal.cellInRange,
                isRangeStart && cal.cellRangeStart,
                isRangeEnd && cal.cellRangeEnd,
              ]}
            >
              <View style={[
                cal.dayCircle,
                (isStart || isEnd) && !isSingleDay && cal.dayCircleEndpoint,
                isSingleDay && cal.dayCircleSingle,
                isToday && !isStart && !isEnd && cal.dayCircleToday,
              ]}>
                <Text style={[
                  cal.dayText,
                  isDisabled && cal.dayTextDisabled,
                  (isStart || isEnd) && cal.dayTextSelected,
                  isToday && !isStart && !isEnd && cal.dayTextToday,
                  isInRange && cal.dayTextInRange,
                ]}>
                  {day}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const cal = StyleSheet.create({
  container: {
    backgroundColor: '#FAFAFA',
    borderRadius: rs(16),
    padding: rs(12),
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: rs(14),
    paddingHorizontal: rs(4),
  },
  navBtn: {
    width: rs(32),
    height: rs(32),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rs(16),
    backgroundColor: '#F0F0F0',
  },
  navBtnDisabled: { backgroundColor: 'transparent' },
  monthTitle: {
    fontSize: nz(15),
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.3,
  },
  weekRow: { flexDirection: 'row', marginBottom: rs(6) },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: nz(11),
    fontWeight: '600',
    color: '#999',
    paddingVertical: rs(4),
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellInRange: { backgroundColor: LIGHT_GREEN },
  cellRangeStart: {
    backgroundColor: LIGHT_GREEN,
    borderTopLeftRadius: rs(20),
    borderBottomLeftRadius: rs(20),
  },
  cellRangeEnd: {
    backgroundColor: LIGHT_GREEN,
    borderTopRightRadius: rs(20),
    borderBottomRightRadius: rs(20),
  },
  dayCircle: {
    width: rs(32),
    height: rs(32),
    borderRadius: rs(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleEndpoint: { backgroundColor: GREEN },
  dayCircleSingle: {
    backgroundColor: GREEN,
    borderWidth: 2,
    borderColor: `${GREEN}55`,
  },
  dayCircleToday: { borderWidth: 1.5, borderColor: GREEN },
  dayText: { fontSize: nz(13), fontWeight: '500', color: '#1A1A1A' },
  dayTextDisabled: { color: '#CCC' },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  dayTextToday: { color: GREEN, fontWeight: '700' },
  dayTextInRange: { color: GREEN, fontWeight: '600' },
});

export const DateFilterBar = React.memo(({
  activeChip,
  startDate,
  endDate,
  onChipSelect,
  onCustomApply,
  triggerOpen = false,
  onTriggerConsumed,   
  hideChips = false,   
}) => {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [tempStart, setTempStart] = useState(null);
  const [tempEnd, setTempEnd] = useState(null);

  useEffect(() => {
    if (triggerOpen && !sheetVisible) {
      openCustomSheet();
      onTriggerConsumed?.();
    }
  }, [triggerOpen]);

  const openCustomSheet = () => {
    if (activeChip === 'custom' && startDate && endDate) {
      setTempStart(startDate);
      setTempEnd(endDate);
    } else {
      setTempStart(null);
      setTempEnd(null);
    }
    setSheetVisible(true);
  };

  const handleRangeChange = useCallback((start, end) => {
    setTempStart(start);
    setTempEnd(end);
  }, []);

  const handleApply = () => {
    if (tempStart && tempEnd) {
      setSheetVisible(false);
      onCustomApply(tempStart, tempEnd);
    }
  };

  const rangeReady = !!(tempStart && tempEnd);

  const chips = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    {
      key: 'custom',
      label:
        activeChip === 'custom' && startDate && endDate
          ? `${fmtShort(startDate)} – ${fmtShort(endDate)}`
          : 'Custom',
    },
  ];

  return (
    <>
      {!hideChips && (
        <View style={df.chipRow}>
          {chips.map((c) => {
            const active = activeChip === c.key;
            return (
              <HapticTouchable
                key={c.key}
                onPress={() => c.key === 'custom' ? openCustomSheet() : onChipSelect(c.key)}
                style={[df.chip, active && df.chipActive]}
                activeOpacity={0.75}
              >
                {c.key === 'custom' && (
                  <Feather
                    name="calendar"
                    size={nz(11)}
                    color={active ? '#fff' : '#1A1A1A'}
                    style={{ marginRight: rs(4) }}
                  />
                )}
                <Text style={[df.chipText, active && df.chipTextActive]} numberOfLines={1}>
                  {c.label}
                </Text>
              </HapticTouchable>
            );
          })}
        </View>
      )}

      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSheetVisible(false)}
      >
        <TouchableOpacity
          style={df.backdrop}
          activeOpacity={1}
          onPress={() => setSheetVisible(false)}
        />

        <View style={df.sheet}>
          <View style={df.handle} />

          <View style={df.header}>
            <Text style={df.title}>Select Date Range</Text>
          </View>

          <RangeCalendar
            startDate={tempStart}
            endDate={tempEnd}
            onRangeChange={handleRangeChange}
          />

          {rangeReady && (
            <HapticTouchable onPress={handleApply} style={df.applyBtn} activeOpacity={0.85}>
              <Feather name="check" size={nz(16)} color="#fff" style={{ marginRight: rs(6) }} />
              <Text style={df.applyBtnText}>Apply Range</Text>
            </HapticTouchable>
          )}
        </View>
      </Modal>
    </>
  );
});

const df = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    gap: rs(8),
    paddingTop: rs(8),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(14),
    paddingVertical: rs(7),
    borderRadius: rs(20),
    borderWidth: rs(1.5),
    borderColor: '#DDD',
    backgroundColor: '#F5F5F5',
    flexShrink: 1,
  },
  chipActive: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { fontSize: nz(12), fontWeight: '600', color: '#1A1A1A' },
  chipTextActive: { color: '#fff' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: rs(24),
    borderTopRightRadius: rs(24),
    paddingHorizontal: rs(20),
    paddingBottom: rs(40),
    paddingTop: rs(14),
    maxHeight: '92%',
  },
  handle: {
    width: rs(40),
    height: rs(4),
    borderRadius: rs(2),
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginBottom: rs(16),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs(16),
  },
  title: { fontSize: nz(18), fontWeight: '700', color: '#1A1A1A' },
  applyBtn: {
    flexDirection: 'row',
    backgroundColor: GREEN,
    borderRadius: rs(26),
    paddingVertical: rs(15),
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: rs(20),
    elevation: 4,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  applyBtnText: { fontSize: nz(16), fontWeight: '700', color: '#fff' },
});