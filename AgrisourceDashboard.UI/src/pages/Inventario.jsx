import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { 
  Package, ArrowRightLeft, Target, X, Building, LayoutTemplate, Layers, Search, FileDown,
  Plus, Printer, Eye, Sliders, TrendingUp, TrendingDown, CheckCircle, AlertTriangle, Trash2, Calendar, Lock, Pencil, Save
} from 'lucide-react';
import * as XLSX from 'xlsx';

import LoadingScreen from '../components/LoadingScreen';

const RAW_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5083/api/dashboard';
const DASHBOARD_API_URL = RAW_API_URL.endsWith('/dashboard') ? RAW_API_URL : (RAW_API_URL.replace(/\/$/, '') + '/dashboard');
const BASE_API_URL = RAW_API_URL.replace(/\/dashboard$/, '');
const INVENTARIO_API_URL = BASE_API_URL + '/inventario';
const CAJA_API_URL = BASE_API_URL + '/caja';

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6'];

// Custom Input for Column Filtering
const ColumnFilter = ({ placeholder, value, onChange }) => (
  <div className="mt-2 relative">
    <Search className="w-3 h-3 absolute left-2 top-2 text-gray-400" />
    <input 
      type="text" 
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 rounded text-gray-600 bg-white focus:outline-none focus:border-blue-500 font-normal"
      onClick={(e) => e.stopPropagation()}
    />
  </div>
);

// Auto-Print Receipt Generator for Inventory Adjustments
const printAjusteReceipt = (header, detalles, currencySymbol = '$') => {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('Permita las ventanas emergentes para imprimir el comprobante.');
    return;
  }

  const detallesHtml = detalles.map((d, index) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${index + 1}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace; font-weight: bold;">${d.articulocodigo || d.articuloCodigo || 'N/A'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">
        <strong>${d.articulanombre || d.articuloNombre || ''}</strong>
        ${d.observacion ? `<br/><small style="color: #666;">Obs: ${d.observacion}</small>` : ''}
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${d.bodeganombre || d.bodegaNombre || ''} / ${d.ubicacionnombre || d.ubicacionNombre || 'N/A'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${Number(d.cantidadanterior || d.cantidadAnterior || 0).toLocaleString()}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; color: ${Number(d.cantidadajuste || d.cantidadAjuste) >= 0 ? '#10B981' : '#EF4444'}; font-weight: bold;">
        ${Number(d.cantidadajuste || d.cantidadAjuste) >= 0 ? '+' : ''}${Number(d.cantidadajuste || d.cantidadAjuste).toLocaleString()}
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${Number(d.cantidadnueva || d.cantidadNueva || 0).toLocaleString()}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${currencySymbol} ${Number(d.costounitario || d.costoUnitario || 0).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${currencySymbol} ${Number(d.costototal || d.costoTotal || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Comprobante de Ajuste ${header.numeroajuste || header.numeroAjuste}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; color: #333; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #047857; padding-bottom: 15px; margin-bottom: 20px; }
        .title { font-size: 20px; font-weight: bold; color: #047857; }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px; }
        .info-item { font-size: 13px; }
        .info-label { font-weight: bold; color: #4b5563; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
        th { background: #047857; color: white; padding: 10px; text-align: left; text-transform: uppercase; font-size: 11px; }
        th.text-right { text-align: right; }
        th.text-center { text-align: center; }
        .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 50px; text-align: center; }
        .sig-line { border-top: 1px solid #666; margin-top: 40px; padding-top: 5px; font-size: 12px; font-weight: bold; color: #4b5563; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="title">COMPROBANTE DE AJUSTE DE INVENTARIO</div>
          <div style="font-size: 12px; color: #666; margin-top: 4px;">AGRISOURCE - Sistema de Control WMS</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 16px; font-weight: bold; color: #111;">N° ${header.numeroajuste || header.numeroAjuste}</div>
          <div style="font-size: 12px; color: #666;">Fecha: ${new Date(header.fecha).toLocaleDateString()}</div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-item"><span class="info-label">Sucursal:</span> ${header.sucursal || 'General'}</div>
        <div class="info-item"><span class="info-label">Tipo de Ajuste:</span> ${header.tipoajuste || header.tipoAjuste}</div>
        <div class="info-item"><span class="info-label">Usuario Autorizador:</span> ${header.usuario || 'Sistema'}</div>
        <div class="info-item"><span class="info-label">Total Ítems:</span> ${header.totalarticulos || header.totalArticulos} ítem(s)</div>
        <div class="info-item" style="grid-column: span 2;"><span class="info-label">Concepto / Motivo:</span> ${header.concepto || 'Ajuste de existencias'}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th class="text-center">#</th>
            <th>Código</th>
            <th>Descripción del Artículo</th>
            <th>Bodega / Ubicación</th>
            <th class="text-right">Stock Ant.</th>
            <th class="text-right">Ajuste</th>
            <th class="text-right">Stock Nuevo</th>
            <th class="text-right">Costo Unit.</th>
            <th class="text-right">Costo Total</th>
          </tr>
        </thead>
        <tbody>
          ${detallesHtml}
        </tbody>
      </table>

      <div style="text-align: right; margin-bottom: 30px;">
        <span style="font-size: 14px; font-weight: bold;">COSTO TOTAL AJUSTADO: </span>
        <span style="font-size: 16px; font-weight: bold; color: #047857;">$${Number(header.costototal || header.costoTotal || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
      </div>

      <div class="signatures">
        <div><div class="sig-line">Elaborado Por</div></div>
        <div><div class="sig-line">Revisado Por</div></div>
        <div><div class="sig-line">Autorizado Por</div></div>
      </div>

      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

const ModalDetalleConsumos = ({ isOpen, onClose, data, detailsLoading, targetName }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            Detalle de Consumos <span className="text-blue-600">({targetName})</span>
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1">
          {detailsLoading ? (
            <div className="text-center py-8 text-gray-500 animate-pulse">Cargando detalles...</div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No se encontraron facturas/movimientos para esta ubicación.</div>
          ) : (
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Factura</th>
                  <th className="px-4 py-3">Artículo</th>
                  <th className="px-4 py-3">Vendedor</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, i) => (
                  <tr key={i} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{new Date(item.fecha).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-blue-600">#{item.factura}</td>
                    <td className="px-4 py-3">{item.articulo}</td>
                    <td className="px-4 py-3">{item.vendedor || 'N/A'}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-700">{item.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const datePart = dateString.split('T')[0];
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
};

const Inventario = ({ filters, currentUser }) => {
  const currencySymbol = filters?.moneda === 'USD' ? '$' : 'C$';
  const formatCurrency = (val) => {
    const amount = Number(val || 0);
    return `${currencySymbol} ${amount.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const [activeTab, setActiveTab] = useState('General');
  
  const [movimientos, setMovimientos] = useState([]);
  const [topArticulos, setTopArticulos] = useState([]);
  const [consumosUbicacion, setConsumosUbicacion] = useState([]);
  const [existencias, setExistencias] = useState([]);
  const [ingresos, setIngresos] = useState([]);
  const [egresos, setEgresos] = useState([]);
  const [trasladosInternos, setTrasladosInternos] = useState([]);

  // Nuevas Métricas
  const [catMovements, setCatMovements] = useState([]);
  const [stockStatus, setStockStatus] = useState([]);
  const [topCategories, setTopCategories] = useState([]);
  const [trendsData, setTrendsData] = useState([]);
  const [trendsView, setTrendsView] = useState('dias');
  
  const [loading, setLoading] = useState(true);

  // Filters State for existencias
  const [existenciasGroupBy, setExistenciasGroupBy] = useState('Sucursal');
  const [extFilters, setExtFilters] = useState({ articulo: '', sucursal: '', bodega: '', ubicacion: '' });
  
  // Filters State for Ingresos
  const [ingFilters, setIngFilters] = useState({ documento: '', tipomovimiento: '', articulo: '', sucursal: '', bodega: '' });
  
  // Filters State for Egresos
  const [egrFilters, setEgrFilters] = useState({ documento: '', tipomovimiento: '', articulo: '', sucursal: '', bodega: '' });
  
  // Filters State for Traslados
  const [traFilters, setTraFilters] = useState({ documento: '', articulo: '', bodegaorigen: '', bodegadestino: '' });

  // Drilldown state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalTitle, setModalTitle] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [movRes, topRes, consRes, extRes, ingRes, egrRes, trasRes, metricsRes, trendsRes] = await Promise.all([
          axios.get(`${DASHBOARD_API_URL}/movimientos-inventario-sucursal`, { params: filters }),
          axios.get(`${DASHBOARD_API_URL}/top-articulos-movimiento`, { params: filters }),
          axios.get(`${DASHBOARD_API_URL}/consumos-ubicaciones`, { params: filters }),
          axios.get(`${DASHBOARD_API_URL}/existencias-detalle`, { params: { sucursalId: filters.sucursalId } }),
          axios.get(`${DASHBOARD_API_URL}/ingresos-detalle`, { params: filters }),
          axios.get(`${DASHBOARD_API_URL}/egresos-detalle`, { params: filters }),
          axios.get(`${DASHBOARD_API_URL}/traslados-internos`, { params: filters }),
          axios.get(`${DASHBOARD_API_URL}/inventario-dashboard-metrics`, { params: filters }),
          axios.get(`${DASHBOARD_API_URL}/inventario-trends`, { params: filters })
        ]);
        setMovimientos(Array.isArray(movRes.data) ? movRes.data : []);
        setTopArticulos(Array.isArray(topRes.data) ? topRes.data : []);
        setConsumosUbicacion(Array.isArray(consRes.data) ? consRes.data : []);
        setExistencias(Array.isArray(extRes.data) ? extRes.data : []);
        setIngresos(Array.isArray(ingRes.data) ? ingRes.data : []);
        setEgresos(Array.isArray(egrRes.data) ? egrRes.data : []);
        setTrasladosInternos(Array.isArray(trasRes.data) ? trasRes.data : []);
        
        setCatMovements(metricsRes.data?.catMovements || []);
        setStockStatus(metricsRes.data?.stockStatus || []);
        setTopCategories(metricsRes.data?.topCategories || []);
        setTrendsData(Array.isArray(trendsRes.data) ? trendsRes.data : []);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filters]);

  const handlePieClick = async (entry) => {
    setModalTitle(`${entry.bodeganombre} - ${entry.ubicacionnombre}`);
    setModalOpen(true);
    setModalLoading(true);
    try {
      const res = await axios.get(`${DASHBOARD_API_URL}/consumos-detalle`, {
        params: {
          ...filters,
          bodegaId: entry.bodegaid,
          ubicacionId: entry.ubicacionid
        }
      });
      setModalData(res.data);
    } catch (error) {
      console.error("Error fetching drilldown details", error);
    } finally {
      setModalLoading(false);
    }
  };

  const exportToExcel = (data, sheetName, fileName) => {
    if (!data || data.length === 0) { alert('No hay datos para exportar.'); return; }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return <LoadingScreen message="Cargando datos de inventario..." />;

  const mTypeMap = {
    'CP': 'Entradas',
    'TS': 'Traslados Salidas',
    'CI': 'Consumos',
    'TE': 'Traslados Externos'
  };

  const formattedMovimientos = movimientos.map(m => ({
    ...m,
    movimientoNombre: mTypeMap[m.movimiento] || m.movimiento
  }));

  const groupedMovimientos = formattedMovimientos.reduce((acc, curr) => {
    const existing = acc.find(item => item.sucursal === curr.sucursal);
    if (existing) {
      existing[curr.movimientoNombre] = curr.cantidadtotal;
    } else {
      acc.push({ sucursal: curr.sucursal, [curr.movimientoNombre]: curr.cantidadtotal });
    }
    return acc;
  }, []);

  const formattedConsumos = consumosUbicacion.map(c => ({
    ...c,
    displayName: `${c.bodeganombre || 'S/B'} | ${c.ubicacionnombre || 'S/U'}`
  }));

  const safeIncludes = (val, search) => (val || '').toString().toLowerCase().includes((search || '').toLowerCase());

  const filteredExistencias = existencias.filter(e => 
    safeIncludes(e.articulo, extFilters.articulo) &&
    safeIncludes(e.sucursal, extFilters.sucursal) &&
    safeIncludes(e.bodega, extFilters.bodega) &&
    safeIncludes(e.ubicacion, extFilters.ubicacion)
  );

  const filteredIngresos = ingresos.filter(i => 
    safeIncludes(i.documento, ingFilters.documento) &&
    safeIncludes(i.tipomovimiento, ingFilters.tipomovimiento) &&
    safeIncludes(i.articulo, ingFilters.articulo) &&
    safeIncludes(i.sucursal, ingFilters.sucursal) &&
    safeIncludes(i.bodega, ingFilters.bodega)
  );

  const filteredEgresos = egresos.filter(e => 
    safeIncludes(e.documento, egrFilters.documento) &&
    safeIncludes(e.tipomovimiento, egrFilters.tipomovimiento) &&
    safeIncludes(e.articulo, egrFilters.articulo) &&
    safeIncludes(e.sucursal, egrFilters.sucursal) &&
    safeIncludes(e.bodega, egrFilters.bodega)
  );

  const filteredTraslados = trasladosInternos.filter(t => 
    safeIncludes(t.documento, traFilters.documento) &&
    safeIncludes(t.articulo, traFilters.articulo) &&
    safeIncludes(t.bodegaorigen, traFilters.bodegaorigen) &&
    safeIncludes(t.bodegadestino, traFilters.bodegadestino)
  );

  return (
    <div>
      <ModalDetalleConsumos 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        data={modalData} 
        detailsLoading={modalLoading} 
        targetName={modalTitle} 
      />

      <header className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Dashboard de Inventario</h1>
          <p className="text-gray-500">Módulo WMS y Kardex avanzado</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-lg mt-4 md:mt-0 overflow-x-auto w-full md:w-auto">
          {['General', 'Existencias', 'Ingresos', 'Egresos', 'Traslados Internos', 'Ajustes'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-white shadow-sm text-emerald-700 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'General' && (() => {
        const safeStockStatus = Array.isArray(stockStatus) ? stockStatus : [];
        const safeTrendsData = Array.isArray(trendsData) ? trendsData : [];

        const getStartOfWeekString = (dateStr) => {
          const date = new Date(dateStr);
          const day = date.getDay();
          const diff = date.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(date.setDate(diff));
          return monday.toISOString().split('T')[0];
        };

        const getMonthString = (dateStr) => {
          const date = new Date(dateStr);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        };

        const buildLineChartData = (movType) => {
          const filtered = safeTrendsData.filter(t => t && t.tipomovimiento === movType);
          const sucursalesSet = [...new Set(filtered.map(t => t.sucursal))];

          const dateMap = {};
          filtered.forEach(t => {
            let key = t.fecha;
            if (trendsView === 'semanas') key = getStartOfWeekString(t.fecha);
            if (trendsView === 'meses') key = getMonthString(t.fecha);

            if (!dateMap[key]) {
              dateMap[key] = { fecha: key };
              sucursalesSet.forEach(s => dateMap[key][s] = 0);
            }
            dateMap[key][t.sucursal] = (dateMap[key][t.sucursal] || 0) + Number(t.cantidad);
          });

          const chartData = Object.values(dateMap).sort((a, b) => a.fecha.localeCompare(b.fecha));
          return { chartData, sucursalesSet };
        };

        const exportStockStatusExcel = () => {
          if (!safeStockStatus || safeStockStatus.length === 0) { alert('No hay datos de estatus de stock.'); return; }
          exportToExcel(safeStockStatus, 'Estatus_Stock', 'Estatus_Stock_Sucursales');
        };

        return (
          <div className="space-y-6">
            {/* Section 1: Stock Mínimos/Máximos y Artículos en Cero por Sucursal */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Layers className="text-emerald-600 w-5 h-5" /> Stock Mínimos/Máximos y Artículos en Cero por Sucursal
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">Pasteles de stock actual para cada sucursal en el sistema</p>
                </div>
                <button
                  onClick={exportStockStatusExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all self-start md:self-auto"
                >
                  <FileDown size={16} /> Exportar Estatus de Stock (Excel)
                </button>
              </div>

              {/* Branch Doughnut Cards Carousel / Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {safeStockStatus.map((item, idx) => {
                  const pieData = [
                    { name: 'En Cero', value: Number(item.stockcero || 0), color: '#EF4444' },
                    { name: 'Bajo Mín', value: Number(item.stockminimo || 0), color: '#F59E0B' },
                    { name: 'Normal', value: Number(item.stocknormal || 0), color: '#10B981' },
                    { name: 'Sobre Máx', value: Number(item.stockmaximo || 0), color: '#3B82F6' }
                  ];

                  return (
                    <div key={idx} className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 flex flex-col items-center">
                      <h4 className="font-bold text-slate-700 text-sm mb-2 text-center">{item.sucursal}</h4>
                      <div className="h-36 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={28}
                              outerRadius={46}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {pieData.map((p, i) => (
                                <Cell key={`cell-${i}`} fill={p.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v, name) => [`${v} artículos`, name]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 w-full text-[11px] mt-2 pt-2 border-t border-slate-200/60">
                        <div className="flex items-center gap-1 text-slate-600 font-medium truncate">
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                          <span className="truncate">En Cero: <strong>{item.stockcero}</strong></span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-600 font-medium truncate">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                          <span className="truncate">Bajo Mín: <strong>{item.stockminimo}</strong></span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-600 font-medium truncate">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                          <span className="truncate">Normal: <strong>{item.stocknormal}</strong></span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-600 font-medium truncate">
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                          <span className="truncate">Sobre Máx: <strong>{item.stockmaximo}</strong></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Agrupar tendencias por Días, Semanas, Meses */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
              <span className="text-sm font-bold text-gray-700">Agrupar tendencias por:</span>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                {[
                  { label: 'Días', val: 'dias' },
                  { label: 'Semanas', val: 'semanas' },
                  { label: 'Meses', val: 'meses' }
                ].map(item => (
                  <button
                    key={item.val}
                    onClick={() => setTrendsView(item.val)}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      trendsView === item.val ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4 Line Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1: TE */}
              {(() => {
                const { chartData, sucursalesSet } = buildLineChartData('TE');
                return (
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-slate-700 text-xs tracking-wider uppercase mb-4 flex items-center gap-2">
                      <span>📈</span> GRÁFICA 1: ENTRADAS POR TRASLADOS DESDE OTRAS SUCURSALES
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                          <XAxis dataKey="fecha" height={45} tick={{ fontSize: 10, fill: '#64748B' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          {sucursalesSet.map((s, idx) => (
                            <Line key={s} type="monotone" dataKey={s} stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}

              {/* Chart 2: CI */}
              {(() => {
                const { chartData, sucursalesSet } = buildLineChartData('CI');
                return (
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-slate-700 text-xs tracking-wider uppercase mb-4 flex items-center gap-2">
                      <span>📈</span> GRÁFICA 2: CONSUMOS POR FACTURAS (VENTAS)
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                          <XAxis dataKey="fecha" height={45} tick={{ fontSize: 10, fill: '#64748B' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          {sucursalesSet.map((s, idx) => (
                            <Line key={s} type="monotone" dataKey={s} stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}

              {/* Chart 3: TS */}
              {(() => {
                const { chartData, sucursalesSet } = buildLineChartData('TS');
                return (
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-slate-700 text-xs tracking-wider uppercase mb-4 flex items-center gap-2">
                      <span>📈</span> GRÁFICA 3: SALIDAS POR TRASLADOS HACIA OTRAS SUCURSALES
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                          <XAxis dataKey="fecha" height={45} tick={{ fontSize: 10, fill: '#64748B' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          {sucursalesSet.map((s, idx) => (
                            <Line key={s} type="monotone" dataKey={s} stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}

              {/* Chart 4: CP */}
              {(() => {
                const { chartData, sucursalesSet } = buildLineChartData('CP');
                return (
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-slate-700 text-xs tracking-wider uppercase mb-4 flex items-center gap-2">
                      <span>📈</span> GRÁFICA 4: ENTRADAS POR COMPRAS
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                          <XAxis dataKey="fecha" height={45} tick={{ fontSize: 10, fill: '#64748B' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          {sucursalesSet.map((s, idx) => (
                            <Line key={s} type="monotone" dataKey={s} stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {activeTab === 'Existencias' && (
        <div className="animate-in fade-in duration-300 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
            <h2 className="text-lg font-bold text-gray-800 flex items-center text-emerald-600">
              <Package className="w-5 h-5 mr-2" /> Consulta de Existencias en Tiempo Real
            </h2>
            <button onClick={() => exportToExcel(filteredExistencias, 'Existencias', 'Existencias_Inventario')} 
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
              <FileDown size={14} /> Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3 align-top">
                    Artículo
                    <ColumnFilter placeholder="Artículo..." value={extFilters.articulo} onChange={v => setExtFilters({...extFilters, articulo: v})} />
                  </th>
                  <th className="px-4 py-3 align-top">
                    Sucursal
                    <ColumnFilter placeholder="Sucursal..." value={extFilters.sucursal} onChange={v => setExtFilters({...extFilters, sucursal: v})} />
                  </th>
                  <th className="px-4 py-3 align-top">
                    Bodega
                    <ColumnFilter placeholder="Bodega..." value={extFilters.bodega} onChange={v => setExtFilters({...extFilters, bodega: v})} />
                  </th>
                  <th className="px-4 py-3 align-top">
                    Ubicación
                    <ColumnFilter placeholder="Ubicación..." value={extFilters.ubicacion} onChange={v => setExtFilters({...extFilters, ubicacion: v})} />
                  </th>
                  <th className="px-4 py-3 text-right align-top pt-8">Stock Disponible</th>
                </tr>
              </thead>
              <tbody>
                {filteredExistencias.map((item, i) => (
                  <tr key={i} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{item.articulo}</td>
                    <td className="px-4 py-3">{item.sucursal}</td>
                    <td className="px-4 py-3">{item.bodega}</td>
                    <td className="px-4 py-3">{item.ubicacion || 'N/A'}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">{Number(item.existencia ?? item.cantidad ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
                {filteredExistencias.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center py-6 text-gray-500">No se encontraron existencias.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Ingresos' && (
        <div className="animate-in fade-in duration-300 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
            <h2 className="text-lg font-bold text-gray-800 flex items-center text-blue-600">
              <Package className="w-5 h-5 mr-2" /> Historial de Ingresos de Inventario
            </h2>
            <button onClick={() => exportToExcel(filteredIngresos, 'Ingresos', 'Ingresos_Inventario')}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
              <FileDown size={14} /> Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3 align-top pt-8">Fecha</th>
                  <th className="px-4 py-3 align-top">
                    Documento
                    <ColumnFilter placeholder="Doc..." value={ingFilters.documento} onChange={v => setIngFilters({...ingFilters, documento: v})} />
                  </th>
                  <th className="px-4 py-3 align-top">
                    Tipo
                    <ColumnFilter placeholder="Tipo..." value={ingFilters.tipomovimiento} onChange={v => setIngFilters({...ingFilters, tipomovimiento: v})} />
                  </th>
                  <th className="px-4 py-3 align-top">
                    Artículo
                    <ColumnFilter placeholder="Artículo..." value={ingFilters.articulo} onChange={v => setIngFilters({...ingFilters, articulo: v})} />
                  </th>
                  <th className="px-4 py-3 align-top">
                    Sucursal
                    <ColumnFilter placeholder="Sucursal..." value={ingFilters.sucursal} onChange={v => setIngFilters({...ingFilters, sucursal: v})} />
                  </th>
                  <th className="px-4 py-3 align-top">
                    Bodega
                    <ColumnFilter placeholder="Bodega..." value={ingFilters.bodega} onChange={v => setIngFilters({...ingFilters, bodega: v})} />
                  </th>
                  <th className="px-4 py-3 text-right align-top pt-8">Cantidad In</th>
                </tr>
              </thead>
              <tbody>
                {filteredIngresos.map((item, i) => (
                  <tr key={i} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{new Date(item.fecha).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-blue-600">{item.documento}</td>
                    <td className="px-4 py-3">{item.tipomovimiento}</td>
                    <td className="px-4 py-3">{item.articulo}</td>
                    <td className="px-4 py-3 text-gray-800">{item.sucursal}</td>
                    <td className="px-4 py-3 text-gray-600">{item.bodega} <span className="text-gray-400">[{item.ubicacion}]</span></td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">+{item.cantidad.toLocaleString()}</td>
                  </tr>
                ))}
                {filteredIngresos.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-6 text-gray-500">No se encontraron ingresos.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Egresos' && (
        <div className="animate-in fade-in duration-300 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
            <h2 className="text-lg font-bold text-gray-800 flex items-center text-red-600">
              <Package className="w-5 h-5 mr-2" /> Historial de Egresos de Inventario
            </h2>
            <button onClick={() => exportToExcel(filteredEgresos, 'Egresos', 'Egresos_Inventario')}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
              <FileDown size={14} /> Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3 align-top pt-8">Fecha</th>
                  <th className="px-4 py-3 align-top">
                    Documento
                    <ColumnFilter placeholder="Doc..." value={egrFilters.documento} onChange={v => setEgrFilters({...egrFilters, documento: v})} />
                  </th>
                  <th className="px-4 py-3 align-top">
                    Tipo
                    <ColumnFilter placeholder="Tipo..." value={egrFilters.tipomovimiento} onChange={v => setEgrFilters({...egrFilters, tipomovimiento: v})} />
                  </th>
                  <th className="px-4 py-3 align-top">
                    Artículo
                    <ColumnFilter placeholder="Artículo..." value={egrFilters.articulo} onChange={v => setEgrFilters({...egrFilters, articulo: v})} />
                  </th>
                  <th className="px-4 py-3 align-top">
                    Sucursal
                    <ColumnFilter placeholder="Sucursal..." value={egrFilters.sucursal} onChange={v => setEgrFilters({...egrFilters, sucursal: v})} />
                  </th>
                  <th className="px-4 py-3 align-top">
                    Bodega
                    <ColumnFilter placeholder="Bodega..." value={egrFilters.bodega} onChange={v => setEgrFilters({...egrFilters, bodega: v})} />
                  </th>
                  <th className="px-4 py-3 text-right align-top pt-8">Cantidad Out</th>
                </tr>
              </thead>
              <tbody>
                {filteredEgresos.map((item, i) => (
                  <tr key={i} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{new Date(item.fecha).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-red-500">{item.documento}</td>
                    <td className="px-4 py-3">{item.tipomovimiento}</td>
                    <td className="px-4 py-3">{item.articulo}</td>
                    <td className="px-4 py-3 text-gray-800">{item.sucursal}</td>
                    <td className="px-4 py-3 text-gray-600">{item.bodega} <span className="text-gray-400">[{item.ubicacion}]</span></td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">-{item.cantidad.toLocaleString()}</td>
                  </tr>
                ))}
                {filteredEgresos.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-6 text-gray-500">No se encontraron egresos.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Traslados Internos' && (
        <div className="animate-in fade-in duration-300 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
            <h2 className="text-lg font-bold text-gray-800 flex items-center text-purple-600">
              <ArrowRightLeft className="w-5 h-5 mr-2" /> Movimientos Internos (Bodega a Bodega)
            </h2>
            <button onClick={() => exportToExcel(filteredTraslados, 'Traslados', 'Traslados_Inventario')}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
              <FileDown size={14} /> Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3 align-top pt-8">Fecha</th>
                  <th className="px-4 py-3 align-top">
                    Traslado N°
                    <ColumnFilter placeholder="Doc..." value={traFilters.documento} onChange={v => setTraFilters({...traFilters, documento: v})} />
                  </th>
                  <th className="px-4 py-3 align-top">
                    Artículo
                    <ColumnFilter placeholder="Artículo..." value={traFilters.articulo} onChange={v => setTraFilters({...traFilters, articulo: v})} />
                  </th>
                  <th className="px-4 py-3 align-top">
                    Desde Origen
                    <ColumnFilter placeholder="Origen..." value={traFilters.bodegaorigen} onChange={v => setTraFilters({...traFilters, bodegaorigen: v})} />
                  </th>
                  <th className="px-4 py-3 align-top">
                    Hacia Destino
                    <ColumnFilter placeholder="Destino..." value={traFilters.bodegadestino} onChange={v => setTraFilters({...traFilters, bodegadestino: v})} />
                  </th>
                  <th className="px-4 py-3 text-right align-top pt-8">Unidades Movidas</th>
                </tr>
              </thead>
              <tbody>
                {filteredTraslados.map((item, i) => (
                  <tr key={i} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{new Date(item.fecha).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-purple-600">{item.documento}</td>
                    <td className="px-4 py-3">{item.articulo}</td>
                    <td className="px-4 py-3 text-gray-600">{item.bodegaorigen} <br/><span className="text-xs text-gray-400">[{item.ubicacionorigen}]</span></td>
                    <td className="px-4 py-3 text-gray-600">{item.bodegadestino} <br/><span className="text-xs text-gray-400">[{item.ubicaciondestino}]</span></td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800">{item.cantidadmovida.toLocaleString()}</td>
                  </tr>
                ))}
                {filteredTraslados.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center py-6 text-gray-500">
                      No se encontraron movimientos internos (mismo origen y destino sucursal).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NEW TAB: AJUSTES DE INVENTARIO */}
      {activeTab === 'Ajustes' && (
        <AjustesTab filters={filters} currencySymbol={currencySymbol} formatCurrency={formatCurrency} currentUser={currentUser} />
      )}

    </div>
  );
};

/* ======================== AJUSTES TAB COMPONENT ======================== */
const AjustesTab = ({ filters, currencySymbol = '$', formatCurrency, currentUser }) => {
  const safeFormatCurrency = formatCurrency || ((val) => `${currencySymbol} ${Number(val || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const [ajustes, setAjustes] = useState([]);
  const [graficas, setGraficas] = useState({ positivos: [], negativos: [] });
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAjuste, setEditingAjuste] = useState(null);
  const [approvingAjuste, setApprovingAjuste] = useState(null);
  const [annulAjuste, setAnnulAjuste] = useState(null);
  const [selectedDetalle, setSelectedDetalle] = useState(null);
  
  // Filters
  const [filterNumero, setFilterNumero] = useState('');
  const [filterSucursal, setFilterSucursal] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterEstado, setFilterEstado] = useState('');

  const fetchAjustesData = async () => {
    setLoading(true);
    try {
      const [ajustesRes, graficasRes] = await Promise.all([
        axios.get(`${INVENTARIO_API_URL}/ajustes`, { params: filters }),
        axios.get(`${INVENTARIO_API_URL}/ajustes-graficas`, { params: filters })
      ]);
      setAjustes(Array.isArray(ajustesRes.data) ? ajustesRes.data : []);
      const g = graficasRes.data || {};
      const pos = g.positivos || g.Positivos || [];
      const neg = g.negativos || g.Negativos || [];
      setGraficas({
        positivos: Array.isArray(pos) ? pos : [],
        negativos: Array.isArray(neg) ? neg : []
      });
    } catch (e) {
      console.error("Error al cargar datos de ajustes", e);
      setAjustes([]);
      setGraficas({ positivos: [], negativos: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAjustesData();
  }, [filters]);

  const handlePrint = async (ajusteId) => {
    try {
      const res = await axios.get(`${INVENTARIO_API_URL}/ajuste-detalle/${ajusteId}`);
      const h = res.data?.header || res.data?.Header;
      const d = res.data?.detalles || res.data?.Detalles || [];
      printAjusteReceipt(h, d, currencySymbol);
    } catch (e) {
      alert("Error al cargar datos del comprobante para imprimir.");
    }
  };

  const handleVerDetalle = async (ajusteId) => {
    try {
      const res = await axios.get(`${INVENTARIO_API_URL}/ajuste-detalle/${ajusteId}`);
      setSelectedDetalle(res.data);
    } catch (e) {
      alert("Error al cargar detalles del ajuste.");
    }
  };

  const safeAjustes = Array.isArray(ajustes) ? ajustes : [];
  const filteredAjustes = safeAjustes.filter(a => {
    if (!a) return false;
    const matchNum = !filterNumero || (a.numeroajuste || a.numeroAjuste || '').toLowerCase().includes(filterNumero.toLowerCase());
    const matchSuc = !filterSucursal || (a.sucursal || '').toLowerCase().includes(filterSucursal.toLowerCase());
    const matchTipo = !filterTipo || (a.tipoajuste || a.tipoAjuste) === filterTipo;
    const matchEst = !filterEstado || (a.estado || 'BORRADOR') === filterEstado;
    return matchNum && matchSuc && matchTipo && matchEst;
  });

  const posList = Array.isArray(graficas?.positivos) ? graficas.positivos : [];
  const negList = Array.isArray(graficas?.negativos) ? graficas.negativos : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Sliders className="text-emerald-600 w-6 h-6" /> Movimientos y Ajustes de Inventario
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Registro, control de sobrantes/faltantes y trazabilidad de existencias limitadas por sucursal.
          </p>
        </div>
        <button
          onClick={() => { setEditingAjuste(null); setIsModalOpen(true); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:shadow flex items-center gap-2"
        >
          <Plus size={18} /> + Nuevo Ajuste de Inventario
        </button>
      </div>

      {/* Dual Charts Section: Positivos & Negativos Grouped by Sucursal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Positive Adjustments (Entradas / Sobrantes) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 text-base mb-1 flex items-center gap-2 text-emerald-700">
            <TrendingUp size={20} /> Ajustes Positivos (Entradas / Sobrantes por Sucursal)
          </h3>
          <p className="text-xs text-gray-500 mb-4">Cantidad total de existencias incrementadas por ajuste agrupadas por sucursal.</p>
          <div className="h-64">
            {posList.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sin datos de entradas por ajuste</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={posList}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="sucursal" />
                  <YAxis />
                  <Tooltip formatter={(val) => [Number(val).toLocaleString(), 'Unidades Sobrantes']} />
                  <Bar dataKey="cantidadtotalajustada" name="Unidades Entrada" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Negative Adjustments (Salidas / Faltantes) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 text-base mb-1 flex items-center gap-2 text-rose-700">
            <TrendingDown size={20} /> Ajustes Negativos (Salidas / Faltantes por Sucursal)
          </h3>
          <p className="text-xs text-gray-500 mb-4">Cantidad total de existencias disminuidas por ajuste agrupadas por sucursal.</p>
          <div className="h-64">
            {negList.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sin datos de salidas por ajuste</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={negList}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="sucursal" />
                  <YAxis />
                  <Tooltip formatter={(val) => [Number(val).toLocaleString(), 'Unidades Faltantes']} />
                  <Bar dataKey="cantidadtotalajustada" name="Unidades Salida" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Adjustments Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-base">Historial de Ajustes Registrados</h3>
          <span className="text-xs bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded-full">
            {filteredAjustes.length} Registros
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">
                  <div>N° Ajuste</div>
                  <input
                    type="text"
                    placeholder="Filtro..."
                    value={filterNumero}
                    onChange={e => setFilterNumero(e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded px-2 py-0.5 text-xs font-normal bg-white"
                  />
                </th>
                <th className="px-4 py-3 align-top pt-3">Fecha</th>
                <th className="px-4 py-3">
                  <div>Sucursal</div>
                  <input
                    type="text"
                    placeholder="Filtro..."
                    value={filterSucursal}
                    onChange={e => setFilterSucursal(e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded px-2 py-0.5 text-xs font-normal bg-white"
                  />
                </th>
                <th className="px-4 py-3">
                  <div>Estado</div>
                  <select
                    value={filterEstado}
                    onChange={e => setFilterEstado(e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded px-2 py-0.5 text-xs font-normal bg-white"
                  >
                    <option value="">Todos</option>
                    <option value="BORRADOR">BORRADOR</option>
                    <option value="APROBADO">APROBADO</option>
                    <option value="ANULADO">ANULADO</option>
                  </select>
                </th>
                <th className="px-4 py-3">
                  <div>Tipo</div>
                  <select
                    value={filterTipo}
                    onChange={e => setFilterTipo(e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded px-2 py-0.5 text-xs font-normal bg-white"
                  >
                    <option value="">Todos</option>
                    <option value="ENTRADA">ENTRADA</option>
                    <option value="SALIDA">SALIDA</option>
                    <option value="MIXTO">MIXTO</option>
                  </select>
                </th>
                <th className="px-4 py-3 align-top pt-3 text-center">Ítems</th>
                <th className="px-4 py-3 align-top pt-3 text-right">Costo Total</th>
                <th className="px-4 py-3 align-top pt-3">Usuario / Concepto</th>
                <th className="px-4 py-3 align-top pt-3 text-center w-48">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAjustes.map(a => (
                <tr key={a.id} className={`hover:bg-gray-50 ${a.estado === 'ANULADO' ? 'opacity-60 bg-rose-50/20' : ''}`}>
                  <td className={`px-4 py-3 font-mono font-bold ${a.estado === 'ANULADO' ? 'line-through text-rose-600' : 'text-emerald-700'}`}>
                    {a.numeroajuste}
                  </td>
                  <td className="px-4 py-3">{new Date(a.fecha).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{a.sucursal || 'N/A'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      a.estado === 'APROBADO' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                      a.estado === 'ANULADO' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                      'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {a.estado || 'BORRADOR'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      a.tipoajuste === 'ENTRADA' ? 'bg-emerald-100 text-emerald-700' :
                      a.tipoajuste === 'SALIDA' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {a.tipoajuste}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold">{a.totalarticulos}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-800">
                    {safeFormatCurrency(a.costototal)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-semibold text-gray-800">{a.usuario || 'Sistema'}</div>
                    {a.usuarioaprobo && <div className="text-[10px] text-emerald-700 font-bold">Aprobado por: {a.usuarioaprobo}</div>}
                    <div className="text-xs text-gray-400 truncate max-w-xs">{a.concepto}</div>
                  </td>
                  <td className="px-4 py-3 text-center space-x-1.5 whitespace-nowrap">
                    {a.estado === 'BORRADOR' && (
                      <>
                        <button
                          onClick={() => { setEditingAjuste(a); setIsModalOpen(true); }}
                          className="p-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                          title="Editar Borrador"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => {
                            if (currentUser && !currentUser.IsAdmin) {
                              alert("Acceso denegado: Su usuario no tiene permisos de Administrador para aprobar ajustes de inventario.");
                              return;
                            }
                            setApprovingAjuste(a);
                          }}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                          title="Aprobar Ajuste (Requiere Contraseña de Administrador)"
                        >
                          <CheckCircle size={15} />
                        </button>
                      </>
                    )}
                    {a.estado !== 'ANULADO' && (
                      <button
                        onClick={() => setAnnulAjuste(a)}
                        className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                        title={a.estado === 'APROBADO' ? 'Anular Ajuste Aprobado (Requiere Contraseña y Revisa Stock)' : 'Anular Borrador'}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => handleVerDetalle(a.id)}
                      className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors"
                      title="Ver detalle"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={() => handlePrint(a.id)}
                      className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold transition-colors"
                      title="Imprimir Comprobante"
                    >
                      <Printer size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredAjustes.length === 0 && (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-gray-400">
                    No hay ajustes de inventario registrados para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Crear / Editar Ajuste */}
      {isModalOpen && (
        <NuevoAjusteModal
          editingAjuste={editingAjuste}
          currencySymbol={currencySymbol}
          formatCurrency={safeFormatCurrency}
          onClose={() => { setIsModalOpen(false); setEditingAjuste(null); }}
          onSuccess={() => { setIsModalOpen(false); setEditingAjuste(null); fetchAjustesData(); }}
        />
      )}

      {/* Modal para Aprobar Ajuste con Contraseña */}
      {approvingAjuste && (
        <AprobarAjusteModal
          ajuste={approvingAjuste}
          currencySymbol={currencySymbol}
          onClose={() => setApprovingAjuste(null)}
          onSuccess={() => { setApprovingAjuste(null); fetchAjustesData(); }}
        />
      )}

      {/* Modal para Anular Ajuste */}
      {annulAjuste && (
        <AnularAjusteModal
          ajuste={annulAjuste}
          onClose={() => setAnnulAjuste(null)}
          onSuccess={() => { setAnnulAjuste(null); fetchAjustesData(); }}
        />
      )}

      {/* Modal para Ver Detalle */}
      {selectedDetalle && (
        <DetalleAjusteModal
          currencySymbol={currencySymbol}
          formatCurrency={safeFormatCurrency}
          data={selectedDetalle}
          onClose={() => setSelectedDetalle(null)}
          onPrint={() => handlePrint(selectedDetalle.header.id)}
        />
      )}
    </div>
  );
};

/* ======================== ANULAR AJUSTE MODAL ======================== */
const AnularAjusteModal = ({ ajuste, onClose, onSuccess }) => {
  const [usuarios, setUsuarios] = useState([]);
  const [selectedUsuario, setSelectedUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const esAprobado = ajuste.estado === 'APROBADO';

  useEffect(() => {
    if (esAprobado) {
      axios.get(`${INVENTARIO_API_URL}/usuarios-activos`)
        .then(res => setUsuarios(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
    }
  }, [esAprobado]);

  const handleAnular = async (e) => {
    e.preventDefault();
    if (esAprobado) {
      if (!selectedUsuario) { setError('Debe seleccionar el usuario autorizador.'); return; }
      if (!password) { setError('Debe ingresar la contraseña del autorizador.'); return; }
    }
    if (!motivo.trim()) { setError('Debe especificar el motivo de la anulación.'); return; }

    setLoading(true);
    setError('');

    try {
      const payload = {
        AjusteId: Number(ajuste.id),
        UsuarioId: selectedUsuario ? Number(selectedUsuario) : null,
        Password: password || null,
        Motivo: motivo
      };

      await axios.post(`${INVENTARIO_API_URL}/anular-ajuste`, payload);
      alert('Ajuste de inventario anulado correctamente.');
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.Error || err.response?.data?.error || err.response?.data?.message || 'Error al anular el ajuste. Verifique sus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        <div className="bg-rose-700 text-white p-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Anular Ajuste de Inventario
            </h2>
            <p className="text-xs text-rose-100 mt-0.5">
              N° {ajuste.numeroajuste || ajuste.numeroAjuste} ({ajuste.estado})
            </p>
          </div>
          <button onClick={onClose} className="text-rose-100 hover:text-white text-lg font-bold">✕</button>
        </div>

        <form onSubmit={handleAnular} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              ⚠️ {error}
            </div>
          )}

          {esAprobado ? (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl font-medium">
              ⚠️ <strong>Atención:</strong> Este ajuste está <strong>APROBADO</strong>. Al anularlo se revertirán automáticamente las existencias físicas en el inventario y se requerirá la <strong>contraseña de autorización</strong>.
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl">
              Este ajuste está en estado <strong>BORRADOR</strong>. Se marcará como ANULADO sin afectar existencias físicas.
            </div>
          )}

          {esAprobado && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                  USUARIO AUTORIZADOR *
                </label>
                <select
                  value={selectedUsuario}
                  onChange={e => setSelectedUsuario(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none"
                  required
                >
                  <option value="">-- Seleccionar Autorizador --</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.fullname} ({u.username})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                  CONTRASEÑA DE AUTORIZADOR *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Ingrese su contraseña..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-rose-500 outline-none"
                  required
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
              MOTIVO DE ANULACIÓN *
            </label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Describa la razón por la cual se anula este ajuste..."
              className="w-full border border-slate-200 rounded-xl p-3 text-xs bg-white focus:ring-2 focus:ring-rose-500 outline-none h-20 resize-none"
              required
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md hover:shadow transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? 'Procesando...' : '🚫 Confirmar Anulación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ======================== ITEM SEARCH SELECT COMPONENT ======================== */
const ItemSearchSelect = ({ item, index, handleItemChange }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  // Debounced Live Search against Backend API
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await axios.get(`${INVENTARIO_API_URL}/articulos-list`, {
          params: { query: query || '' }
        });
        setResults(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("Error al buscar artículos", e);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Sync text if item was selected or loaded from draft
  useEffect(() => {
    if (item?.articuloId) {
      if (item.articuloCodigo || item.articuloNombre) {
        setQuery(`${item.articuloCodigo ? item.articuloCodigo + ' - ' : ''}${item.articuloNombre || ''}`.trim());
      } else if (!query) {
        axios.get(`${INVENTARIO_API_URL}/articulos-list`, { params: { query: String(item.articuloId) } })
          .then(res => {
            const found = res.data?.find(a => String(a.id) === String(item.articuloId));
            if (found) setQuery(`${found.codigo} - ${found.descripcion}`);
          })
          .catch(() => {});
      }
    }
  }, [item?.articuloId, item?.articuloCodigo, item?.articuloNombre]);

  return (
    <div className="relative w-full min-w-[240px]">
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 absolute left-2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          placeholder="Buscar código o nombre (Ej: AGDDC)..."
          onFocus={() => {
            setIsOpen(true);
            if (results.length === 0) {
              axios.get(`${INVENTARIO_API_URL}/articulos-list`, { params: { query: query || '' } })
                .then(res => setResults(res.data || []));
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (!e.target.value) {
              handleItemChange(index, 'articuloId', '');
            }
          }}
          className="w-full pl-7 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none truncate"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              handleItemChange(index, 'articuloId', '');
              setIsOpen(true);
            }}
            className="absolute right-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-[360px] bg-white border border-slate-300 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto divide-y divide-slate-100">
            {searching ? (
              <div className="p-3 text-xs text-slate-500 text-center animate-pulse">Buscando en catálogo...</div>
            ) : results.length > 0 ? (
              results.map(a => (
                <div
                  key={a.id}
                  onClick={() => {
                    handleItemChange(index, 'articuloId', a.id);
                    setQuery(`${a.codigo} - ${a.descripcion}`);
                    setIsOpen(false);
                  }}
                  className={`p-2.5 hover:bg-emerald-50 cursor-pointer text-xs transition-colors ${
                    String(item.articuloId) === String(a.id) ? 'bg-emerald-50 font-bold border-l-4 border-emerald-600' : ''
                  }`}
                >
                  <div className="font-bold text-emerald-800 font-mono">{a.codigo}</div>
                  <div className="text-slate-700 text-[11px] truncate">{a.descripcion}</div>
                </div>
              ))
            ) : (
              <div className="p-3 text-xs text-slate-400 text-center">
                No se encontraron artículos para "{query}"
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

/* ======================== APROBAR AJUSTE MODAL ======================== */
const AprobarAjusteModal = ({ ajuste, onClose, onSuccess, currencySymbol }) => {
  const [usuarios, setUsuarios] = useState([]);
  const [selectedUsuario, setSelectedUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${INVENTARIO_API_URL}/usuarios-activos`)
      .then(res => setUsuarios(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const handleAprobar = async (e) => {
    e.preventDefault();
    if (!selectedUsuario) { setError('Debe seleccionar el usuario autorizador.'); return; }
    if (!password) { setError('Debe ingresar la contraseña del autorizador.'); return; }

    setLoading(true);
    setError('');

    try {
      const payload = {
        AjusteId: Number(ajuste.id),
        UsuarioId: Number(selectedUsuario),
        Password: password
      };

      const res = await axios.post(`${INVENTARIO_API_URL}/aprobar-ajuste`, payload);
      alert('Ajuste aprobado correctamente. Existencias actualizadas en el inventario.');

      if (res.data.Header && res.data.Detalles) {
        printAjusteReceipt(res.data.Header, res.data.Detalles, currencySymbol);
      }

      onSuccess();
    } catch (err) {
      setError(err.response?.data?.Error || 'Error al aprobar el ajuste. Verifique sus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        <div className="bg-emerald-700 text-white p-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> Aprobar Ajuste de Inventario
            </h2>
            <p className="text-xs text-emerald-100 mt-0.5">N° {ajuste.numeroajuste || ajuste.numeroAjuste}</p>
          </div>
          <button onClick={onClose} className="text-emerald-100 hover:text-white text-lg font-bold">✕</button>
        </div>

        <form onSubmit={handleAprobar} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              ⚠️ {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
              USUARIO QUE APRUEBA *
            </label>
            <select
              value={selectedUsuario}
              onChange={e => setSelectedUsuario(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            >
              <option value="">-- Seleccionar Autorizador --</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>{u.fullname} ({u.username})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
              CONTRASEÑA DE AUTORIZADOR *
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Ingrese su contraseña..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md hover:shadow transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? 'Verificando...' : '✔ Aprobar y Actualizar Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ======================== NUEVO / EDITAR AJUSTE MODAL ======================== */
const NuevoAjusteModal = ({ editingAjuste, onClose, onSuccess, currencySymbol, formatCurrency }) => {
  const [sucursales, setSucursales] = useState([]);
  const [selectedSucursal, setSelectedSucursal] = useState('');
  const [concepto, setConcepto] = useState('Ajuste de inventario por conteo físico');
  const [usuarios, setUsuarios] = useState([]);
  const [selectedUsuario, setSelectedUsuario] = useState('');
  
  const [articulosList, setArticulosList] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [items, setItems] = useState([
    {
      articuloId: '',
      bodegaId: '',
      ubicacionId: '',
      ubicaciones: [],
      cantidadAnterior: 0,
      tipoMovimiento: 'ENTRADA',
      cantidadAjuste: 0,
      cantidadNueva: 0,
      costoUnitario: 0,
      costoTotal: 0,
      observacion: ''
    }
  ]);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [sucRes, userRes, artRes] = await Promise.all([
          axios.get(`${INVENTARIO_API_URL}/sucursales`),
          axios.get(`${INVENTARIO_API_URL}/usuarios-activos`),
          axios.get(`${INVENTARIO_API_URL}/articulos-list`)
        ]);
        setSucursales(sucRes.data);
        setUsuarios(userRes.data);
        setArticulosList(artRes.data);

        if (editingAjuste) {
          const detailRes = await axios.get(`${INVENTARIO_API_URL}/ajuste-detalle/${editingAjuste.id}`);
          const h = detailRes.data.Header || detailRes.data.header;
          const d = detailRes.data.Detalles || detailRes.data.detalles;

          const sucursalIdVal = h ? (h.sucursalid || h.SucursalId || h.sucursalId || h.sucursal_id) : (editingAjuste.sucursal_id || editingAjuste.sucursalId || editingAjuste.sucursalid);
          setSelectedSucursal(sucursalIdVal || '');
          setConcepto(h?.concepto || h?.Concepto || editingAjuste.concepto || '');
          if (h?.usuarioid || h?.UsuarioId || h?.usuarioId || h?.usuario_id || editingAjuste.usuario_id || editingAjuste.usuarioid) {
            setSelectedUsuario(h?.usuarioid || h?.UsuarioId || h?.usuarioId || h?.usuario_id || editingAjuste.usuario_id || editingAjuste.usuarioid);
          }

          if (d && d.length > 0) {
            const mappedItems = await Promise.all(d.map(async (it) => {
              const artId = it.articuloid ?? it.ArticuloId ?? it.articuloId ?? it.articulo_id;
              const bodId = it.bodegaid ?? it.BodegaId ?? it.bodegaId ?? it.bodega_id;
              const ubiId = it.ubicacionid ?? it.UbicacionId ?? it.ubicacionId ?? it.ubicacion_id ?? '';

              let ubicaciones = [];
              if (artId && sucursalIdVal && bodId) {
                try {
                  const ubiRes = await axios.get(`${INVENTARIO_API_URL}/ubicaciones-disponibles`, {
                    params: { articuloId: artId, sucursalId: sucursalIdVal, bodegaId: bodId }
                  });
                  ubicaciones = ubiRes.data || [];
                } catch (e) {
                  console.error("Error al cargar ubicaciones al editar borrador", e);
                }
              }

              const cantAjRaw = Number(it.cantidadajuste ?? it.CantidadAjuste ?? it.cantidadAjuste ?? it.cantidad_ajuste ?? 0);
              const cantAnterior = Number(it.cantidadanterior ?? it.CantidadAnterior ?? it.cantidadAnterior ?? it.cantidad_anterior ?? 0);
              const tipoMov = (it.tipomovimiento || it.TipoMovimiento || it.tipoMovimiento || it.tipo_movimiento) === 'SALIDA' || cantAjRaw < 0 ? 'SALIDA' : 'ENTRADA';
              const cantAjAbs = Math.abs(cantAjRaw);
              const cantNueva = Number(it.cantidadnueva ?? it.CantidadNueva ?? it.cantidadNueva ?? it.cantidad_nueva ?? (tipoMov === 'SALIDA' ? cantAnterior - cantAjAbs : cantAnterior + cantAjAbs));
              const costoU = Number(it.costounitario ?? it.CostoUnitario ?? it.costoUnitario ?? it.costo_unitario ?? 0);
              const costoT = Number(it.costototal ?? it.CostoTotal ?? it.costoTotal ?? it.costo_total ?? (cantAjAbs * costoU));

              const artCodigo = it.articulocodigo || it.ArticuloCodigo || '';
              const artNombre = it.articulonombre || it.ArticuloNombre || '';

              return {
                articuloId: artId,
                articuloCodigo: artCodigo,
                articuloNombre: artNombre,
                bodegaId: bodId,
                ubicacionId: ubiId,
                ubicaciones,
                cantidadAnterior: cantAnterior,
                tipoMovimiento: tipoMov,
                cantidadAjuste: cantAjAbs,
                cantidadNueva: cantNueva,
                costoUnitario: costoU,
                costoTotal: costoT,
                observacion: it.observacion || it.Observacion || ''
              };
            }));

            setItems(mappedItems);
          }
        } else {
          if (sucRes.data.length > 0) setSelectedSucursal(sucRes.data[0].id);
          if (userRes.data.length > 0) setSelectedUsuario(userRes.data[0].id);
        }
      } catch (e) {
        console.error("Error al cargar catalogos para ajuste", e);
      }
    };
    loadLookups();
  }, [editingAjuste]);

  useEffect(() => {
    if (!selectedSucursal) return;
    const fetchBodegas = async () => {
      try {
        const res = await axios.get(`${INVENTARIO_API_URL}/bodegas-sucursal`, { params: { sucursalId: selectedSucursal } });
        setBodegas(res.data);
      } catch (e) {
        console.error("Error al cargar bodegas de la sucursal", e);
      }
    };
    fetchBodegas();
  }, [selectedSucursal]);

  const handleItemChange = async (index, field, value) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };

    // If changing Bodega or Articulo, load available Ubicaciones for this item/branch/bodega
    if (['articuloId', 'bodegaId'].includes(field)) {
      const artId = field === 'articuloId' ? value : item.articuloId;
      const bodId = field === 'bodegaId' ? value : item.bodegaId;

      if (artId && selectedSucursal && bodId) {
        try {
          const ubiRes = await axios.get(`${INVENTARIO_API_URL}/ubicaciones-disponibles`, {
            params: {
              articuloId: artId,
              sucursalId: selectedSucursal,
              bodegaId: bodId
            }
          });
          item.ubicaciones = ubiRes.data;
          if (!ubiRes.data.some(u => String(u.id) === String(item.ubicacionId))) {
            item.ubicacionId = ubiRes.data.length > 0 ? ubiRes.data[0].id : '';
          }
        } catch (e) {
          console.error("Error al cargar ubicaciones disponibles para ítem", e);
        }
      } else if (field === 'bodegaId' && value) {
        try {
          const res = await axios.get(`${INVENTARIO_API_URL}/ubicaciones-bodega`, { params: { bodegaId: value } });
          item.ubicaciones = res.data;
          item.ubicacionId = res.data.length > 0 ? res.data[0].id : '';
        } catch (e) {
          console.error("Error al cargar ubicaciones", e);
        }
      }
    }

    // Recalculate stock anterior if articuloId, sucursal, bodega, or ubicacion changes
    if (['articuloId', 'bodegaId', 'ubicacionId'].includes(field)) {
      const artId = field === 'articuloId' ? value : item.articuloId;
      const bodId = field === 'bodegaId' ? value : item.bodegaId;
      const ubiId = field === 'ubicacionId' ? value : item.ubicacionId;

      if (artId && selectedSucursal && bodId) {
        try {
          const res = await axios.get(`${INVENTARIO_API_URL}/articulo-existencia`, {
            params: {
              articuloId: artId,
              sucursalId: selectedSucursal,
              bodegaId: bodId,
              ubicacionId: ubiId || null
            }
          });
          item.cantidadAnterior = Number(res.data.existencia || 0);
        } catch (e) {
          console.error("Error al obtener stock actual", e);
        }
      }
    }

    // Calculate cantidadNueva and costoTotal
    const cantAj = Math.abs(Number(item.cantidadAjuste || 0));
    const factor = item.tipoMovimiento === 'SALIDA' ? -1 : 1;
    const finalAj = cantAj * factor;

    item.cantidadNueva = item.cantidadAnterior + finalAj;
    item.costoTotal = cantAj * Number(item.costoUnitario || 0);

    newItems[index] = item;
    setItems(newItems);
  };

  const addItemRow = () => {
    setItems([
      ...items,
      {
        articuloId: '',
        bodegaId: bodegas.length > 0 ? bodegas[0].id : '',
        ubicacionId: '',
        ubicaciones: [],
        cantidadAnterior: 0,
        tipoMovimiento: 'ENTRADA',
        cantidadAjuste: 0,
        cantidadNueva: 0,
        costoUnitario: 0,
        costoTotal: 0,
        observacion: ''
      }
    ]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (esBorrador = true) => {
    if (!selectedSucursal) { setError('Debe seleccionar una sucursal.'); return; }
    if (items.some(it => !it.articuloId)) { setError('Todos los renglones deben tener un artículo seleccionado.'); return; }
    if (items.some(it => Number(it.cantidadAjuste) <= 0)) { setError('La cantidad a ajustar debe ser mayor a 0.'); return; }

    setLoading(true);
    setError('');

    try {
      const payload = {
        Fecha: new Date().toISOString().split('T')[0],
        SucursalId: Number(selectedSucursal),
        Concepto: concepto,
        UsuarioId: selectedUsuario ? Number(selectedUsuario) : null,
        EsBorrador: esBorrador,
        Detalles: items.map(it => {
          const cantAj = Math.abs(Number(it.cantidadAjuste));
          const factor = it.tipoMovimiento === 'SALIDA' ? -1 : 1;
          return {
            ArticuloId: Number(it.articuloId),
            BodegaId: Number(it.bodegaId),
            UbicacionId: it.ubicacionId ? Number(it.ubicacionId) : null,
            CantidadAnterior: Number(it.cantidadAnterior),
            CantidadAjuste: cantAj * factor,
            CantidadNueva: Number(it.cantidadNueva),
            CostoUnitario: Number(it.costoUnitario || 0),
            Observacion: it.observacion
          };
        })
      };

      if (editingAjuste) {
        await axios.put(`${INVENTARIO_API_URL}/actualizar-ajuste/${editingAjuste.id}`, payload);
        alert('Borrador de ajuste actualizado correctamente.');
      } else {
        const res = await axios.post(`${INVENTARIO_API_URL}/crear-ajuste`, payload);
        alert(esBorrador ? 'Ajuste guardado como Borrador.' : 'Ajuste guardado y aprobado correctamente.');

        if (!esBorrador && res.data.Header && res.data.Detalles) {
          printAjusteReceipt(res.data.Header, res.data.Detalles, currencySymbol);
        }
      }

      onSuccess();
    } catch (err) {
      setError(err.response?.data?.Error || 'Error al registrar el ajuste de inventario');
    } finally {
      setLoading(false);
    }
  };

  const totalCostoGlobal = items.reduce((sum, i) => sum + (Number(i.costoTotal) || 0), 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden border border-slate-100 my-8 animate-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="bg-emerald-800 text-white p-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sliders className="w-5 h-5" /> {editingAjuste ? `Editar Borrador de Ajuste (N° ${editingAjuste.numeroajuste})` : 'Nuevo Ajuste de Inventario (Entradas / Salidas)'}
            </h2>
            <p className="text-xs text-emerald-100 mt-0.5">Moneda activa: <strong>Córdobas (C$)</strong></p>
          </div>
          <button onClick={onClose} className="text-emerald-100 hover:text-white text-xl font-bold">✕</button>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-semibold flex items-center gap-2">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {/* Form Top Controls */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">SUCURSAL OBLIGATORIA *</label>
              <select
                value={selectedSucursal}
                onChange={e => setSelectedSucursal(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-semibold text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              >
                <option value="">-- Seleccionar Sucursal --</option>
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">USUARIO SOLICITANTE / AUTORIZADOR</label>
              <select
                value={selectedUsuario}
                onChange={e => setSelectedUsuario(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">-- Seleccionar Usuario --</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.fullname} ({u.username})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">CONCEPTO / MOTIVO *</label>
              <input
                type="text"
                value={concepto}
                onChange={e => setConcepto(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Ej: Conteo físico mensual, Merma, Faltante"
                required
              />
            </div>
          </div>

          {/* Dynamic Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-700 text-sm">Detalle de Ítems a Ajustar</h3>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
              >
                <Plus size={14} /> Agregar Ítem
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl pb-40">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase">
                  <tr>
                    <th className="p-2.5 min-w-[240px]">Artículo (Búsqueda por Filtro)</th>
                    <th className="p-2.5 min-w-[140px]">Bodega</th>
                    <th className="p-2.5 min-w-[130px]">Ubicación (Filtrada por Ítem)</th>
                    <th className="p-2.5 text-right w-20">Stock Ant.</th>
                    <th className="p-2.5 min-w-[110px]">Tipo Ajuste</th>
                    <th className="p-2.5 text-right w-24">Cantidad</th>
                    <th className="p-2.5 text-right w-20">Stock Nuevo</th>
                    <th className="p-2.5 text-right w-24">Costo Unit. ({currencySymbol})</th>
                    <th className="p-2.5 text-right w-24">Total ({currencySymbol})</th>
                    <th className="p-2.5 text-center w-12">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2">
                        <ItemSearchSelect
                          item={it}
                          index={idx}
                          handleItemChange={handleItemChange}
                        />
                      </td>

                      <td className="p-2">
                        <select
                          value={it.bodegaId}
                          onChange={e => handleItemChange(idx, 'bodegaId', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                          required
                        >
                          <option value="">-- Bodega --</option>
                          {bodegas.map(b => (
                            <option key={b.id} value={b.id}>{b.descripcion}</option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2">
                        <select
                          value={it.ubicacionId}
                          onChange={e => handleItemChange(idx, 'ubicacionId', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-emerald-500 outline-none font-medium text-emerald-900"
                        >
                          <option value="">Sin Ubicación</option>
                          {it.ubicaciones.map(u => (
                            <option key={u.id} value={u.id}>{u.nivel1 || u.nivel_1}</option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2 text-right font-bold text-slate-500">
                        {Number(it.cantidadAnterior).toLocaleString()}
                      </td>

                      <td className="p-2">
                        <select
                          value={it.tipoMovimiento}
                          onChange={e => handleItemChange(idx, 'tipoMovimiento', e.target.value)}
                          className={`w-full border rounded px-2 py-1 font-bold focus:ring-1 focus:ring-emerald-500 outline-none ${
                            it.tipoMovimiento === 'ENTRADA' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200'
                          }`}
                        >
                          <option value="ENTRADA">(+) Entrada / Sobrante</option>
                          <option value="SALIDA">(-) Salida / Faltante</option>
                        </select>
                      </td>

                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={it.cantidadAjuste}
                          onChange={e => handleItemChange(idx, 'cantidadAjuste', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-right font-bold focus:ring-1 focus:ring-emerald-500 outline-none"
                          required
                        />
                      </td>

                      <td className="p-2 text-right font-bold text-slate-800">
                        {Number(it.cantidadNueva).toLocaleString()}
                      </td>

                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.costoUnitario}
                          onChange={e => handleItemChange(idx, 'costoUnitario', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-right focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                      </td>

                      <td className="p-2 text-right font-bold text-slate-700">
                        {formatCurrency(it.costoTotal)}
                      </td>

                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          disabled={items.length === 1}
                          className="text-rose-500 hover:text-rose-700 disabled:opacity-30 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-500 font-semibold">Total Ítems: <strong>{items.length}</strong></span>
              <span className="text-xs text-slate-500 font-semibold">Costo Total: <strong className="text-emerald-700 text-sm">{formatCurrency(totalCostoGlobal)}</strong></span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={loading}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-60 flex items-center gap-1.5"
              >
                <Save size={15} /> {editingAjuste ? 'Guardar Borrador' : 'Guardar como Borrador'}
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-60 flex items-center gap-1.5"
              >
                <CheckCircle size={15} /> {editingAjuste ? 'Guardar y Aprobar' : '✓ Finalizar y Aprobar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ======================== DETALLE AJUSTE MODAL ======================== */
const DetalleAjusteModal = ({ data, onClose, onPrint, currencySymbol, formatCurrency }) => {
  const { header, detalles } = data;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-slate-700 to-slate-800 text-white">
          <div className="flex items-center gap-2">
            <Eye size={20} />
            <h2 className="text-base font-bold">Detalle del Ajuste N° {header.numeroajuste}</h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-sm text-slate-600">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div><span className="text-xs text-slate-400 font-bold uppercase block">Fecha</span> {new Date(header.fecha).toLocaleDateString()}</div>
            <div><span className="text-xs text-slate-400 font-bold uppercase block">Sucursal</span> {header.sucursal}</div>
            <div><span className="text-xs text-slate-400 font-bold uppercase block">Tipo</span> <strong className="text-emerald-700">{header.tipoajuste}</strong></div>
            <div><span className="text-xs text-slate-400 font-bold uppercase block">Usuario</span> {header.usuario || 'Sistema'}</div>
            <div className="col-span-2 md:col-span-4"><span className="text-xs text-slate-400 font-bold uppercase block">Concepto</span> {header.concepto}</div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase">
                <tr>
                  <th className="p-2.5">Código</th>
                  <th className="p-2.5">Artículo</th>
                  <th className="p-2.5">Bodega / Ubicación</th>
                  <th className="p-2.5 text-right">Stock Ant.</th>
                  <th className="p-2.5 text-right">Ajuste</th>
                  <th className="p-2.5 text-right">Stock Nuevo</th>
                  <th className="p-2.5 text-right">Costo Unit. ({currencySymbol})</th>
                  <th className="p-2.5 text-right">Total ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detalles.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold text-slate-700">{d.articulocodigo}</td>
                    <td className="p-2.5 font-medium text-slate-900">{d.articulanombre}</td>
                    <td className="p-2.5">{d.bodeganombre} / {d.ubicacionnombre || 'N/A'}</td>
                    <td className="p-2.5 text-right font-bold">{Number(d.cantidadanterior).toLocaleString()}</td>
                    <td className={`p-2.5 text-right font-bold ${Number(d.cantidadajuste) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {Number(d.cantidadajuste) >= 0 ? '+' : ''}{Number(d.cantidadajuste).toLocaleString()}
                    </td>
                    <td className="p-2.5 text-right font-bold text-slate-800">{Number(d.cantidadnueva).toLocaleString()}</td>
                    <td className="p-2.5 text-right">{formatCurrency(d.costounitario)}</td>
                    <td className="p-2.5 text-right font-bold text-slate-800">{formatCurrency(d.costototal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <span className="font-bold text-slate-700">Costo Total: <strong className="text-emerald-700 text-base">{formatCurrency(header.costototal)}</strong></span>
          <div className="flex gap-3">
            <button onClick={onClose} className="border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-white">Cerrar</button>
            <button onClick={onPrint} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
              <Printer size={16} /> Imprimir Comprobante
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inventario;
