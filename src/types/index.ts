export interface Story {
  id: string;
  title: string;
  url: string;
  description: string;
  tags: string[];
  author: string;
  createdAt: Date;
  votes: number;
  commentCount: number;
  customMessage?: string;
  screenshot?: string;
  rating?: number;
  ratingCount?: number;
}

export interface Comment {
  id: string;
  content: string;
  author: string;
  createdAt: Date;
  storyId: string;
  parentId?: string;
  votes: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  karma: number;
  createdAt: Date;
}

export interface Tag {
  name: string;
  showInHeader: boolean;
}

export type FormFieldType = 'shortText' | 'longText' | 'url' | 'email' | 'yesNo' | 'dropdown' | 'multiSelect';

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface CustomForm {
  id: string;
  title: string;
  slug: string;
  fields: FormField[];
  isPublic: boolean;
  createdAt: Date;
}

export interface FormSubmission {
  id: string;
  formId: string;
  data: Record<string, any>;
  createdAt: Date;
}