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

export default function AppNavbar() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const me = await fetch('/api/auth/me');
      if (me.ok) {
        const json = await me.json();
        setUser(json.user);
      }
    }

    loadUser().catch(() => undefined);
  }, []);

  async function logout() {
    const headers = new Headers();
    const csrfToken = getCookieValue('csrfToken');
    if (csrfToken) headers.set('x-csrf-token', csrfToken);

    await fetch('/api/auth/logout', { method: 'POST', headers });
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userEmail');
    window.location.href = '/login';
  }

  return (
    <header className="app-navbar border-bottom">
      <div className="container d-flex justify-content-between align-items-center py-2">
        <div className="d-flex align-items-center gap-3">
          <Link href="/" className="navbar-brand mb-0 fw-semibold">
            Doc-u-maker
          </Link>
        </div>

        <div className="d-flex align-items-center gap-2 position-relative">
          {!user ? (
            <>
              <Link href="/login" className="btn btn-sm btn-primary">
                Login
              </Link>
              <Link href="/signup" className="btn btn-sm btn-outline-primary">
                Sign up
              </Link>
            </>
          ) : (
            <>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setOpen((prev) => !prev)}
                aria-expanded={open}
              >
                {user.email}
              </button>
              {open ? (
                <div className="app-nav-dropdown card shadow-sm position-absolute end-0 top-100 mt-2 p-2">
                  <Link href="/users" className="btn btn-sm btn-outline-primary" onClick={() => setOpen(false)}>
                    Workspace
                  </Link>
                  {user.role === 'admin' ? (
                    <Link href="/admin" className="btn btn-sm btn-outline-dark mt-2" onClick={() => setOpen(false)}>
                      Admin
                    </Link>
                  ) : null}
                  <Link href="/settings" className="btn btn-sm btn-outline-primary mt-2" onClick={() => setOpen(false)}>
                    User Settings
                  </Link>
                  <button className="btn btn-sm btn-outline-danger mt-2" onClick={logout}>
                    Logout
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
