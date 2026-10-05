import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { api } from '../../api';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Plus, Download, UploadCloud, KeyRound, AlertCircle, CheckCircle2, Eye, Search, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Calendar, Info } from 'lucide-react';
import { StudentProfileHoverCard } from '../../components/StudentProfileHoverCard';
import { TeacherProfileHoverCard } from '../../components/TeacherProfileHoverCard';

/* ────── Teacher DOB Validation & Formatting Helpers ────── */
function isValidDdMmYyyy(val: string): boolean {
  if (!val || typeof val !== 'string') return false;
  const match = val.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return false;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1920 || year > new Date().getFullYear()) return false;
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function toDdMmYyyy(val: any): string {
  if (!val) return '';
  if (typeof val === 'number' || (/^\d{4,5}$/.test(String(val).trim()) && !String(val).includes('-') && !String(val).includes('/'))) {
    const num = Number(val);
    if (!isNaN(num) && num > 1000 && num < 60000) {
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        const d = String(date.getUTCDate()).padStart(2, '0');
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const y = String(date.getUTCFullYear());
        return `${d}-${m}-${y}`;
      }
    }
  }
  const s = String(val).trim();
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    return `${dmy[1].padStart(2, '0')}-${dmy[2].padStart(2, '0')}-${dmy[3]}`;
  }
  const ymd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    return `${ymd[3].padStart(2, '0')}-${ymd[2].padStart(2, '0')}-${ymd[1]}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const d = String(dt.getDate()).padStart(2, '0');
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const y = String(dt.getFullYear());
    return `${d}-${m}-${y}`;
  }
  return s;
}

export default function PeopleManagement() {
  const [tab, setTab] = useState<'students' | 'teachers'>('students');
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Teacher Modals State
  const [addTeacherOpen, setAddTeacherOpen] = useState(false);
  const [addTeacherPreview, setAddTeacherPreview] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [teacherForm, setTeacherForm] = useState<any>({ sendInviteEmail: true });
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [importPreviewPage, setImportPreviewPage] = useState(1);
  const [importPreviewPageSize, setImportPreviewPageSize] = useState<number>(25);
  const [importPreviewSearch, setImportPreviewSearch] = useState('');
  const [directoryPage, setDirectoryPage] = useState(1);
  const [directoryPageSize, setDirectoryPageSize] = useState<number>(25);
  const [toastNotice, setToastNotice] = useState<{ type: 'success' | 'error'; message: string; resetUrl?: string } | null>(null);

  const lastRegisteredTeacherInfo = useMemo(() => {
    try {
      const stored = localStorage.getItem('attendo_last_registered_teacher');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.name) return parsed;
      }
    } catch {}

    if (!rows || rows.length === 0) return null;

    const withTime = rows.filter(r => r.created_at || r.createdAt);
    if (withTime.length > 0) {
      const latest = [...withTime].sort((a, b) => new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime())[0];
      return {
        name: latest.name || `${latest.first_name || ''} ${latest.last_name || ''}`.trim() || 'Teacher',
        employeeId: latest.employee_id || latest.savior_no || latest.Savior_No || latest.employeeId || '—'
      };
    }

    const candidate = rows[0];
    return {
      name: candidate.name || `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Teacher',
      employeeId: candidate.employee_id || candidate.savior_no || candidate.Savior_No || candidate.employeeId || '—'
    };
  }, [rows]);

  const directoryTopRef = useRef<HTMLDivElement>(null);
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const isInitialDirectoryMount = useRef(true);

  const scrollToDirectoryTop = useCallback(() => {
    setTimeout(() => {
      if (tableBodyRef.current) {
        try {
          tableBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
          tableBodyRef.current.scrollTop = 0;
        }
      }
      if (directoryTopRef.current) {
        try {
          directoryTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch {
          // ignore
        }
      }
    }, 10);
  }, []);

  useEffect(() => {
    if (isInitialDirectoryMount.current) {
      isInitialDirectoryMount.current = false;
      return;
    }
    scrollToDirectoryTop();
  }, [directoryPage, scrollToDirectoryTop]);

  function prepareExportData() {
    return rows.map(r => {
      let fn = r.first_name || r.firstName || '';
      let ln = r.last_name || r.lastName || '';
      if (!fn && !ln && (r.name || r.fullName)) {
        const parts = (r.name || r.fullName).split(' ');
        fn = parts[0] || '';
        ln = parts.slice(1).join(' ') || '';
      }
      const fullName = (fn && ln) ? `${fn} ${ln}` : (r.name || r.fullName || `${fn} ${ln}`.trim());
      return {
        'Savior_No': r.savior_no || r.employee_id || r.Savior_No || '',
        'Fist Name': fn,
        'Last Name': ln,
        'Full Name(Automatically generated)': fullName,
        'Email_id': r.email || '',
        'Gender': r.gender || '',
        'Date_of_Birth': r.dob || r.date_of_birth || '',
        'Class': r.class_name || r.class || '',
        'Section': r.section_name || r.section || '',
        'Status': (r.is_active !== false && r.active !== false) ? 'Active' : 'Inactive',
        'Designation': r.designation || 'Teacher'
      };
    });
  }

  function handleExportExcel() {
    const data = prepareExportData();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Faculty');
    XLSX.writeFile(wb, 'Faculty_Export.xlsx');
  }

  function handleExportCSV() {
    const data = prepareExportData();
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'Faculty_Export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const endpoint = tab === 'students' ? '/people/students' : '/teachers';
      const res = await api.get(endpoint, { params: { search: search.trim() || undefined } });
      setRows(res.data || []);
    } catch (e: any) {
      setMessage(e?.response?.data?.message || 'Unable to load people records');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tab]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    load();
  }

  // Teacher Addition
  async function handleAddTeacher(e: React.FormEvent) {
    e.preventDefault();
    if (teacherForm.dob && !isValidDdMmYyyy(teacherForm.dob)) {
      alert('Validation Error: Date of Birth must strictly follow DD-MM-YYYY format (e.g. 15-08-1990).');
      return;
    }
    setSavingTeacher(true);
    try {
      const firstName = String(teacherForm.firstName || '').trim();
      const lastName = String(teacherForm.lastName || '').trim();
      const fullName = (firstName && lastName) ? `${firstName} ${lastName}` : (firstName || lastName || teacherForm.name || '');
      const payload = {
        ...teacherForm,
        firstName,
        lastName,
        name: fullName,
        fullName,
        employeeId: teacherForm.employeeId || teacherForm.saviorNo,
        gender: teacherForm.gender || '',
        dob: teacherForm.dob ? toDdMmYyyy(teacherForm.dob) : '',
        date_of_birth: teacherForm.dob ? toDdMmYyyy(teacherForm.dob) : ''
      };

      const res = await api.post('/teachers', payload);
      try {
        localStorage.setItem('attendo_last_registered_teacher', JSON.stringify({
          name: fullName,
          employeeId: teacherForm.employeeId || teacherForm.saviorNo || res.data?.employee_id || '—'
        }));
      } catch {}
      setToastNotice({
        type: 'success',
        message: `Faculty member ${fullName} added! Automatic welcome email dispatched via SMTP to ${res.data.email}.`,
        resetUrl: res.data.reset_url
      });
      setAddTeacherOpen(false);
      setTeacherForm({ sendInviteEmail: true });
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to add teacher');
    } finally {
      setSavingTeacher(false);
    }
  }

  // Teacher Bulk Template Download
  function downloadTeacherTemplate() {
    const sample = [
      { "Savior_No": "EMP010", "Fist Name": "Sunita", "Last Name": "Verma", "Full Name(Automatically generated)": "Sunita Verma", "Email_id": "sunita.v@school.local", "Gender": "Female", "Date_of_Birth": "15-08-1990", "Class": "Class 10", "Section": "A", "Status": "Active", "Designation": "Senior Teacher" },
      { "Savior_No": "EMP011", "Fist Name": "Alok", "Last Name": "Mishra", "Full Name(Automatically generated)": "Alok Mishra", "Email_id": "alok.m@school.local", "Gender": "Male", "Date_of_Birth": "22-04-1988", "Class": "Class 9", "Section": "B", "Status": "Active", "Designation": "TGT Mathematics" },
      { "Savior_No": "EMP012", "Fist Name": "Rekha", "Last Name": "Sengupta", "Full Name(Automatically generated)": "Rekha Sengupta", "Email_id": "rekha.s@school.local", "Gender": "Female", "Date_of_Birth": "10-12-1992", "Class": "Class 8", "Section": "A", "Status": "Active", "Designation": "PRT Science" }
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    ws['!cols'] = [16, 14, 14, 24, 26, 12, 16, 12, 10, 12, 20].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Teachers Import Template");
    XLSX.writeFile(wb, "teachers_import_template.xlsx");
  }

  // Teacher Excel Ingestion
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const mapped = json.map((r, idx) => {
          const saviorNo = String(r['Savior_No'] || r['Savior No'] || r['savior_no'] || r['Employee ID'] || r['Employee Id/Savior_NO'] || r['Emp ID'] || r['employee_id'] || `EMP0${idx+10}`).trim();
          let firstName = String(r['Fist Name'] || r['First Name'] || r['firstName'] || '').trim();
          let lastName = String(r['Last Name'] || r['lastName'] || '').trim();
          const explicitFullName = String(r['Full Name(Automatically generated)'] || r['Full Name'] || r['Teacher Name'] || r['Name'] || r['name'] || '').trim();
          if ((!firstName || !lastName) && explicitFullName) {
            const parts = explicitFullName.split(' ');
            if (!firstName) firstName = parts[0] || '';
            if (!lastName) lastName = parts.slice(1).join(' ') || '';
          }
          const name = explicitFullName || ((firstName && lastName) ? `${firstName} ${lastName}` : (firstName || lastName || `Faculty ${idx + 1}`));
          const email = String(r['Email_id'] || r['Email ID'] || r['Email'] || r['email'] || `teacher${idx+1}@school.local`).toLowerCase().trim();
          const mobile = String(r['Mobile'] || r['Phone'] || r['mobile'] || '9876500000').trim();
          const gender = String(r['Gender'] || r['gender'] || r['Sex'] || r['sex'] || '').trim();
          const rawDob = r['Date_of_Birth'] || r['Date of Birth'] || r['date_of_birth'] || r['DOB'] || r['dob'] || '';
          const dob = toDdMmYyyy(rawDob);
          const designation = String(r['Designation'] || r['designation'] || 'Teacher').trim();
          const status = String(r['Status'] || r['status'] || 'Active').trim();
          const className = String(r['Class'] || r['class'] || '').trim();
          const sectionName = String(r['Section'] || r['section'] || 'A').trim().toUpperCase();
          return {
            saviorNo,
            employeeId: saviorNo,
            firstName,
            lastName,
            name,
            email,
            mobile,
            gender,
            dob,
            designation,
            status,
            class: className,
            section: sectionName,
            emailStatus: 'Pending',
            _origRowIndex: idx + 1
          };
        }).filter(x => x.name && x.email);
        setPreviewRows(mapped);
        setImportPreviewPage(1);
        setImportPreviewSearch('');
      } catch (err) {
        alert('Failed to parse file. Please upload a valid .xlsx or .csv file.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // Teacher Bulk Import Submit
  async function submitBulkImport() {
    if (previewRows.length === 0) return;
    setImporting(true);
    try {
      const res = await api.post('/teachers/bulk-import', { teachers: previewRows });
      if (previewRows.length > 0) {
        const lastRow = previewRows[previewRows.length - 1];
        const teacherName = lastRow.name || `${lastRow.firstName || ''} ${lastRow.lastName || ''}`.trim() || 'Teacher';
        const teacherEmpId = lastRow.saviorNo || lastRow.employeeId || '—';
        try {
          localStorage.setItem('attendo_last_registered_teacher', JSON.stringify({
            name: teacherName,
            employeeId: teacherEmpId
          }));
        } catch {}
      }
      setToastNotice({
        type: 'success',
        message: `Successfully onboarded ${res.data.count} teachers! Automatic welcome emails and credentials have been dispatched via SMTP.`
      });
      setImportOpen(false);
      setPreviewRows([]);
      setImportPreviewPage(1);
      setImportPreviewSearch('');
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to import teachers');
    } finally {
      setImporting(false);
    }
  }

  // Teacher Bulk Import Preview Pagination & Filtering
  const filteredTeacherPreviewRows = previewRows.filter((r) => {
    if (!importPreviewSearch.trim()) return true;
    const q = importPreviewSearch.toLowerCase();
    const target = [
      r.saviorNo,
      r.employeeId,
      r.firstName,
      r.lastName,
      r.name,
      r.email,
      r.mobile,
      r.designation,
      r.class,
      r.section
    ].filter(Boolean).join(' ').toLowerCase();
    return target.includes(q);
  });

  const totalTeacherImportPages = Math.max(1, Math.ceil(filteredTeacherPreviewRows.length / (importPreviewPageSize || 25)));
  const currentTeacherImportPage = Math.min(Math.max(1, importPreviewPage), totalTeacherImportPages);
  const teacherStartIdx = filteredTeacherPreviewRows.length === 0 ? 0 : (currentTeacherImportPage - 1) * (importPreviewPageSize || 25);
  const teacherEndIdx = Math.min(teacherStartIdx + (importPreviewPageSize || 25), filteredTeacherPreviewRows.length);
  const displayedTeacherPreviewRows = filteredTeacherPreviewRows.slice(teacherStartIdx, teacherEndIdx);

  useEffect(() => {
    setDirectoryPage(1);
  }, [tab, search]);

  const totalDirectoryPages = Math.max(1, Math.ceil(rows.length / (directoryPageSize || 25)));
  const currentDirectoryPage = Math.min(Math.max(1, directoryPage), totalDirectoryPages);
  const directoryStartIdx = rows.length === 0 ? 0 : (currentDirectoryPage - 1) * (directoryPageSize || 25);
  const directoryEndIdx = Math.min(directoryStartIdx + (directoryPageSize || 25), rows.length);
  const displayedDirectoryRows = rows.slice(directoryStartIdx, directoryEndIdx);

  return (
    <div className="feature-page">
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <p className="eyebrow">INSTITUTIONAL DIRECTORY</p>
          <h1>People Management</h1>
          <p className="muted">Centralized directory of enrolled students, parents, and school faculty staff.</p>
        </div>

        {tab === 'teachers' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setImportOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#10b981', color: '#ffffff' }}
              title="Import faculty via Excel spreadsheet or CSV with interactive preview"
            >
              <FileSpreadsheet size={16} /> Import Excel / CSV
            </button>
            <button
              onClick={() => { setTeacherForm({ sendInviteEmail: true }); setAddTeacherPreview(false); setAddTeacherOpen(true); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} /> Add Teacher
            </button>
          </div>
        )}
      </div>

      {toastNotice && (
        <div style={{
          padding: '12px 16px',
          marginBottom: 16,
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          backgroundColor: toastNotice.type === 'error' ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${toastNotice.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
          color: toastNotice.type === 'error' ? '#991b1b' : '#166534',
          fontSize: 13
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {toastNotice.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{toastNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastNotice(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit', padding: 0 }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── UNIFIED PEOPLE DIRECTORY BOX WITH INNER SCROLLBAR ── */}
      <div className="directory-box" ref={directoryTopRef}>
        {/* Box Header (Tabs & Search Controls) */}
        <div className="directory-box-header">
        {/* Segmented Tab Switcher */}
        <div className="tabs" style={{ margin: 0 }}>
          <button
            type="button"
            className={tab === 'students' ? 'tab-active' : ''}
            onClick={() => setTab('students')}
          >
            Enrolled Students
          </button>
          <button
            type="button"
            className={tab === 'teachers' ? 'tab-active' : ''}
            onClick={() => setTab('teachers')}
          >
            Teaching Faculty
          </button>
        </div>

        {/* Search Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <form onSubmit={handleSearchSubmit} className="filter-row" style={{ margin: 0 }}>
            <input
              placeholder={tab === 'students' ? 'Search by name, roll, or parent…' : 'Search by name, employee ID/Savior_NO, or email…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 300, background: '#ffffff' }}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
            {search && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setSearch('');
                  setTimeout(load, 10);
                }}
              >
                Clear
              </button>
            )}
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary, #475569)' }}>
            <span>Rows per page:</span>
            <select
              value={directoryPageSize}
              onChange={e => { setDirectoryPageSize(Number(e.target.value)); setDirectoryPage(1); scrollToDirectoryTop(); }}
              style={{
                padding: '4px 8px',
                fontSize: 12.5,
                borderRadius: 6,
                border: '1px solid var(--border, #cbd5e1)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text, #1e293b)',
                cursor: 'pointer'
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25 (Default)</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={100000}>All ({rows.length})</option>
            </select>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {rows.length === 0 ? (
              `Showing 0 ${tab === 'students' ? 'students' : 'faculty members'}`
            ) : (
              <>
                Showing <b>{directoryStartIdx + 1}</b> to <b>{directoryEndIdx}</b> of <b>{rows.length}</b> {tab === 'students' ? 'students' : 'faculty members'}
              </>
            )}
          </div>
        </div>
      </div>

      {message && <div className="error" style={{ margin: '8px 16px 0' }}>{message}</div>}

      {/* Box Body (Scrollable Table Area) */}
      <div className="directory-box-body" ref={tableBodyRef}>
        <table>
          {tab === 'students' ? (
            <>
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Adm No</th>
                  <th>Student Name</th>
                  <th>Gender</th>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Parent</th>
                  <th>SMS Mobile</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayedDirectoryRows.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <span className="roll" style={{ display: 'inline-block', minWidth: 28, textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                        {r.roll_number || r.roll || '—'}
                      </span>
                    </td>
                    <td>
                      {(r.admission_number || r.admissionNumber) ? (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {r.admission_number || r.admissionNumber}
                        </span>
                      ) : (
                        <span className="muted" style={{ fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td>
                      <StudentProfileHoverCard student={r}>
                        <b>{r.name}</b>
                      </StudentProfileHoverCard>
                    </td>
                    <td>
                      {r.gender ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 11.5,
                          fontWeight: 500,
                          background: /^f/i.test(r.gender) ? '#fdf2f8' : /^m/i.test(r.gender) ? '#f0f9ff' : '#f8fafc',
                          color: /^f/i.test(r.gender) ? '#db2777' : /^m/i.test(r.gender) ? '#0284c7' : '#64748b',
                          border: `1px solid ${/^f/i.test(r.gender) ? '#fbcfe8' : /^m/i.test(r.gender) ? '#bae6fd' : '#e2e8f0'}`
                        }}>
                          {r.gender}
                        </span>
                      ) : (
                        <span className="muted" style={{ fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {r.class_number === -1 ? 'L-KG' : r.class_number === 0 ? 'U-KG' : (r.class_number || String(r.class_name || '1').replace(/^class\s*/i, ''))}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {String(r.section_name || r.section || 'A').replace(/^section\s*/i, '').trim() || 'A'}
                      </span>
                    </td>
                    <td>{r.parent_name || 'Parent'}</td>
                    <td>{r.parent_sms_number || r.parent_phone || r.email || '—'}</td>
                    <td>
                      <span className={`badge ${r.active === false ? 'failed' : 'active'}`}>
                        {r.active === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={9} className="muted" style={{ padding: 28, textAlign: 'center' }}>
                      {loading ? 'Searching directory…' : 'No student records found matching this criteria.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr>
                  <th>Employee Id/Savior_NO</th>
                  <th>Faculty Name</th>
                  <th>Gender</th>
                  <th>Designation</th>
                  <th>Official Email</th>
                  <th>Mobile Contact</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayedDirectoryRows.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary-700)' }}>
                        {r.savior_no || r.employee_id || r.Savior_No || '—'}
                      </span>
                    </td>
                    <td>
                      <TeacherProfileHoverCard teacher={r}>
                        <b>{r.name || r.fullName}</b>
                      </TeacherProfileHoverCard>
                    </td>
                    <td>
                      {r.gender ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 11.5,
                          fontWeight: 500,
                          background: /^f/i.test(r.gender) ? '#fdf2f8' : /^m/i.test(r.gender) ? '#f0f9ff' : '#f8fafc',
                          color: /^f/i.test(r.gender) ? '#db2777' : /^m/i.test(r.gender) ? '#0284c7' : '#64748b',
                          border: `1px solid ${/^f/i.test(r.gender) ? '#fbcfe8' : /^m/i.test(r.gender) ? '#bae6fd' : '#e2e8f0'}`
                        }}>
                          {r.gender}
                        </span>
                      ) : (
                        <span className="muted" style={{ fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td>{r.designation || 'Teacher'}</td>
                    <td>{r.email}</td>
                    <td>{r.mobile || r.phone || '—'}</td>
                    <td>
                      <span className={`badge ${r.is_active === false || r.active === false ? 'failed' : 'active'}`}>
                        {r.is_active === false || r.active === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={7} className="muted" style={{ padding: 28, textAlign: 'center' }}>
                      {loading ? 'Searching directory…' : 'No faculty records found matching this criteria.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </>
          )}
        </table>
      </div>

      {/* Box Footer (Pagination Bar) */}
      <div className="directory-box-footer">
        <div style={{ color: 'var(--text-secondary, #475569)', fontSize: 12.5 }}>
          {rows.length === 0 ? (
            `Showing 0 ${tab === 'students' ? 'students' : 'faculty members'}`
          ) : (
            <>
              Showing <b>{directoryStartIdx + 1}</b> to <b>{directoryEndIdx}</b> of <b>{rows.length}</b> {tab === 'students' ? 'students' : 'faculty members'}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
            disabled={currentDirectoryPage <= 1}
            onClick={() => { setDirectoryPage(1); scrollToDirectoryTop(); }}
            title="First Page"
          >
            <ChevronsLeft size={14} /> First
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
            disabled={currentDirectoryPage <= 1}
            onClick={() => { setDirectoryPage(p => Math.max(1, p - 1)); scrollToDirectoryTop(); }}
            title="Previous Page"
          >
            <ChevronLeft size={14} /> Previous
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '0 4px', fontSize: 12.5 }}>
            <span>Page</span>
            <select
              value={currentDirectoryPage}
              onChange={(e) => { setDirectoryPage(Number(e.target.value)); scrollToDirectoryTop(); }}
              style={{
                padding: '3px 6px',
                fontSize: 12,
                borderRadius: 4,
                border: '1px solid var(--border, #cbd5e1)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text, #1e293b)',
                cursor: 'pointer'
              }}
            >
              {Array.from({ length: totalDirectoryPages }, (_, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {idx + 1}
                </option>
              ))}
            </select>
            <span>of <b>{totalDirectoryPages}</b></span>
          </div>

          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
            disabled={currentDirectoryPage >= totalDirectoryPages}
            onClick={() => { setDirectoryPage(p => Math.min(totalDirectoryPages, p + 1)); scrollToDirectoryTop(); }}
            title="Next Page"
          >
            Next <ChevronRight size={14} />
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
            disabled={currentDirectoryPage >= totalDirectoryPages}
            onClick={() => { setDirectoryPage(totalDirectoryPages); scrollToDirectoryTop(); }}
            title="Last Page"
          >
            Last <ChevronsRight size={14} />
          </button>
        </div>
      </div>
      </div>

      {/* ─── ADD TEACHER MODAL WITH PREVIEW ─── */}
      {addTeacherOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{addTeacherPreview ? "Preview Teacher Details" : "Add Faculty Member / Teacher"}</h2>
              <button
                type="button"
                onClick={() => { setAddTeacherOpen(false); setAddTeacherPreview(false); }}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>
            {!addTeacherPreview ? (
              <form className="modal-form" onSubmit={(e) => { e.preventDefault(); setAddTeacherPreview(true); }}>
                {/* Last Registered Teacher Banner in Red */}
                {lastRegisteredTeacherInfo && (
                  <div style={{
                    color: '#dc2626',
                    fontSize: 12.5,
                    fontWeight: 600,
                    padding: '8px 12px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 6,
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <Info size={15} style={{ flexShrink: 0, color: '#dc2626' }} />
                    <span>
                      Last registered teacher: <strong style={{ color: '#b91c1c' }}>{lastRegisteredTeacherInfo.name}</strong> | Employee ID: <strong style={{ color: '#b91c1c' }}>{lastRegisteredTeacherInfo.employeeId}</strong>
                    </span>
                  </div>
                )}

                {/* First Name + Last Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label>First Name
                    <input
                      required
                      placeholder="e.g. Rahul"
                      value={teacherForm.firstName || ''}
                      style={{
                        borderColor: /\d/.test(teacherForm.firstName || '') ? '#ef4444' : undefined,
                        boxShadow: /\d/.test(teacherForm.firstName || '') ? '0 0 0 1px #ef4444' : undefined
                      }}
                      onChange={e => {
                        const fn = e.target.value;
                        const ln = teacherForm.lastName || '';
                        setTeacherForm({ ...teacherForm, firstName: fn, name: [fn, ln].filter(Boolean).join(' ') });
                      }}
                    />
                    {/\d/.test(teacherForm.firstName || '') && (
                      <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                        Enter a string not a number
                      </span>
                    )}
                  </label>
                  <label>Last Name
                    <input
                      placeholder="e.g. Sharma"
                      value={teacherForm.lastName || ''}
                      style={{
                        borderColor: /\d/.test(teacherForm.lastName || '') ? '#ef4444' : undefined,
                        boxShadow: /\d/.test(teacherForm.lastName || '') ? '0 0 0 1px #ef4444' : undefined
                      }}
                      onChange={e => {
                        const ln = e.target.value;
                        const fn = teacherForm.firstName || '';
                        setTeacherForm({ ...teacherForm, lastName: ln, name: [fn, ln].filter(Boolean).join(' ') });
                      }}
                    />
                    {/\d/.test(teacherForm.lastName || '') && (
                      <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                        Enter a string not a number
                      </span>
                    )}
                  </label>
                </div>

                {/* Full Name — auto-computed, read-only */}
                <label style={{ color: '#64748b', fontSize: 12 }}>
                  Full Name <span style={{ color: '#10b981', fontSize: 11 }}>● Auto-generated</span>
                  <input
                    readOnly
                    tabIndex={-1}
                    style={{ backgroundColor: '#f8fafc', color: '#334155', cursor: 'default', border: '1px solid #e2e8f0' }}
                    value={[teacherForm.firstName, teacherForm.lastName].filter(Boolean).join(' ') || teacherForm.name || ''}
                    placeholder="Full name will appear here automatically"
                  />
                </label>

                <label>Email Address (for Faculty Portal Login)
                  <input
                    required
                    type="email"
                    placeholder="teacher@school.local"
                    value={teacherForm.email || ''}
                    onChange={e => setTeacherForm({ ...teacherForm, email: e.target.value })}
                  />
                </label>

                <label>Employee Id/Savior_NO
                  <input
                    required
                    placeholder="e.g. EMP001 or SAVIOR_101"
                    value={teacherForm.employeeId || teacherForm.saviorNo || ''}
                    onChange={e => setTeacherForm({ ...teacherForm, employeeId: e.target.value, saviorNo: e.target.value })}
                  />
                </label>

                {/* Row 1: Gender & Date of Birth */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label>Gender
                    <select
                      value={teacherForm.gender || ''}
                      onChange={e => setTeacherForm({ ...teacherForm, gender: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', marginTop: 4, boxSizing: 'border-box' }}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                  <label>Date of Birth <span style={{ color: '#64748b', fontSize: 11, fontWeight: 400 }}>(DD-MM-YYYY)</span>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: 4 }}>
                      <input
                        type="text"
                        placeholder="DD-MM-YYYY (e.g. 15-08-1990)"
                        maxLength={10}
                        value={teacherForm.dob || ''}
                        onChange={e => {
                          let val = e.target.value.replace(/[^0-9-]/g, '');
                          const rawDigits = val.replace(/-/g, '');
                          if (rawDigits.length <= 8 && !val.includes('-')) {
                            if (rawDigits.length > 4) {
                              val = `${rawDigits.slice(0, 2)}-${rawDigits.slice(2, 4)}-${rawDigits.slice(4, 8)}`;
                            } else if (rawDigits.length > 2) {
                              val = `${rawDigits.slice(0, 2)}-${rawDigits.slice(2, 4)}`;
                            }
                          }
                          setTeacherForm({ ...teacherForm, dob: val });
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 34px 8px 10px',
                          borderRadius: 6,
                          border: `1px solid ${teacherForm.dob && !isValidDdMmYyyy(teacherForm.dob) ? '#ef4444' : 'var(--border)'}`,
                          boxSizing: 'border-box'
                        }}
                      />
                      <input
                        type="date"
                        title="Select from date picker"
                        style={{
                          position: 'absolute',
                          right: 8,
                          width: 22,
                          height: 22,
                          opacity: 0,
                          cursor: 'pointer',
                          zIndex: 2
                        }}
                        onChange={e => {
                          if (e.target.value) {
                            const [y, m, d] = e.target.value.split('-');
                            setTeacherForm({ ...teacherForm, dob: `${d}-${m}-${y}` });
                          }
                        }}
                      />
                      <Calendar
                        size={16}
                        style={{
                          position: 'absolute',
                          right: 10,
                          color: '#64748b',
                          pointerEvents: 'none'
                        }}
                      />
                    </div>
                    {teacherForm.dob && !isValidDdMmYyyy(teacherForm.dob) && (
                      <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block', fontWeight: 500 }}>
                        Strict format required: DD-MM-YYYY (e.g. 15-08-1990)
                      </span>
                    )}
                  </label>
                </div>

                {/* Row 2: Designation & Mobile Number */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label>Designation
                    <input
                      placeholder="e.g. Senior Teacher, TGT Science"
                      value={teacherForm.designation || ''}
                      onChange={e => setTeacherForm({ ...teacherForm, designation: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </label>
                  <label>Mobile Number
                    <input
                      placeholder="10-digit mobile number"
                      value={teacherForm.mobile || ''}
                      onChange={e => setTeacherForm({ ...teacherForm, mobile: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </label>
                </div>

                {/* Row 3: Qualification */}
                <label>Qualification
                  <input
                    placeholder="e.g. M.Sc, B.Ed"
                    value={teacherForm.qualification || ''}
                    onChange={e => setTeacherForm({ ...teacherForm, qualification: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </label>

                {/* Automatic Email Notice */}
                <div style={{
                  padding: 12,
                  backgroundColor: '#eff6ff',
                  borderRadius: 8,
                  border: '1px solid #bfdbfe',
                  margin: '10px 0 16px 0',
                  fontSize: 12.5,
                  color: '#1e40af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <KeyRound size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
                  <span>
                    <b>Automatic Teacher Email:</b> Welcome credentials and a secure 24h password setup link will automatically be dispatched via SMTP to the teacher's registered email address upon submission.
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => {
                      if (!teacherForm.firstName && !teacherForm.name) { alert('Please enter First Name.'); return; }
                      if (/\d/.test(teacherForm.firstName || '') || /\d/.test(teacherForm.lastName || '')) {
                        alert('Validation Error: Enter a string not a number in name fields.');
                        return;
                      }
                      if (!teacherForm.email) { alert('Please enter Email Address.'); return; }
                      if (!(teacherForm.employeeId || teacherForm.saviorNo)) { alert('Please enter Employee Id/Savior_NO.'); return; }
                      setAddTeacherPreview(true);
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Eye size={15} /> Preview Details
                  </button>
                  <button type="submit" disabled={savingTeacher}>
                    {savingTeacher ? 'Adding Teacher…' : 'Add Teacher & Send Invite'}
                  </button>
                </div>
              </form>
            ) : (
              /* Teacher Preview Card */
              <div style={{ padding: '4px 2px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                  border: '1px solid #a7f3d0',
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 14
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#065f46', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                    <CheckCircle2 size={18} color="#10b981" />
                    Teacher Profile Preview
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#047857' }}>
                    Verify the details below before creating the account and dispatching credentials.
                  </p>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                  background: '#ffffff',
                  padding: 14,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  marginBottom: 14
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Employee Id / Savior_NO</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, fontFamily: 'monospace' }}>{teacherForm.employeeId || teacherForm.saviorNo || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>First Name</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{teacherForm.firstName || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Last Name</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{teacherForm.lastName || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Full Name (Auto-Generated)</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginTop: 2 }}>{[teacherForm.firstName, teacherForm.lastName].filter(Boolean).join(' ') || teacherForm.name || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Official Email</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{teacherForm.email || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Designation</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{teacherForm.designation || 'Teacher'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Gender</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{teacherForm.gender || 'Not Specified'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Date of Birth</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{teacherForm.dob || 'Not Specified'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Mobile Contact</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{teacherForm.mobile || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Welcome Dispatch</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#10b981', marginTop: 2 }}>✓ Automatic SMTP Email</div>
                  </div>
                </div>

                <div style={{
                  fontSize: 12,
                  color: '#1e3a8a',
                  background: '#eff6ff',
                  padding: '10px 14px',
                  borderRadius: 6,
                  border: '1px solid #bfdbfe',
                  marginBottom: 16
                }}>
                  <b>Security Notice:</b> A temporary password and 24-hour setup link will automatically be generated and emailed to <b>{teacherForm.email}</b>.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button type="button" className="btn-secondary" onClick={() => setAddTeacherPreview(false)}>
                    ← Back to Edit
                  </button>
                  <button type="button" className="btn-primary" onClick={handleAddTeacher} disabled={savingTeacher}>
                    {savingTeacher ? 'Adding Teacher…' : '✓ Confirm & Create Teacher'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── BULK TEACHER IMPORT MODAL ─── */}
      {importOpen && (
        <div className="modal-backdrop" style={{ padding: 12 }}>
          <div className="modal modal-fullwindow" style={{ width: 'calc(100vw - 28px)', maxWidth: 'calc(100vw - 28px)', height: 'calc(100vh - 28px)', maxHeight: 'calc(100vh - 28px)', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Bulk Teacher Import</h2>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                  Upload Excel (.xlsx, .csv) spreadsheet with standardized headers. Welcome credentials will automatically be dispatched via SMTP.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setImportOpen(false); setPreviewRows([]); }}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>

            {/* Last Registered Teacher Banner in Red */}
            {lastRegisteredTeacherInfo && (
              <div style={{
                color: '#dc2626',
                fontSize: 12.5,
                fontWeight: 600,
                padding: '8px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 6,
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0
              }}>
                <Info size={15} style={{ flexShrink: 0, color: '#dc2626' }} />
                <span>
                  Last registered teacher: <strong style={{ color: '#b91c1c' }}>{lastRegisteredTeacherInfo.name}</strong> | Employee ID: <strong style={{ color: '#b91c1c' }}>{lastRegisteredTeacherInfo.employeeId}</strong>
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 12, color: '#475569' }}>
                Required headers: <code>Savior_No</code>, <code>Fist Name</code>, <code>Last Name</code>, <code>Full Name(Automatically generated)</code>, <code>Email_id</code>, <code>Gender</code>, <code>Date_of_Birth</code>, <code>Class</code>, <code>Section</code>, <code>Status</code>, <code>Designation</code>
              </span>
              <button
                type="button"
                className="template-download-btn"
                onClick={downloadTeacherTemplate}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              >
                <Download size={13} /> Download Sample Template (.xlsx)
              </button>
            </div>

            <label className="dropzone" style={{ border: '2px dashed #cbd5e1', padding: 24, textAlign: 'center', borderRadius: 8, cursor: 'pointer', display: 'block', background: '#ffffff' }}>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFile}
                style={{ display: 'none' }}
              />
              <div className="dropzone-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: '#2563eb' }}>
                <UploadCloud size={28} />
              </div>
              <strong style={{ fontSize: 14 }}>Click to browse or drop Excel file here</strong>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv)</div>
            </label>

            {previewRows.length > 0 && (
              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                {/* ── TOP TOOLBAR: Search, Page Size & Clear ── */}
                <div className="preview-toolbar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 14 }}>Preview Data</strong>
                    <span style={{ fontSize: 12, padding: '2px 8px', background: '#e0f2fe', color: '#0369a1', borderRadius: 10, fontWeight: 600 }}>
                      {previewRows.length} faculty ready to import
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {/* Search inside preview */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Search size={14} style={{ position: 'absolute', left: 8, color: '#94a3b8', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        placeholder="Search preview..."
                        value={importPreviewSearch}
                        onChange={(e) => { setImportPreviewSearch(e.target.value); setImportPreviewPage(1); }}
                        style={{
                          padding: '5px 26px 5px 28px',
                          fontSize: 12.5,
                          border: '1px solid var(--border, #cbd5e1)',
                          borderRadius: 6,
                          width: 180,
                          background: 'var(--card-bg, #ffffff)',
                          color: 'var(--text, #0f172a)'
                        }}
                      />
                      {importPreviewSearch && (
                        <button
                          type="button"
                          onClick={() => { setImportPreviewSearch(''); setImportPreviewPage(1); }}
                          style={{
                            position: 'absolute',
                            right: 6,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 2,
                            color: '#94a3b8'
                          }}
                          title="Clear search"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {/* Rows per page selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary, #475569)' }}>
                      <span>Rows per page:</span>
                      <select
                        value={importPreviewPageSize}
                        onChange={(e) => { setImportPreviewPageSize(Number(e.target.value)); setImportPreviewPage(1); }}
                        style={{
                          padding: '4px 8px',
                          fontSize: 12.5,
                          borderRadius: 6,
                          border: '1px solid var(--border, #cbd5e1)',
                          background: 'var(--card-bg, #ffffff)',
                          color: 'var(--text, #1e293b)',
                          cursor: 'pointer'
                        }}
                      >
                        <option value={10}>10</option>
                        <option value={25}>25 (Default)</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={250}>250</option>
                        <option value={500}>500</option>
                        <option value={100000}>All ({previewRows.length})</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => { setPreviewRows([]); setImportPreviewPage(1); setImportPreviewSearch(''); }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* ── PREVIEW TABLE ── */}
                <div className="preview-table-container" style={{ flex: 1, maxHeight: 'calc(100vh - 350px)', minHeight: 340, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                  <table style={{ width: '100%', minWidth: 1200, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ width: 44, textAlign: 'center' }}>#</th>
                        <th>Savior_No</th>
                        <th>First Name</th>
                        <th>Last Name</th>
                        <th>Full Name</th>
                        <th>Email ID</th>
                        <th>Gender</th>
                        <th>Date of Birth</th>
                        <th>Designation</th>
                        <th>Class & Section</th>
                        <th>Status</th>
                        <th>Email Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedTeacherPreviewRows.length === 0 ? (
                        <tr>
                          <td colSpan={12} style={{ textAlign: 'center', padding: '36px 20px', color: '#64748b' }}>
                            No teachers match the current search filter.
                          </td>
                        </tr>
                      ) : (
                        displayedTeacherPreviewRows.map((r, i) => {
                          const rowNum = r._origRowIndex || (teacherStartIdx + i + 1);
                          return (
                            <tr key={teacherStartIdx + i}>
                              <td style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center' }}>{rowNum}</td>
                              <td><code>{r.saviorNo || r.employeeId}</code></td>
                              <td>{r.firstName || '—'}</td>
                              <td>{r.lastName || '—'}</td>
                              <td><b>{r.name}</b></td>
                              <td>{r.email}</td>
                              <td>
                                {r.gender ? (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '1px 7px',
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 500,
                                    background: /^f/i.test(r.gender) ? '#fdf2f8' : /^m/i.test(r.gender) ? '#f0f9ff' : '#f8fafc',
                                    color: /^f/i.test(r.gender) ? '#db2777' : /^m/i.test(r.gender) ? '#0284c7' : '#64748b',
                                    border: `1px solid ${/^f/i.test(r.gender) ? '#fbcfe8' : /^m/i.test(r.gender) ? '#bae6fd' : '#e2e8f0'}`
                                  }}>
                                    {r.gender}
                                  </span>
                                ) : '—'}
                              </td>
                              <td>{r.dob || '—'}</td>
                              <td>{r.designation || 'Teacher'}</td>
                              <td>{r.class ? `${r.class} — Sec ${r.section}` : '—'}</td>
                              <td><span className="badge active">{r.status || 'Active'}</span></td>
                              <td><span className="badge pending">Pending Dispatch</span></td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ── PAGINATION BAR ── */}
                <div className="preview-pagination-bar">
                  <div style={{ color: 'var(--text-secondary, #475569)', fontSize: 12.5 }}>
                    {filteredTeacherPreviewRows.length === 0 ? (
                      'Showing 0 records'
                    ) : (
                      <>
                        Showing <b>{teacherStartIdx + 1}</b> to <b>{teacherEndIdx}</b> of <b>{filteredTeacherPreviewRows.length}</b> records
                        {filteredTeacherPreviewRows.length !== previewRows.length && (
                          <span style={{ opacity: 0.75, marginLeft: 4 }}>(filtered from {previewRows.length} total)</span>
                        )}
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                      disabled={currentTeacherImportPage <= 1}
                      onClick={() => setImportPreviewPage(1)}
                      title="First Page"
                    >
                      <ChevronsLeft size={14} /> First
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                      disabled={currentTeacherImportPage <= 1}
                      onClick={() => setImportPreviewPage(p => Math.max(1, p - 1))}
                      title="Previous Page"
                    >
                      <ChevronLeft size={14} /> Previous
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '0 4px', fontSize: 12.5 }}>
                      <span>Page</span>
                      <select
                        value={currentTeacherImportPage}
                        onChange={(e) => setImportPreviewPage(Number(e.target.value))}
                        style={{
                          padding: '3px 6px',
                          fontSize: 12,
                          borderRadius: 4,
                          border: '1px solid var(--border, #cbd5e1)',
                          background: 'var(--card-bg, #ffffff)',
                          color: 'var(--text, #1e293b)',
                          cursor: 'pointer'
                        }}
                      >
                        {Array.from({ length: totalTeacherImportPages }, (_, idx) => (
                          <option key={idx + 1} value={idx + 1}>
                            {idx + 1}
                          </option>
                        ))}
                      </select>
                      <span>of <b>{totalTeacherImportPages}</b></span>
                    </div>

                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                      disabled={currentTeacherImportPage >= totalTeacherImportPages}
                      onClick={() => setImportPreviewPage(p => Math.min(totalTeacherImportPages, p + 1))}
                      title="Next Page"
                    >
                      Next <ChevronRight size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                      disabled={currentTeacherImportPage >= totalTeacherImportPages}
                      onClick={() => setImportPreviewPage(totalTeacherImportPages)}
                      title="Last Page"
                    >
                      Last <ChevronsRight size={14} />
                    </button>
                  </div>
                </div>

                {/* ── MODAL FOOTER ── */}
                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => { setImportOpen(false); setPreviewRows([]); setImportPreviewPage(1); }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitBulkImport}
                    disabled={importing}
                    style={{ background: '#10b981', color: '#ffffff', fontWeight: 600, padding: '8px 20px' }}
                  >
                    {importing ? 'Importing Teachers…' : `Confirm & Import ${previewRows.length} Teachers`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── EXPORT FACULTY DIRECTORY (PREVIEW) MODAL ─── */}
      {exportOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 880 }}>
            <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Export Faculty Directory (Preview)</h2>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                  Previewing <b>{prepareExportData().length}</b> faculty records formatted with standardized template headers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExportOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                onClick={handleExportExcel}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#10b981', color: '#ffffff' }}
              >
                <FileSpreadsheet size={15} /> Download Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={15} /> Download CSV (.csv)
              </button>
            </div>

            <div className="preview-table-container" style={{ maxHeight: 360, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Savior_No</th>
                    <th>Fist Name</th>
                    <th>Last Name</th>
                    <th>Full Name(Automatically generated)</th>
                    <th>Email_id</th>
                    <th>Gender</th>
                    <th>Date of Birth</th>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Status</th>
                    <th>Designation</th>
                  </tr>
                </thead>
                <tbody>
                  {prepareExportData().slice(0, 15).map((r, i) => (
                    <tr key={i}>
                      <td><code>{r['Savior_No'] || '—'}</code></td>
                      <td>{r['Fist Name'] || '—'}</td>
                      <td>{r['Last Name'] || '—'}</td>
                      <td><b>{r['Full Name(Automatically generated)']}</b></td>
                      <td>{r['Email_id']}</td>
                      <td>
                        {r['Gender'] ? (
                          <span className={`badge ${String(r['Gender']).toLowerCase() === 'female' ? 'role-teacher' : 'role-admin'}`} style={{ fontSize: 11 }}>
                            {r['Gender']}
                          </span>
                        ) : '—'}
                      </td>
                      <td>{r['Date_of_Birth'] ? <code>{r['Date_of_Birth']}</code> : '—'}</td>
                      <td>{r['Class'] || '—'}</td>
                      <td>{r['Section'] || '—'}</td>
                      <td><span className="badge active">{r['Status']}</span></td>
                      <td>{r['Designation']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {prepareExportData().length > 15 && (
              <p className="muted" style={{ fontSize: 11, margin: '8px 0 0', textAlign: 'center' }}>
                Showing first 15 of {prepareExportData().length} faculty records in preview. Full dataset will be included in the export file.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
