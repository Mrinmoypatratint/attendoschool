import React, { useEffect, useState } from 'react';
import { api } from './api';

export default function PeopleManagement() {
  const [tab, setTab] = useState<'students' | 'teachers'>('students');
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const endpoint = tab === 'students' ? '/people/students' : '/people/teachers';
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

  return (
    <div className="feature-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">INSTITUTIONAL DIRECTORY</p>
          <h1>People Management</h1>
          <p className="muted">Centralized directory of enrolled students, guardians, and school faculty staff.</p>
        </div>
      </div>

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
            placeholder={tab === 'students' ? 'Search by name, roll, or parent…' : 'Search by name, employee ID, or email…'}
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
      </div>

      {message && <div className="error" style={{ marginBottom: 16 }}>{message}</div>}

      <div className="table-wrap">
        <table>
          {tab === 'students' ? (
            <>
              <thead>
                <tr>
                  <th>Roll</th>
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
                    </td>
                    <td>
                      <b>{r.name}</b>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Class {r.class_name || r.class_number || '8'} — Section {r.section_name || 'A'}
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
                  <th>Employee ID</th>
                  <th>Faculty Name</th>
                  <th>Official Email</th>
                  <th>Mobile Contact</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary-700)' }}>
                        {r.employee_id || 'FAC001'}
                      </span>
                    </td>
                    <td>
                      <b>{r.name}</b>
                    </td>
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
                    <td colSpan={5} className="muted" style={{ padding: 28, textAlign: 'center' }}>
                      {loading ? 'Searching directory…' : 'No faculty records found matching this criteria.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </>
          )}
        </table>
      </div>
    </div>
  );
}

