'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MeUser } from '@/lib/types';

function getCookieValue(name: string) {
  const token = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
  return token ? decodeURIComponent(token) : null;
}

export default function HomeClient() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadUser() {
      const meResponse = await fetch('/api/auth/me');

      if (meResponse.ok) {
        const meJson = await meResponse.json();
        setUser(meJson.user);
        return;
      }

      const refreshResponse = await fetch('/api/auth/refresh', { method: 'POST' });
      if (!refreshResponse.ok) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userEmail');
        return;
      }

      const refreshJson = await refreshResponse.json();
      localStorage.setItem('accessToken', refreshJson.accessToken);
      setUser(refreshJson.user);
    }

    loadUser().catch(() => setError('Failed to load user session'));
  }, []);

  async function logout() {
    const headers = new Headers();
    const csrfToken = getCookieValue('csrfToken');
    if (csrfToken) headers.set('x-csrf-token', csrfToken);
    await fetch('/api/auth/logout', { method: 'POST', headers });
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userEmail');
    setUser(null);
  }

  return (
    <main className="container py-5">
      <div className="p-4 p-md-5 bg-white rounded-4 shadow-sm border">
        <h1 className="display-6 mb-3">Doc-u-maker</h1>
        <p className="text-muted mb-4">Protected canvas builder that exports and stores markdown files.</p>

        {error ? <div className="alert alert-warning">{error}</div> : null}

        {user ? (
          <>
            <p className="mb-3">
              Logged in as <strong>{user.email}</strong>
            </p>
            <div className="d-flex gap-2">
              <Link className="btn btn-primary" href="/users">
                Open Workspace
              </Link>
              {user.role === 'admin' ? (
                <Link className="btn btn-outline-dark" href="/admin">
                  Admin Panel
                </Link>
              ) : null}
              <button className="btn btn-outline-danger" onClick={logout}>
                Logout
              </button>
            </div>
          </>
        ) : (
          <div className="d-flex gap-2">
            <Link className="btn btn-primary" href="/login">
              Login
            </Link>
            <Link className="btn btn-outline-primary" href="/signup">
              Sign up
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
