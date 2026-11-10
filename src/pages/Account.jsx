import { startTransition, useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Field, PageHeader } from '../components/common';
import { DEPARTMENTS } from '../utils/departments';

const API = '/api/auth';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      credentials: 'include',
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new Error('Cannot reach the Flask API. Start it with `python -m backend.app` and check the API URL.');
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (response.status === 500 && contentType.startsWith('text/plain')) {
      throw new Error('Vite could not reach the Flask API at http://127.0.0.1:5000. Start Flask with `python -m backend.app` and check its terminal.');
    }
    if (response.status >= 500) {
      throw new Error(`The API returned HTTP ${response.status} without a JSON error. Check the Flask terminal for the cause.`);
    }
    throw new Error('The Flask API returned a non-JSON response. Check that the Vite /api proxy points to the Flask server.');
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('The server returned an invalid response. Check that the Flask API is running.');
  }
  if (!response.ok) throw new Error(result.error || result.msg || 'Request failed. Please try again.');
  return result;
}

const ROLE_LABELS = {
  student: 'Student',
  mentor: 'Mentor',
  admin: 'Admin',
};

export default function Account({ onAuthenticated, authError }) {
  const { setUser } = useContext(AuthContext);
  const [role, setRole] = useState('student');
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({});
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectRole = (nextRole) => {
    setRole(nextRole);
    setMode('login');
    setForm({});
    setMessage(null);
  };
  const switchMode = (nextMode) => {
    setMode(nextMode);
    setForm({});
    setMessage(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setMessage(null);
    if (mode === 'register' && form.password !== form.confirm_password) {
      setMessage({ type: 'danger', text: 'Passwords do not match.' });
      return;
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        const payload = {
          ...form,
          department: form.department === 'Other' ? 'Other' : form.department,
        };
        delete payload.confirm_password;
        const path = role === 'student' ? '/register/student' : '/register/mentor';
        await request(path, { method: 'POST', body: JSON.stringify(payload) });
        setBusy(false);
        setMessage({
          type: 'success',
          text: role === 'mentor'
            ? 'Registration received. An admin must approve your account before you can sign in.'
            : 'Registration successful. Sign in with your new student account.',
        });
        setMode('login');
        setForm({ email: form.email || '' });
        return;
      }

      await request('/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.email, password: form.password, role }),
      });
      const profile = await request('/me');
      startTransition(() => {
        setUser(profile);
        onAuthenticated(profile);
      });
    } catch (error) {
      setMessage({ type: 'danger', text: error.message });
      setBusy(false);
    }
  };

  const registerStudent = role === 'student' && mode === 'register';
  const registerMentor = role === 'mentor' && mode === 'register';
  const registering = registerStudent || registerMentor;

  return (
    <div className="public-auth min-vh-100 d-flex align-items-center py-4">
      <div className="container">
        <div className="row justify-content-center align-items-center g-4">
          <div className="col-12 col-lg-5">
            <div className="mb-4">
              <span className="brand-mark d-inline-grid mb-3"><i className="bi bi-journal-check" /></span>
              <p className="text-uppercase small fw-semibold text-primary mb-2">Student Study Planner</p>
              <h1 className="display-6 fw-bold">Plan your next step with confidence.</h1>
              <p className="text-secondary fs-5 mb-0">
                Sign in to manage study plans, track progress, and stay connected with your academic team.
              </p>
            </div>
            <div className="d-flex flex-wrap gap-2">
              {['student', 'mentor', 'admin'].map((value) => (
                <button
                  type="button"
                  key={value}
                  className={`btn ${role === value ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => selectRole(value)}
                >
                  {ROLE_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          <div className="col-12 col-lg-7 col-xl-6">
            <section className="card border-0 shadow-sm">
              <div className="card-header bg-transparent p-3 p-md-4">
                <h2 className="h4 mb-1">{registering ? `${ROLE_LABELS[role]} registration` : `${ROLE_LABELS[role]} login`}</h2>
                <p className="text-secondary mb-0">
                  {role === 'admin'
                    ? 'Admin accounts are created securely by the system administrator.'
                    : role === 'mentor' && registering
                      ? 'Mentor accounts require Admin approval before dashboard access.'
                      : 'Use your registered account details to continue.'}
                </p>
              </div>
              <div className="card-body p-3 p-md-4">
                {authError && <div className="alert alert-warning" role="alert">{authError}</div>}
                <div className="d-flex gap-2 mb-4" role="group" aria-label={`${ROLE_LABELS[role]} account options`}>
                  <button type="button" className={`btn ${mode === 'login' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => switchMode('login')}>
                    {ROLE_LABELS[role]} Login
                  </button>
                  {role !== 'admin' && (
                    <button type="button" className={`btn ${mode === 'register' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => switchMode('register')}>
                      {ROLE_LABELS[role]} Registration
                    </button>
                  )}
                </div>

                {message && <div className={`alert alert-${message.type}`} role="status">{message.text}</div>}

                <form onSubmit={submit}>
                  <div className="row g-3">
                    {registering && (
                      <Field label="Full name" className="col-12 col-md-6">
                        <input className="form-control" autoComplete="name" required maxLength={120} value={form.full_name || ''} onChange={(e) => change('full_name', e.target.value)} />
                      </Field>
                    )}
                    {registerStudent && (
                      <Field label="Student ID / Roll Number" className="col-12 col-md-6">
                        <input className="form-control" required pattern="2451-[0-9]{2}-[0-9]{3}-[0-9]{3}" title="Expected format: 2451-XX-XXX-XXX" value={form.student_id || ''} onChange={(e) => change('student_id', e.target.value)} />
                      </Field>
                    )}
                    {registerMentor && (
                      <>
                        <Field label="Employee ID" className="col-12 col-md-6">
                          <input className="form-control" required maxLength={20} value={form.employee_id || ''} onChange={(e) => change('employee_id', e.target.value)} />
                        </Field>
                        <Field label="Department" className="col-12 col-md-6">
                          <input className="form-control" required maxLength={80} value={form.department || ''} onChange={(e) => change('department', e.target.value)} />
                        </Field>
                      </>
                    )}
                    <Field label="Email" className="col-12 col-md-6">
                      <input type="email" className="form-control" autoComplete="email" required maxLength={120} value={form.email || ''} onChange={(e) => change('email', e.target.value)} />
                    </Field>
                    {registering && (
                      <Field label="Phone number" className="col-12 col-md-6">
                        <input type="tel" className="form-control" autoComplete="tel" required maxLength={20} value={form.phone || ''} onChange={(e) => change('phone', e.target.value)} />
                      </Field>
                    )}
                    {registerStudent && (
                      <>
                        <Field label="Department / Branch" className="col-12 col-md-6">
                          <select className="form-select" required value={form.department || ''} onChange={(e) => change('department', e.target.value)}>
                            <option value="">Select your department / branch</option>
                            {DEPARTMENTS.map((department) => <option key={department.value} value={department.value}>{department.label}</option>)}
                          </select>
                        </Field>
                        {form.department === 'Other' && (
                          <Field label="Enter your branch name" className="col-12 col-md-6">
                            <input className="form-control" required maxLength={80} value={form.other_department || ''} onChange={(e) => change('other_department', e.target.value)} />
                          </Field>
                        )}
                        <Field label="Academic year" className="col-12 col-md-6">
                          <input className="form-control" required maxLength={10} value={form.academic_year || ''} onChange={(e) => change('academic_year', e.target.value)} placeholder="e.g. 2nd Year" />
                        </Field>
                        <Field label="Semester" className="col-12 col-md-6">
                          <input className="form-control" required maxLength={10} value={form.semester || ''} onChange={(e) => change('semester', e.target.value)} placeholder="e.g. 4" />
                        </Field>
                      </>
                    )}
                    <Field label="Password" className="col-12 col-md-6">
                      <input type="password" className="form-control" autoComplete={registering ? 'new-password' : 'current-password'} required minLength={8} maxLength={128} value={form.password || ''} onChange={(e) => change('password', e.target.value)} />
                    </Field>
                    {registering && (
                      <Field label="Confirm password" className="col-12 col-md-6">
                        <input type="password" className="form-control" autoComplete="new-password" required minLength={8} maxLength={128} value={form.confirm_password || ''} onChange={(e) => change('confirm_password', e.target.value)} />
                      </Field>
                    )}
                  </div>
                  <button className="btn btn-primary w-100 mt-4" type="submit" disabled={busy}>
                    {busy ? 'Please wait…' : registering ? `Create ${ROLE_LABELS[role].toLowerCase()} account` : `Sign in as ${ROLE_LABELS[role].toLowerCase()}`}
                  </button>
                </form>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
