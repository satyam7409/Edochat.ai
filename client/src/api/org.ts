import { api } from './client';

export type DocumentStatus = 'PROCESSING' | 'READY' | 'FAILED';
export type DocumentCategory = 'FINANCE' | 'SYLLABUS' | 'TEST_PAPER' | 'NOTICE' | 'EVENTS' | 'OTHER';

export interface Org {
  id: string;
  name: string;
  slug: string;
  type: 'SCHOOL' | 'COLLEGE';
  address?: string;
}

export interface Document {
  id: string;
  orgId: string;
  category: DocumentCategory;
  title: string;
  sourceType: 'FILE' | 'TEXT';
  fileUrl?: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Assistant {
  id: string;
  orgId: string;
  status: 'DRAFT' | 'LIVE';
  name: string;
  greetingMessage: string;
  publicSiteKey: string;
}

export async function createOrg(payload: {
  userId: string;
  orgName: string;
  type: 'SCHOOL' | 'COLLEGE';
  address?: string;
}): Promise<{ org: Org; assistant: Assistant }> {
  const res = await api.post('/org', payload);
  return res.data.data;
}

export async function listDocuments(orgId: string, category?: DocumentCategory): Promise<Document[]> {
  const params = category ? { category } : {};
  const res = await api.get(`/org/${orgId}/documents`, { params });
  return res.data.data.documents;
}

export async function getDocument(orgId: string, docId: string): Promise<Document> {
  const res = await api.get(`/org/${orgId}/documents/${docId}`);
  return res.data.data.document;
}

export async function uploadDocument(orgId: string, file: File, category: DocumentCategory): Promise<Document> {
  const formData = new FormData();
  formData.append('pdfFile', file);
  formData.append('category', category);
  const res = await api.post(`/org/${orgId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data.document;
}

export async function deleteDocument(orgId: string, docId: string): Promise<void> {
  await api.delete(`/org/${orgId}/documents/${docId}`);
}

export async function replaceDocument(orgId: string, docId: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('pdfFile', file);
  // Backend route: PATCH /org/orgs/:orgId/documents/:docId
  await api.patch(`/org/orgs/${orgId}/documents/${docId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
