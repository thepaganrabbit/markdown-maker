/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

import AdminPanel from '@/app/components/admin/AdminPanel';

describe('AdminPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
      const u = String(url);
      if (u.includes('/api/admin/users?')) {
        return { ok: true, status: 200, json: async () => ({ users: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } }) } as any;
      }
      if (u.includes('/force-logout')) return { ok: true, status: 200, json: async () => ({ deletedSessions: 1 }) } as any;
      return { ok: true, status: 200, json: async () => ({}) } as any;
    }) as any);
  });

  it('loads and renders admin panel', async () => {
    render(React.createElement(AdminPanel));
    await waitFor(() => expect(screen.getByText('Admin Panel')).toBeInTheDocument());
    expect(screen.getByText('Create User')).toBeInTheDocument();
  });

  it('applies search filter', async () => {
    render(React.createElement(AdminPanel));
    fireEvent.change(screen.getByPlaceholderText('Search by email...'), { target: { value: 'u@example.com' } });
    fireEvent.click(screen.getByText('Apply'));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it('triggers force logout action', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
      const u = String(url);
      if (u.includes('/api/admin/users?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            users: [{ id: 'u1', email: 'u@example.com', role: 'user', createdAt: new Date().toISOString(), isOnline: true }],
            pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }
          })
        } as any;
      }
      if (u.includes('/force-logout')) return { ok: true, status: 200, json: async () => ({ deletedSessions: 2 }) } as any;
      return { ok: true, status: 200, json: async () => ({}) } as any;
    }) as any);

    render(React.createElement(AdminPanel));
    await waitFor(() => expect(screen.getByText('u@example.com')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Force Logout' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Invalidated 2 active sessions.'));
  });
});
