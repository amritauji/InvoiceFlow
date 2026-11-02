import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import logo from '../assets/logo.webp';

const navSections = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', icon: 'dashboard', to: '/dashboard' },
    ],
  },
  {
    label: 'Invoices',
    items: [
      { label: 'Approval Queue', icon: 'rule', to: '/approvals', roles: ['admin','accountant_1','accountant_2','manager','ceo'] },
      { label: 'Submit Invoice', icon: 'add_circle', to: '/invoices/new', roles: ['admin','department_user','accountant_1','accountant_2'] },
      { label: 'My Submissions', icon: 'send_and_archive', to: '/invoices' },
    ],
  },
  {
    label: 'Statements',
    items: [
      { label: 'All Statements', icon: 'receipt_long', to: '/statements' },
      { label: 'Submit Statement', icon: 'upload_file', to: '/statements/new', roles: ['accountant_1'] },
    ],
  },
  {
    label: 'Management',
    items: [
      { label: 'Audit Trail', icon: 'history', to: '/audit', roles: ['admin','accountant_1','accountant_2','manager','ceo'] },
      { label: 'Admin', icon: 'admin_panel_settings', to: '/admin', roles: ['admin'] },
    ],
  },
];

const roleLabels = {
  department_user: 'Department User',
  accountant_1: 'Accountant 1',
  accountant_2: 'Accountant 2',
  accounts_team: 'Accounts Team',
  accounts_head: 'Accounts Head',
  ceo: 'CEO',
  manager: 'Manager',
  admin: 'Administrator',
};

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { dark, toggleTheme } = useTheme();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
      setSearchQuery('');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1423] text-gray-900 dark:text-[#e1e3f0] font-sans transition-colors">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed top-0 left-0 h-full w-[280px] z-50 bg-white dark:bg-[#181d2e] border-r border-gray-200 dark:border-[#2e3650] flex flex-col transform transition-transform duration-300 ease-in-out lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent onClose={() => setSidebarOpen(false)} user={user} onLogout={handleLogout} />
      </aside>

      <aside className="hidden lg:flex fixed top-0 left-0 h-full w-[260px] z-30 bg-white dark:bg-[#181d2e] border-r border-gray-200 dark:border-[#2e3650] flex-col">
        <SidebarContent user={user} onLogout={handleLogout} />
      </aside>

      <div className="lg:ml-[260px] flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 bg-white/80 dark:bg-[#0f1423]/80 backdrop-blur-md border-b border-gray-200 dark:border-[#2e3650] h-16 flex items-center justify-between px-4 lg:px-6 transition-colors">
          {sidebarOpen && <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 dark:text-[#8d95b0] hover:bg-gray-100 dark:hover:bg-[#1e2538] hover:text-gray-700 dark:hover:text-[#e1e3f0] transition-colors shrink-0" onClick={() => setSidebarOpen(true)}>
              <span className="material-symbols-outlined text-[22px]">menu</span>
            </button>
            <form onSubmit={handleSearch} className="flex-1 min-w-0 max-w-[200px] lg:max-w-none lg:w-64">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-gray-400 dark:text-[#8d95b0] pointer-events-none">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search invoices..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-gray-100 dark:bg-[#1e2538] border border-transparent rounded-lg text-gray-900 dark:text-[#e1e3f0] placeholder:text-gray-400 dark:placeholder:text-[#8d95b0] focus:bg-white dark:focus:bg-[#242c42] focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 outline-none transition-colors"
                />
              </div>
            </form>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 dark:text-[#8d95b0] hover:bg-gray-100 dark:hover:bg-[#1e2538] hover:text-gray-700 dark:hover:text-[#e1e3f0] transition-colors"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="material-symbols-outlined text-[22px]">{dark ? 'light_mode' : 'dark_mode'}</span>
            </button>
            <NotificationBell />
            <div className="w-px h-6 bg-gray-200 dark:bg-[#2e3650] mx-1" />
            <div className="flex items-center gap-2 pl-1">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-400 text-xs font-bold shrink-0">{initials}</div>
              <div className="hidden sm:flex flex-col items-start min-w-0">
                <span className="text-sm font-medium text-gray-700 dark:text-[#e1e3f0] leading-tight truncate max-w-[120px]">{user?.full_name || 'User'}</span>
                <span className="text-[11px] text-gray-400 dark:text-[#8d95b0] leading-tight">{roleLabels[user?.role] || user?.role || ''}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 ml-1 rounded-lg text-gray-400 dark:text-[#8d95b0] hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors" title="Logout">
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ onClose, user, onLogout }) {
  const loc = useLocation();
  const userRole = user?.role;

  return (
    <>
      <div className="px-5 h-16 flex items-center justify-between border-b border-gray-100 dark:border-[#2e3650] shrink-0 transition-colors">
        <div className="flex items-center gap-3">
          <img src={logo} alt="InvoiceFlow" className="w-9 h-9 rounded-lg" />
          <div className="flex flex-col">
            <span className="text-[15px] font-bold text-gray-900 dark:text-[#e1e3f0] leading-tight">InvoiceFlow</span>
            <span className="text-[10px] text-gray-400 dark:text-[#8d95b0] font-medium uppercase tracking-wider leading-tight">Enterprise</span>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 -mr-1.5 rounded-lg text-gray-400 dark:text-[#8d95b0] hover:bg-gray-100 dark:hover:bg-[#1e2538] hover:text-gray-600 dark:hover:text-[#e1e3f0] transition-colors lg:hidden">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navSections.map((section) => {
          const visibleItems = section.items.filter(item => !item.roles || item.roles.includes(userRole));
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label}>
              <p className="px-3 mb-2 text-[10px] font-semibold text-gray-400 dark:text-[#8d95b0] uppercase tracking-widest">{section.label}</p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = loc.pathname === item.to || loc.pathname.startsWith(item.to + '/');
                  return (
                    <NavLink key={item.to} to={item.to} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${isActive ? 'bg-indigo-50 dark:bg-indigo-600/15 text-indigo-700 dark:text-indigo-400' : 'text-gray-600 dark:text-[#8d95b0] hover:bg-gray-50 dark:hover:bg-[#1e2538] hover:text-gray-900 dark:hover:text-[#e1e3f0]'}`}>
                      <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-[#8d95b0]'}`}>{item.icon}</span>
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="p-3 border-t border-gray-100 dark:border-[#2e3650] shrink-0 transition-colors">
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-gray-500 dark:text-[#8d95b0] hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all">
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Sign Out
        </button>
      </div>
    </>
  );
}

function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  const seconds = Math.max(0, Math.floor((Date.now() - then.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString();
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications', { params: { limit: 15 } });
      setItems(data.data || []);
      setUnread(data.meta?.unread ?? 0);
    } catch {
      // ignore — bell stays silent on errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) fetchNotifications();
  };

  const handleClick = async (n) => {
    if (!n.is_read) {
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      try { await api.patch(`/notifications/${n.id}/read`); } catch { /* noop */ }
    }
    setOpen(false);
    if (n.invoice_id) navigate(`/invoices/${n.invoice_id}`);
  };

  const markAll = async () => {
    try { await api.patch('/notifications/read-all'); } catch { /* noop */ }
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
    setUnread(0);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative p-2 rounded-lg text-gray-500 dark:text-[#8d95b0] hover:bg-gray-100 dark:hover:bg-[#1e2538] hover:text-gray-700 dark:hover:text-[#e1e3f0] transition-colors"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
      >
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] max-w-[calc(100vw-2rem)] bg-white dark:bg-[#181d2e] border border-gray-200 dark:border-[#2e3650] rounded-xl shadow-xl shadow-black/5 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#2e3650]">
            <span className="text-sm font-semibold text-gray-800 dark:text-[#e1e3f0]">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-[#8d95b0]">Loading...</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <span className="material-symbols-outlined text-[32px] text-gray-300 dark:text-[#3a4260]">notifications_none</span>
                <p className="mt-2 text-sm text-gray-500 dark:text-[#8d95b0]">You're all caught up</p>
              </div>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-gray-50 dark:hover:bg-[#1e2538] ${n.is_read ? 'opacity-70' : ''}`}
                    >
                      <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${n.is_read ? 'bg-gray-200 dark:bg-[#2e3650]' : 'bg-indigo-500'}`} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-medium text-gray-800 dark:text-[#e1e3f0] truncate">{n.title}</span>
                        <span className="block text-xs text-gray-500 dark:text-[#8d95b0] mt-0.5 leading-snug line-clamp-2">{n.message}</span>
                        <span className="block text-[11px] text-gray-400 dark:text-[#5b6780] mt-1">{timeAgo(n.created_at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Layout;
