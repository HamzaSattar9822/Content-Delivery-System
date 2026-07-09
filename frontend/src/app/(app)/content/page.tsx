'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Category, Content, DriveFile, Paginated } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Table,
  Textarea,
} from '@/components/ui';
import { formatBytes, formatDate } from '@/lib/format';

export default function ContentLibraryPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('content:manage');

  const [items, setItems] = useState<Content[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [fileType, setFileType] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Paginated<Content>>('/content', {
        search,
        status,
        fileType,
        sortBy,
        pageSize: 50,
      });
      setItems(data.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [search, status, fileType, sortBy]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api.get<Category[]>('/content/categories').then(setCategories).catch(() => undefined);
  }, []);

  const archive = async (id: string, currentStatus: string) => {
    const action = currentStatus === 'ARCHIVED' ? 'restore' : 'archive';
    await api.post(`/content/${id}/${action}`);
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm('Permanently delete this content and all its links?')) return;
    await api.delete(`/content/${id}`);
    void load();
  };

  return (
    <div>
      <PageHeader
        title="Content Library"
        description="Manage content sourced from Google Drive."
        action={canManage && <Button onClick={() => setShowCreate(true)}>Add Content</Button>}
      />

      {error && <Banner tone="error">{error}</Banner>}

      <Card className="p-3 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input placeholder="Search title or description" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
          <Select value={fileType} onChange={(e) => setFileType(e.target.value)}>
            <option value="">All types</option>
            {['VIDEO', 'PDF', 'DOCX', 'PPTX', 'IMAGE', 'AUDIO', 'ZIP', 'OTHER'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="createdAt">Newest</option>
            <option value="title">Title</option>
            <option value="fileSize">Size</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState message="No content found. Add content from Google Drive to get started." />
      ) : (
        <Table headers={['Title', 'Type', 'Category', 'Size', 'Links', 'Views', 'Status', 'Created', '']}>
          {items.map((c) => (
            <tr key={c.id} className="border-b border-line last:border-0">
              <td className="px-4 py-2 text-ink max-w-[200px] truncate">{c.title}</td>
              <td className="px-4 py-2 text-muted">{c.fileType}</td>
              <td className="px-4 py-2 text-muted">{c.category?.name ?? '-'}</td>
              <td className="px-4 py-2 text-muted">{formatBytes(c.fileSize)}</td>
              <td className="px-4 py-2 text-muted">{c._count?.links ?? 0}</td>
              <td className="px-4 py-2 text-muted">{c._count?.viewLogs ?? 0}</td>
              <td className="px-4 py-2">
                <Badge tone={c.status === 'ACTIVE' ? 'default' : 'muted'}>{c.status}</Badge>
              </td>
              <td className="px-4 py-2 text-muted whitespace-nowrap">{formatDate(c.createdAt)}</td>
              <td className="px-4 py-2 whitespace-nowrap text-right">
                {hasPermission('link:manage') && (
                  <Link href={`/links/create?contentId=${c.id}`} className="text-sm text-ink hover:underline mr-3">
                    Link
                  </Link>
                )}
                {canManage && (
                  <>
                    <button onClick={() => archive(c.id, c.status)} className="text-sm text-ink hover:underline mr-3">
                      {c.status === 'ARCHIVED' ? 'Restore' : 'Archive'}
                    </button>
                    <button onClick={() => remove(c.id)} className="text-sm text-ink hover:underline">
                      Delete
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {showCreate && (
        <CreateContentModal
          categories={categories}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function CreateContentModal({
  categories,
  onClose,
  onCreated,
}: {
  categories: Category[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [driveConfigured, setDriveConfigured] = useState<boolean | null>(null);
  const [folderStack, setFolderStack] = useState<string[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  const [googleDriveFileId, setGoogleDriveFileId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentFolder = folderStack[folderStack.length - 1];

  const browse = useCallback(async (folderId?: string) => {
    setDriveLoading(true);
    setDriveError(null);
    try {
      const data = await api.get<{ files: DriveFile[] }>('/drive/files', { folderId });
      setFiles(data.files);
    } catch (err) {
      setDriveError(err instanceof ApiError ? err.message : 'Failed to browse Drive');
    } finally {
      setDriveLoading(false);
    }
  }, []);

  useEffect(() => {
    api
      .get<{ configured: boolean }>('/drive/status')
      .then((d) => {
        setDriveConfigured(d.configured);
        if (d.configured) void browse();
      })
      .catch(() => setDriveConfigured(false));
  }, [browse]);

  const openFolder = (id: string) => {
    setFolderStack((s) => [...s, id]);
    void browse(id);
  };

  const goBack = () => {
    const next = folderStack.slice(0, -1);
    setFolderStack(next);
    void browse(next[next.length - 1]);
  };

  const selectFile = (file: DriveFile) => {
    setGoogleDriveFileId(file.id);
    if (!title) setTitle(file.name);
  };

  const submit = async () => {
    setError(null);
    if (!title || !googleDriveFileId) {
      setError('A title and a Google Drive file are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/content', {
        title,
        description: description || undefined,
        categoryId: categoryId || undefined,
        googleDriveFileId,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        syncFromDrive: driveConfigured ?? false,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create content');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add Content">
      {error && <Banner tone="error">{error}</Banner>}

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-ink">Google Drive</span>
            {folderStack.length > 0 && (
              <button className="text-xs text-ink hover:underline" onClick={goBack}>
                Back
              </button>
            )}
          </div>
          {driveConfigured === false ? (
            <Banner>
              Google Drive is not configured on the server. You can still add content by entering a Drive file ID
              manually below.
            </Banner>
          ) : (
            <div className="border border-line rounded max-h-48 overflow-y-auto">
              {driveError && <div className="p-2 text-xs text-ink">{driveError}</div>}
              {driveLoading ? (
                <div className="p-3 text-xs text-muted">Loading Drive...</div>
              ) : files.length === 0 ? (
                <div className="p-3 text-xs text-muted">This folder is empty.</div>
              ) : (
                <ul className="divide-y divide-line">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <button
                        className="text-left text-ink hover:underline truncate"
                        onClick={() => (f.isFolder ? openFolder(f.id) : selectFile(f))}
                      >
                        {f.isFolder ? `[Folder] ${f.name}` : f.name}
                      </button>
                      {!f.isFolder && googleDriveFileId === f.id && <span className="text-xs text-muted ml-2">Selected</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <Field label="Google Drive File ID" hint="Auto-filled when you select a file above.">
          <Input value={googleDriveFileId} onChange={(e) => setGoogleDriveFileId(e.target.value)} placeholder="Drive file id" />
        </Field>
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Content title" />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tags" hint="Comma separated">
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="onboarding, hr" />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Saving...' : 'Add Content'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
