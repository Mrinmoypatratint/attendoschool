import {
  ensureCalendarTables,
  calculateWorkingCalendar,
  checkInstructionalDate,
  addSchoolHoliday,
  updateSchoolHoliday,
  deleteSchoolHoliday,
  listSchoolHolidays,
  getSchoolWorkingDays,
  updateSchoolWorkingDays,
  parseYMDToUtc,
  formatDateYMD
} from '../src/services/calendarService';
import { pool } from '../src/db';

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function recordTest(name: string, category: string, passed: boolean, details?: string, error?: string) {
  results.push({ name, category, passed, details, error });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} | [${category}] ${name}${details ? ` -> ${details}` : ''}${error ? ` (Error: ${error})` : ''}`);
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('AttendoSchool: Comprehensive Working Calendar & Holiday QA Suite');
  console.log('================================================================\n');

  await ensureCalendarTables();

  const schoolA = '00000000-0000-0000-0000-000000000001'; // Greenwood
  const schoolB = '00000000-0000-0000-0000-000000000002'; // TINT

  try {
    // -------------------------------------------------------------
    // 1. Normal Working Day
    // -------------------------------------------------------------
    const normalDayCheck = await checkInstructionalDate(schoolA, '2026-10-07'); // Wednesday
    recordTest(
      'Normal working day recognition',
      'Instructional Logic',
      normalDayCheck.isInstructional === true &&
      normalDayCheck.isWeekend === false &&
      normalDayCheck.isHoliday === false,
      `2026-10-07 (Wed) isInstructional: ${normalDayCheck.isInstructional}`
    );

    // -------------------------------------------------------------
    // 2. Saturday Rules (WORKING vs HALF_DAY vs OFF)
    // -------------------------------------------------------------
    // Saturday Working
    const satWorkingRes = await calculateWorkingCalendar(schoolA, '2026-10-10', '2026-10-10', {
      customSaturdayRule: 'WORKING'
    });
    recordTest(
      'Saturday configured as FULL WORKING day',
      'Saturday Policy',
      satWorkingRes.workingDays === 1 && satWorkingRes.weekendDays === 0 && satWorkingRes.breakdown[0].workingWeight === 1,
      `Working weight: ${satWorkingRes.breakdown[0].workingWeight}, Working days: ${satWorkingRes.workingDays}`
    );

    // Saturday Half-Day
    const satHalfRes = await calculateWorkingCalendar(schoolA, '2026-10-10', '2026-10-10', {
      customSaturdayRule: 'HALF_DAY'
    });
    recordTest(
      'Saturday configured as HALF_DAY session',
      'Saturday Policy',
      satHalfRes.workingDays === 0.5 && satHalfRes.halfDays === 1 && satHalfRes.breakdown[0].workingWeight === 0.5,
      `Working weight: ${satHalfRes.breakdown[0].workingWeight}, Working days: ${satHalfRes.workingDays}`
    );

    // Saturday Off
    const satOffRes = await calculateWorkingCalendar(schoolA, '2026-10-10', '2026-10-10', {
      customSaturdayRule: 'OFF'
    });
    recordTest(
      'Saturday configured as OFF (Weekend)',
      'Saturday Policy',
      satOffRes.workingDays === 0 && satOffRes.weekendDays === 1 && satOffRes.breakdown[0].workingWeight === 0,
      `Working weight: ${satOffRes.breakdown[0].workingWeight}, Non-working days: ${satOffRes.nonWorkingDays}`
    );

    // -------------------------------------------------------------
    // 3. Sunday Recognition
    // -------------------------------------------------------------
    const sunCheck = await checkInstructionalDate(schoolA, '2026-10-11'); // Sunday
    recordTest(
      'Sunday recognized as scheduled weekend',
      'Weekend Logic',
      sunCheck.isInstructional === false && sunCheck.isWeekend === true,
      `2026-10-11 isWeekend: ${sunCheck.isWeekend}, Reason: ${sunCheck.reason}`
    );

    // -------------------------------------------------------------
    // 4. Configured Weekday Holiday (Gandhi Jayanti: 2026-10-02 Friday)
    // -------------------------------------------------------------
    const weekdayHolCheck = await checkInstructionalDate(schoolA, '2026-10-02');
    recordTest(
      'Configured weekday holiday recognized',
      'Holiday Logic',
      weekdayHolCheck.isInstructional === false &&
      weekdayHolCheck.isHoliday === true &&
      weekdayHolCheck.isWeekend === false &&
      weekdayHolCheck.holidayName === 'Gandhi Jayanti',
      `Holiday: ${weekdayHolCheck.holidayName} on Friday`
    );

    // -------------------------------------------------------------
    // 5. Weekend Holiday Overlap Deduplication (CRITICAL REQUIREMENT)
    // Diwali on Sunday 2026-11-08
    // -------------------------------------------------------------
    const diwaliCheck = await checkInstructionalDate(schoolA, '2026-11-08');
    const novCalc = await calculateWorkingCalendar(schoolA, '2026-11-01', '2026-11-30');
    const novOverlapDay = novCalc.breakdown.find(d => d.date === '2026-11-08');

    const deduplicationPass =
      novCalc.overlapDays === 1 &&
      novOverlapDay?.isWeekendAndHoliday === true &&
      novOverlapDay.workingWeight === 0 &&
      // Invariant: NonWorkingDays must EQUAL (weekendDays + holidayDays - overlapDays)
      novCalc.nonWorkingDays === (novCalc.weekendDays + novCalc.holidayDays - novCalc.overlapDays) &&
      novCalc.totalDays === (novCalc.workingDays + novCalc.nonWorkingDays);

    recordTest(
      'Weekend holiday overlap deduplication (Zero double-counting)',
      'Deduplication',
      deduplicationPass,
      `Total: ${novCalc.totalDays}, Working: ${novCalc.workingDays}, NonWorking: ${novCalc.nonWorkingDays}, Weekends: ${novCalc.weekendDays}, Holidays: ${novCalc.holidayDays}, Overlap: ${novCalc.overlapDays}`
    );

    // -------------------------------------------------------------
    // 6. Consecutive Holidays
    // Declare consecutive holidays for Dussehra: 2026-10-20 & 2026-10-21
    // -------------------------------------------------------------
    await addSchoolHoliday(schoolA, {
      name: 'Dussehra Day 2 / Vijaya Dashami',
      holiday_date: '2026-10-21',
      holiday_type: 'FESTIVAL'
    });

    const consecCalc = await calculateWorkingCalendar(schoolA, '2026-10-19', '2026-10-22');
    const consecDays = consecCalc.breakdown.filter(d => d.isHoliday).map(d => d.date);
    recordTest(
      'Consecutive holidays in date range',
      'Holiday Logic',
      consecDays.includes('2026-10-20') && consecDays.includes('2026-10-21') && consecCalc.holidayDays === 2,
      `Consecutive dates found: ${consecDays.join(', ')}`
    );

    // -------------------------------------------------------------
    // 7. Multiple Holidays in One Range
    // Oct 2026 has Gandhi Jayanti (Oct 2), Durga Puja (Oct 20), Dussehra 2 (Oct 21)
    // -------------------------------------------------------------
    const octMulti = await calculateWorkingCalendar(schoolA, '2026-10-01', '2026-10-31');
    recordTest(
      'Multiple holidays in one range correctly aggregated',
      'Range Calculation',
      octMulti.holidayDays >= 3 && octMulti.totalDays === 31,
      `Total October holidays: ${octMulti.holidayDays}, Working days: ${octMulti.workingDays}`
    );

    // -------------------------------------------------------------
    // 8. Date Range Containing Both Weekends and Holidays
    // -------------------------------------------------------------
    const fullWeekCalc = await calculateWorkingCalendar(schoolA, '2026-10-01', '2026-10-07');
    // Thu 1 (Work), Fri 2 (Gandhi Jayanti Holiday), Sat 3 (Work), Sun 4 (Weekend), Mon 5 (Work), Tue 6 (Work), Wed 7 (Work)
    // Total: 7 days. Working: 5. Non-working: 2 (1 weekend + 1 holiday).
    recordTest(
      'Range containing both weekends and holidays',
      'Range Calculation',
      fullWeekCalc.totalDays === 7 &&
      fullWeekCalc.workingDays === 5 &&
      fullWeekCalc.nonWorkingDays === 2 &&
      fullWeekCalc.weekendDays === 1 &&
      fullWeekCalc.holidayDays === 1,
      `Total: 7, Working: ${fullWeekCalc.workingDays}, Weekend: ${fullWeekCalc.weekendDays}, Holiday: ${fullWeekCalc.holidayDays}`
    );

    // -------------------------------------------------------------
    // 9. Single-Day Ranges (Start Date === End Date)
    // -------------------------------------------------------------
    const singleWorking = await calculateWorkingCalendar(schoolA, '2026-10-01', '2026-10-01');
    const singleHoliday = await calculateWorkingCalendar(schoolA, '2026-10-02', '2026-10-02');
    const singleWeekend = await calculateWorkingCalendar(schoolA, '2026-10-04', '2026-10-04');

    recordTest(
      'Single-day range handling (startDate === endDate)',
      'Boundary Handling',
      singleWorking.totalDays === 1 && singleWorking.workingDays === 1 &&
      singleHoliday.totalDays === 1 && singleHoliday.workingDays === 0 && singleHoliday.holidayDays === 1 &&
      singleWeekend.totalDays === 1 && singleWeekend.workingDays === 0 && singleWeekend.weekendDays === 1,
      `Working single: ${singleWorking.workingDays}, Holiday single: ${singleHoliday.holidayDays}, Weekend single: ${singleWeekend.weekendDays}`
    );

    // -------------------------------------------------------------
    // 10. Start and End Boundary Dates (Weekend/Holiday at start or end)
    // -------------------------------------------------------------
    // Range starts on Sunday 2026-10-04 and ends on Sunday 2026-10-11
    const boundarySunToSun = await calculateWorkingCalendar(schoolA, '2026-10-04', '2026-10-11');
    // Total days: 8. Sun 4, Mon 5, Tue 6, Wed 7, Thu 8, Fri 9, Sat 10, Sun 11.
    // 2 Sundays. Mon-Sat (6 days) working.
    recordTest(
      'Boundary dates: Range starting and ending on weekends',
      'Boundary Handling',
      boundarySunToSun.totalDays === 8 &&
      boundarySunToSun.weekendDays === 2 &&
      boundarySunToSun.workingDays === 6,
      `Total: ${boundarySunToSun.totalDays}, Weekend days: ${boundarySunToSun.weekendDays}, Working: ${boundarySunToSun.workingDays}`
    );

    // -------------------------------------------------------------
    // 11. Month Transitions (October 30 to November 2)
    // Oct 30 (Fri - Work), Oct 31 (Sat - Work), Nov 1 (Sun - Weekend), Nov 2 (Mon - Work)
    // -------------------------------------------------------------
    const monthTransition = await calculateWorkingCalendar(schoolA, '2026-10-30', '2026-11-02');
    recordTest(
      'Month transition boundary (Oct 30 -> Nov 02 across 31-day month)',
      'Date Handling',
      monthTransition.totalDays === 4 &&
      monthTransition.workingDays === 3 &&
      monthTransition.weekendDays === 1,
      `Total: ${monthTransition.totalDays}, Working: ${monthTransition.workingDays}, Weekend: ${monthTransition.weekendDays}`
    );

    // -------------------------------------------------------------
    // 12. Year Transitions (Dec 28, 2026 to Jan 4, 2027)
    // -------------------------------------------------------------
    const yearTransition = await calculateWorkingCalendar(schoolA, '2026-12-28', '2027-01-04');
    recordTest(
      'Year transition boundary (Dec 28, 2026 -> Jan 04, 2027)',
      'Date Handling',
      yearTransition.totalDays === 8 &&
      yearTransition.totalDays === yearTransition.workingDays + yearTransition.nonWorkingDays,
      `Total: ${yearTransition.totalDays}, Working: ${yearTransition.workingDays}, NonWorking: ${yearTransition.nonWorkingDays}`
    );

    // -------------------------------------------------------------
    // 13. Leap Year Handling (Feb 28 to Mar 1 in leap year 2024 vs 2025)
    // -------------------------------------------------------------
    const leapYear2024 = await calculateWorkingCalendar(schoolA, '2024-02-28', '2024-03-01');
    // Feb 28, Feb 29 (Leap day), Mar 1 = 3 days!
    const nonLeap2025 = await calculateWorkingCalendar(schoolA, '2025-02-28', '2025-03-01');
    // Feb 28, Mar 1 = 2 days!
    recordTest(
      'Leap year safe date boundary handling (2024 has Feb 29, 2025 does not)',
      'Date Handling',
      leapYear2024.totalDays === 3 && nonLeap2025.totalDays === 2,
      `2024 days: ${leapYear2024.totalDays}, 2025 days: ${nonLeap2025.totalDays}`
    );

    // -------------------------------------------------------------
    // 14. Empty Holiday List (Calculates purely against working calendar)
    // -------------------------------------------------------------
    const emptyRangeCalc = await calculateWorkingCalendar(schoolA, '2026-06-01', '2026-06-30');
    // June 2026 has 30 days, 4 Sundays (7, 14, 21, 28)
    recordTest(
      'Empty holiday period calculation (Pure working-week evaluation)',
      'Edge Cases',
      emptyRangeCalc.holidayDays === 0 &&
      emptyRangeCalc.weekendDays === 4 &&
      emptyRangeCalc.workingDays === 26 &&
      emptyRangeCalc.totalDays === 30,
      `Total: 30, Working: ${emptyRangeCalc.workingDays}, Weekends: ${emptyRangeCalc.weekendDays}, Holidays: ${emptyRangeCalc.holidayDays}`
    );

    // -------------------------------------------------------------
    // 15. Inactive / Deleted Holidays
    // -------------------------------------------------------------
    const tempHol = await addSchoolHoliday(schoolA, {
      name: 'Temporary Test Holiday',
      holiday_date: '2026-07-15',
      holiday_type: 'INSTITUTIONAL'
    });
    // Now deactivate it
    await updateSchoolHoliday(schoolA, tempHol.id, { is_active: false });
    const inactiveCalc = await calculateWorkingCalendar(schoolA, '2026-07-15', '2026-07-15');
    // Now delete it
    await deleteSchoolHoliday(schoolA, tempHol.id);

    recordTest(
      'Deactivated/deleted holiday is excluded from non-working count',
      'Holiday Logic',
      inactiveCalc.holidayDays === 0 && inactiveCalc.workingDays === 1,
      `Working weight for deactivated holiday date: ${inactiveCalc.breakdown[0].workingWeight}`
    );

    // -------------------------------------------------------------
    // 16. Duplicate Holiday Prevention (Unique constraint check)
    // -------------------------------------------------------------
    const dup1 = await addSchoolHoliday(schoolA, {
      name: 'Sports Day Initial',
      holiday_date: '2026-11-20',
      holiday_type: 'INSTITUTIONAL'
    });
    const dup2 = await addSchoolHoliday(schoolA, {
      name: 'Sports Day Revised',
      holiday_date: '2026-11-20',
      holiday_type: 'INSTITUTIONAL'
    });
    // Check that there is only ONE record for 2026-11-20
    const holList = await listSchoolHolidays(schoolA, { startDate: '2026-11-20', endDate: '2026-11-20' });
    // Clean up
    await deleteSchoolHoliday(schoolA, dup1.id);

    recordTest(
      'Duplicate holiday prevention & upsert safety on same date',
      'Database Integrity',
      holList.length === 1 && holList[0].name === 'Sports Day Revised',
      `Records on date: ${holList.length}, Name: ${holList[0]?.name}`
    );

    // -------------------------------------------------------------
    // 17. Multi-Tenant School Isolation (School A vs School B)
    // Configure School B with Sun-Thu week and a private holiday
    // -------------------------------------------------------------
    await updateSchoolWorkingDays(schoolB, {
      working_days: [0, 1, 2, 3, 4], // Sun-Thu working
      weekend_days: [5, 6],          // Fri-Sat weekend
      saturday_rule: 'OFF'
    });

    const bPrivateHol = await addSchoolHoliday(schoolB, {
      name: 'TINT Foundation Day',
      holiday_date: '2026-09-15',
      holiday_type: 'INSTITUTIONAL'
    });

    // Verify School A does NOT see School B's holiday
    const schoolAHols = await listSchoolHolidays(schoolA, { startDate: '2026-09-15', endDate: '2026-09-15' });
    // Verify School B sees its own holiday
    const schoolBHols = await listSchoolHolidays(schoolB, { startDate: '2026-09-15', endDate: '2026-09-15' });

    // Verify School B's weekend rules: Friday is weekend in School B, but regular in School A
    const friSchoolA = await checkInstructionalDate(schoolA, '2026-09-18'); // Friday
    const friSchoolB = await checkInstructionalDate(schoolB, '2026-09-18'); // Friday

    const isolationPass =
      schoolAHols.length === 0 &&
      schoolBHols.length === 1 &&
      friSchoolA.isWeekend === false &&
      friSchoolB.isWeekend === true;

    recordTest(
      'Multi-tenant calendar & holiday isolation between schools',
      'Security & Isolation',
      isolationPass,
      `School A sees B holiday: ${schoolAHols.length > 0}, School B Friday isWeekend: ${friSchoolB.isWeekend}, School A Friday isWeekend: ${friSchoolA.isWeekend}`
    );

    // Clean up School B private holiday
    await deleteSchoolHoliday(schoolB, bPrivateHol.id);

    // -------------------------------------------------------------
    // 18. Timezone and Date-Format Neutrality
    // -------------------------------------------------------------
    const utcDate = parseYMDToUtc('2026-10-02');
    const formatted = formatDateYMD(utcDate);
    recordTest(
      'Timezone neutrality: YMD date parsing and serialization invariance',
      'Date Handling',
      formatted === '2026-10-02' && utcDate.getUTCHours() === 0,
      `Input: 2026-10-02 -> Formatted: ${formatted}, UTC Hours: ${utcDate.getUTCHours()}`
    );

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;
    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED out of ${results.length} total test cases.`);
    console.log('================================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err: any) {
    console.error('Fatal error during test execution:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTestSuite();
