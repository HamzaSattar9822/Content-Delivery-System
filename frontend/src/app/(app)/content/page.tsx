'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { ensureContentFromDrive } from '@/lib/content-from-drive';
import { Category, Content, DriveFile, Paginated } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { DriveBrowser } from '@/components/DriveBrowser';
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

type LibraryTab = 'library' | 'drive';

export default function ContentLibraryPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('content:manage');
  const canLink = hasPermission('link:manage');
  const canBrowseDrive = hasPermission('drive:browse');

  const [tab, setTab] = useState<LibraryTab>('library');
  const [items, setItems] = useState<Content[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [fileType, setFileType] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [showCreate, setShowCreate] = useState(false);
  const [busyDriveId, setBusyDriveId] = useState<string | null>(null);
  const [driveActionError, setDriveActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Paginated<Content>>('/content', {
        search,
        status,
        fileType,
        sortBy,
        pageSize: 100,
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

  const registeredByDriveId = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.googleDriveFileId) map.set(item.googleDriveFileId, item.id);
    }
    return map;
  }, [items]);

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

  const addFromDrive = async (file: DriveFile) => {
    setDriveActionError(null);
    setBusyDriveId(file.id);
    try {
      await ensureContentFromDrive(file);
      await load();
    } catch (err) {
      setDriveActionError(err instanceof ApiError ? err.message : 'Failed to add content from Drive');
    } finally {
      setBusyDriveId(null);
    }
  };

  const linkFromDrive = async (file: DriveFile) => {
    setDriveActionError(null);
    setBusyDriveId(file.id);
    try {
      const content = await ensureContentFromDrive(file);
      router.push(`/links/create?contentId=${content.id}`);
    } catch (err) {
      setDriveActionError(err instanceof ApiError ? err.message : 'Failed to prepare link from Drive');
      setBusyDriveId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Content Library"
        description="Browse Google Drive and manage content registered for delivery."
        action={canManage && <Button onClick={() => setShowCreate(true)}>Add Content</Button>}
      />

      {error && <Banner tone="error">{error}</Banner>}
      {driveActionError && <Banner tone="error">{driveActionError}</Banner>}

      <div className="flex gap-2 mb-4 border-b border-line">
        <TabButton active={tab === 'library'} onClick={() => setTab('library')}>
          Registered library
        </TabButton>
        {canBrowseDrive && (
          <TabButton active={tab === 'drive'} onClick={() => setTab('drive')}>
            Google Drive
          </TabButton>
        )}
      </div>

      {tab === 'drive' && canBrowseDrive ? (
        <Card className="p-4">
          <p className="text-sm text-muted mb-3">
            Preview everything in Drive. Add a file to the library, or create a delivery link directly — the file is
            registered automatically if needed.
          </p>
          <DriveBrowser
            registeredByDriveId={registeredByDriveId}
            onSelect={(file) => {
              if (canManage) void addFromDrive(file);
            }}
            maxHeightClassName="max-h-[28rem]"
            renderFileActions={(file, registeredContentId) => (
              <div className="flex items-center gap-2 shrink-0">
                {canManage && !registeredContentId && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="!py-1 !px-2 text-xs"
                    disabled={busyDriveId === file.id}
                    onClick={() => void addFromDrive(file)}
                  >
                    {busyDriveId === file.id ? 'Adding…' : 'Add'}
                  </Button>
                )}
                {canLink && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="!py-1 !px-2 text-xs"
                    disabled={busyDriveId === file.id}
                    onClick={() => void linkFromDrive(file)}
                  >
                    {busyDriveId === file.id ? '…' : 'Link'}
                  </Button>
                )}
                {registeredContentId && canLink && (
                  <Link
                    href={`/links/create?contentId=${registeredContentId}`}
                    className="text-xs text-ink hover:underline"
                  >
                    Open
                  </Link>
                )}
              </div>
            )}
          />
        </Card>
      ) : (
        <>
          <Card className="p-3 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input
                placeholder="Search title or description"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
            <EmptyState message="No content registered yet. Browse Google Drive and add files, or use Add Content." />
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
                    {canLink && (
                      <Link
                        href={`/links/create?contentId=${c.id}`}
                        className="text-sm text-ink hover:underline mr-3"
                      >
                        Link
                      </Link>
                    )}
                    {canManage && (
                      <>
                        <button
                          onClick={() => archive(c.id, c.status)}
                          className="text-sm text-ink hover:underline mr-3"
                        >
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
        </>
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-sm border-b-2 -mb-px ${
        active ? 'border-ink text-ink font-medium' : 'border-transparent text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  const [googleDriveFileId, setGoogleDriveFileId] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        tags: tags
          ? tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
        syncFromDrive: true,
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
        <DriveBrowser
          selectedId={googleDriveFileId}
          onSelect={(file) => {
            setGoogleDriveFileId(file.id);
            setSelectedName(file.name);
            if (!title) setTitle(file.name);
          }}
          maxHeightClassName="max-h-48"
        />

        <Field label="Google Drive File ID" hint={selectedName ? `Selected: ${selectedName}` : 'Auto-filled when you select a file above.'}>
          <Input
            value={googleDriveFileId}
            onChange={(e) => setGoogleDriveFileId(e.target.value)}
            placeholder="Drive file id"
          />
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
