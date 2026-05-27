/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/app/components/HomeClient', () => ({ default: () => React.createElement('div', null, 'home-client') }));
vi.mock('@/app/components/AuthForm', () => ({ default: ({ mode }: any) => React.createElement('div', null, `auth-${mode}`) }));
vi.mock('@/app/components/admin/AdminPanel', () => ({ default: () => React.createElement('div', null, 'admin-panel') }));
vi.mock('@/app/components/settings/SettingsClient', () => ({ default: () => React.createElement('div', null, 'settings-client') }));
vi.mock('@/app/components/users/UserWorkspace', () => ({ default: () => React.createElement('div', null, 'user-workspace') }));
vi.mock('@/app/components/nav/AppNavbar', () => ({ default: () => React.createElement('div', null, 'app-navbar') }));

import HomePage from '@/app/page';
import LoginPage from '@/app/login/page';
import SignupPage from '@/app/signup/page';
import AdminPage from '@/app/admin/page';
import SettingsPage from '@/app/settings/page';
import UsersPage from '@/app/users/page';
import RootLayout, { metadata } from '@/app/layout';

describe('pages', () => {
  it('renders all pages', () => {
    const { rerender } = render(React.createElement(HomePage));
    expect(screen.getByText('home-client')).toBeInTheDocument();

    rerender(React.createElement(LoginPage));
    expect(screen.getByText('auth-login')).toBeInTheDocument();

    rerender(React.createElement(SignupPage));
    expect(screen.getByText('auth-signup')).toBeInTheDocument();

    rerender(React.createElement(AdminPage));
    expect(screen.getByText('admin-panel')).toBeInTheDocument();

    rerender(React.createElement(SettingsPage));
    expect(screen.getByText('settings-client')).toBeInTheDocument();

    rerender(React.createElement(UsersPage));
    expect(screen.getByText('user-workspace')).toBeInTheDocument();
  });

  it('renders root layout and exports metadata', () => {
    const childText = 'child-content';
    render(React.createElement(RootLayout, { children: React.createElement('main', null, childText) }));

    expect(screen.getByText('app-navbar')).toBeInTheDocument();
    expect(screen.getByText(childText)).toBeInTheDocument();
    expect(metadata).toEqual({
      title: 'Doc-u-maker',
      description: 'Simple Next.js + MongoDB auth starter'
    });
  });
});
