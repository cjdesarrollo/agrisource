import React from 'react';
import iconoDashboard from '../assets/icono_dashboard.png';

const LoadingScreen = ({ message = 'Cargando datos...' }) => {
  return (
    <div className="fixed inset-0 bg-slate-50/80 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
      <div className="relative flex flex-col items-center">
        {/* Glowing aura effect */}
        <div className="absolute w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl animate-pulse" />
        
        {/* Circular spinning ring */}
        <div className="w-28 h-28 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin duration-1000 mb-6" />

        {/* Dashboard icon centered inside ring */}
        <div className="absolute top-4 w-20 h-20 bg-white rounded-2xl shadow-md border border-slate-100 flex items-center justify-center overflow-hidden animate-bounce duration-2000">
          <img 
            src={iconoDashboard} 
            alt="Cargando..." 
            className="w-16 h-16 object-contain"
          />
        </div>

        {/* Loading text messages */}
        <p className="text-slate-600 font-semibold text-sm tracking-wide animate-pulse">
          {message}
        </p>
        <span className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">
          Agrisource Systems
        </span>
      </div>
    </div>
  );
};

export default LoadingScreen;
