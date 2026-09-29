import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Plus, Download, UploadCloud, KeyRound, AlertCircle, CheckCircle2, Eye } from 'lucide-react';

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
  const [toastNotice, setToastNotice] = useState<{ type: 'success' | 'error'; message: string; resetUrl?: string } | null>(null);

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
        employeeId: teacherForm.employeeId || teacherForm.saviorNo
      };

      const res = await api.post('/teachers', payload);
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
  async function downloadTeacherTemplate() {
    try {
      const res = await api.get('/teachers/template', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'teachers_import_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Local fallback with exact requested headers
      const sample = [
        { "Savior_No": "EMP010", "Fist Name": "Sunita", "Last Name": "Verma", "Full Name(Automatically generated)": "Sunita Verma", "Email_id": "sunita.v@school.local", "Class": "Class 10", "Section": "A", "Status": "Active", "Designation": "Senior Teacher" },
        { "Savior_No": "EMP011", "Fist Name": "Alok", "Last Name": "Mishra", "Full Name(Automatically generated)": "Alok Mishra", "Email_id": "alok.m@school.local", "Class": "Class 9", "Section": "B", "Status": "Active", "Designation": "TGT Mathematics" },
        { "Savior_No": "EMP012", "Fist Name": "Rekha", "Last Name": "Sengupta", "Full Name(Automatically generated)": "Rekha Sengupta", "Email_id": "rekha.s@school.local", "Class": "Class 8", "Section": "A", "Status": "Active", "Designation": "PRT Science" }
      ];
      const ws = XLSX.utils.json_to_sheet(sample);
      ws['!cols'] = [16, 14, 14, 24, 26, 12, 10, 12, 20].map(wch => ({ wch }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Teachers");
      XLSX.writeFile(wb, "teachers_import_template.xlsx");
    }
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
            designation,
            status,
            class: className,
            section: sectionName,
            emailStatus: 'Pending'
          };
        }).filter(x => x.name && x.email);
        setPreviewRows(mapped);
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
      setToastNotice({
        type: 'success',
        message: `Successfully onboarded ${res.data.count} teachers! Automatic welcome emails and credentials have been dispatched via SMTP.`
      });
      setImportOpen(false);
      setPreviewRows([]);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to import teachers');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="feature-page">
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <p className="eyebrow">INSTITUTIONAL DIRECTORY</p>
          <h1>People Management</h1>
          <p className="muted">Centralized directory of enrolled students, guardians, and school faculty staff.</p>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
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
        <form onSubmit={handleSearchSubmit} className="filter-row" style={{ margin: 0 }}>
          <input
            placeholder={tab === 'students' ? 'Search by name, roll, or parent…' : 'Search by name, employee ID/Savior_NO, or email…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 320, background: '#ffffff' }}
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
      </div>

      {message && <div className="error" style={{ marginBottom: 16 }}>{message}</div>}

      <div className="table-wrap">
        <table>
          {tab === 'students' ? (
            <>
              <thead>
                <tr>
                  <th>Roll / Adm No</th>
                  <th>Student Name</th>
                  <th>Class & Section</th>
                  <th>Parent / Guardian</th>
                  <th>SMS Mobile</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <span className="roll" style={{ display: 'inline-block', minWidth: 28, textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                        {r.roll_number || r.roll || '—'}
                      </span>
                      {(r.admission_number || r.admissionNumber) && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                          {r.admission_number || r.admissionNumber}
                        </div>
                      )}
                    </td>
                    <td>
                      <b>{r.name}</b>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {r.class_number === -1 ? 'L-KG' : r.class_number === 0 ? 'U-KG' : `Class ${r.class_number || r.class_name || '1'}`} — Section {r.section_name || 'A'}
                      </span>
                    </td>
                    <td>{r.parent_name || 'Guardian'}</td>
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
                    <td colSpan={6} className="muted" style={{ padding: 28, textAlign: 'center' }}>
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
                  <th>Designation</th>
                  <th>Official Email</th>
                  <th>Mobile Contact</th>
                  <th>Email Delivery Status</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary-700)' }}>
                        {r.savior_no || r.employee_id || r.Savior_No || '—'}
                      </span>
                    </td>
                    <td>
                      <b>{r.name || r.fullName}</b>
                    </td>
                    <td>{r.designation || 'Teacher'}</td>
                    <td>{r.email}</td>
                    <td>{r.mobile || r.phone || '—'}</td>
                    <td>
                      <span className={`badge ${r.email_status === 'Sent' ? 'active' : r.email_status === 'Failed' ? 'failed' : 'pending'}`}>
                        {r.email_status === 'Sent' ? '✓ Sent' : r.email_status === 'Failed' ? '✕ Failed' : '● Pending'}
                      </span>
                    </td>
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
                {/* First Name + Last Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label>First Name
                    <input
                      required
                      placeholder="e.g. Rahul"
                      value={teacherForm.firstName || ''}
                      onChange={e => {
                        const fn = e.target.value;
                        const ln = teacherForm.lastName || '';
                        setTeacherForm({ ...teacherForm, firstName: fn, name: [fn, ln].filter(Boolean).join(' ') });
                      }}
                    />
                  </label>
                  <label>Last Name
                    <input
                      placeholder="e.g. Sharma"
                      value={teacherForm.lastName || ''}
                      onChange={e => {
                        const ln = e.target.value;
                        const fn = teacherForm.firstName || '';
                        setTeacherForm({ ...teacherForm, lastName: ln, name: [fn, ln].filter(Boolean).join(' ') });
                      }}
                    />
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label>Designation
                    <input
                      placeholder="e.g. Senior Teacher, TGT Science"
                      value={teacherForm.designation || ''}
                      onChange={e => setTeacherForm({ ...teacherForm, designation: e.target.value })}
                    />
                  </label>
                  <label>Mobile Number
                    <input
                      placeholder="10-digit mobile number"
                      value={teacherForm.mobile || ''}
                      onChange={e => setTeacherForm({ ...teacherForm, mobile: e.target.value })}
                    />
                  </label>
                </div>

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
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 840 }}>
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 12, color: '#475569' }}>
                Required headers: <code>Savior_No</code>, <code>Fist Name</code>, <code>Last Name</code>, <code>Full Name(Automatically generated)</code>, <code>Email_id</code>, <code>Class</code>, <code>Section</code>, <code>Status</code>, <code>Designation</code>
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
              <div style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 14 }}>Preview Data ({previewRows.length} faculty ready to import)</strong>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => setPreviewRows([])}
                  >
                    Clear
                  </button>
                </div>
                <div className="preview-table-container" style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Savior_No</th>
                        <th>First Name</th>
                        <th>Last Name</th>
                        <th>Full Name</th>
                        <th>Email ID</th>
                        <th>Designation</th>
                        <th>Class & Section</th>
                        <th>Status</th>
                        <th>Email Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r, i) => (
                        <tr key={i}>
                          <td><code>{r.saviorNo || r.employeeId}</code></td>
                          <td>{r.firstName || '—'}</td>
                          <td>{r.lastName || '—'}</td>
                          <td><b>{r.name}</b></td>
                          <td>{r.email}</td>
                          <td>{r.designation || 'Teacher'}</td>
                          <td>{r.class ? `${r.class} — Sec ${r.section}` : '—'}</td>
                          <td><span className="badge active">{r.status || 'Active'}</span></td>
                          <td><span className="badge pending">Pending Dispatch</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => { setImportOpen(false); setPreviewRows([]); }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitBulkImport}
                    disabled={importing}
                    style={{ background: '#10b981', color: '#ffffff' }}
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
