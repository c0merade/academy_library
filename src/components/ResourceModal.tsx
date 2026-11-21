import { useEffect, useState } from 'react';
import { X, Sparkles, ShieldCheck, Loader2 } from 'lucide-react';
import type { Resource, ResourceLevel, ResourceType, SourceType } from '../types.ts';
import { api } from '../api.ts';
import { translations, type Lang } from '../i18n.ts';

interface ResourceModalProps {
  userId: number;
  lang: Lang;
  initial?: Resource | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ResourceModal({ userId, lang, initial, onClose, onSaved }: ResourceModalProps) {
  const t = translations[lang];
  const [url, setUrl] = useState(initial?.url ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [author, setAuthor] = useState(initial?.author ?? '');
  const [course, setCourse] = useState(initial?.course ?? 'Web Development');
  const [topic, setTopic] = useState(initial?.topic ?? 'Async JavaScript');
  const [level, setLevel] = useState<ResourceLevel>(initial?.level ?? 'Beginner');
  const [resourceType, setResourceType] = useState<ResourceType>(
    initial?.resource_type ?? 'article'
  );
  const [sourceType, setSourceType] = useState<SourceType>(initial?.source_type ?? 'open-access');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');
  const [durationOrPages, setDurationOrPages] = useState(initial?.duration_or_pages ?? '');
  const [previewImage, setPreviewImage] = useState<string | null>(initial?.preview_image ?? null);

  const [isPhysical, setIsPhysical] = useState(initial?.is_physical ?? false);
  const [depotShelf, setDepotShelf] = useState(initial?.depot_shelf ?? 'Shelf A-1');
  const [totalCopies, setTotalCopies] = useState(initial?.total_copies || 1);

  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock background page scroll while modal is open & close on Escape
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  async function handleFetchPreview() {
    if (!url.trim()) {
      setError(t.modal.enterUrlFirst);
      return;
    }
    setError(null);
    setFetchingPreview(true);
    try {
      const preview = await api.fetchLinkPreview(userId, url.trim());
      if (!title) setTitle(preview.title);
      if (!description) setDescription(preview.description);
      if (preview.image) setPreviewImage(preview.image);
      setSourceType(preview.source_hint);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch link preview.');
    } finally {
      setFetchingPreview(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload = {
      title,
      description,
      url,
      author,
      course,
      topic,
      level,
      resource_type: resourceType,
      source_type: sourceType,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      duration_or_pages: durationOrPages || null,
      preview_image: previewImage,
      is_physical: isPhysical,
      depot_shelf: isPhysical ? depotShelf : null,
      total_copies: isPhysical ? Number(totalCopies) : 0,
    };

    try {
      if (initial) {
        await api.updateResource(userId, initial.id, payload);
      } else {
        await api.createResource(userId, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save resource.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden overscroll-none bg-black/70 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto overscroll-contain rounded-3xl bg-white dark:bg-[#14141D] text-slate-900 dark:text-[#F3F4F6] shadow-2xl border border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 px-6 py-4">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {initial ? t.modal.editTitle : t.modal.addTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-600 dark:hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="flex items-start gap-2 rounded-2xl bg-[#64FCE5]/20 border border-[#64FCE5]/50 px-3.5 py-2.5 text-xs font-medium text-[#0B0B10] dark:text-[#64FCE5]">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{t.modal.legalNotice}</span>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-3.5 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* URL + Live Link Preview */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-1">
              {t.modal.urlLabel}
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                required
                placeholder="https://developer.mozilla.org/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/[0.05] px-3 py-2 text-sm focus:border-[#64FCE5] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleFetchPreview}
                disabled={fetchingPreview}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#64FCE5] px-3.5 py-2 text-xs font-bold text-[#0B0B10] hover:brightness-95 disabled:opacity-50 cursor-pointer"
              >
                {fetchingPreview ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {t.modal.fetchPreview}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-1">
                {t.modal.titleLabel}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.modal.titlePlaceholder}
                className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/[0.05] px-3 py-2 text-sm focus:border-[#64FCE5] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-1">
                {t.modal.descLabel}
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.modal.descPlaceholder}
                className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/[0.05] px-3 py-2 text-sm focus:border-[#64FCE5] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-1">
                {t.modal.courseLabel}
              </label>
              <input
                type="text"
                required
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/[0.05] px-3 py-2 text-sm focus:border-[#64FCE5] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-1">
                {t.modal.topicLabel}
              </label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/[0.05] px-3 py-2 text-sm focus:border-[#64FCE5] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-1">
                {t.modal.typeLabel}
              </label>
              <select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value as ResourceType)}
                className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#1A1A24] px-3 py-2 text-sm"
              >
                <option value="article">{t.types.article}</option>
                <option value="book">{t.types.book}</option>
                <option value="video">{t.types.video}</option>
                <option value="recording">{t.types.recording}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-1">
                {t.modal.levelLabel}
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as ResourceLevel)}
                className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#1A1A24] px-3 py-2 text-sm"
              >
                <option value="Beginner">{t.levels.Beginner}</option>
                <option value="Intermediate">{t.levels.Intermediate}</option>
                <option value="Advanced">{t.levels.Advanced}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-1">
                {t.modal.sourceLabel}
              </label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as SourceType)}
                className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#1A1A24] px-3 py-2 text-sm"
              >
                <option value="open-access">{t.sources['open-access']}</option>
                <option value="publisher">{t.sources.publisher}</option>
                <option value="licensed">{t.sources.licensed}</option>
                <option value="reel">{t.sources.reel}</option>
                <option value="depot">{t.sources.depot}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-1">
                {t.modal.authorLabel}
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/[0.05] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-1">
                {t.modal.tagsLabel}
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="javascript, promises, async"
                className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/[0.05] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-1">
                {t.modal.lengthLabel}
              </label>
              <input
                type="text"
                value={durationOrPages}
                onChange={(e) => setDurationOrPages(e.target.value)}
                placeholder={t.modal.lengthPlaceholder}
                className="w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/[0.05] px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Physical Book Depot Option */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] p-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white cursor-pointer">
              <input
                type="checkbox"
                checked={isPhysical}
                onChange={(e) => setIsPhysical(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-[#D900D6]"
              />
              {t.modal.physicalToggle}
            </label>

            {isPhysical && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {t.modal.shelfLabel}
                  </label>
                  <input
                    type="text"
                    value={depotShelf}
                    onChange={(e) => setDepotShelf(e.target.value)}
                    placeholder="Shelf B-2"
                    className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/[0.05] px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {t.modal.copiesLabel}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={totalCopies}
                    onChange={(e) => setTotalCopies(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/[0.05] px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-300 dark:border-white/15 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 cursor-pointer"
            >
              {t.modal.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[#D900D6] px-5 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? t.modal.saving : initial ? t.modal.saveChanges : t.modal.addBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
