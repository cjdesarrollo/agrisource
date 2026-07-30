import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Banknote, Menu, X, User, LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import logoImg from '../assets/logo.jpg';

const navLinks = [
  { to: '/', label: 'Ventas', icon: <LayoutDashboard size={20} />, activeColor: 'bg-blue-50 text-blue-700' },
  { to: '/compras', label: 'Compras', icon: <ShoppingCart size={20} />, activeColor: 'bg-blue-50 text-blue-700' },
  { to: '/inventario', label: 'Inventario', icon: <Package size={20} />, activeColor: 'bg-blue-50 text-blue-700' },
  { to: '/caja', label: 'Caja', icon: <Banknote size={20} />, activeColor: 'bg-emerald-50 text-emerald-700' },
];

const NavContent = ({ currentUser, onChangeUser, onLinkClick }) => (
  <>
    <div className="p-5 flex items-center justify-center border-b border-slate-100">
      <img src={logoImg} alt="Agrisource" className="h-9 w-auto object-contain" />
    </div>

    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {navLinks.map(link => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === '/'}
          onClick={() => {
            sessionStorage.removeItem('ventas_active_tab');
            sessionStorage.removeItem('compras_active_tab');
            sessionStorage.removeItem('caja_active_tab');
            if (onLinkClick) onLinkClick();
          }}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium ${
              isActive ? `${link.activeColor} font-semibold` : 'text-slate-600 hover:bg-slate-50'
            }`
          }
        >
          {link.icon} {link.label}
        </NavLink>
      ))}
    </nav>

    {/* User profile card at footer */}
    {currentUser && (
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
              {currentUser.Username?.substring(0, 2).toUpperCase() || 'US'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate" title={currentUser.FullName || currentUser.Username}>
                {currentUser.FullName || currentUser.Username}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                {currentUser.IsAdmin ? (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">
                    <ShieldCheck className="w-3 h-3" /> Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
                    <UserCheck className="w-3 h-3" /> Usuario
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onChangeUser}
            className="w-full mt-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 text-xs font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Cambiar Usuario
          </button>
        </div>
      </div>
    )}
  </>
);

const Sidebar = ({ currentUser, onChangeUser }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="lg:hidden fixed top-3 left-3 z-50 bg-white shadow-md p-2 rounded-xl border border-slate-200"
        onClick={() => setMobileOpen(v => !v)}
        aria-label="Abrir menú"
      >
        {mobileOpen ? <X size={22} className="text-slate-700" /> : <Menu size={22} className="text-slate-700" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={`lg:hidden fixed top-0 left-0 h-full w-64 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <NavContent currentUser={currentUser} onChangeUser={onChangeUser} onLinkClick={() => setMobileOpen(false)} />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-64 bg-white h-screen border-r border-slate-200 flex-col fixed left-0 top-0">
        <NavContent currentUser={currentUser} onChangeUser={onChangeUser} onLinkClick={() => {}} />
      </div>
    </>
  );
};

export default Sidebar;
