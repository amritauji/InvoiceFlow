import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

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
      { label: 'Submit Invoice', icon: 'add_circle', to: '/invoices/new', roles: ['admin','department_user'] },
      { label: 'My Submissions', icon: 'send_and_archive', to: '/invoices' },
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
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed top-0 left-0 h-full w-[280px] z-50 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent onClose={() => setSidebarOpen(false)} user={user} onLogout={handleLogout} />
      </aside>

      <aside className="hidden lg:flex fixed top-0 left-0 h-full w-[260px] z-30 bg-white border-r border-gray-200 flex-col">
        <SidebarContent user={user} onLogout={handleLogout} />
      </aside>

      <div className="lg:ml-[260px] flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 h-16 flex items-center px-4 lg:px-6 gap-4">
          <button className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors" onClick={() => setSidebarOpen(true)}>
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <span className="material-symbols-outlined text-[22px]">notifications</span>
            </button>
            <div className="w-px h-6 bg-gray-200 mx-1" />
            <div className="flex items-center gap-2.5 p-1.5 pr-3 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">{initials}</div>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-sm font-medium text-gray-700 leading-tight">{user?.full_name || 'User'}</span>
                <span className="text-[11px] text-gray-400 leading-tight">{roleLabels[user?.role] || user?.role || ''}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Logout">
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
      <div className="px-5 h-16 flex items-center justify-between border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <img src={logo} alt="InvoiceFlow" className="w-9 h-9 rounded-lg" />
          <div className="flex flex-col">
            <span className="text-[15px] font-bold text-gray-900 leading-tight">InvoiceFlow</span>
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider leading-tight">Enterprise</span>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors lg:hidden">
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
              <p className="px-3 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{section.label}</p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = loc.pathname === item.to || loc.pathname.startsWith(item.to + '/');
                  return (
                    <NavLink key={item.to} to={item.to} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                      <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>{item.icon}</span>
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="p-3 border-t border-gray-100 shrink-0">
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all">
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Sign Out
        </button>
      </div>
    </>
  );
}

export default Layout;
