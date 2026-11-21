import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, GraduationCap, Shield, BookUser } from 'lucide-react';
import type { User, UserRole } from '../types.ts';
import { translations, type Lang } from '../i18n.ts';

interface UserMenuProps {
  users: User[];
  currentUser: User;
  lang: Lang;
  onSelect: (user: User) => void;
}

const ROLE_STYLES: Record<
  UserRole,
  { avatar: string; badge: string; icon: typeof GraduationCap }
> = {
  student: {
    avatar: 'from-[#0071E3] to-[#00C7BE] text-white',
    badge: 'bg-[#E8F4FF] text-[#005BB5] dark:bg-[#0A84FF]/20 dark:text-[#64D2FF]',
    icon: GraduationCap,
  },
  lecturer: {
    avatar: 'from-[#AF52DE] to-[#FF2D55] text-white',
    badge: 'bg-[#F5EAFF] text-[#8933B5] dark:bg-[#BF5AF2]/20 dark:text-[#DA8FFF]',
    icon: BookUser,
  },
  admin: {
    avatar: 'from-[#FF9500] to-[#FF2D55] text-white',
    badge: 'bg-[#FFF3E0] text-[#B86200] dark:bg-[#FF9F0A]/20 dark:text-[#FFB340]',
    icon: Shield,
  },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter((part) => !part.endsWith('.'))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function UserMenu({ users, currentUser, lang, onSelect }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const t = translations[lang];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const currentStyle = ROLE_STYLES[currentUser.role];

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Pill */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Active User Role"
        className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-black/[0.08] dark:border-white/[0.14] bg-white dark:bg-[#242428] py-1 pl-1.5 pr-2.5 sm:pr-3 text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] shadow-2xs transition hover:border-black/20 dark:hover:border-white/30 cursor-pointer"
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold shadow-2xs ${currentStyle.avatar}`}
        >
          {getInitials(currentUser.name)}
        </span>
        <span className="hidden sm:inline max-w-[120px] truncate font-semibold">
          {currentUser.name}
        </span>
        <span className={`hidden md:inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${currentStyle.badge}`}>
          {t.roles[currentUser.role]}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#86868B] transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown */}
      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] origin-top-right overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#1C1C1E]/95 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.16)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.65)] backdrop-blur-2xl z-50 animate-fade-up"
        >
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#86868B] dark:text-[#98989D]">
            {lang === 'hy' ? 'Ընտրել հաշիվը և դերը' : 'Switch Account & Role'}
          </div>

          <div className="space-y-0.5">
            {users.map((user) => {
              const style = ROLE_STYLES[user.role];
              const RoleIcon = style.icon;
              const isSelected = user.id === currentUser.id;

              return (
                <button
                  key={user.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelect(user);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#0071E3]/10 dark:bg-[#0A84FF]/20'
                      : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold shadow-xs ${style.avatar}`}
                  >
                    {getInitials(user.name)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {user.name}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}
                      >
                        <RoleIcon className="h-2.5 w-2.5" />
                        {t.roles[user.role]}
                      </span>
                      {user.group_name && (
                        <span className="rounded-full bg-black/[0.05] dark:bg-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-[#6E6E73] dark:text-[#AEAEB2]">
                          {user.group_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0071E3] text-white">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
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
