'use client';

import { useEffect, useState } from 'react';
import { applyTheme, readStoredTheme, saveTheme, type AppTheme } from '@/lib/theme';
import type { SettingsDocItem, SettingsUser } from '@/lib/types';

function getCookieValue(name: string) {
  const token = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
  return token ? decodeURIComponent(token) : null;
}

export default function SettingsClient() {
  const [user, setUser] = useState<SettingsUser | null>(null);
  const [docs, setDocs] = useState<SettingsDocItem[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [renameDocId, setRenameDocId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [theme, setTheme] = useState<AppTheme>('light');

  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  async function authFetch(url: string, init?: RequestInit) {
    const method = init?.method?.toUpperCase() ?? 'GET';
    const headers = new Headers(init?.headers);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const csrf = getCookieValue('csrfToken');
      if (csrf) headers.set('x-csrf-token', csrf);
    }

    const response = await fetch(url, { ...init, headers });
    if (response.status === 401) {
      const refresh = await fetch('/api/auth/refresh', { method: 'POST' });
      if (!refresh.ok) {
        window.location.href = '/login?next=/settings';
        throw new Error('Unauthorized');
      }
      return fetch(url, { ...init, headers });
    }
    return response;
  }

  async function loadSettings() {
    const [userRes, docsRes] = await Promise.all([
      authFetch('/api/user/settings'),
      authFetch('/api/user/settings/docs')
    ]);

    if (userRes.ok) {
      const userJson = await userRes.json();
      setUser(userJson.user);
      setEmail(userJson.user.email);
    }

    if (docsRes.ok) {
      const docsJson = await docsRes.json();
      setDocs(docsJson.docs);
    }
  }

  useEffect(() => {
    const storedTheme = readStoredTheme();
    setTheme(storedTheme);
    applyTheme(storedTheme);
    loadSettings().catch(() => setError('Failed to load settings.'));
  }, []);

  function onThemeChange(nextTheme: AppTheme) {
    setTheme(nextTheme);
    saveTheme(nextTheme);
    setMessage(`Theme updated to ${nextTheme}.`);
  }

  async function updateProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setMessage('');

    const payload: Record<string, string> = { currentPassword };
    if (email.trim()) payload.email = email.trim();
    if (newPassword.trim()) payload.newPassword = newPassword;

    const res = await authFetch('/api/user/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? 'Failed to update account settings.');
      return;
    }

    setMessage(json.message ?? 'Settings updated.');
    setCurrentPassword('');
    setNewPassword('');
    await loadSettings();
  }

  async function renameDoc(id: string, title: string) {
    if (!title.trim()) return;
    const res = await authFetch(`/api/user/settings/docs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim() })
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? 'Failed to rename markdown file.');
      return;
    }

    await loadSettings();
  }

  async function deleteDoc(id: string) {
    const res = await authFetch(`/api/user/settings/docs/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? 'Failed to delete markdown file.');
      return;
    }

    await loadSettings();
  }

  return (
    <main className="container py-5">
      <div className="row g-3">
        <section className="col-12 col-lg-5">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h1 className="h4 mb-3">User Settings</h1>
              <p className="text-muted small">Update your account email/password and app theme.</p>

              {error ? <div className="alert alert-danger py-2">{error}</div> : null}
              {message ? <div className="alert alert-success py-2">{message}</div> : null}

              <div className="mb-3">
                <label className="form-label mb-1">Theme</label>
                <select
                  className="form-select"
                  value={theme}
                  onChange={(e) => onThemeChange(e.target.value as AppTheme)}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <form onSubmit={updateProfile} className="d-grid gap-2">
                <label className="form-label mb-0">Email</label>
                <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

                <label className="form-label mb-0 mt-2">Current Password</label>
                <input
                  className="form-control"
                  type="password"
                  minLength={8}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />

                <label className="form-label mb-0 mt-2">New Password (optional)</label>
                <input
                  className="form-control"
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                />

                <button className="btn btn-primary mt-3">Update Account</button>
              </form>

              {user ? (
                <p className="text-muted small mt-3 mb-0">
                  Account created: {new Date(user.createdAt).toLocaleString()} | Role: {user.role}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="col-12 col-lg-7">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5 mb-3">Current Markdown Files</h2>
              <div className="docs-list">
                {docs.map((doc) => (
                  <div key={doc.id} className="doc-row">
                    <div className="flex-grow-1">
                      <div className="fw-semibold">{doc.title}</div>
                      <div className="text-muted small">Updated: {new Date(doc.updatedAt).toLocaleString()}</div>
                    </div>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => {
                        setRenameDocId(doc.id);
                        setRenameTitle(doc.title);
                      }}
                    >
                      Rename
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => deleteDoc(doc.id)}>
                      Delete
                    </button>
                  </div>
                ))}
                {docs.length === 0 ? <p className="small text-muted mb-0">No markdown files yet.</p> : null}
              </div>

              {renameDocId ? (
                <form
                  className="mt-3 d-flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    renameDoc(renameDocId, renameTitle).then(() => {
                      setRenameDocId(null);
                      setRenameTitle('');
                    });
                  }}
                >
                  <input
                    className="form-control"
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    placeholder="New markdown title"
                    required
                  />
                  <button className="btn btn-primary" type="submit">
                    Save
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() => {
                      setRenameDocId(null);
                      setRenameTitle('');
                    }}
                  >
                    Cancel
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
