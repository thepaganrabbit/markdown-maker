/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

vi.mock('@/lib/theme', () => ({
  applyTheme: vi.fn(),
  readStoredTheme: vi.fn(() => 'light'),
  saveTheme: vi.fn()
}));

import SettingsClient from '@/app/components/settings/SettingsClient';

describe('SettingsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
      const u = String(url);
      if (u.endsWith('/api/user/settings')) {
        return { ok: true, status: 200, json: async () => ({ user: { id: '1', email: 'u@example.com', role: 'user', createdAt: new Date().toISOString() } }) } as any;
      }
      if (u.endsWith('/api/user/settings/docs')) {
        return { ok: true, status: 200, json: async () => ({ docs: [] }) } as any;
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, message: 'Settings updated.' }) } as any;
    }) as any);
  });

  it('loads settings data', async () => {
    render(React.createElement(SettingsClient));
    await waitFor(() => expect(screen.getByText('User Settings')).toBeInTheDocument());
  });

  it('updates theme and profile form submits', async () => {
    const { container } = render(React.createElement(SettingsClient));
    await waitFor(() => expect(screen.getByText('User Settings')).toBeInTheDocument());
    const select = container.querySelector('select.form-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'dark' } });
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: 'password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Account' }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it('supports markdown file rename flow', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
      const u = String(url);
      if (u.endsWith('/api/user/settings')) {
        return { ok: true, status: 200, json: async () => ({ user: { id: '1', email: 'u@example.com', role: 'user', createdAt: new Date().toISOString() } }) } as any;
      }
      if (u.endsWith('/api/user/settings/docs')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ docs: [{ id: 'd1', title: 'Old title', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] })
        } as any;
      }
      if (u.includes('/api/user/settings/docs/d1')) return { ok: true, status: 200, json: async () => ({ ok: true }) } as any;
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as any;
    }) as any);

    render(React.createElement(SettingsClient));
    await waitFor(() => expect(screen.getByText('Old title')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByPlaceholderText('New markdown title'), { target: { value: 'New title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/user/settings/docs/d1', expect.objectContaining({ method: 'PATCH' })));
  });
});
