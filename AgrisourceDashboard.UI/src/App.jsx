import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import FiltrosGlobales from './components/FiltrosGlobales';
import UserAuthModal from './components/UserAuthModal';
import Ventas from './pages/Ventas';
import Compras from './pages/Compras';
import Inventario from './pages/Inventario';
import Caja from './pages/Caja';

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

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = sessionStorage.getItem('agrisource_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isChangingUser, setIsChangingUser] = useState(false);

  const [filters, setFilters] = useState(() => {
    const saved = sessionStorage.getItem('global_filters');
    return saved ? JSON.parse(saved) : { 
      startDate: `${firstDayStr}T00:00:00`, 
      endDate: `${lastDayStr}T23:59:59`, 
      sucursalId: null,
      moneda: 'NIO',
      tipoCambio: 36.6243
    };
  });

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    sessionStorage.setItem('global_filters', JSON.stringify(newFilters));
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setIsChangingUser(false);
  };

  return (
    <div className="flex bg-gray-50 min-h-screen font-sans">
      {(!currentUser || isChangingUser) && (
        <UserAuthModal 
          onLoginSuccess={handleLoginSuccess} 
          onClose={() => setIsChangingUser(false)} 
          isChangingUser={isChangingUser}
        />
      )}

      <Sidebar currentUser={currentUser} onChangeUser={() => setIsChangingUser(true)} />

      <div className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0">
        <div className="max-w-7xl mx-auto pt-10 lg:pt-0">
          <FiltrosGlobales filters={filters} onFilterChange={handleFilterChange} currentUser={currentUser} />
          
          <Routes>
            <Route path="/" element={<Ventas filters={filters} currentUser={currentUser} />} />
            <Route path="/compras" element={<Compras filters={filters} currentUser={currentUser} />} />
            <Route path="/inventario" element={<Inventario filters={filters} currentUser={currentUser} />} />
            <Route path="/caja" element={<Caja filters={filters} currentUser={currentUser} />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;
