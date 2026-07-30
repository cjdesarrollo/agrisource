import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { Filter, DollarSign, Home, UserCheck, ShieldCheck } from 'lucide-react';
import logoImg from '../assets/logo.jpg';

const API_BASE_URL = import.meta.env.VITE_API_URL;

// Helper to get first and last day of current month in local timezone
const getMonthDateRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // First day of current month
  const firstDay = new Date(year, month, 1);
  const fdYear = firstDay.getFullYear();
  const fdMonth = String(firstDay.getMonth() + 1).padStart(2, '0');
  const firstDayStr = `${fdYear}-${fdMonth}-01`;

  // Last day of current month
  const lastDay = new Date(year, month + 1, 0);
  const ldYear = lastDay.getFullYear();
  const ldMonth = String(lastDay.getMonth() + 1).padStart(2, '0');
  const ldDay = String(lastDay.getDate()).padStart(2, '0');
  const lastDayStr = `${ldYear}-${ldMonth}-${ldDay}`;

  return { firstDayStr, lastDayStr };
};

const { firstDayStr, lastDayStr } = getMonthDateRange();

const FiltrosGlobales = ({ filters, onFilterChange, currentUser }) => {
  const location = useLocation();
  const isInventario = location.pathname === '/inventario';
  const [sucursales, setSucursales] = useState([]);
  
  // Initialize state from filters prop or month defaults
  const [startDate, setStartDate] = useState(() => {
    return filters.startDate ? filters.startDate.split('T')[0] : firstDayStr;
  });
  const [endDate, setEndDate] = useState(() => {
    return filters.endDate ? filters.endDate.split('T')[0] : lastDayStr;
  });
  const [sucursalId, setSucursalId] = useState(() => {
    return filters.sucursalId || '';
  });
  const [moneda, setMoneda] = useState(() => {
    return filters.moneda || 'NIO';
  });
  const [tipoCambio, setTipoCambio] = useState(() => {
    return filters.tipoCambio || 36.6243;
  });

  // Sync state if props change
  useEffect(() => {
    if (filters) {
      setStartDate(filters.startDate ? filters.startDate.split('T')[0] : firstDayStr);
      setEndDate(filters.endDate ? filters.endDate.split('T')[0] : lastDayStr);
      setSucursalId(filters.sucursalId || '');
      setMoneda(filters.moneda || 'NIO');
      setTipoCambio(filters.tipoCambio || 36.6243);
    }
  }, [filters]);

  useEffect(() => {
    const fetchSucursales = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/sucursales`, {
          params: { includeLosArcos: isInventario }
        });
        
        let list = res.data;
        
        // Filter branches based on user permissions
        if (currentUser && currentUser.Sucursales && currentUser.Sucursales.length > 0) {
          const allowedIds = currentUser.Sucursales.map(s => Number(s.id));
          if (!currentUser.IsAdmin) {
            list = list.filter(s => allowedIds.includes(Number(s.id)));
          }
        }

        setSucursales(list);
      } catch (error) {
        console.error("Error fetching sucursales", error);
      }
    };
    fetchSucursales();
  }, [location.pathname, isInventario, currentUser]);

  const handleApply = () => {
    onFilterChange({
      startDate: startDate ? `${startDate}T00:00:00` : null,
      endDate: endDate ? `${endDate}T23:59:59` : null,
      sucursalId: sucursalId ? parseInt(sucursalId) : null,
      moneda: moneda,
      tipoCambio: parseFloat(tipoCambio) || 36.6243
    });
  };

  const handleClear = () => {
    const defaultFilters = { 
      startDate: `${firstDayStr}T00:00:00`, 
      endDate: `${lastDayStr}T23:59:59`, 
      sucursalId: null, 
      moneda: 'NIO', 
      tipoCambio: 36.6243 
    };
    onFilterChange(defaultFilters);
  };

  const LOGIN_URL = 'https://red-stone-0c074280f.7.azurestaticapps.net/auth/login';

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8 flex flex-col gap-4">
      <div className="flex flex-wrap gap-4 items-end border-b pb-4">
        {/* Logo clickable */}
        <a href={LOGIN_URL} title="Volver al portal" className="flex-shrink-0">
          <img src={logoImg} alt="Agrisource" className="h-10 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity" />
        </a>

        <div className="flex items-center gap-2 text-gray-700 font-semibold mb-1 md:w-auto">
          <Filter size={20} className="text-blue-600"/> Filtros
        </div>

        {/* Current user badge */}
        {currentUser && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs text-slate-700">
            {currentUser.IsAdmin ? (
              <span className="inline-flex items-center gap-1 font-bold text-purple-700">
                <ShieldCheck className="w-4 h-4 text-purple-600" /> Admin
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-bold text-blue-700">
                <UserCheck className="w-4 h-4 text-blue-600" /> Usuario
              </span>
            )}
            <span className="text-slate-400">|</span>
            <span className="font-semibold">{currentUser.FullName || currentUser.Username}</span>
          </div>
        )}
        
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Fecha Inicio</label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Fecha Fin</label>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col flex-1 md:flex-none min-w-[200px]">
          <label className="text-xs text-gray-500 mb-1">Sucursal</label>
          <select 
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Todas las sucursales permitidas</option>
            {sucursales.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>

        {/* Volver a pantalla principal button */}
        <div className="ml-auto flex items-end">
          <a
            href={LOGIN_URL}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
          >
            <Home size={16} /> Volver a Pantalla Principal
          </a>
        </div>
      </div>
      
      {/* Finanzas / Moneda */}
      {!isInventario ? (
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex items-center gap-2 text-gray-700 font-semibold mb-1 w-full md:w-auto">
            <DollarSign size={20} className="text-emerald-600"/> Moneda
          </div>
          
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Moneda de Visualización</label>
            <select 
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="NIO">Córdobas (C$)</option>
              <option value="USD">Dólares Estadounidenses ($)</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Tipo de Cambio</label>
            <input 
              type="number" 
              step="0.0001"
              value={tipoCambio}
              onChange={(e) => setTipoCambio(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 ml-auto mt-2 md:mt-0">
            <button 
              onClick={handleApply}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Aplicar
            </button>
            <button 
              onClick={handleClear}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Limpiar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <button 
            onClick={handleApply}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Aplicar
          </button>
          <button 
            onClick={handleClear}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Limpiar
          </button>
        </div>
      )}
    </div>
  );
};

export default FiltrosGlobales;
