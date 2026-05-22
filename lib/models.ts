import { ObjectId } from 'mongodb';

export type User = {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  createdAt: Date;
};

export type Session = {
  _id?: ObjectId;
  userId: ObjectId;
  refreshToken: string;
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
