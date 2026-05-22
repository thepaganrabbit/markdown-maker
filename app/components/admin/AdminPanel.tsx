'use client';

import { useEffect, useState } from 'react';

type UserRow = {
  id: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
  isOnline: boolean;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
type SortBy = 'createdAt' | 'email' | 'role';
type SortDir = 'asc' | 'desc';

function getCookieValue(name: string) {
  const token = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
  return token ? decodeURIComponent(token) : null;
}

export default function AdminPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<'user' | 'admin'>('user');
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  async function adminFetch(url: string, init?: RequestInit) {
    const method = init?.method?.toUpperCase() ?? 'GET';
    const headers = new Headers(init?.headers);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const csrfToken = getCookieValue('csrfToken');
      if (csrfToken) headers.set('x-csrf-token', csrfToken);
    }

    const response = await fetch(url, { ...init, headers });
    if (response.status === 401) {
      const refresh = await fetch('/api/auth/refresh', { method: 'POST' });
      if (refresh.ok) {
        return fetch(url, { ...init, headers });
      }
      window.location.href = '/login?next=/admin';
    }
    return response;
  }

  async function loadUsers(nextPage = page) {
    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (roleFilter !== 'all') params.set('role', roleFilter);
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    params.set('page', String(nextPage));
    params.set('pageSize', String(pageSize));

    const response = await adminFetch(`/api/admin/users?${params.toString()}`);
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? 'Failed to load users');
      setLoading(false);
      return;
    }

    const json = await response.json();
    setUsers(json.users);
    setPagination(json.pagination);
    setPage(json.pagination.page);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers(1).catch(() => {
      setError('Failed to load users');
      setLoading(false);
    });
  }, [query, roleFilter, pageSize, sortBy, sortDir]);

  function toggleSort(field: SortBy) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(field);
    setSortDir(field === 'createdAt' ? 'desc' : 'asc');
  }

  async function createUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const response = await adminFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: createEmail, password: createPassword, role: createRole })
    });

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? 'Failed to create user');
      return;
    }

    setCreateEmail('');
    setCreatePassword('');
    setCreateRole('user');
    await loadUsers(1);
  }

  async function updateUser(id: string, data: Partial<Pick<UserRow, 'email' | 'role'>> & { password?: string }) {
    const response = await adminFetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? 'Failed to update user');
      return;
    }

    await loadUsers(page);
  }

  async function deleteUser(id: string) {
    const response = await adminFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? 'Failed to delete user');
      return;
    }

    await loadUsers(page);
  }

  async function forceLogoutUser(id: string) {
    const response = await adminFetch(`/api/admin/users/${id}/force-logout`, { method: 'POST' });
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error ?? 'Failed to invalidate user sessions');
      return;
    }

    const json = await response.json();
    alert(`Invalidated ${json.deletedSessions} active sessions.`);
  }

  async function submitPasswordReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resetUser) return;
    if (resetPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setError('');
    await updateUser(resetUser.id, { password: resetPassword });
    setResetPassword('');
    setResetUser(null);
  }

  return (
    <main className="container py-5">
      <div className="bg-white border rounded-4 shadow-sm p-4 p-md-5">
        <h1 className="h3 mb-3">Admin Panel</h1>
        <p className="text-muted">Create, update, delete, search, filter, paginate, and force-logout user accounts.</p>

        {error ? <div className="alert alert-danger">{error}</div> : null}

        <form onSubmit={createUser} className="row g-2 align-items-end mb-4">
          <div className="col-md-4">
            <label className="form-label">Email</label>
            <input className="form-control" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} required />
          </div>
          <div className="col-md-3">
            <label className="form-label">Password</label>
            <input className="form-control" type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} required minLength={8} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Role</label>
            <select className="form-select" value={createRole} onChange={(e) => setCreateRole(e.target.value as 'user' | 'admin')}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="col-md-3">
            <button className="btn btn-primary w-100">Create User</button>
          </div>
        </form>

        <div className="row g-2 align-items-end mb-3">
          <div className="col-md-5">
            <label className="form-label">Search Email</label>
            <input
              className="form-control"
              placeholder="Search by email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Role Filter</label>
            <select
              className="form-select"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value as 'all' | 'user' | 'admin');
                setPage(1);
              }}
            >
              <option value="all">all</option>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">Page Size</label>
            <select
              className="form-select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">Sort</label>
            <select
              className="form-select"
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => {
                const [nextSortBy, nextSortDir] = e.target.value.split(':') as [SortBy, SortDir];
                setSortBy(nextSortBy);
                setSortDir(nextSortDir);
                setPage(1);
              }}
            >
              <option value="createdAt:desc">Newest</option>
              <option value="createdAt:asc">Oldest</option>
              <option value="email:asc">Email A-Z</option>
              <option value="email:desc">Email Z-A</option>
              <option value="role:asc">Role A-Z</option>
              <option value="role:desc">Role Z-A</option>
            </select>
          </div>
          <div className="col-md-2 d-grid">
            <button
              className="btn btn-outline-primary"
              onClick={(e) => {
                e.preventDefault();
                setQuery(searchInput.trim());
                setPage(1);
              }}
            >
              Apply
            </button>
          </div>
        </div>

        {loading ? (
          <p>Loading users...</p>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                <tr>
                  <th>Status</th>
                  <th>
                      <button className="btn btn-link p-0 text-decoration-none" onClick={() => toggleSort('email')}>
                        Email {sortBy === 'email' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th>
                      <button className="btn btn-link p-0 text-decoration-none" onClick={() => toggleSort('role')}>
                        Role {sortBy === 'role' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th>
                      <button className="btn btn-link p-0 text-decoration-none" onClick={() => toggleSort('createdAt')}>
                        Created {sortBy === 'createdAt' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th>Password Reset</th>
                    <th>Session Control</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <span
                          className="d-inline-block rounded-circle"
                          style={{
                            width: '10px',
                            height: '10px',
                            backgroundColor: user.isOnline ? '#16a34a' : '#dc2626'
                          }}
                          title={user.isOnline ? 'Online' : 'Offline'}
                        />
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={user.role}
                          onChange={(e) => updateUser(user.id, { role: e.target.value as 'user' | 'admin' })}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td>{new Date(user.createdAt).toLocaleString()}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => {
                            setResetUser(user);
                            setResetPassword('');
                          }}
                        >
                          Set Password
                        </button>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-outline-warning" onClick={() => forceLogoutUser(user.id)}>
                          Force Logout
                        </button>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => deleteUser(user.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="text-muted">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} users)
              </span>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-outline-secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => loadUsers(pagination.page - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => loadUsers(pagination.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}

        {resetUser ? (
          <div className="mt-4 border rounded-3 p-3 bg-light">
            <h2 className="h6 mb-3">Reset Password</h2>
            <p className="text-muted mb-3">
              Set a new password for <strong>{resetUser.email}</strong>.
            </p>
            <form onSubmit={submitPasswordReset} className="row g-2 align-items-end">
              <div className="col-md-6">
                <label className="form-label">New Password</label>
                <input
                  className="form-control"
                  type="password"
                  minLength={8}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                />
              </div>
              <div className="col-md-3 d-grid">
                <button className="btn btn-primary" type="submit">
                  Update Password
                </button>
              </div>
              <div className="col-md-3 d-grid">
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => {
                    setResetUser(null);
                    setResetPassword('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </main>
  );
}
