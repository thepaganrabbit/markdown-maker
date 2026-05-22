import { ObjectId } from 'mongodb';

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
