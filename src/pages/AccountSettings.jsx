import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Field } from '../components/common';
import { DEPARTMENTS } from '../utils/departments';
import { apiUrl } from '../utils/apiBase';
import { csrfHeaders } from '../utils/api';

async function request(path, options) {
  const method = options.method || 'GET';
  const response = await fetch(apiUrl(`/api/auth${path}`), {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeaders(method),
      ...options.headers,
    },
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('The server returned an invalid response. Check that the Flask API is running.');
  }
  if (!response.ok) throw new Error(result.error || result.msg || 'Could not save your changes.');
  return result;
}

function accountForm(user) {
  const knownDepartment = DEPARTMENTS.some((item) => item.value === user?.department);
  return {
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    department: knownDepartment ? user.department : user?.department ? 'Other' : '',
    other_department: knownDepartment ? '' : user?.department || '',
    academic_year: user?.academic_year || '',
    semester: user?.semester || '',
  };
}

export default function AccountSettings() {
  const { user, setUser } = useContext(AuthContext);
  const [form, setForm] = useState(() => accountForm(user));
  const [password, setPassword] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [message, setMessage] = useState(null);
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setForm(accountForm(user));
  }, [user]);

  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const changePassword = (key, value) => setPassword((current) => ({ ...current, [key]: value }));

  const saveProfile = async (event) => {
    event.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.department === 'Other') payload.other_department = payload.other_department.trim();
      const updatedUser = await request('/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setUser(updatedUser);
      setMessage({ type: 'success', text: 'Account settings saved to the database.' });
    } catch (error) {
      setMessage({ type: 'danger', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setPasswordMessage(null);
    if (password.new_password !== password.confirm_password) {
      setPasswordMessage({ type: 'danger', text: 'New passwords do not match.' });
      return;
    }
    setSavingPassword(true);
    try {
      const result = await request('/password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: password.current_password,
          new_password: password.new_password,
        }),
      });
      setPassword({ current_password: '', new_password: '', confirm_password: '' });
      setPasswordMessage({ type: 'success', text: result.msg });
    } catch (error) {
      setPasswordMessage({ type: 'danger', text: error.message });
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) return null;
  const isStudent = user.role === 'student';
  const isMentor = user.role === 'mentor';

  return (
    <>
      <section className="card mb-4 border-0 shadow-sm">
        <div className="card-header bg-transparent fw-bold border-bottom">
          <i className="bi bi-person-badge text-primary me-2" />
          {user.role[0].toUpperCase() + user.role.slice(1)} Account
        </div>
        <form onSubmit={saveProfile}>
          <div className="card-body">
            {message && <div className={`alert alert-${message.type}`} role="status">{message.text}</div>}
            <div className="row g-3">
              <Field label="Full name" className="col-12 col-md-6">
                <input className="form-control" required maxLength={120} value={form.full_name} onChange={(e) => change('full_name', e.target.value)} />
              </Field>
              <Field label="Email" className="col-12 col-md-6">
                <input type="email" className="form-control" required maxLength={120} value={form.email} onChange={(e) => change('email', e.target.value)} />
              </Field>
              <Field label="Phone number" className="col-12 col-md-6">
                <input type="tel" className="form-control" maxLength={20} value={form.phone} onChange={(e) => change('phone', e.target.value)} />
              </Field>
              {(isStudent || isMentor) && (
                <Field label="Department / Branch" className="col-12 col-md-6">
                  {isStudent ? (
                    <select className="form-select" required value={form.department} onChange={(e) => change('department', e.target.value)}>
                      <option value="">Select your department / branch</option>
                      {DEPARTMENTS.map((department) => <option key={department.value} value={department.value}>{department.label}</option>)}
                    </select>
                  ) : (
                    <input className="form-control" required maxLength={80} value={form.department} onChange={(e) => change('department', e.target.value)} />
                  )}
                </Field>
              )}
              {isStudent && form.department === 'Other' && (
                <Field label="Enter your branch name" className="col-12 col-md-6">
                  <input className="form-control" required maxLength={80} value={form.other_department} onChange={(e) => change('other_department', e.target.value)} />
                </Field>
              )}
              {isStudent && (
                <>
                  <Field label="Academic year" className="col-12 col-md-6">
                    <input className="form-control" required maxLength={10} value={form.academic_year} onChange={(e) => change('academic_year', e.target.value)} />
                  </Field>
                  <Field label="Semester" className="col-12 col-md-6">
                    <input className="form-control" required maxLength={10} value={form.semester} onChange={(e) => change('semester', e.target.value)} />
                  </Field>
                  <Field label="Student ID / Roll Number" className="col-12 col-md-6">
                    <input className="form-control" readOnly value={user.student_id || ''} />
                  </Field>
                </>
              )}
              {isMentor && (
                <>
                  <Field label="Employee ID" className="col-12 col-md-6">
                    <input className="form-control" readOnly value={user.employee_id || ''} />
                  </Field>
                </>
              )}
            </div>
          </div>
          <div className="card-footer bg-transparent">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save account settings'}
            </button>
          </div>
        </form>
      </section>

      <section className="card mb-4 border-0 shadow-sm">
        <div className="card-header bg-transparent fw-bold border-bottom">
          <i className="bi bi-shield-lock text-primary me-2" />Change password
        </div>
        <form onSubmit={savePassword}>
          <div className="card-body">
            {passwordMessage && <div className={`alert alert-${passwordMessage.type}`} role="status">{passwordMessage.text}</div>}
            <div className="row g-3">
              <Field label="Current password" className="col-12 col-md-4">
                <input type="password" className="form-control" autoComplete="current-password" required value={password.current_password} onChange={(e) => changePassword('current_password', e.target.value)} />
              </Field>
              <Field label="New password" className="col-12 col-md-4">
                <input type="password" className="form-control" autoComplete="new-password" minLength={8} maxLength={128} required value={password.new_password} onChange={(e) => changePassword('new_password', e.target.value)} />
              </Field>
              <Field label="Confirm new password" className="col-12 col-md-4">
                <input type="password" className="form-control" autoComplete="new-password" minLength={8} maxLength={128} required value={password.confirm_password} onChange={(e) => changePassword('confirm_password', e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="card-footer bg-transparent">
            <button type="submit" className="btn btn-outline-primary" disabled={savingPassword}>
              {savingPassword ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
