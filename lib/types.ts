import type { ObjectId } from 'mongodb';

export type UserRole = 'user' | 'admin';

export type User = {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
};

export type Session = {
  _id?: ObjectId;
  userId: ObjectId;
  refreshToken?: string;
  refreshTokenHash?: string;
  createdAt: Date;
  expiresAt: Date;
};

export type MarkdownDoc = {
  _id?: ObjectId;
  userId: ObjectId;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UploadedImage = {
  _id?: ObjectId;
  userId: ObjectId;
  filename: string;
  contentType: string;
  size: number;
  bytes: Buffer;
  createdAt: Date;
};

export type JwtPayload = {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
  exp: number;
};

export type Bucket = { count: number; resetAt: number };
export type AppTheme = 'light' | 'dark';

export type MeUser = {
  id: string;
  email: string;
  role: UserRole;
};

export type SettingsUser = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

export type SettingsDocItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthFormMode = 'login' | 'signup';

export type AuthFormProps = {
  mode: AuthFormMode;
};

export type ElementType =
  | 'heading'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'boldHeading'
  | 'text'
  | 'line'
  | 'table'
  | 'code'
  | 'definition'
  | 'task'
  | 'image'
  | 'olist'
  | 'ulist';

export type TableData = {
  headers: string[];
  rows: string[][];
};

export type CanvasItem = {
  id: string;
  type: ElementType;
  row: number;
  content?: string;
  table?: TableData;
  code?: {
    language: string;
    customLanguage: string;
    useCustomLanguage: boolean;
    content: string;
  };
  definition?: {
    term: string;
    description: string;
  };
  task?: {
    checked: boolean;
    label: string;
  };
  image?: {
    source: 'url' | 'upload';
    url: string;
    alt: string;
  };
  list?: {
    items: string[];
  };
};

export type WorkspaceDocListItem = {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
};

export type AdminUserRow = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  isOnline: boolean;
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminSortBy = 'createdAt' | 'email' | 'role';
export type SortDir = 'asc' | 'desc';
