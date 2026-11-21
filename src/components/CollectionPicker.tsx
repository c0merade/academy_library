import { useEffect, useRef, useState } from 'react';
import { FolderPlus, FolderKanban, Check, Plus } from 'lucide-react';
import type { Collection } from '../types.ts';
import { translations, type Lang } from '../i18n.ts';

interface CollectionPickerProps {
  collections: Collection[];
  resourceId: number;
  lang: Lang;
  onAdd: (collectionId: number, resourceId: number) => void;
  triggerClassName?: string;
}

export function CollectionPicker({
  collections,
  resourceId,
  lang,
  onAdd,
  triggerClassName,
}: CollectionPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const t = translations[lang];

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('keydown', handleKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (collections.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Add to collection"
        className={
          triggerClassName ||
          'inline-flex items-center gap-1 rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-[#F5F5F7] dark:bg-[#2C2C2E] px-2.5 py-1 text-[11px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] transition hover:border-[#0071E3] hover:text-[#0071E3] dark:hover:border-[#0A84FF] dark:hover:text-[#64D2FF] cursor-pointer'
        }
      >
        <FolderPlus className="h-3 w-3" />
        <span>{t.card.addToList.replace(/^\+\s*/, '')}</span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute bottom-full right-0 mb-2 w-64 origin-bottom-right overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#1C1C1E]/95 p-1.5 text-left shadow-[0_18px_45px_rgba(0,0,0,0.18)] dark:shadow-[0_18px_45px_rgba(0,0,0,0.7)] backdrop-blur-2xl z-50 animate-fade-up"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#86868B] dark:text-[#98989D]">
            {lang === 'hy' ? 'Ավելացնել հավաքածուում' : 'Add to Collection'}
          </div>

          <div className="space-y-0.5 max-h-56 overflow-y-auto">
            {collections.map((col) => {
              const alreadyIn = col.items.some((item) => item.id === resourceId);

              return (
                <button
                  key={col.id}
                  type="button"
                  role="option"
                  aria-selected={alreadyIn}
                  onClick={() => {
                    if (!alreadyIn) onAdd(col.id, resourceId);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition cursor-pointer ${
                    alreadyIn
                      ? 'bg-[#34C759]/10 dark:bg-[#30D158]/15'
                      : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.08]'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      alreadyIn
                        ? 'bg-[#34C759] text-white'
                        : 'bg-[#E8F4FF] text-[#0071E3] dark:bg-[#0A84FF]/20 dark:text-[#64D2FF]'
                    }`}
                  >
                    {alreadyIn ? (
                      <Check className="h-3.5 w-3.5 stroke-[2.8]" />
                    ) : (
                      <FolderKanban className="h-3.5 w-3.5" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {col.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#86868B] dark:text-[#98989D]">
                      <span className="rounded-full bg-black/[0.05] dark:bg-white/[0.08] px-1.5 py-0.2 font-semibold text-[#1D1D1F] dark:text-[#E5E5EA]">
                        {col.group_name}
                      </span>
                      <span>
                        {col.items.length} {t.collections.items}
                      </span>
                    </div>
                  </div>

                  {!alreadyIn && (
                    <Plus className="h-3.5 w-3.5 shrink-0 text-[#86868B] group-hover:text-[#0071E3]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
