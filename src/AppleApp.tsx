import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  RefreshCw,
  X,
  BookOpen,
  FileText,
  Video,
  Radio,
  Library,
  CheckCircle2,
  ExternalLink,
  SlidersHorizontal,
  FolderKanban,
  Compass,
  Building2,
  BookmarkCheck,
  RotateCcw,
  Pencil,
  Trash2,
  FolderPlus,
  ArrowUpRight,
  Moon,
  Sun,
} from 'lucide-react';
import { api } from './api.ts';
import { translations, type Lang } from './i18n.ts';
import type { Collection, Resource, ResourceFacets, SkillMapResponse, User } from './types.ts';
import { UserMenu } from './components/UserMenu.tsx';
import { CollectionPicker } from './components/CollectionPicker.tsx';

const ResourceModal = lazy(() =>
  import('./components/ResourceModal.tsx').then((m) => ({ default: m.ResourceModal }))
);

type Tab = 'catalogue' | 'collections' | 'skill-map' | 'depot';

function MinimalLogo() {
  return (
    <img
      src="/logo.svg"
      alt="Picsart Academy"
      className="h-8 w-8 shrink-0 object-contain"
      draggable={false}
    />
  );
}

export default function AppleApp() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('pa-library-apple-theme') === 'dark';
  });

  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('pa-library-lang');
    return saved === 'en' ? 'en' : 'hy';
  });

  const t = translations[lang];

  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('catalogue');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [resources, setResources] = useState<Resource[]>([]);
  const [physicalBooks, setPhysicalBooks] = useState<Resource[]>([]);
  const [facets, setFacets] = useState<ResourceFacets>({
    courses: [],
    topics: [],
    levels: ['Beginner', 'Intermediate', 'Advanced'],
    types: ['book', 'article', 'video', 'recording'],
    tags: [],
  });
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [skillMap, setSkillMap] = useState<SkillMapResponse | null>(null);

  // Create collection form
  const [showNewCol, setShowNewCol] = useState(false);
  const [colTitle, setColTitle] = useState('');
  const [colDesc, setColDesc] = useState('');
  const [colGroup, setColGroup] = useState('JS-24');
  const [colCourse, setColCourse] = useState('Web Development');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [syncingReel, setSyncingReel] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('pa-library-apple-theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('pa-library-apple-theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('pa-library-lang', lang);
  }, [lang]);

  const notify = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast((prev) => (prev === message ? null : prev));
    }, 3200);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput), 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveTab('catalogue');
        setTimeout(() => searchInputRef.current?.focus(), 30);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    api
      .getUsers()
      .then(({ users: list }) => {
        setUsers(list);
        if (list.length > 0) {
          const savedId = Number(localStorage.getItem('pa-library-user-id'));
          const matched = list.find((u) => u.id === savedId);
          setCurrentUser(matched ?? list[0]);
        }
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to connect to API';
        setInitError(msg);
      });
  }, []);

  const handleSelectUser = useCallback((user: User) => {
    localStorage.setItem('pa-library-user-id', String(user.id));
    setCurrentUser(user);
  }, []);

  const loadCatalogue = useCallback(
    async (signal?: AbortSignal) => {
      if (!currentUser) return;
      setLoading(true);
      try {
        const catRes = await api.getResources(
          currentUser.id,
          {
            q: debouncedQuery,
            course: courseFilter,
            topic: topicFilter,
            level: levelFilter,
            type: typeFilter,
            tag: tagFilter,
          },
          signal
        );
        if (signal?.aborted) return;
        setResources(Array.isArray(catRes?.resources) ? catRes.resources : []);
        if (catRes?.facets) setFacets(catRes.facets);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        notify(err instanceof Error ? err.message : 'Failed to load library.');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [
      currentUser,
      debouncedQuery,
      courseFilter,
      topicFilter,
      levelFilter,
      typeFilter,
      tagFilter,
      notify,
    ]
  );

  const loadDepot = useCallback(async () => {
    if (!currentUser) return;
    try {
      const depotRes = await api.getResources(currentUser.id, { physicalOnly: true });
      setPhysicalBooks(Array.isArray(depotRes?.resources) ? depotRes.resources : []);
    } catch {
      // ignore
    }
  }, [currentUser]);

  const loadCollectionsAndSkillMap = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [colRes, smRes] = await Promise.all([
        api.getCollections(currentUser.id),
        api.getSkillMap(currentUser.id),
      ]);
      setCollections(Array.isArray(colRes?.collections) ? colRes.collections : []);
      if (smRes) setSkillMap(smRes);
    } catch {
      // ignore
    }
  }, [currentUser]);

  useEffect(() => {
    const controller = new AbortController();
    loadCatalogue(controller.signal);
    return () => controller.abort();
  }, [loadCatalogue]);

  useEffect(() => {
    loadDepot();
    loadCollectionsAndSkillMap();
  }, [loadDepot, loadCollectionsAndSkillMap]);

  const refreshAll = useCallback(() => {
    loadCatalogue();
    loadDepot();
    loadCollectionsAndSkillMap();
  }, [loadCatalogue, loadDepot, loadCollectionsAndSkillMap]);

  async function handleSyncReel() {
    if (!currentUser) return;
    setSyncingReel(true);
    try {
      const res = await api.syncReel(currentUser.id);
      notify(res.message);
      refreshAll();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Reel sync failed.');
    } finally {
      setSyncingReel(false);
    }
  }

  async function handleDelete(resource: Resource) {
    if (!currentUser) return;
    if (!confirm(t.toasts.confirmDelete(resource.title))) return;
    try {
      await api.deleteResource(currentUser.id, resource.id);
      notify(t.toasts.resourceDeleted);
      refreshAll();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Permission denied.');
    }
  }

  async function handleAddToCollection(collectionId: number, resourceId: number) {
    if (!currentUser) return;
    try {
      await api.addResourceToCollection(currentUser.id, collectionId, resourceId);
      notify(t.toasts.addedToCollection);
      loadCollectionsAndSkillMap();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed.');
    }
  }

  async function handleBorrow(resourceId: number) {
    if (!currentUser) return;
    try {
      await api.borrowBook(currentUser.id, resourceId);
      notify(t.toasts.bookBorrowed);
      refreshAll();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed.');
    }
  }

  async function handleReturn(resourceId: number) {
    if (!currentUser) return;
    try {
      await api.returnBook(currentUser.id, resourceId);
      notify(t.toasts.bookReturned);
      refreshAll();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed.');
    }
  }

  async function handleCreateCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    try {
      await api.createCollection(currentUser.id, {
        title: colTitle,
        description: colDesc,
        group_name: colGroup,
        course: colCourse,
      });
      setColTitle('');
      setColDesc('');
      setShowNewCol(false);
      loadCollectionsAndSkillMap();
      notify(t.toasts.collectionCreated);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed.');
    }
  }

  async function handleRemoveColItem(collectionId: number, resourceId: number) {
    if (!currentUser) return;
    try {
      await api.removeResourceFromCollection(currentUser.id, collectionId, resourceId);
      loadCollectionsAndSkillMap();
      notify(t.toasts.collectionItemRemoved);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Permission denied.');
    }
  }

  async function handleDeleteCol(collectionId: number) {
    if (!currentUser) return;
    try {
      await api.deleteCollection(currentUser.id, collectionId);
      loadCollectionsAndSkillMap();
      notify(t.toasts.collectionDeleted);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Permission denied.');
    }
  }

  function clearFilters() {
    setSearchInput('');
    setCourseFilter('');
    setTopicFilter('');
    setLevelFilter('');
    setTypeFilter('');
    setTagFilter('');
  }

  const canCreate = currentUser?.role === 'lecturer' || currentUser?.role === 'admin';
  const activeFilterCount = [courseFilter, topicFilter, levelFilter, tagFilter].filter(Boolean).length;
  const hasAnyFilter = Boolean(searchInput || typeFilter || activeFilterCount > 0);

  const manageableCollections = useMemo(() => {
    if (!currentUser) return [];
    return collections.filter(
      (c) =>
        currentUser.role === 'admin' ||
        (currentUser.role === 'lecturer' && c.created_by === currentUser.id)
    );
  }, [collections, currentUser]);

  const sections = useMemo(() => {
    return (
      [
        {
          key: 'book',
          label: t.filters.books,
          icon: BookOpen,
          iconBg: 'bg-[#FFF3E0] text-[#E67E00] dark:bg-[#FF9F0A]/15 dark:text-[#FF9F0A]',
          bar: 'from-[#FF9500] to-[#FFCC00]',
          pill: 'bg-[#FFF3E0] text-[#B86200] dark:bg-[#FF9F0A]/15 dark:text-[#FFB340]',
          hoverBorder: 'hover:border-[#FF9500]/45',
          items: resources.filter((r) => r.resource_type === 'book'),
        },
        {
          key: 'article',
          label: t.filters.articles,
          icon: FileText,
          iconBg: 'bg-[#E8F4FF] text-[#0071E3] dark:bg-[#0A84FF]/15 dark:text-[#409CFF]',
          bar: 'from-[#0071E3] to-[#00C7BE]',
          pill: 'bg-[#E8F4FF] text-[#005BB5] dark:bg-[#0A84FF]/15 dark:text-[#64D2FF]',
          hoverBorder: 'hover:border-[#0071E3]/45',
          items: resources.filter((r) => r.resource_type === 'article'),
        },
        {
          key: 'recording',
          label: t.filters.recordings,
          icon: Radio,
          iconBg: 'bg-[#FFEAF0] text-[#FF2D55] dark:bg-[#FF375F]/15 dark:text-[#FF6482]',
          bar: 'from-[#FF2D55] to-[#AF52DE]',
          pill: 'bg-[#FFEAF0] text-[#C91A3E] dark:bg-[#FF375F]/15 dark:text-[#FF6482]',
          hoverBorder: 'hover:border-[#FF2D55]/45',
          items: resources.filter((r) => r.resource_type === 'recording'),
        },
        {
          key: 'video',
          label: t.filters.videos,
          icon: Video,
          iconBg: 'bg-[#F5EAFF] text-[#AF52DE] dark:bg-[#BF5AF2]/15 dark:text-[#DA8FFF]',
          bar: 'from-[#AF52DE] to-[#5856D6]',
          pill: 'bg-[#F5EAFF] text-[#8933B5] dark:bg-[#BF5AF2]/15 dark:text-[#DA8FFF]',
          hoverBorder: 'hover:border-[#AF52DE]/45',
          items: resources.filter((r) => r.resource_type === 'video'),
        },
      ] as const
    ).filter((s) => s.items.length > 0);
  }, [resources, t.filters.articles, t.filters.books, t.filters.recordings, t.filters.videos]);

  const availablePhysical = useMemo(
    () => physicalBooks.reduce((sum, b) => sum + b.available_copies, 0),
    [physicalBooks]
  );
  const totalPhysical = useMemo(
    () => physicalBooks.reduce((sum, b) => sum + b.total_copies, 0),
    [physicalBooks]
  );

  if (!currentUser) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F5F5F7] dark:bg-[#0A0A0C] p-6 text-sm text-[#6E6E73] dark:text-[#98989D]">
        <span>{initError ? `API Error: ${initError}` : t.loading}</span>
        {initError && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-[#0071E3] px-4 py-1.5 text-xs font-medium text-white cursor-pointer"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F5F5F7] dark:bg-[#0A0A0C] text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors">
      {/* Subtle Apple-Intelligence Ambient Aura */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[420px] overflow-hidden">
        <div className="absolute -top-24 left-[12%] h-72 w-72 rounded-full bg-[#64D2FF]/25 dark:bg-[#0A84FF]/15 blur-3xl" />
        <div className="absolute -top-20 left-[42%] h-72 w-72 rounded-full bg-[#BF5AF2]/20 dark:bg-[#BF5AF2]/15 blur-3xl" />
        <div className="absolute -top-24 right-[12%] h-72 w-72 rounded-full bg-[#FF9F0A]/20 dark:bg-[#FF375F]/12 blur-3xl" />
      </div>

      {/* Apple-Style Frosted Glass Top Bar */}
      <header className="sticky top-0 z-30 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#161618]/85 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-2 px-4 py-2.5 sm:px-10 sm:py-3">
          {/* Brand */}
          <button
            type="button"
            onClick={() => setActiveTab('catalogue')}
            className="flex min-w-0 items-center gap-2 text-left cursor-pointer"
          >
            <MinimalLogo />
            <span className="truncate text-[14px] sm:text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              Picsart Academy{' '}
              <span className="hidden xs:inline font-normal text-[#6E6E73] dark:text-[#98989D]">
                {t.brandSub}
              </span>
            </span>
          </button>

          {/* Desktop Centered Minimal Navigation (Mobile uses native Bottom Tab Bar) */}
          <nav className="hidden md:flex items-center gap-1 text-[13px] font-medium">
            {(
              [
                { id: 'catalogue', label: t.nav.catalogue },
                { id: 'collections', label: t.nav.collections },
                { id: 'skill-map', label: t.nav.skillMap },
                { id: 'depot', label: t.nav.depot },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`rounded-full px-3.5 py-1.5 transition cursor-pointer ${
                  activeTab === id
                    ? 'bg-[#1D1D1F] text-white dark:bg-[#F5F5F7] dark:text-[#0A0A0C]'
                    : 'text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-[#1D1D1F] dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Right Utilities */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <UserMenu
              users={users}
              currentUser={currentUser}
              lang={lang}
              onSelect={handleSelectUser}
            />

            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'hy' ? 'en' : 'hy'))}
              className="rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-[#F5F5F7] dark:bg-[#2C2C2E] px-2.5 sm:px-3 py-1.5 text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] transition hover:bg-black/[0.06] dark:hover:bg-white/[0.14] cursor-pointer"
            >
              {lang === 'hy' ? 'EN' : 'ՀԱՅ'}
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label="Toggle Dark Mode"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#FFD60A] transition hover:border-[#0071E3] cursor-pointer"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Compact Top Tab Strip (avoids Netlify badge & mobile browser bottom bar) */}
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden border-t border-black/[0.05] dark:border-white/[0.07] px-2 py-1.5"
        >
          <div className="grid grid-cols-4 gap-1">
            {(
              [
                { id: 'catalogue', label: t.nav.catalogue, icon: Library },
                { id: 'collections', label: t.nav.collections, icon: FolderKanban },
                { id: 'skill-map', label: t.nav.skillMap, icon: Compass },
                { id: 'depot', label: t.nav.depot, icon: Building2 },
              ] as const
            ).map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setActiveTab(id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-[#1D1D1F] text-white dark:bg-[#F5F5F7] dark:text-[#0A0A0C] shadow-2xs'
                      : 'text-[#6E6E73] dark:text-[#98989D]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate max-w-[78px]">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-16 sm:bottom-6 left-1/2 z-50 -translate-x-1/2 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-[#1D1D1F] px-4 py-2.5 text-xs font-medium text-white shadow-xl animate-fade-up">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#34C759]" />
          <span className="truncate">{toast}</span>
        </div>
      )}

      <main className="relative z-10 mx-auto max-w-[1400px] px-4 pt-6 pb-16 sm:px-10 sm:py-10">
        {/* CATALOGUE TAB */}
        {activeTab === 'catalogue' && (
          <div className="space-y-10 animate-fade-up">
            {/* Airy Minimal Hero + Spotlight Search */}
            <section className="mx-auto max-w-3xl text-center space-y-4 sm:space-y-5">
              <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                {t.hero.titlePrefix}{' '}
                <span className="bg-gradient-to-r from-[#0071E3] via-[#AF52DE] to-[#FF2D55] bg-clip-text text-transparent">
                  {t.hero.titleAccent}
                </span>
              </h1>
              <p className="text-sm sm:text-lg text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
                {t.hero.subtitle}
              </p>

              {/* Minimal Spotlight Search Input (16px text prevents iOS Safari zoom) */}
              <div className="relative mx-auto max-w-2xl rounded-2xl bg-gradient-to-r from-[#00C7BE]/50 via-[#AF52DE]/50 to-[#FF9500]/50 p-[1.5px] shadow-[0_8px_28px_-10px_rgba(175,82,222,0.28)] transition focus-within:from-[#0071E3] focus-within:via-[#AF52DE] focus-within:to-[#FF2D55]">
                <div className="relative flex items-center rounded-[14.5px] bg-white dark:bg-[#1C1C1E] px-2.5 py-1.5 sm:px-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0071E3] via-[#AF52DE] to-[#FF2D55] text-white shadow-xs">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={t.filters.searchPlaceholder}
                    className="w-full bg-transparent py-2 pl-3 pr-10 sm:pr-16 text-[16px] sm:text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] focus:outline-none"
                  />
                  {searchInput ? (
                    <button
                      type="button"
                      onClick={() => setSearchInput('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[#FFEAF0] dark:bg-[#FF375F]/20 p-1.5 text-[#FF2D55] dark:text-[#FF6482] hover:bg-[#FF2D55] hover:text-white transition cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <kbd className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 hidden sm:inline-block rounded-md border border-black/[0.08] dark:border-white/[0.12] bg-[#F5F5F7] dark:bg-[#2C2C2E] px-2 py-0.5 text-[11px] font-medium text-[#86868B]">
                      ⌘K
                    </kbd>
                  )}
                </div>
              </div>

              {/* Horizontally Scrollable Type Pills on Mobile + Filters + Lecturer Actions */}
              <div className="flex flex-col items-center gap-2.5 pt-1">
                <div className="w-full overflow-x-auto no-scrollbar pb-0.5">
                  <div className="mx-auto inline-flex items-center gap-1 rounded-full bg-[#E8E8ED]/80 dark:bg-[#1C1C1E] p-1 text-xs font-medium ring-1 ring-transparent dark:ring-white/[0.08] whitespace-nowrap">
                    {(
                      [
                        { id: '', label: t.filters.allTypes },
                        { id: 'book', label: t.filters.books },
                        { id: 'article', label: t.filters.articles },
                        { id: 'recording', label: t.filters.recordings },
                        { id: 'video', label: t.filters.videos },
                      ] as const
                    ).map(({ id, label }) => (
                      <button
                        key={id || 'all'}
                        type="button"
                        onClick={() => setTypeFilter(id)}
                        className={`rounded-full px-3.5 py-1.5 transition cursor-pointer ${
                          typeFilter === id
                            ? 'bg-white dark:bg-[#3A3A3C] text-[#1D1D1F] dark:text-white shadow-xs'
                            : 'text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFilters((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition cursor-pointer ${
                      showFilters || activeFilterCount > 0
                        ? 'border-[#0071E3] bg-[#0071E3] text-white'
                        : 'border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] hover:border-black/20 dark:hover:border-white/25'
                    }`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>{t.filters.filtersBtn}</span>
                    {activeFilterCount > 0 && (
                      <span className="rounded-full bg-white/25 px-1.5 text-[10px]">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  {canCreate && (
                    <>
                      <button
                        type="button"
                        onClick={handleSyncReel}
                        disabled={syncingReel}
                        className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#1C1C1E] px-3.5 py-2 text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:border-black/20 dark:hover:border-white/25 disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncingReel ? 'animate-spin' : ''}`} />
                        {t.hero.syncReel}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingResource(null);
                          setModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#0071E3] px-4 py-2 text-xs font-medium text-white hover:bg-[#0077ED] cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t.hero.addResource}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Expandable Filters Panel */}
              {showFilters && (
                <div className="mx-auto max-w-2xl rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] p-4 shadow-sm space-y-3 text-left animate-fade-up">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={courseFilter}
                      onChange={(e) => setCourseFilter(e.target.value)}
                      className="rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3 py-1.5 text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none cursor-pointer"
                    >
                      <option value="">{t.filters.allCourses}</option>
                      {facets.courses.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <select
                      value={topicFilter}
                      onChange={(e) => setTopicFilter(e.target.value)}
                      className="rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3 py-1.5 text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none cursor-pointer"
                    >
                      <option value="">{t.filters.allTopics}</option>
                      {facets.topics.map((topic) => (
                        <option key={topic} value={topic}>
                          {topic}
                        </option>
                      ))}
                    </select>
                    <select
                      value={levelFilter}
                      onChange={(e) => setLevelFilter(e.target.value)}
                      className="rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3 py-1.5 text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none cursor-pointer"
                    >
                      <option value="">{t.filters.allLevels}</option>
                      {facets.levels.map((l) => (
                        <option key={l} value={l}>
                          {t.levels[l]}
                        </option>
                      ))}
                    </select>
                    {hasAnyFilter && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="ml-auto text-xs font-medium text-[#0071E3] dark:text-[#0A84FF] hover:underline cursor-pointer"
                      >
                        {t.filters.reset}
                      </button>
                    )}
                  </div>

                  {facets.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 border-t border-black/[0.05] dark:border-white/[0.08] pt-3">
                      {facets.tags.slice(0, 12).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setTagFilter((prev) => (prev === tag ? '' : tag))}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                            tagFilter === tag
                              ? 'bg-[#0071E3] text-white'
                              : 'bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#AEAEB2] hover:text-[#1D1D1F] dark:hover:text-white'
                          }`}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Categorized Clean Apple Cards */}
            {loading ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-56 animate-pulse rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E]"
                  />
                ))}
              </div>
            ) : resources.length === 0 ? (
              <div className="mx-auto max-w-md rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] p-12 text-center shadow-2xs">
                <p className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {t.filters.noResultsTitle}
                </p>
                <p className="mt-1 text-sm text-[#6E6E73] dark:text-[#98989D]">
                  {t.filters.noResultsSub}
                </p>
                {hasAnyFilter && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 rounded-full bg-[#0071E3] px-5 py-2 text-xs font-medium text-white cursor-pointer"
                  >
                    {t.filters.resetFilters}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-12">
                {sections.map(({ key, label, icon: SectionIcon, iconBg, bar, pill, hoverBorder, items }) => (
                  <section key={key} className="space-y-4">
                    <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconBg}`}
                        >
                          <SectionIcon className="h-4 w-4" />
                        </span>
                        <h2 className="text-xl font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {label}
                        </h2>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${pill}`}>
                          {items.length}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {items.map((resource) => {
                        const canModify =
                          currentUser.role === 'admin' ||
                          (currentUser.role === 'lecturer' &&
                            currentUser.id === resource.created_by);
                        const isBorrowedByMe = resource.borrowed_by === currentUser.id;
                        const canReturn =
                          resource.is_physical &&
                          resource.available_copies < resource.total_copies &&
                          (isBorrowedByMe || currentUser.role === 'admin');

                        return (
                          <article
                            key={resource.id}
                            className={`group flex flex-col justify-between rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_14px_30px_rgba(0,0,0,0.45)] ${hoverBorder}`}
                          >
                            <div className={`h-1 w-full rounded-t-2xl bg-gradient-to-r ${bar}`} />
                            <div className="flex flex-1 flex-col justify-between p-5">
                            <div>
                              <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-[#86868B] dark:text-[#98989D]">
                                <span className="truncate uppercase tracking-wider">
                                  {resource.course}
                                </span>
                                <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-semibold ${pill}`}>
                                  {t.levels[resource.level]}
                                </span>
                              </div>

                              <h3 className="mt-2.5 text-[16px] font-semibold leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-start gap-1 transition hover:text-[#0071E3] dark:hover:text-[#0A84FF]"
                                >
                                  <span>{resource.title}</span>
                                  <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 opacity-30 transition group-hover:opacity-100 group-hover:text-[#0071E3] dark:group-hover:text-[#0A84FF]" />
                                </a>
                              </h3>

                              <p className="mt-1 text-xs text-[#86868B] dark:text-[#98989D]">
                                {resource.author || resource.preview_domain}
                                {resource.duration_or_pages ? ` · ${resource.duration_or_pages}` : ''}
                              </p>

                              <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-[#6E6E73] dark:text-[#AEAEB2]">
                                {resource.description}
                              </p>

                              {/* Minimal Physical Shelf Bar */}
                              {resource.is_physical && (
                                <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3 py-2 text-xs">
                                  <div className="flex items-center gap-1.5 text-[#1D1D1F] dark:text-[#F5F5F7]">
                                    <span
                                      className={`h-2 w-2 rounded-full ${
                                        resource.available_copies > 0
                                          ? 'bg-[#34C759]'
                                          : 'bg-[#FF9500]'
                                      }`}
                                    />
                                    <span className="font-medium">
                                      {resource.available_copies}/{resource.total_copies}{' '}
                                      {t.card.free}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {resource.available_copies > 0 && !isBorrowedByMe && (
                                      <button
                                        type="button"
                                        onClick={() => handleBorrow(resource.id)}
                                        className="rounded-full bg-[#0071E3] px-2.5 py-0.5 text-[11px] font-medium text-white hover:bg-[#0077ED] cursor-pointer"
                                      >
                                        {t.card.borrow}
                                      </button>
                                    )}
                                    {canReturn && (
                                      <button
                                        type="button"
                                        onClick={() => handleReturn(resource.id)}
                                        className="rounded-full border border-black/15 dark:border-white/20 bg-white dark:bg-[#3A3A3C] px-2.5 py-0.5 text-[11px] font-medium text-[#1D1D1F] dark:text-white hover:bg-black/5 cursor-pointer"
                                      >
                                        {t.card.return}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Subtle Footer */}
                            <div className="mt-4 flex items-center justify-between gap-2 border-t border-black/[0.05] dark:border-white/[0.08] pt-3 text-[11px] text-[#86868B] dark:text-[#98989D]">
                              <div className="flex flex-wrap gap-1">
                                {resource.tags.slice(0, 2).map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() =>
                                      setTagFilter((prev) => (prev === tag ? '' : tag))
                                    }
                                    className="rounded-md bg-[#F5F5F7] dark:bg-[#2C2C2E] px-2 py-0.5 text-[#6E6E73] dark:text-[#AEAEB2] hover:text-[#0071E3] dark:hover:text-[#0A84FF] cursor-pointer"
                                  >
                                    #{tag}
                                  </button>
                                ))}
                              </div>

                              <div className="flex items-center gap-1">
                                <CollectionPicker
                                  collections={manageableCollections}
                                  resourceId={resource.id}
                                  lang={lang}
                                  onAdd={handleAddToCollection}
                                />

                                {canModify && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingResource(resource);
                                        setModalOpen(true);
                                      }}
                                      className="rounded p-1 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] hover:text-[#0071E3] dark:hover:text-[#0A84FF] cursor-pointer"
                                      title={t.card.edit}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(resource)}
                                      className="rounded p-1 hover:bg-rose-50 dark:hover:bg-[#FF375F]/20 hover:text-rose-600 dark:hover:text-[#FF6482] cursor-pointer"
                                      title={t.card.delete}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {/* COLLECTIONS TAB */}
        {activeTab === 'collections' && (
          <div className="space-y-8 animate-fade-up">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {t.collections.title}
                </h2>
                <p className="mt-1 text-sm text-[#6E6E73] dark:text-[#98989D]">
                  {t.collections.subtitle}
                </p>
              </div>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => setShowNewCol((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#0071E3] px-4 py-2 text-xs font-medium text-white hover:bg-[#0077ED] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t.collections.newBtn}
                </button>
              )}
            </div>

            {showNewCol && (
              <form
                onSubmit={handleCreateCollection}
                className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] p-6 shadow-sm space-y-4"
              >
                <h3 className="text-base font-semibold">{t.collections.createTitle}</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    required
                    placeholder={t.collections.titlePlaceholder}
                    value={colTitle}
                    onChange={(e) => setColTitle(e.target.value)}
                    className="rounded-xl border border-black/10 dark:border-white/15 bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3.5 py-2 text-sm sm:col-span-2 focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] focus:outline-none"
                  />
                  <input
                    required
                    placeholder={t.collections.groupPlaceholder}
                    value={colGroup}
                    onChange={(e) => setColGroup(e.target.value)}
                    className="rounded-xl border border-black/10 dark:border-white/15 bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3.5 py-2 text-sm focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] focus:outline-none"
                  />
                  <input
                    required
                    placeholder={t.collections.coursePlaceholder}
                    value={colCourse}
                    onChange={(e) => setColCourse(e.target.value)}
                    className="rounded-xl border border-black/10 dark:border-white/15 bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3.5 py-2 text-sm focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] focus:outline-none"
                  />
                  <input
                    placeholder={t.collections.descPlaceholder}
                    value={colDesc}
                    onChange={(e) => setColDesc(e.target.value)}
                    className="rounded-xl border border-black/10 dark:border-white/15 bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3.5 py-2 text-sm sm:col-span-2 focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewCol(false)}
                    className="rounded-full border border-black/10 dark:border-white/15 px-4 py-1.5 text-xs font-medium text-[#6E6E73] dark:text-[#AEAEB2] cursor-pointer"
                  >
                    {t.collections.cancel}
                  </button>
                  <button
                    type="submit"
                    className="rounded-full bg-[#0071E3] px-5 py-1.5 text-xs font-medium text-white cursor-pointer"
                  >
                    {t.collections.create}
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {collections.map((col) => {
                const canManage =
                  currentUser.role === 'admin' ||
                  (currentUser.role === 'lecturer' && col.created_by === currentUser.id);
                return (
                  <div
                    key={col.id}
                    className="flex flex-col rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F4FF] dark:bg-[#0A84FF]/15 px-2.5 py-0.5 text-[11px] font-medium text-[#0071E3] dark:text-[#64D2FF]">
                          <FolderKanban className="h-3 w-3" />
                          {col.group_name} · {col.course}
                        </span>
                        <h3 className="mt-2.5 text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {col.title}
                        </h3>
                        {col.description && (
                          <p className="mt-1 text-xs text-[#6E6E73] dark:text-[#98989D]">
                            {col.description}
                          </p>
                        )}
                      </div>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCol(col.id)}
                          className="rounded p-1 text-[#86868B] hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="mt-4 flex-1 divide-y divide-black/[0.05] dark:divide-white/[0.07]">
                      {col.items.length === 0 ? (
                        <p className="py-6 text-center text-xs text-[#86868B]">
                          {t.collections.empty}
                        </p>
                      ) : (
                        col.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 py-2.5 text-sm"
                          >
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:text-[#0071E3] dark:hover:text-[#0A84FF]"
                            >
                              {item.title}
                            </a>
                            {canManage ? (
                              <button
                                type="button"
                                onClick={() => handleRemoveColItem(col.id, item.id)}
                                className="text-[#86868B] hover:text-rose-600 cursor-pointer"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#86868B]" />
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <p className="mt-4 border-t border-black/[0.05] dark:border-white/[0.07] pt-3 text-[11px] text-[#86868B]">
                      {t.collections.curatedBy} {col.created_by_name}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SKILL MAP (FOR YOU) TAB */}
        {activeTab === 'skill-map' && (
          <div className="space-y-8 animate-fade-up">
            <div className="rounded-3xl border border-[#AF52DE]/20 bg-gradient-to-br from-[#F5EAFF] via-white to-[#E8F4FF] dark:from-[#261636] dark:via-[#1C1C1E] dark:to-[#112438] p-8 shadow-2xs">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#AF52DE]/15 px-3 py-1 text-xs font-semibold text-[#8933B5] dark:text-[#DA8FFF]">
                <Compass className="h-3.5 w-3.5" />
                <span>{t.skillMap.badge}</span>
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                {skillMap ? t.skillMap.title(skillMap.user.name) : t.skillMap.loading}
              </h2>
              {skillMap && skillMap.skill_gaps.length > 0 ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                    {t.skillMap.focusTopics}
                  </span>
                  {skillMap.skill_gaps.map((gap) => (
                    <span
                      key={gap}
                      className="rounded-full bg-white/80 dark:bg-[#2C2C2E] px-3 py-1 text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] ring-1 ring-black/[0.06] dark:ring-white/[0.1]"
                    >
                      {gap}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#6E6E73] dark:text-[#98989D]">
                  {t.skillMap.switchHint}
                </p>
              )}
            </div>

            {skillMap && skillMap.recommendations.length > 0 && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {skillMap.recommendations.map((rec) => (
                  <div
                    key={rec.resource.id}
                    className="flex flex-col justify-between rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] p-6 shadow-2xs transition hover:shadow-md"
                  >
                    <div>
                      <span className="rounded-full bg-[#0071E3]/10 dark:bg-[#0A84FF]/15 px-2.5 py-0.5 text-[11px] font-medium text-[#0071E3] dark:text-[#64D2FF]">
                        {t.skillMap.closesGap} {rec.gap}
                      </span>
                      <h3 className="mt-3 text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {rec.resource.title}
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-[#6E6E73] dark:text-[#AEAEB2]">
                        {rec.resource.description}
                      </p>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-black/[0.05] dark:border-white/[0.07] pt-3">
                      <span className="text-[11px] text-[#86868B]">
                        {t.levels[rec.resource.level]}
                      </span>
                      <a
                        href={rec.resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-[#0071E3] px-3.5 py-1 text-xs font-medium text-white hover:bg-[#0077ED]"
                      >
                        {t.skillMap.open}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DEPOT TAB */}
        {activeTab === 'depot' && (
          <div className="space-y-8 animate-fade-up">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#FF9500]/20 bg-gradient-to-br from-[#FFF6E5] to-white dark:from-[#2C200E] dark:to-[#1C1C1E] p-6">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#C96B00] dark:text-[#FFB340]">
                  <Building2 className="h-4 w-4" />
                  <span>{t.depot.badge}</span>
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {t.depot.title}
                </h2>
                <p className="mt-1 text-xs text-[#6E6E73] dark:text-[#98989D]">{t.depot.subtitle}</p>
              </div>
              <div className="rounded-2xl border border-[#34C759]/25 bg-gradient-to-br from-[#EBFAEE] to-white dark:from-[#0E2916] dark:to-[#1C1C1E] p-6">
                <span className="text-xs font-semibold text-[#1F8A3B] dark:text-[#30D158]">
                  {t.depot.available}
                </span>
                <p className="mt-2 text-3xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {availablePhysical}{' '}
                  <span className="text-sm font-normal text-[#6E6E73] dark:text-[#98989D]">
                    {t.depot.ofCopies(totalPhysical)}
                  </span>
                </p>
              </div>
              <div className="rounded-2xl border border-[#0071E3]/20 bg-gradient-to-br from-[#E8F4FF] to-white dark:from-[#0E2238] dark:to-[#1C1C1E] p-6">
                <span className="text-xs font-semibold text-[#005BB5] dark:text-[#64D2FF]">
                  {t.depot.checkedOut}
                </span>
                <p className="mt-2 text-3xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {totalPhysical - availablePhysical}{' '}
                  <span className="text-sm font-normal text-[#6E6E73] dark:text-[#98989D]">
                    {t.depot.activeLoans}
                  </span>
                </p>
              </div>
            </div>

            {/* Mobile Depot Cards (< 768px) */}
            <div className="space-y-3 md:hidden">
              {physicalBooks.map((book) => {
                const isBorrowedByMe = book.borrowed_by === currentUser.id;
                const canReturn =
                  book.available_copies < book.total_copies &&
                  (isBorrowedByMe || currentUser.role === 'admin');
                return (
                  <div
                    key={book.id}
                    className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] p-4 shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <a
                          href={book.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] hover:text-[#0071E3]"
                        >
                          {book.title}
                        </a>
                        <p className="mt-0.5 text-xs text-[#86868B]">{book.author}</p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-[#F5F5F7] dark:bg-[#2C2C2E] px-2 py-1 font-mono text-[11px] font-medium text-[#6E6E73] dark:text-[#AEAEB2]">
                        {book.depot_shelf || t.depot.mainShelf}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            book.available_copies > 0 ? 'bg-[#34C759]' : 'bg-[#FF9500]'
                          }`}
                        />
                        {book.available_copies}/{book.total_copies} {t.card.free}
                      </span>
                      {book.borrowed_by_name && (
                        <span className="truncate text-[#6E6E73] dark:text-[#AEAEB2]">
                          {book.borrowed_by_name}
                          {book.due_date ? ` · ${book.due_date}` : ''}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      {book.available_copies > 0 && !isBorrowedByMe && (
                        <button
                          type="button"
                          onClick={() => handleBorrow(book.id)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0071E3] py-2 text-xs font-medium text-white active:scale-[0.98] transition cursor-pointer"
                        >
                          <BookmarkCheck className="h-3.5 w-3.5" />
                          {t.card.borrow}
                        </button>
                      )}
                      {canReturn && (
                        <button
                          type="button"
                          onClick={() => handleReturn(book.id)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-black/15 dark:border-white/20 bg-white dark:bg-[#2C2C2E] py-2 text-xs font-medium text-[#1D1D1F] dark:text-white active:scale-[0.98] transition cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {t.card.return}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Depot Table (>= 768px) */}
            <div className="hidden md:block overflow-hidden rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-black/[0.06] dark:border-white/[0.08] bg-[#FAFAFC] dark:bg-[#161618] text-[11px] font-medium uppercase tracking-wider text-[#86868B]">
                    <tr>
                      <th className="px-6 py-3.5">{t.depot.colBook}</th>
                      <th className="px-5 py-3.5">{t.depot.colShelf}</th>
                      <th className="px-5 py-3.5">{t.depot.colStatus}</th>
                      <th className="px-5 py-3.5">{t.depot.colBorrower}</th>
                      <th className="px-6 py-3.5 text-right">{t.depot.colAction}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
                    {physicalBooks.map((book) => {
                      const isBorrowedByMe = book.borrowed_by === currentUser.id;
                      const canReturn =
                        book.available_copies < book.total_copies &&
                        (isBorrowedByMe || currentUser.role === 'admin');
                      return (
                        <tr key={book.id} className="hover:bg-[#FAFAFC] dark:hover:bg-white/[0.03]">
                          <td className="px-6 py-4">
                            <a
                              href={book.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:text-[#0071E3] dark:hover:text-[#0A84FF]"
                            >
                              {book.title}
                            </a>
                            <p className="text-xs text-[#86868B]">{book.author}</p>
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-[#6E6E73] dark:text-[#AEAEB2]">
                            {book.depot_shelf || t.depot.mainShelf}
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  book.available_copies > 0 ? 'bg-[#34C759]' : 'bg-[#FF9500]'
                                }`}
                              />
                              {book.available_copies}/{book.total_copies} {t.card.free}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs text-[#6E6E73] dark:text-[#AEAEB2]">
                            {book.borrowed_by_name ? (
                              <span>
                                {book.borrowed_by_name}
                                {book.due_date ? ` · ${t.depot.due} ${book.due_date}` : ''}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="inline-flex gap-2">
                              {book.available_copies > 0 && !isBorrowedByMe && (
                                <button
                                  type="button"
                                  onClick={() => handleBorrow(book.id)}
                                  className="inline-flex items-center gap-1 rounded-full bg-[#0071E3] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#0077ED] cursor-pointer"
                                >
                                  <BookmarkCheck className="h-3.5 w-3.5" />
                                  {t.card.borrow}
                                </button>
                              )}
                              {canReturn && (
                                <button
                                  type="button"
                                  onClick={() => handleReturn(book.id)}
                                  className="inline-flex items-center gap-1 rounded-full border border-black/15 dark:border-white/20 bg-white dark:bg-[#2C2C2E] px-3.5 py-1.5 text-xs font-medium text-[#1D1D1F] dark:text-white hover:bg-black/5 cursor-pointer"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  {t.card.return}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {modalOpen && (
        <Suspense fallback={null}>
          <ResourceModal
            userId={currentUser.id}
            lang={lang}
            initial={editingResource}
            onClose={() => {
              setModalOpen(false);
              setEditingResource(null);
            }}
            onSaved={() => {
              notify(editingResource ? t.toasts.resourceUpdated : t.toasts.resourceAdded);
              refreshAll();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
