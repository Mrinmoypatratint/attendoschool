import {
  calculateWorkingCalendar,
  checkInstructionalDate,
  addSchoolHoliday,
  updateSchoolHoliday,
  deleteSchoolHoliday,
  getSchoolWorkingDays,
  updateSchoolWorkingDays
} from '../src/services/calendarService';

async function run() {
  const schoolId = '00000000-0000-0000-0000-000000000001';
  console.log('--- 1. Testing Default Working Days Config ---');
  const config = await getSchoolWorkingDays(schoolId);
  console.log('Config:', config);

  console.log('\n--- 2. Testing October 2026 Calculation ---');
  const octResult = await calculateWorkingCalendar(schoolId, '2026-10-01', '2026-10-31');
  console.log({
    totalDays: octResult.totalDays,
    workingDays: octResult.workingDays,
    nonWorkingDays: octResult.nonWorkingDays,
    weekendDays: octResult.weekendDays,
    holidayDays: octResult.holidayDays,
    overlapDays: octResult.overlapDays
  });

  console.log('\n--- 3. Testing November 2026 (Diwali on Sunday 2026-11-08) Overlap Deduplication ---');
  const novResult = await calculateWorkingCalendar(schoolId, '2026-11-01', '2026-11-30');
  console.log({
    totalDays: novResult.totalDays,
    workingDays: novResult.workingDays,
    nonWorkingDays: novResult.nonWorkingDays,
    weekendDays: novResult.weekendDays,
    holidayDays: novResult.holidayDays,
    overlapDays: novResult.overlapDays
  });
  const diwali = novResult.breakdown.find(d => d.date === '2026-11-08');
  console.log('Diwali day detail:', diwali);

  console.log('\n--- 4. Invariant Check (totalDays === workingDays + nonWorkingDays) ---');
  console.log('Oct check:', octResult.totalDays === octResult.workingDays + octResult.nonWorkingDays ? 'PASS' : 'FAIL');
  console.log('Nov check:', novResult.totalDays === novResult.workingDays + novResult.nonWorkingDays ? 'PASS' : 'FAIL');
  console.log('Deduplication invariant (nonWorkingDays === weekendDays + holidayDays - overlapDays):');
  console.log('Nov deduplication check:', novResult.nonWorkingDays === (novResult.weekendDays + novResult.holidayDays - novResult.overlapDays) ? 'PASS' : 'FAIL');

  console.log('\n--- 5. Single Day Date Checks ---');
  const normalDay = await checkInstructionalDate(schoolId, '2026-10-01'); // Thursday
  console.log('2026-10-01 (Thu):', normalDay);
  const gandhiJayanti = await checkInstructionalDate(schoolId, '2026-10-02'); // Friday Holiday
  console.log('2026-10-02 (Fri Holiday):', gandhiJayanti);
  const sunday = await checkInstructionalDate(schoolId, '2026-10-04'); // Sunday Weekend
  console.log('2026-10-04 (Sun):', sunday);
  const diwaliSun = await checkInstructionalDate(schoolId, '2026-11-08'); // Sunday + Festival
  console.log('2026-11-08 (Diwali Sun):', diwaliSun);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
