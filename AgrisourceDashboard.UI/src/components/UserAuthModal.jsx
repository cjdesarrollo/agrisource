import React, { useState } from 'react';
import axios from 'axios';
import { Lock, User, ShieldAlert, LogIn, AlertCircle, Sparkles } from 'lucide-react';
import logoImg from '../assets/logo.jpg';

const API_BASE_URL = import.meta.env.VITE_API_URL.replace('/dashboard', '');

const UserAuthModal = ({ onLoginSuccess, onClose, isChangingUser = false }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Por favor ingrese su usuario y contraseña.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, {
        username: username.trim(),
        password: password
      });

      const tieneAcceso = res.data.tieneAcceso ?? res.data.TieneAcceso;
      const rawUser = res.data.user ?? res.data.User;
      const errorText = res.data.error ?? res.data.Error;

      if (tieneAcceso === false) {
        setErrorMsg(errorText || 'Acceso Denegado: Su usuario no tiene permisos para acceder al Dashboard. Por favor póngase en contacto con gerencia o el departamento de sistemas.');
      } else if (tieneAcceso && rawUser) {
        const normalizedUser = {
          Id: rawUser.id ?? rawUser.Id,
          Username: rawUser.username ?? rawUser.Username,
          FullName: rawUser.fullName ?? rawUser.fullname ?? rawUser.FullName,
          Email: rawUser.email ?? rawUser.Email,
          IsAdmin: rawUser.isAdmin ?? rawUser.isadmin ?? rawUser.IsAdmin ?? false,
          Sucursales: (rawUser.sucursales ?? rawUser.Sucursales ?? []).map(s => ({
            id: s.id ?? s.Id,
            nombre: s.nombre ?? s.Nombre,
            codigo: s.codigo ?? s.Codigo
          }))
        };

        sessionStorage.setItem('agrisource_user', JSON.stringify(normalizedUser));
        onLoginSuccess(normalizedUser);
      } else {
        setErrorMsg('Error en la respuesta del servidor de autenticación.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.Error || 'Error al conectar con el servidor. Verifique sus credenciales.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white p-6 text-center relative">
          {isChangingUser && (
            <button 
              type="button" 
              onClick={onClose}
              className="absolute top-4 right-4 text-emerald-200 hover:text-white text-lg font-bold"
            >
              ✕
            </button>
          )}
          <div className="w-16 h-16 bg-white rounded-full mx-auto flex items-center justify-center p-1 shadow-lg mb-3 ring-4 ring-emerald-500/30">
            <img src={logoImg} alt="Logo Agrisource" className="w-full h-full object-contain rounded-full" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Agrisource Dashboard</h2>
          <p className="text-xs text-emerald-100/90 mt-1 font-medium flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" /> Control de Acceso y Permisos
          </p>
        </div>

        {/* Error Notification Banner */}
        {errorMsg && (
          <div className="m-5 mb-0 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3 text-red-800 text-xs shadow-sm animate-in fade-in duration-200">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block text-red-900 mb-0.5">Acceso Restringido</span>
              <p className="leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600" /> Usuario
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. wroque"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-800"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600" /> Contraseña
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-800"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Ingresar al Dashboard
                </>
              )}
            </button>
          </div>

          <p className="text-[11px] text-center text-slate-400 mt-4 leading-normal">
            Sus permisos de sucursal y rol de usuario se activarán automáticamente al iniciar sesión.
          </p>
        </form>

      </div>
    </div>
  );
};

export default UserAuthModal;
