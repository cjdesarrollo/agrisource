import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell 
} from 'recharts';
import { TrendingUp, Percent, Users, FileWarning, CreditCard, Banknote, Download, Search, Briefcase, FileText, Printer, Calendar, Building2, Layers, Clock, CheckCircle2, FileSpreadsheet, Tag, DollarSign, RotateCcw, Undo2, CheckCircle, RefreshCw, AlertTriangle, AlertCircle, Eye, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import logoImg from '../assets/logo.jpg';

import LoadingScreen from '../components/LoadingScreen';

const API_BASE_URL = import.meta.env.VITE_API_URL;
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const getCondicionColor = (tipoventa, index) => {
  if (!tipoventa) return COLORS[index % COLORS.length];
  if (tipoventa === 'Contado') return '#10B981'; // green
  if (tipoventa.includes('15')) return '#6366F1'; // indigo
  if (tipoventa.includes('30')) return '#3B82F6'; // blue
  if (tipoventa.includes('60')) return '#F59E0B'; // amber
  if (tipoventa.includes('90')) return '#EF4444'; // red
  return COLORS[index % COLORS.length];
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const datePart = dateString.split('T')[0];
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO', minimumFractionDigits: 2 })
    .format(amount || 0)
    .replace('NIO', 'C$');
};

const printDevolucionReceipt = (header, detalles, currencySymbol = 'C$') => {
  const printWindow = window.open('', '_blank', 'width=900,height=750');
  if (!printWindow) {
    alert('Permita las ventanas emergentes para imprimir el comprobante.');
    return;
  }

  const isNotaCredito = (header.tiporeintegro || header.tipoReintegro) === 'NOTA_CREDITO';
  const docTitle = isNotaCredito ? 'NOTA DE CRÉDITO A FAVOR DEL CLIENTE' : 'RECIBO DE REINTEGRO EN EFECTIVO';
  const docNum = isNotaCredito ? (header.numeronotacredito || header.numeroNotaCredito || header.numerodevolucion || header.numeroDevolucion) : (header.numerodevolucion || header.numeroDevolucion);

  const detallesHtml = (detalles || []).map((d, index) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${index + 1}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace; font-weight: bold;">${d.articulocodigo || d.articuloCodigo || 'N/A'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${d.articulanombre || d.articuloNombre || ''}</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${d.bodeganombre || d.bodegaNombre || ''} / ${d.ubicacionnombre || d.ubicacionNombre || 'N/A'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${Number(d.cantidad).toLocaleString()}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${currencySymbol} ${Number(d.preciounitario || d.precioUnitario || 0).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; color: #DC2626;">-${currencySymbol} ${Number(d.descuento || 0).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${currencySymbol} ${Number(d.subtotal || d.subTotal || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${docTitle} - ${docNum}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 25px; color: #1e293b; line-height: 1.5; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
        .company-name { font-size: 22px; font-weight: 900; color: #1e3a8a; letter-spacing: -0.5px; }
        .company-sub { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
        .doc-badge { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 8px 16px; border-radius: 8px; text-align: right; }
        .doc-type { font-size: 13px; font-weight: 800; text-transform: uppercase; }
        .doc-num { font-size: 18px; font-weight: 900; font-family: monospace; }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 13px; }
        .info-item { display: flex; gap: 8px; }
        .info-label { font-weight: 700; color: #475569; width: 140px; }
        .info-val { font-weight: 600; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
        th { background: #1e3a8a; color: white; padding: 10px; text-align: left; text-transform: uppercase; font-size: 11px; font-weight: 700; }
        .totals-table { width: 320px; margin-left: auto; margin-bottom: 30px; font-size: 13px; }
        .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
        .totals-row.grand-total { border-top: 2px solid #1e3a8a; border-bottom: 2px solid #1e3a8a; font-weight: 900; font-size: 15px; color: #1e3a8a; padding: 10px 0; }
        .signatures { display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; margin-top: 60px; text-align: center; }
        .sig-line { border-top: 1.5px dashed #94a3b8; margin-top: 50px; padding-top: 8px; font-size: 12px; font-weight: 700; color: #475569; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="company-name">AGRISOURCE S.A.</div>
          <div class="company-sub">Sistema Integral de Control WMS & Ventas</div>
        </div>
        <div class="doc-badge">
          <div class="doc-type">${docTitle}</div>
          <div class="doc-num">N° ${docNum}</div>
          <div style="font-size: 11px; color: #64748b;">Fecha: ${new Date(header.fecha).toLocaleDateString()}</div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-item"><span class="info-label">Cliente:</span> <span class="info-val">${header.cliente || 'N/A'}</span></div>
        <div class="info-item"><span class="info-label">Sucursal Emisión:</span> <span class="info-val">${header.sucursal || 'N/A'}</span></div>
        <div class="info-item"><span class="info-label">Factura Referencia:</span> <span class="info-val">#${header.numerofactura || header.numeroFactura}</span></div>
        <div class="info-item"><span class="info-label">Método Reintegro:</span> <span class="info-val" style="color: ${isNotaCredito ? '#2563eb' : '#059669'}">${isNotaCredito ? 'CRÉDITO A FAVOR (NC)' : 'REINTEGRO EN EFECTIVO'}</span></div>
        ${header.observacion ? `<div class="info-item" style="grid-column: span 2;"><span class="info-label">Observación:</span> <span class="info-val">${header.observacion}</span></div>` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th style="text-align: center; width: 40px;">#</th>
            <th style="width: 110px;">Código</th>
            <th>Descripción del Artículo</th>
            <th>Bodega / Ubicación Restituida</th>
            <th style="text-align: right; width: 80px;">Cant. Dev.</th>
            <th style="text-align: right; width: 100px;">P. Unitario</th>
            <th style="text-align: right; width: 90px;">Descuento</th>
            <th style="text-align: right; width: 110px;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${detallesHtml}
        </tbody>
      </table>

      <div class="totals-table">
        <div class="totals-row"><span>Subtotal Devuelto:</span> <span>${currencySymbol} ${Number(header.subtotal || header.subTotal || 0).toFixed(2)}</span></div>
        <div class="totals-row"><span>IVA Reintegrado (15%):</span> <span>${currencySymbol} ${Number(header.iva || 0).toFixed(2)}</span></div>
        <div class="totals-row grand-total"><span>TOTAL REINTEGRO:</span> <span>${currencySymbol} ${Number(header.total || 0).toFixed(2)}</span></div>
      </div>

      <div class="signatures">
        <div>
          <div class="sig-line">Elaborado por (Sucursal)</div>
        </div>
        <div>
          <div class="sig-line">Conforme Cliente (Firma y Cédula/RUC)</div>
        </div>
      </div>

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

const Ventas = ({ filters }) => {
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('ventas_active_tab') || 'resumen';
  });

  useEffect(() => {
    sessionStorage.setItem('ventas_active_tab', activeTab);
  }, [activeTab]);
  
  // Resumen States
  const [ventasComparativo, setVentasComparativo] = useState([]);
  const [descuentosComparativo, setDescuentosComparativo] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [ventasResumen, setVentasResumen] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [loadingResumen, setLoadingResumen] = useState(true);
  
  // Resumen Detallado
  const [ventasDetalleResumen, setVentasDetalleResumen] = useState({
    subtotalventas: 0,
    ivaventas: 0,
    totalventas: 0,
    totalanulado: 0,
    cantidadanuladas: 0,
    ventascontado: 0,
    ventascredito: 0
  });

  // Devoluciones States
  const [showDevolucionModal, setShowDevolucionModal] = useState(false);
  const [searchInvoiceQuery, setSearchInvoiceQuery] = useState('');
  const [devolucionInvoiceData, setDevolucionInvoiceData] = useState(null);
  const [loadingInvoiceData, setLoadingInvoiceData] = useState(false);
  const [devolucionQuantities, setDevolucionQuantities] = useState({});
  const [tipoReintegro, setTipoReintegro] = useState('NOTA_CREDITO');
  const [devolucionObservacion, setDevolucionObservacion] = useState('');
  const [processingDevolucion, setProcessingDevolucion] = useState(false);
  const [devolucionesList, setDevolucionesList] = useState([]);
  const [loadingDevoluciones, setLoadingDevoluciones] = useState(false);
  const [searchDevolucionFilter, setSearchDevolucionFilter] = useState('');
  const [selectedDevolucionView, setSelectedDevolucionView] = useState(null);

  // Anuladas Modal
  const [showAnuladasModal, setShowAnuladasModal] = useState(false);
  const [facturasAnuladas, setFacturasAnuladas] = useState([]);
  const [loadingAnuladas, setLoadingAnuladas] = useState(false);

  // Facturas table column filters
  const [factFiltros, setFactFiltros] = useState({ factura: '', cliente: '', sucursal: '', vendedor: '', condicion: '', estado: '' });
  const [searchVendedorRendimiento, setSearchVendedorRendimiento] = useState('');

  const filteredVendedoresRendimiento = (vendedores || []).filter(v => {
    const q = (searchVendedorRendimiento || '').toLowerCase().trim();
    return !q ||
      (v.vendedor || '').toLowerCase().includes(q) ||
      (v.sucursal || '').toLowerCase().includes(q);
  });

  const exportVendedoresRendimientoExcel = (vendedoresData) => {
    const sheetData = (vendedoresData || []).map(v => ({
      'Vendedor': v.vendedor || 'N/A',
      'Sucursal': v.sucursal || 'General',
      'Facturas Emitidas': Number(v.totalfacturas || v.totalFacturas || 0),
      'Ventas Contado (C$)': Number(v.totalcontado || v.totalContado || 0),
      'Ventas Crédito (C$)': Number(v.totalcredito || v.totalCredito || 0),
      'Venta Total (C$)': Number(v.totalventas || v.totalVentas || 0)
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rendimiento Vendedores");
    XLSX.writeFile(wb, `Rendimiento_Vendedores_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportDetalleVendedorExcel = (vendedorNombre) => {
    const facturasVendedor = (facturas || []).filter(f => (f.vendedor || '').toLowerCase().trim() === (vendedorNombre || '').toLowerCase().trim());
    if (facturasVendedor.length === 0) {
      alert(`No hay facturas encontradas en el período para el vendedor ${vendedorNombre}`);
      return;
    }

    const sheetData = facturasVendedor.map(f => ({
      'N° Factura': f.numerofactura || f.numeroFactura || 'N/A',
      'Fecha': formatDate(f.fecha),
      'Cliente': f.cliente || 'Cliente General',
      'Sucursal': f.sucursal || 'N/A',
      'Vendedor': f.vendedor || 'N/A',
      'Condición Pago': f.condicionpago || f.condicionPago || 'N/A',
      'Estado': f.estado || 'ACTIVA',
      'Total (C$)': Number(f.total || 0)
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Ventas_${(vendedorNombre || 'Vendedor').substring(0, 20)}`);
    XLSX.writeFile(wb, `Ventas_Detalle_${(vendedorNombre || 'Vendedor').replace(/\s+/g, '_')}.xlsx`);
  };

  const exportarTodasFacturasExcel = (facturasList) => {
    const list = facturasList && facturasList.length > 0 ? facturasList : facturas;
    if (!list || list.length === 0) {
      alert("No hay facturas para exportar.");
      return;
    }

    const dataToExport = list.map(f => ({
      'N° Factura': f.numerofactura || f.numeroFactura || 'N/A',
      'Fecha': formatDate(f.fecha),
      'Cliente': f.cliente || 'Cliente General',
      'Vendedor': f.vendedor || 'N/A',
      'Sucursal': f.sucursal || 'N/A',
      'Condición Pago': f.condicion || f.condicionpago || 'N/A',
      'Estado': f.estadopago || f.estado || 'ACTIVA',
      'SubTotal (C$)': Number(f.subtotal || 0),
      'Descuento (C$)': Number(f.descuento || 0),
      'IVA (C$)': Number(f.iva || 0),
      'Total (C$)': Number(f.total || 0)
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Todas las Facturas");
    XLSX.writeFile(wb, `Reporte_Facturas_Completo_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // CxC States
  const [cxcPendientes, setCxcPendientes] = useState([]);
  const [cxcDetalle, setCxcDetalle] = useState([]);
  const [loadingCxc, setLoadingCxc] = useState(true);
  const [cxcFilters, setCxcFilters] = useState({ cliente: '', sucursalId: '', vendedorId: '' });
  
  // Client statement selector
  const [clientesList, setClientesList] = useState([]);
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [clienteStatement, setClienteStatement] = useState([]);
  const [loadingStatement, setLoadingStatement] = useState(false);

  // Catalogs for CxC Filters
  const [sucursalesList, setSucursalesList] = useState([]);
  const [vendedoresList, setVendedoresList] = useState([]);

  // Preformas States
  const [preformasEstadisticas, setPreformasEstadisticas] = useState({
    kpis: { totalpreformas: 0, preformasfacturadas: 0, preformasvigentes: 0, preformasvencidas: 0, montototal: 0, montofacturado: 0, promediopreforma: 0 },
    diario: [],
    porSucursal: [],
    topArticulos: [],
    topClientes: []
  });
  const [preformasListado, setPreformasListado] = useState([]);
  const [searchPreforma, setSearchPreforma] = useState('');
  const [loadingPreformas, setLoadingPreformas] = useState(true);
  // Descuentos Drilled-down States
  const [showSucursalDescuentosModal, setShowSucursalDescuentosModal] = useState(false);
  const [selectedSucursalDescuentos, setSelectedSucursalDescuentos] = useState('');
  const [vendedoresDescuentosList, setVendedoresDescuentosList] = useState([]);
  const [loadingVendedoresDescuentos, setLoadingVendedoresDescuentos] = useState(false);

  const [showVendedorFacturasModal, setShowVendedorFacturasModal] = useState(false);
  const [selectedVendedorData, setSelectedVendedorData] = useState(null);
  const [facturasDescuentosList, setFacturasDescuentosList] = useState([]);
  const [loadingFacturasDescuentos, setLoadingFacturasDescuentos] = useState(false);
  const [searchFacturaDescuentoFilter, setSearchFacturaDescuentoFilter] = useState('');

  const handleOpenSucursalDescuentosModal = async (sucursalName) => {
    if (!sucursalName) return;
    setSelectedSucursalDescuentos(sucursalName);
    setShowSucursalDescuentosModal(true);
    setLoadingVendedoresDescuentos(true);
    setVendedoresDescuentosList([]);
    try {
      const res = await axios.get(`${API_BASE_URL}/descuentos-vendedores-sucursal`, {
        params: { ...filters, sucursal: sucursalName }
      });
      setVendedoresDescuentosList(res.data || []);
    } catch (err) {
      console.error("Error al obtener descuentos por vendedor:", err);
    } finally {
      setLoadingVendedoresDescuentos(false);
    }
  };

  const handleOpenVendedorFacturasModal = async (vendedorItem) => {
    if (!vendedorItem) return;
    setSelectedVendedorData(vendedorItem);
    setShowVendedorFacturasModal(true);
    setLoadingFacturasDescuentos(true);
    setFacturasDescuentosList([]);
    setSearchFacturaDescuentoFilter('');
    try {
      const res = await axios.get(`${API_BASE_URL}/descuentos-facturas-vendedor`, {
        params: {
          ...filters,
          sucursal: selectedSucursalDescuentos,
          vendedorId: vendedorItem.vendedorid || vendedorItem.vendedorId,
          vendedor: vendedorItem.vendedor
        }
      });
      setFacturasDescuentosList(res.data || []);
    } catch (err) {
      console.error("Error al obtener facturas con descuento del vendedor:", err);
    } finally {
      setLoadingFacturasDescuentos(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'resumen') {
      fetchResumen();
    } else if (activeTab === 'cxc') {
      fetchCxc();
    } else if (activeTab === 'preformas') {
      fetchPreformas();
    } else if (activeTab === 'devoluciones') {
      fetchDevoluciones();
    }
  }, [filters, activeTab]);

  const fetchDevoluciones = async () => {
    setLoadingDevoluciones(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/devoluciones`, { params: filters });
      setDevolucionesList(res.data);
    } catch (e) {
      console.error("Error fetching devoluciones:", e);
    } finally {
      setLoadingDevoluciones(false);
    }
  };

  const handleSearchInvoiceForDevolucion = async (e) => {
    if (e) e.preventDefault();
    if (!searchInvoiceQuery.trim()) return;

    setLoadingInvoiceData(true);
    setDevolucionInvoiceData(null);
    setDevolucionQuantities({});
    try {
      const res = await axios.get(`${API_BASE_URL}/factura-devolucion-info/${encodeURIComponent(searchInvoiceQuery.trim())}`);
      setDevolucionInvoiceData(res.data);
      const initialQtys = {};
      (res.data.detalles || []).forEach(d => {
        initialQtys[d.facturadetalleid || d.facturaDetalleId] = 0;
      });
      setDevolucionQuantities(initialQtys);
    } catch (err) {
      console.error("Error buscando factura para devolución:", err);
      alert(err.response?.data?.error || "Factura no encontrada o anulada.");
    } finally {
      setLoadingInvoiceData(false);
    }
  };

  const handleProcessDevolucion = async () => {
    if (!devolucionInvoiceData || !devolucionInvoiceData.factura) return;

    const itemsToReturn = (devolucionInvoiceData.detalles || [])
      .map(d => {
        const id = d.facturadetalleid || d.facturaDetalleId;
        const cant = Number(devolucionQuantities[id]) || 0;
        return {
          facturaDetalleId: id,
          articuloId: d.articuloid || d.articuloId,
          bodegaId: d.bodegaid || d.bodegaId,
          ubicacionId: d.ubicacionid || d.ubicacionId,
          cantidadADevolver: cant
        };
      })
      .filter(i => i.cantidadADevolver > 0);

    if (itemsToReturn.length === 0) {
      alert("Debe ingresar al menos una cantidad mayor a 0 para devolver.");
      return;
    }

    setProcessingDevolucion(true);
    try {
      const payload = {
        facturaId: devolucionInvoiceData.factura.id,
        tipoReintegro: tipoReintegro,
        observacion: devolucionObservacion,
        items: itemsToReturn
      };

      const res = await axios.post(`${API_BASE_URL}/devoluciones`, payload);
      alert(`¡Devolución ${res.data.numeroDevolucion} procesada exitosamente!`);

      const detailRes = await axios.get(`${API_BASE_URL}/devolucion-detalle/${res.data.devolucionId}`);
      if (detailRes.data && detailRes.data.header) {
        printDevolucionReceipt(detailRes.data.header, detailRes.data.detalles);
      }

      setShowDevolucionModal(false);
      setDevolucionInvoiceData(null);
      setSearchInvoiceQuery('');
      setDevolucionObservacion('');
      fetchDevoluciones();
      if (activeTab === 'resumen') fetchResumen();
    } catch (err) {
      console.error("Error al procesar la devolución:", err);
      alert(err.response?.data?.error || "Error al procesar la devolución.");
    } finally {
      setProcessingDevolucion(false);
    }
  };

  const handlePrintPastDevolucion = async (id) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/devolucion-detalle/${id}`);
      if (res.data && res.data.header) {
        printDevolucionReceipt(res.data.header, res.data.detalles);
      }
    } catch (err) {
      console.error("Error fetching devolucion for print:", err);
      alert("Error al cargar los datos de la devolución.");
    }
  };

  // Handle distinct cxc text filters separately
  useEffect(() => {
    if (activeTab === 'cxc') {
      fetchCxc();
    }
  }, [cxcFilters.sucursalId, cxcFilters.vendedorId]);

  useEffect(() => {
    if (selectedClienteId) {
      fetchClienteStatement(selectedClienteId);
    } else {
      setClienteStatement([]);
    }
  }, [selectedClienteId]);

  const fetchResumen = async () => {
    setLoadingResumen(true);
    try {
      const [vComp, dSuc, vendRes, resuRes, factRes, detRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/ventas-sucursal-comparativo`, { params: filters }),
        axios.get(`${API_BASE_URL}/descuentos-sucursal`, { params: filters }),
        axios.get(`${API_BASE_URL}/vendedores`, { params: filters }),
        axios.get(`${API_BASE_URL}/ventas-resumen`, { params: filters }),
        axios.get(`${API_BASE_URL}/facturas-exportar`, { params: filters }),
        axios.get(`${API_BASE_URL}/ventas-resumen-detallado`, { params: filters })
      ]);
      setVentasComparativo(vComp.data);
      setDescuentosComparativo(dSuc.data);
      setVendedores(vendRes.data);
      setVentasResumen(resuRes.data);
      setFacturas(factRes.data);
      setVentasDetalleResumen(detRes.data);
    } catch (error) {
      console.error("Error fetching resumen data:", error);
    } finally {
      setLoadingResumen(false);
    }
  };

  const fetchCxc = async () => {
    setLoadingCxc(true);
    try {
      const params = {
        ...filters,
        cliente: cxcFilters.cliente || null,
        sucursalId: cxcFilters.sucursalId || null,
        vendedorId: cxcFilters.vendedorId || null
      };
      
      const [pendientes, detalle, clientes] = await Promise.all([
        axios.get(`${API_BASE_URL}/cuentas-cobrar-pendientes`, { params }),
        axios.get(`${API_BASE_URL}/cuentas-cobrar-detalle`, { params }),
        axios.get(`${API_BASE_URL}/clientes`)
      ]);
      
      setCxcPendientes(pendientes.data);
      setCxcDetalle(detalle.data);
      setClientesList(clientes.data);

      if (sucursalesList.length === 0) {
        const sucs = [...new Set(detalle.data.map(d => d.sucursal))].sort();
        setSucursalesList(sucs);
      }
      if (vendedoresList.length === 0) {
        const vends = [...new Set(detalle.data.map(d => d.vendedor))].sort();
        setVendedoresList(vends);
      }

    } catch (error) {
      console.error("Error fetching cxc data:", error);
    } finally {
      setLoadingCxc(false);
    }
  };

  const fetchClienteStatement = async (clienteId) => {
    setLoadingStatement(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/cuentas-cobrar-cliente`, { params: { clienteId } });
      setClienteStatement(res.data);
    } catch (error) {
      console.error("Error fetching client statement:", error);
    } finally {
      setLoadingStatement(false);
    }
  };

  const fetchPreformas = async () => {
    setLoadingPreformas(true);
    try {
      const [estRes, listRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/preformas-estadisticas`, { params: filters }),
        axios.get(`${API_BASE_URL}/preformas-listado`, { params: filters })
      ]);
      setPreformasEstadisticas(estRes.data || {});
      setPreformasListado(listRes.data || []);
    } catch (error) {
      console.error("Error fetching preformas data:", error);
    } finally {
      setLoadingPreformas(false);
    }
  };

  const handleExportarFacturas = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/facturas-exportar`, { params: filters });
      const data = res.data;
      if (data.length === 0) {
        alert("No hay facturas en este rango de fechas para exportar.");
        return;
      }
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Facturas");
      XLSX.writeFile(workbook, `Facturas_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Ocurrió un error al exportar.");
    }
  };

  const handleVerAnuladas = async () => {
    setShowAnuladasModal(true);
    if (facturasAnuladas.length > 0) return; // already loaded
    setLoadingAnuladas(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/facturas-anuladas`, { params: filters });
      setFacturasAnuladas(res.data);
    } catch (e) {
      console.error('Error fetching anuladas:', e);
    } finally {
      setLoadingAnuladas(false);
    }
  };

  const handleExportarAnuladas = () => {
    if (facturasAnuladas.length === 0) { alert('No hay facturas anuladas.'); return; }
    const ws = XLSX.utils.json_to_sheet(facturasAnuladas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas_Anuladas');
    XLSX.writeFile(wb, `Facturas_Anuladas_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportarCxC = () => {
    if (cxcDetalle.length === 0) {
      alert("No hay datos de cuentas por cobrar para exportar.");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(cxcDetalle);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "CxC_Pendientes");
    XLSX.writeFile(workbook, `CxC_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportarClienteStatement = () => {
    if (clienteStatement.length === 0) {
      alert("No hay transacciones en el estado de cuenta para exportar.");
      return;
    }
    const clienteNombre = clientesList.find(c => c.id === parseInt(selectedClienteId))?.nombre || "Cliente";
    const worksheet = XLSX.utils.json_to_sheet(clienteStatement);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Estado_Cuenta");
    XLSX.writeFile(workbook, `Estado_Cuenta_${clienteNombre.replace(/\s+/g, '_')}.xlsx`);
  };

  const handlePrintClienteStatement = () => {
    if (clienteStatement.length === 0) return;
    const cliente = clientesList.find(c => c.id === parseInt(selectedClienteId));
    const printWindow = window.open('', '_blank');
    
    const todayVal = new Date();
    todayVal.setHours(0,0,0,0);
    
    const rowsHtml = clienteStatement.map(f => {
      const vencDate = (() => {
        if (!f.fechavencimiento) return new Date();
        const dateStr = f.fechavencimiento.split('T')[0];
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }
        return new Date(dateStr);
      })();
      vencDate.setHours(0,0,0,0);
      const diffTime = vencDate.getTime() - todayVal.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const remainingText = diffDays < 0 ? `Vencida (${Math.abs(diffDays)} días)` : `${diffDays} días`;
      
      return `
        <tr>
          <td>${formatDate(f.fecha)}</td>
          <td>#${f.numerofactura}</td>
          <td>${remainingText}</td>
          <td>${formatDate(f.fechavencimiento)}</td>
          <td class="text-right">${formatCurrency(f.subtotal)}</td>
          <td class="text-right">${formatCurrency(f.iva)}</td>
          <td class="text-right">${formatCurrency(f.total)}</td>
        </tr>
      `;
    }).join('');

    const printContent = `
      <html>
        <head>
          <title>Estado de Cuenta - ${cliente?.nombre}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #333; }
            .header { border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px; }
            .header-top { display: flex; justify-content: space-between; align-items: center; }
            h1 { color: #1e3a8a; margin: 0; font-size: 24px; text-transform: uppercase; }
            .logo { height: 45px; object-fit: contain; }
            .subtitle { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; margin-top: 5px; }
            .company-details { font-size: 11px; color: #475569; margin-bottom: 4px; }
            .meta { display: flex; justify-content: space-between; margin-top: 25px; font-size: 14px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { background-color: #f8fafc; font-weight: 600; color: #475569; }
            .text-right { text-align: right; }
            .total-row { font-weight: bold; background-color: #f1f5f9; }
            .status { font-weight: 600; font-size: 11px; padding: 2px 6px; border-radius: 9999px; }
            .status-vencida { background-color: #fee2e2; color: #991b1b; }
            .status-pendiente { background-color: #fef3c7; color: #92400e; }
            .status-pagada { background-color: #d1fae5; color: #065f46; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <h1>ESTADO DE CUENTA DE CLIENTE</h1>
              <img src="${window.location.origin}${logoImg}" class="logo" />
            </div>
            <div class="subtitle">Venta de Maquinaria y Repuestos Agrícolas en general</div>
            <div class="company-details"><strong>RUC:</strong> J0310000054703 | <strong>Email:</strong> agrisource@deshonsupply.com</div>
            <div class="company-details"><strong>Celular:</strong> 8694-0217 / 8492-9388</div>
            
            <div class="meta">
              <div>
                <p><strong>Cliente:</strong> ${cliente?.nombre}</p>
                <p><strong>Identificación:</strong> ${cliente?.identificacion || 'N/A'}</p>
              </div>
              <div style="text-align: right;">
                <p><strong>Fecha Reporte:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Total Pendiente:</strong> ${formatCurrency(clienteStatement.reduce((acc, f) => acc + (f.estadomora !== 'PAGADA' ? f.total : 0), 0))}</p>
              </div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Factura</th>
                <th>Días Faltantes de Crédito</th>
                <th>Vencimiento</th>
                <th class="text-right">Subtotal</th>
                <th class="text-right">IVA</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="total-row">
                <td colspan="4">Total Histórico</td>
                <td class="text-right">${formatCurrency(clienteStatement.reduce((acc, f) => acc + (f.subtotal || 0), 0))}</td>
                <td class="text-right">${formatCurrency(clienteStatement.reduce((acc, f) => acc + (f.iva || 0), 0))}</td>
                <td class="text-right">${formatCurrency(clienteStatement.reduce((acc, f) => acc + (f.total || 0), 0))}</td>
              </tr>
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const formatCurrency = (val) => {
    let numericVal = Number(val) || 0;
    const prefix = filters.moneda === 'USD' ? '$' : 'C$';
    
    if (filters.moneda === 'USD' && filters.tipoCambio) {
      numericVal = numericVal / filters.tipoCambio;
    }

    return `${prefix} ` + new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numericVal);
  };

  // --- Rendering Functions ---

  const renderResumen = () => {
    if (loadingResumen) return <LoadingScreen message="Cargando resumen de ventas..." />;

    return (
      <>
        {/* Anuladas Modal */}
        {showAnuladasModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowAnuladasModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-red-600 to-red-700 rounded-t-2xl text-white">
                <div className="flex items-center gap-3">
                  <FileWarning size={22} />
                  <div>
                    <h2 className="text-lg font-bold">Facturas Anuladas</h2>
                    <p className="text-sm opacity-80">{facturasAnuladas.length} factura{facturasAnuladas.length !== 1 ? 's' : ''} anulada{facturasAnuladas.length !== 1 ? 's' : ''} en el período</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExportarAnuladas} className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                    <Download size={15} /> Excel
                  </button>
                  <button onClick={() => setShowAnuladasModal(false)} className="text-white/80 hover:text-white ml-2"><FileWarning size={20} className="rotate-45" /></button>
                </div>
              </div>
              <div className="overflow-auto flex-1">
                {loadingAnuladas ? (
                  <div className="py-12 text-center text-slate-400 animate-pulse">Cargando facturas anuladas...</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Factura</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Cliente</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Sucursal</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Vendedor</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Subtotal</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">IVA</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {facturasAnuladas.length === 0 ? (
                        <tr><td colSpan={8} className="text-center py-10 text-slate-400">No hay facturas anuladas en este período</td></tr>
                      ) : (
                        facturasAnuladas.map((f, i) => (
                          <tr key={i} className="hover:bg-red-50/30 transition-colors">
                            <td className="px-4 py-3 font-mono text-red-600 font-semibold">#{f.numerofactura}</td>
                            <td className="px-4 py-3 text-slate-600">{formatDate(f.fecha)}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{f.cliente}</td>
                            <td className="px-4 py-3 text-slate-500">{f.sucursal}</td>
                            <td className="px-4 py-3 text-slate-500">{f.vendedor || 'N/A'}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(f.subtotal)}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(f.iva)}</td>
                            <td className="px-4 py-3 text-right font-bold text-red-700">{formatCurrency(f.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {facturasAnuladas.length > 0 && (
                      <tfoot className="bg-slate-100">
                        <tr>
                          <td colSpan={5} className="px-4 py-3 font-bold text-slate-700">TOTALES</td>
                          <td className="px-4 py-3 text-right font-bold">{formatCurrency(facturasAnuladas.reduce((a, f) => a + (f.subtotal || 0), 0))}</td>
                          <td className="px-4 py-3 text-right font-bold">{formatCurrency(facturasAnuladas.reduce((a, f) => a + (f.iva || 0), 0))}</td>
                          <td className="px-4 py-3 text-right font-bold text-red-700">{formatCurrency(facturasAnuladas.reduce((a, f) => a + (f.total || 0), 0))}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modern Sales Summary Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5 mb-8">
          {/* 1. Subtotal Neto */}
          <div className="relative overflow-hidden bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">Subtotal Neto</span>
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {formatCurrency(ventasDetalleResumen.subtotalneto || ventasDetalleResumen.subtotalventas)}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-2 font-medium">Ventas netas del período</p>
          </div>

          {/* 2. Descuento Total */}
          <div className="relative overflow-hidden bg-white rounded-2xl p-5 shadow-sm border border-orange-200/80 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-orange-600 tracking-wider uppercase">Descuento Total</span>
              <div className="p-2.5 rounded-xl bg-orange-100/80 text-orange-600 group-hover:scale-110 transition-transform">
                <Tag className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-orange-600 tracking-tight">
                - {formatCurrency(ventasDetalleResumen.totaldescuento || 0)}
              </h3>
            </div>
            <p className="text-xs text-orange-600/70 mt-2 font-medium">Total descuentos concedidos</p>
          </div>

          {/* 3. IVA */}
          <div className="relative overflow-hidden bg-white rounded-2xl p-5 shadow-sm border border-emerald-200/80 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-700 tracking-wider uppercase">IVA (15%)</span>
              <div className="p-2.5 rounded-xl bg-emerald-100/80 text-emerald-600 group-hover:scale-110 transition-transform">
                <Percent className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {formatCurrency(ventasDetalleResumen.ivaventas)}
              </h3>
            </div>
            <p className="text-xs text-emerald-600/70 mt-2 font-medium">Impuestos acumulados</p>
          </div>

          {/* 4. Gran Total (Totalizado) */}
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 rounded-2xl p-5 shadow-lg shadow-indigo-500/20 text-white hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 group">
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-blue-200 tracking-wider uppercase">Gran Totalizado</span>
              <div className="p-2.5 rounded-xl bg-white/15 text-white backdrop-blur-md group-hover:scale-110 transition-transform">
                <Banknote className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {formatCurrency(ventasDetalleResumen.totalventas)}
              </h3>
            </div>
            <p className="text-xs text-blue-200/80 mt-2 font-medium">Monto final facturado (Neto + IVA)</p>
          </div>

          {/* 5. Facturas Anuladas */}
          <button
            onClick={handleVerAnuladas}
            className="relative overflow-hidden bg-white rounded-2xl p-5 shadow-sm border border-red-200/80 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group text-left w-full cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-red-700 tracking-wider uppercase">Anuladas</span>
              <div className="p-2.5 rounded-xl bg-red-100/80 text-red-600 group-hover:scale-110 transition-transform">
                <FileWarning className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-red-800 tracking-tight">
                {ventasDetalleResumen.cantidadanuladas ?? 0}
              </h3>
            </div>
            <p className="text-xs text-red-500 mt-2 font-medium group-hover:underline flex items-center">
              Ver detalle →
            </p>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Ventas Comparativo */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center"><TrendingUp className="w-5 h-5 mr-2 text-gray-500"/> Ventas por Sucursal (Actual vs Anterior)</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={ventasComparativo} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB"/>
                  <XAxis dataKey="sucursal" axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => formatCurrency(val)} />
                  <Tooltip cursor={{fill: '#F3F4F6'}} formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="ventasactual" fill="#3B82F6" name="Periodo Actual" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="ventasanterior" stroke="#F59E0B" strokeWidth={3} name="Periodo Anterior" dot={{r: 4}} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Descuentos por Sucursal */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <Percent className="w-5 h-5 mr-2 text-emerald-600"/> % Descuentos por Sucursal
              </h2>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shadow-sm w-fit">
                💡 Clic en un segmento para ver detalle
              </span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={descuentosComparativo}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="totaldescuentos"
                    nameKey="sucursal"
                    cursor="pointer"
                    onClick={(entry) => handleOpenSucursalDescuentosModal(entry.sucursal)}
                  >
                    {descuentosComparativo.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                        className="hover:opacity-80 transition-all cursor-pointer stroke-2 stroke-white hover:scale-105"
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend
                    onClick={(e) => handleOpenSucursalDescuentosModal(e.value)}
                    wrapperStyle={{ cursor: 'pointer' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center"><CreditCard className="w-5 h-5 mr-2 text-gray-500"/> Ventas por Condición (Crédito vs Contado)</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ventasResumen} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="totalventas" nameKey="tipoventa">
                    {ventasResumen.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getCondicionColor(entry.tipoventa, index)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <Users className="w-5 h-5 mr-2 text-gray-500"/> Rendimiento de Vendedores
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="Buscar vendedor..."
                    value={searchVendedorRendimiento}
                    onChange={e => setSearchVendedorRendimiento(e.target.value)}
                    className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
                  />
                </div>
                {searchVendedorRendimiento && (
                  <button
                    onClick={() => setSearchVendedorRendimiento('')}
                    className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                  >
                    Limpiar
                  </button>
                )}
                <button
                  onClick={() => exportVendedoresRendimientoExcel(filteredVendedoresRendimiento)}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
                  title="Exportar resumen de vendedores a Excel"
                >
                  <FileSpreadsheet size={15} /> Excel Resumen
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 font-bold">
                  <tr>
                    <th className="px-3 py-2.5 rounded-tl-lg">Vendedor</th>
                    <th className="px-3 py-2.5">Sucursal</th>
                    <th className="px-3 py-2.5 text-center">Facturas</th>
                    <th className="px-3 py-2.5 text-right">Contado</th>
                    <th className="px-3 py-2.5 text-right">Crédito</th>
                    <th className="px-3 py-2.5 text-right font-black text-slate-900">Venta Total</th>
                    <th className="px-3 py-2.5 text-center rounded-tr-lg">Detalle Excel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVendedoresRendimiento.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        No se encontraron vendedores para el filtro aplicado.
                      </td>
                    </tr>
                  ) : (
                    filteredVendedoresRendimiento.map((v, i) => (
                      <tr key={i} className="bg-white hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5 font-bold text-slate-900">{v.vendedor}</td>
                        <td className="px-3 py-2.5 text-slate-600 font-medium">{v.sucursal || 'General'}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-slate-700">{v.totalfacturas || v.totalFacturas || 0}</td>
                        <td className="px-3 py-2.5 text-right text-emerald-600 font-bold">{formatCurrency(v.totalcontado)}</td>
                        <td className="px-3 py-2.5 text-right text-purple-600 font-bold">{formatCurrency(v.totalcredito)}</td>
                        <td className="px-3 py-2.5 text-right font-black text-blue-700 text-sm">{formatCurrency(v.totalventas)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => exportDetalleVendedorExcel(v.vendedor)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-all"
                            title={`Descargar facturas detalladas de ${v.vendedor}`}
                          >
                            <FileSpreadsheet size={13} /> Facturas
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Facturas del Período */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
              <Briefcase className="w-5 h-5 mr-2 text-gray-500"/> Facturas del Período (incl. Anuladas)
            </h2>
            <button
              onClick={() => exportarTodasFacturasExcel(facturas)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
              title="Exportar todas las facturas del período incluyendo anuladas"
            >
              <FileSpreadsheet size={16} /> Exportar Todas las Facturas (incl. Anuladas)
            </button>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 font-semibold">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Fecha</th>
                  <th className="px-4 py-3">
                    <div>Factura</div>
                    <input type="text" placeholder="Filtrar..." value={factFiltros.factura} onChange={e => setFactFiltros(f => ({...f, factura: e.target.value}))} className="mt-1 w-full border border-gray-200 rounded px-2 py-0.5 text-xs font-normal normal-case text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </th>
                  <th className="px-4 py-3">
                    <div>Cliente</div>
                    <input type="text" placeholder="Filtrar..." value={factFiltros.cliente} onChange={e => setFactFiltros(f => ({...f, cliente: e.target.value}))} className="mt-1 w-full border border-gray-200 rounded px-2 py-0.5 text-xs font-normal normal-case text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </th>
                  <th className="px-4 py-3">
                    <div>Vendedor</div>
                    <input type="text" placeholder="Filtrar..." value={factFiltros.vendedor} onChange={e => setFactFiltros(f => ({...f, vendedor: e.target.value}))} className="mt-1 w-full border border-gray-200 rounded px-2 py-0.5 text-xs font-normal normal-case text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </th>
                  <th className="px-4 py-3">
                    <div>Condición</div>
                    <select value={factFiltros.condicion} onChange={e => setFactFiltros(f => ({...f, condicion: e.target.value}))} className="mt-1 w-full border border-gray-200 rounded px-1 py-0.5 text-xs font-normal normal-case text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                      <option value="">Todas</option>
                      <option value="Contado">Contado</option>
                      <option value="Crédito">Crédito</option>
                    </select>
                  </th>
                  <th className="px-4 py-3">
                    <div>Sucursal</div>
                    <input type="text" placeholder="Filtrar..." value={factFiltros.sucursal} onChange={e => setFactFiltros(f => ({...f, sucursal: e.target.value}))} className="mt-1 w-full border border-gray-200 rounded px-2 py-0.5 text-xs font-normal normal-case text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </th>
                  <th className="px-4 py-3">
                    <div>Estado</div>
                    <select value={factFiltros.estado} onChange={e => setFactFiltros(f => ({...f, estado: e.target.value}))} className="mt-1 w-full border border-gray-200 rounded px-1 py-0.5 text-xs font-normal normal-case text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                      <option value="">Todos</option>
                      <option value="ANULADO">Anuladas</option>
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="PAGADO">Pagado</option>
                    </select>
                  </th>
                  <th className="px-4 py-3 text-right">SubTotal</th>
                  <th className="px-4 py-3 text-right text-orange-600">Descuento</th>
                  <th className="px-4 py-3 text-right">IVA</th>
                  <th className="px-4 py-3 rounded-tr-lg text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {facturas
                  .filter(f => {
                    const matchFactura = !factFiltros.factura || (f.numerofactura || '').toString().toLowerCase().includes(factFiltros.factura.toLowerCase());
                    const matchCliente = !factFiltros.cliente || (f.cliente || '').toLowerCase().includes(factFiltros.cliente.toLowerCase());
                    const matchVendedor = !factFiltros.vendedor || (f.vendedor || '').toLowerCase().includes(factFiltros.vendedor.toLowerCase());
                    const matchSucursal = !factFiltros.sucursal || (f.sucursal || '').toLowerCase().includes(factFiltros.sucursal.toLowerCase());
                    const matchCondicion = !factFiltros.condicion || (factFiltros.condicion === 'Crédito' ? (f.condicion || '').startsWith('Crédito') : f.condicion === factFiltros.condicion);
                    const matchEstado = !factFiltros.estado || (factFiltros.estado === 'ANULADO' ? (f.estado === 'AN' || f.estado === 'ANULADA' || f.estadopago === 'ANULADO') : f.estadopago === factFiltros.estado);
                    return matchFactura && matchCliente && matchVendedor && matchSucursal && matchCondicion && matchEstado;
                  })
                  .map((f, i) => {
                    const isAnulada = f.estado === 'AN' || f.estado === 'ANULADA' || f.estadopago === 'ANULADO';
                    return (
                      <tr key={i} className={`border-b hover:bg-gray-50 transition-colors ${isAnulada ? 'bg-red-50' : 'bg-white'}`}>
                        <td className="px-4 py-3">{formatDate(f.fecha)}</td>
                        <td className={`px-4 py-3 font-bold ${isAnulada ? 'text-red-400 line-through' : 'text-blue-600'}`}>#{f.numerofactura}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{f.cliente}</td>
                        <td className="px-4 py-3">{f.vendedor}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${f.condicion === 'Contado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {f.condicion}
                          </span>
                        </td>
                        <td className="px-4 py-3">{f.sucursal}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            isAnulada ? 'bg-red-100 text-red-700' :
                            f.estadopago === 'PAGADO' ? 'bg-green-100 text-green-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>{isAnulada ? 'ANULADA' : (f.estadopago || 'N/A')}</span>
                        </td>
                        <td className="px-4 py-3 text-right">{formatCurrency(f.subtotal)}</td>
                        <td className="px-4 py-3 text-right text-orange-600 font-medium">{formatCurrency(f.descuento || 0)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(f.iva)}</td>
                        <td className={`px-4 py-3 font-bold text-right ${isAnulada ? 'text-red-400' : 'text-gray-800'}`}>{formatCurrency(f.total)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  };

  const renderCxC = () => {
    if (loadingCxc) return <LoadingScreen message="Cargando cuentas por cobrar..." />;
    return (
      <>
        {/* Filtros CxC and detailed list (movido al inicio) */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Buscar Cliente en Cartera</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Nombre del cliente..." 
                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={cxcFilters.cliente}
                onChange={(e) => setCxcFilters({...cxcFilters, cliente: e.target.value})}
                onKeyDown={(e) => e.key === 'Enter' && fetchCxc()}
              />
            </div>
          </div>
          
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Filtrar por Sucursal</label>
            <select 
              className="w-full px-4 py-2 border rounded-lg text-sm outline-none bg-white"
              value={cxcFilters.sucursalId}
              onChange={(e) => setCxcFilters({...cxcFilters, sucursalId: e.target.value})}
            >
              <option value="">Todas</option>
              {sucursalesList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Filtrar por Vendedor</label>
            <select 
              className="w-full px-4 py-2 border rounded-lg text-sm outline-none bg-white"
              value={cxcFilters.vendedorId}
              onChange={(e) => setCxcFilters({...cxcFilters, vendedorId: e.target.value})}
            >
              <option value="">Todos</option>
              {vendedoresList.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div className="mt-5">
            <button 
              onClick={handleExportarCxC}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
            >
              <Download size={18} /> Exportar CxC
            </button>
          </div>
        </div>

        {/* CXC Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Left Column: CXC por Sucursal bar chart */}
          <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center"><FileWarning className="w-5 h-5 mr-2 text-orange-500"/> CXC por Sucursal</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cxcPendientes} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB"/>
                  <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(val) => `C$${val}`} />
                  <YAxis dataKey="sucursal" type="category" axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#F3F4F6'}} formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="deudatotal" fill="#F97316" radius={[0, 4, 4, 0]} name="Deuda Total" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right Column: Detalle de Facturas Pendientes */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><Briefcase className="w-5 h-5 mr-2 text-gray-500"/> Detalle de Facturas Pendientes</h2>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 font-semibold">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Fecha</th>
                    <th className="px-4 py-3">Factura</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Sucursal</th>
                    <th className="px-4 py-3">Plazo (Hábiles)</th>
                    <th className="px-4 py-3">Transcurridos</th>
                    <th className="px-4 py-3">Vencimiento</th>
                    <th className="px-4 py-3">Devolución Aplicada</th>
                    <th className="px-4 py-3 rounded-tr-lg text-right">Deuda Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {cxcDetalle
                    .filter(d => cxcFilters.sucursalId ? d.sucursal === cxcFilters.sucursalId : true)
                    .filter(d => cxcFilters.vendedorId ? d.vendedor === cxcFilters.vendedorId : true)
                    .map((d, i) => (
                    <tr key={i} className="bg-white border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">{formatDate(d.fecha)}</td>
                      <td className="px-4 py-3 font-bold text-blue-600">#{d.numerofactura}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{d.cliente}</td>
                      <td className="px-4 py-3">{d.sucursal}</td>
                      <td className="px-4 py-3">{d.diascredito} días</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${d.diastranscurridos > d.diascredito ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {d.diastranscurridos} días
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{formatDate(d.fechavencimiento)}</td>
                      <td className="px-4 py-3">
                        {d.devolucionaplicada ? (
                          <span className="font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-xs font-bold">
                            {d.devolucionaplicada}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-orange-600 text-right">{formatCurrency(d.deuda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Client Account Statement section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><FileText className="w-5 h-5 mr-2 text-blue-600"/> Estado de Cuenta por Cliente</h2>
          
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div className="flex-1 min-w-[250px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Seleccionar Cliente</label>
              <select 
                className="w-full px-4 py-2 border rounded-lg text-sm outline-none bg-white"
                value={selectedClienteId}
                onChange={(e) => setSelectedClienteId(e.target.value)}
              >
                <option value="">-- Seleccione un cliente --</option>
                {clientesList.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.identificacion || 'Sin ID'})</option>)}
              </select>
            </div>
            
            {selectedClienteId && (
              <div className="flex gap-2">
                <button 
                  onClick={handleExportarClienteStatement}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Download size={16} /> Exportar Excel
                </button>
                <button 
                  onClick={handlePrintClienteStatement}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Printer size={16} /> Imprimir PDF
                </button>
              </div>
            )}
          </div>

          {selectedClienteId ? (
            loadingStatement ? (
              <div className="text-gray-500 animate-pulse py-8 text-center">Generando estado de cuenta...</div>
            ) : (
              <div className="overflow-x-auto max-h-[350px]">
                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Factura</th>
                      <th className="px-4 py-3">Plazo</th>
                      <th className="px-4 py-3">Vencimiento</th>
                      <th className="px-4 py-3 text-right">Subtotal</th>
                      <th className="px-4 py-3 text-right">IVA</th>
                      <th className="px-4 py-3 text-right">Total Factura</th>
                      <th className="px-4 py-3 text-right">Devolución / Crédito</th>
                      <th className="px-4 py-3 text-right">Saldo Pendiente</th>
                      <th className="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clienteStatement.map((f, i) => (
                      <tr key={i} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-4 py-3">{formatDate(f.fecha)}</td>
                        <td className="px-4 py-3 font-bold text-blue-600">#{f.numerofactura}</td>
                        <td className="px-4 py-3">{f.diascredito} días</td>
                        <td className="px-4 py-3">{formatDate(f.fechavencimiento)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(f.subtotal)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(f.iva)}</td>
                        <td className="px-4 py-3 font-bold text-gray-800 text-right">{formatCurrency(f.total)}</td>
                        <td className="px-4 py-3 text-right font-bold text-indigo-600">
                          {f.devolucionaplicada ? (
                            <div>
                              <span>-{formatCurrency(f.montodevuelto || 0)}</span>
                              <span className="block text-[10px] font-mono font-normal text-indigo-500">({f.devolucionaplicada})</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 font-extrabold text-orange-600 text-right">{formatCurrency(f.saldopendiente ?? f.total)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            f.estadomora === 'VENCIDA' ? 'bg-red-100 text-red-700' :
                            f.estadomora === 'PENDIENTE' ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {f.estadomora}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="text-center py-8 text-gray-400">Seleccione un cliente para ver su estado de cuenta.</div>
          )}
        </div>
      </>
    );
  };

  const handleExportarPreformas = () => {
    if (preformasListado.length === 0) {
      alert("No hay preformas registradas para exportar.");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(preformasListado.map(p => ({
      Documento: p.documento || `PF-${p.id}`,
      'N° Factura': p.numeroFactura || 'No Facturada',
      Fecha: formatDate(p.fecha),
      Expiracion: formatDate(p.fechaExpiracion),
      Cliente: p.cliente,
      Sucursal: p.sucursal,
      Estado: p.estadoVigencia,
      SubTotal: p.subTotal,
      IVA: p.iva,
      Total: p.total
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Estadisticas_Preformas");
    XLSX.writeFile(workbook, `Preformas_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrintPreformasReport = () => {
    if (preformasListado.length === 0) return;
    const printWindow = window.open('', '_blank');
    const printContent = `
      <html>
        <head>
          <title>Reporte de Estadísticas de Preformas</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #333; }
            .header { border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; }
            .header-top { display: flex; justify-content: space-between; align-items: center; }
            h1 { color: #1e3a8a; margin: 0; font-size: 24px; }
            .logo { height: 45px; object-fit: contain; }
            .meta { display: flex; justify-content: space-between; margin-top: 15px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 25px; font-size: 13px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { background-color: #f8fafc; font-weight: 600; color: #475569; }
            .text-right { text-align: right; }
            .total-row { font-weight: bold; background-color: #eff6ff; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <h1>REPORTE DE ESTADÍSTICAS DE PREFORMAS Y FACTURACIÓN</h1>
              <img src="${logoImg}" class="logo" />
            </div>
            <div class="meta">
              <div><p><strong>Módulo:</strong> Ventas & Preformas</p></div>
              <div style="text-align: right;">
                <p><strong>Fecha Reporte:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Total Registros:</strong> ${preformasListado.length}</p>
              </div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>N° Preforma</th>
                <th>N° Factura</th>
                <th>Fecha</th>
                <th>Expiración</th>
                <th>Cliente</th>
                <th>Sucursal</th>
                <th>Estado</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${preformasListado.map(p => `
                <tr>
                  <td><strong>${p.documento || 'PF-'+p.id}</strong></td>
                  <td>${p.numeroFactura ? '<strong>#' + p.numeroFactura + '</strong>' : '-'}</td>
                  <td>${formatDate(p.fecha)}</td>
                  <td>${formatDate(p.fechaExpiracion)}</td>
                  <td>${p.cliente}</td>
                  <td>${p.sucursal}</td>
                  <td>${p.estadoVigencia}</td>
                  <td class="text-right">${formatCurrency(p.total)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="7">Total General Preformas</td>
                <td class="text-right">${formatCurrency(preformasListado.reduce((acc, x) => acc + (x.total || 0), 0))}</td>
              </tr>
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const renderPreformas = () => {
    if (loadingPreformas) return <div className="text-gray-500 animate-pulse text-lg py-8">Cargando Estadísticas de Preformas...</div>;

    const kpis = preformasEstadisticas.kpis || {};
    const totalPreformas = kpis.totalpreformas || 0;
    const preformasFacturadas = kpis.preformasfacturadas || 0;
    const conversionPct = totalPreformas > 0 ? ((preformasFacturadas / totalPreformas) * 100).toFixed(1) : '0.0';

    const diarioChartData = (preformasEstadisticas.diario || []).map(d => ({
      fecha: formatDate(d.fecha),
      "Preformas Emitidas": d.preformasemitidas || 0,
      "Preformas Facturadas": d.preformasfacturadas || 0,
      "Monto Preformas": d.montopreformas || 0,
      "Monto Facturado": d.montofacturado || 0
    }));

    const filteredPreformas = preformasListado.filter(p => {
      const doc = (p.documento || '').toLowerCase();
      const numF = (p.numeroFactura || p.numerofactura || '').toLowerCase();
      const cli = (p.cliente || '').toLowerCase();
      const suc = (p.sucursal || '').toLowerCase();
      const q = searchPreforma.toLowerCase();
      return doc.includes(q) || numF.includes(q) || cli.includes(q) || suc.includes(q);
    });

    return (
      <div className="space-y-8 mb-8 animate-fadeIn">
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col border-l-4 border-l-blue-500">
            <div className="flex justify-between items-center text-gray-500">
              <span className="text-sm font-medium">Total Preformas Emitidas</span>
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-3xl font-extrabold text-slate-800 mt-2">{totalPreformas}</span>
            <span className="text-xs text-gray-400 mt-1">Cotizaciones registradas</span>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col border-l-4 border-l-emerald-500">
            <div className="flex justify-between items-center text-gray-500">
              <span className="text-sm font-medium">Preformas Facturadas</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-emerald-600">{preformasFacturadas}</span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {conversionPct}% Conversión
              </span>
            </div>
            <span className="text-xs text-emerald-600 font-semibold mt-1">Convertidas exitosamente en factura</span>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col border-l-4 border-l-indigo-500">
            <div className="flex justify-between items-center text-gray-500">
              <span className="text-sm font-medium">Monto Total Preformado</span>
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
            <span className="text-3xl font-extrabold text-indigo-600 mt-2">{formatCurrency(kpis.montototal)}</span>
            <span className="text-xs text-gray-400 mt-1">Valor total de preformas emitidas</span>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col border-l-4 border-l-teal-500">
            <div className="flex justify-between items-center text-gray-500">
              <span className="text-sm font-medium">Monto Facturado de Preformas</span>
              <Banknote className="w-5 h-5 text-teal-600" />
            </div>
            <span className="text-3xl font-extrabold text-teal-600 mt-2">{formatCurrency(kpis.montofacturado)}</span>
            <span className="text-xs text-teal-600 font-semibold mt-1">Valor facturado a partir de preformas</span>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Dual Bar Chart: Daily Preformas vs Facturadas */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-blue-500" /> Tendencia Diaria: Preformas Emitidas vs Facturadas
            </h2>
            <p className="text-xs text-gray-400 mb-6">Comparativo de preformas generadas y cuántas se convirtieron en facturas por fecha</p>
            <div className="h-[340px]">
              {diarioChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">Sin movimientos en este periodo</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={diarioChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Preformas Emitidas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="Preformas Facturadas" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: "#10B981" }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Preformas by Branch */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center">
              <Building2 className="w-5 h-5 mr-2 text-indigo-500" /> Preformas por Sucursal (Emitidas vs Facturadas)
            </h2>
            <p className="text-xs text-gray-400 mb-6">Desglose de preformas emitidas y facturadas agrupadas por sucursal</p>
            <div className="h-[340px]">
              {(preformasEstadisticas.porSucursal || []).length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">Sin datos por sucursal</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={preformasEstadisticas.porSucursal} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="sucursal" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="cantidad" fill="#6366F1" name="Preformas Emitidas" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="facturadas" fill="#10B981" name="Preformas Facturadas" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top 10 Articles */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
              <Layers className="w-5 h-5 mr-2 text-emerald-500" /> Top 10 Artículos Más Cotizados en Preformas
            </h2>
            <div className="h-[350px]">
              {(preformasEstadisticas.topArticulos || []).length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">Sin datos de artículos</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={(preformasEstadisticas.topArticulos || []).map(a => ({
                      ...a,
                      articuloCorto: a.articulo ? (a.articulo.length > 25 ? a.articulo.substring(0, 25) + '...' : a.articulo) : 'S/A'
                    }))} 
                    layout="vertical" 
                    margin={{ top: 5, right: 15, left: 60, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                    <XAxis type="number" tickFormatter={(val) => formatCurrency(val)} tick={{ fontSize: 10 }} />
                    <YAxis dataKey="articuloCorto" type="category" width={130} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(val, name, item) => [formatCurrency(val), item.payload.articulo || 'Monto Cotizado']} />
                    <Bar dataKey="montototal" fill="#10B981" radius={[0, 4, 4, 0]} name="Monto Cotizado" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top 10 Clients */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-500" /> Top 10 Clientes con Mayor Monto Cotizado
            </h2>
            <div className="h-[350px] overflow-y-auto">
              {(preformasEstadisticas.topClientes || []).length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">Sin datos de clientes</div>
              ) : (
                <div className="space-y-3 pr-2">
                  {preformasEstadisticas.topClientes.map((c, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-bold text-sm text-gray-800">{c.cliente}</p>
                          <p className="text-xs text-gray-400">
                            {c.cantidadpreformas} preforma(s) emitidas • <span className="text-emerald-600 font-semibold">{c.preformasfacturadas} facturada(s)</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-sm text-blue-600 block">{formatCurrency(c.montototal)}</span>
                        {c.montofacturado > 0 && <span className="text-xxs text-emerald-600 font-bold block">Facturado: {formatCurrency(c.montofacturado)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Preformas Table with Invoice Number */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" /> Registro Detallado de Preformas y Facturas
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Listado de preformas registradas, estado de vigencia y número de factura vinculada</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por preforma, factura o cliente..."
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={searchPreforma}
                  onChange={(e) => setSearchPreforma(e.target.value)}
                />
              </div>
              <button
                onClick={handleExportarPreformas}
                title="Exportar a Excel"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
              >
                <Download size={14} /> Excel
              </button>
              <button
                onClick={handlePrintPreformasReport}
                title="Imprimir PDF"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
              >
                <Printer size={14} /> PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 font-semibold">
                <tr>
                  <th className="px-4 py-3">N° Preforma</th>
                  <th className="px-4 py-3">N° Factura</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Expiración</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">IVA</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredPreformas.map((p, i) => {
                  const numFact = p.numeroFactura || p.numerofactura;
                  const estadoVal = p.estadoVigencia || p.estadovigencia;
                  const fechaExp = p.fechaExpiracion || p.fechaexpiracion;
                  const subTotalVal = p.subTotal ?? p.subtotal;

                  return (
                    <tr key={i} className="bg-white border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-blue-600">{p.documento || `PF-${p.id}`}</td>
                      <td className="px-4 py-3 font-bold">
                        {numFact ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-xs font-mono">
                            #{numFact}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs font-normal">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{formatDate(p.fecha)}</td>
                      <td className="px-4 py-3">{formatDate(fechaExp)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{p.cliente}</td>
                      <td className="px-4 py-3 text-xs">{p.sucursal}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          estadoVal === 'Facturada' ? 'bg-emerald-100 text-emerald-800' :
                          estadoVal === 'Vigente' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {estadoVal}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(subTotalVal)}</td>
                      <td className="px-4 py-3 text-right text-gray-400">{formatCurrency(p.iva)}</td>
                      <td className="px-4 py-3 font-bold text-slate-800 text-right">{formatCurrency(p.total)}</td>
                    </tr>
                  );
                })}
                {filteredPreformas.length === 0 && (
                  <tr>
                    <td colSpan="10" className="text-center py-8 text-gray-400">No se encontraron preformas con el filtro seleccionado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderDevoluciones = () => {
    const filteredDevs = devolucionesList.filter(d => {
      const q = searchDevolucionFilter.toLowerCase();
      return !q || 
        (d.numerodevolucion || '').toLowerCase().includes(q) ||
        (d.numerofactura || '').toLowerCase().includes(q) ||
        (d.cliente || '').toLowerCase().includes(q) ||
        (d.sucursal || '').toLowerCase().includes(q) ||
        (d.numeronotacredito || '').toLowerCase().includes(q);
    });

    return (
      <div className="space-y-6">
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <RotateCcw className="text-blue-600" size={24} />
              Gestión de Devoluciones y Notas de Crédito
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Registro de devoluciones de items por sucursal a ubicación original y emisión de notas de crédito / reintegros en efectivo.
            </p>
          </div>
          <button
            onClick={() => {
              setShowDevolucionModal(true);
              setDevolucionInvoiceData(null);
              setSearchInvoiceQuery('');
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md transition-all hover:scale-105"
          >
            <Plus size={18} /> Nueva Devolución
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por devolución, factura, cliente..."
              value={searchDevolucionFilter}
              onChange={e => setSearchDevolucionFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Total Devoluciones: <span className="font-bold text-slate-800">{filteredDevs.length}</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loadingDevoluciones ? (
            <div className="p-12 text-center text-slate-400">Cargando devoluciones...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-xs border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Devolución #</th>
                    <th className="px-4 py-3">Factura Orig.</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Sucursal</th>
                    <th className="px-4 py-3">Tipo Reintegro</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
                    <th className="px-4 py-3 text-right">IVA</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDevs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-10 text-slate-400">
                        No hay devoluciones registradas.
                      </td>
                    </tr>
                  ) : (
                    filteredDevs.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-blue-600">{d.numerodevolucion}</td>
                        <td className="px-4 py-3 font-mono text-slate-700">#{d.numerofactura}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(d.fecha)}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{d.cliente}</td>
                        <td className="px-4 py-3 text-slate-600">{d.sucursal}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                            d.tiporeintegro === 'NOTA_CREDITO' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {d.tiporeintegro === 'NOTA_CREDITO' ? <CreditCard size={13} /> : <Banknote size={13} />}
                            {d.tiporeintegro === 'NOTA_CREDITO' ? `NC (${d.numeronotacredito || 'NC'})` : 'EFECTIVO'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(d.subtotal)}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(d.iva)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(d.total)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handlePrintPastDevolucion(d.id)}
                            className="inline-flex items-center gap-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                            title="Imprimir Comprobante Oficial"
                          >
                            <Printer size={14} /> Imprimir
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Devolución */}
        {showDevolucionModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowDevolucionModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 bg-slate-900 text-white">
                <div className="flex items-center gap-3">
                  <RotateCcw className="text-blue-400" size={22} />
                  <div>
                    <h2 className="text-lg font-bold">Procesar Devolución de Factura</h2>
                    <p className="text-xs text-slate-400">Devolución total o parcial de ítems a su ubicación original</p>
                  </div>
                </div>
                <button onClick={() => setShowDevolucionModal(false)} className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Search Bar */}
                <form onSubmit={handleSearchInvoiceForDevolucion} className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="Ingrese Número de Factura o ID (Ej: 28007, C02841)..."
                      value={searchInvoiceQuery}
                      onChange={e => setSearchInvoiceQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loadingInvoiceData}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {loadingInvoiceData ? <RefreshCw className="animate-spin" size={16} /> : <Search size={16} />}
                    Buscar Factura
                  </button>
                </form>

                {devolucionInvoiceData && devolucionInvoiceData.factura && (
                  <div className="space-y-6 animate-fadeIn">
                    {/* Invoice Summary Card */}
                    <div className="bg-blue-50/60 border border-blue-100 p-4 rounded-xl grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 font-semibold block">FACTURA</span>
                        <span className="text-sm font-extrabold text-blue-900">#{devolucionInvoiceData.factura.numero}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block">CLIENTE</span>
                        <span className="text-sm font-bold text-slate-800">{devolucionInvoiceData.factura.cliente}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block">SUCURSAL</span>
                        <span className="text-sm font-bold text-slate-800">{devolucionInvoiceData.factura.sucursal}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block">CONDICIÓN PAGO</span>
                        <span className="text-sm font-bold text-indigo-700">{devolucionInvoiceData.factura.condicionpago || (devolucionInvoiceData.factura.diascredito > 0 ? 'Crédito' : 'Contado')}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block">FECHA FACTURA</span>
                        <span className="text-sm font-bold text-slate-800">{formatDate(devolucionInvoiceData.factura.fecha)}</span>
                      </div>
                    </div>

                    {(Number(devolucionInvoiceData.factura.diascredito) > 0 || (devolucionInvoiceData.factura.estadopago && devolucionInvoiceData.factura.estadopago !== 'PAGADO')) && (
                      <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-amber-900 text-xs flex items-start gap-3 shadow-sm">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block text-sm text-amber-900">FACTURA REGISTRADA A CRÉDITO</span>
                          <p className="mt-0.5 text-amber-800">
                            Esta devolución se aplicará <strong>directamente como abono al saldo de la deuda</strong> de esta factura. Si la devolución cubre el importe pendiente total, la Cuenta por Cobrar (CxC) de esta factura quedará <strong>AUTOMÁTICAMENTE CANCELADA</strong>.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Items Table */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Seleccione ítems y cantidades a devolver</h4>
                      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left">
                          <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                            <tr>
                              <th className="p-3">Artículo</th>
                              <th className="p-3">Bodega / Ubicación Orig.</th>
                              <th className="p-3 text-right">Facturado</th>
                              <th className="p-3 text-right">Dev. Previa</th>
                              <th className="p-3 text-right">Disponible</th>
                              <th className="p-3 text-right w-32">Cant. a Devolver</th>
                              <th className="p-3 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {devolucionInvoiceData.detalles.map((det) => {
                              const id = det.facturadetalleid || det.facturaDetalleId;
                              const cantDisp = Number(det.cantidaddisponible ?? det.cantidadDisponible ?? 0);
                              const cantDev = Number(devolucionQuantities[id]) || 0;
                              const pUnit = Number(det.preciounitario || det.precioUnitario || 0);
                              const descUnit = Number(det.cantidadfacturada) > 0 ? (Number(det.descuento || 0) / Number(det.cantidadfacturada)) : 0;
                              const subItem = (pUnit - descUnit) * cantDev;

                              return (
                                <tr key={id} className="hover:bg-slate-50">
                                  <td className="p-3 font-medium text-slate-900">
                                    <span className="font-mono text-blue-600 block">{det.articulocodigo || det.articuloCodigo}</span>
                                    {det.articulanombre || det.articuloNombre}
                                  </td>
                                  <td className="p-3 text-slate-600">
                                    {det.bodeganombre || det.bodegaNombre} / <span className="font-mono font-bold text-indigo-600">{det.ubicacionnombre || det.ubicacionNombre}</span>
                                  </td>
                                  <td className="p-3 text-right font-bold text-slate-700">{det.cantidadfacturada}</td>
                                  <td className="p-3 text-right text-slate-400">{det.cantidaddevuelta || det.cantidadDevuelta}</td>
                                  <td className="p-3 text-right font-bold text-emerald-600">{cantDisp}</td>
                                  <td className="p-3 text-right">
                                    <input
                                      type="number"
                                      min="0"
                                      max={cantDisp}
                                      step="any"
                                      value={cantDev}
                                      onChange={e => {
                                        const val = Math.min(cantDisp, Math.max(0, parseFloat(e.target.value) || 0));
                                        setDevolucionQuantities(prev => ({ ...prev, [id]: val }));
                                      }}
                                      className="w-24 px-2 py-1 border border-slate-300 rounded text-right font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                  </td>
                                  <td className="p-3 text-right font-bold text-blue-700">{formatCurrency(subItem)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Calculation Totals & Reintegration Method */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                      {/* Method Selection */}
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Método de Reintegro de Importe</label>
                        <div className="space-y-2">
                          <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${tipoReintegro === 'NOTA_CREDITO' ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold' : 'bg-white border-slate-200 text-slate-700'}`}>
                            <input
                              type="radio"
                              name="tipoReintegro"
                              value="NOTA_CREDITO"
                              checked={tipoReintegro === 'NOTA_CREDITO'}
                              onChange={() => setTipoReintegro('NOTA_CREDITO')}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <CreditCard size={18} className="text-blue-600" />
                            <div>
                              <span>Nota de Crédito a Favor del Cliente</span>
                              <p className="text-[11px] font-normal text-slate-500">Genera documento NC para aplicar en futuros pagos</p>
                            </div>
                          </label>

                          <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${tipoReintegro === 'EFECTIVO' ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold' : 'bg-white border-slate-200 text-slate-700'}`}>
                            <input
                              type="radio"
                              name="tipoReintegro"
                              value="EFECTIVO"
                              checked={tipoReintegro === 'EFECTIVO'}
                              onChange={() => setTipoReintegro('EFECTIVO')}
                              className="text-emerald-600 focus:ring-emerald-500"
                            />
                            <Banknote size={18} className="text-emerald-600" />
                            <div>
                              <span>Reintegro en Efectivo (Devolución de Dinero)</span>
                              <p className="text-[11px] font-normal text-slate-500">Devuelve importe en efectivo directamente al cliente</p>
                            </div>
                          </label>
                        </div>

                        <div className="mt-3">
                          <label className="text-xs font-semibold text-slate-600 block mb-1">Observaciones / Motivo</label>
                          <textarea
                            rows={2}
                            value={devolucionObservacion}
                            onChange={e => setDevolucionObservacion(e.target.value)}
                            placeholder="Motivo de la devolución..."
                            className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Totals Breakdown */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Resumen de Reintegro (Incluye IVA 15%)</h4>
                        {(() => {
                          let sub = 0;
                          (devolucionInvoiceData.detalles || []).forEach(det => {
                            const id = det.facturadetalleid || det.facturaDetalleId;
                            const cantDev = Number(devolucionQuantities[id]) || 0;
                            const pUnit = Number(det.preciounitario || det.precioUnitario || 0);
                            const descUnit = Number(det.cantidadfacturada) > 0 ? (Number(det.descuento || 0) / Number(det.cantidadfacturada)) : 0;
                            sub += (pUnit - descUnit) * cantDev;
                          });
                          const iva = sub * 0.15;
                          const tot = sub + iva;

                          return (
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between text-slate-600">
                                <span>Subtotal Neto a Devolver:</span>
                                <span className="font-bold">{formatCurrency(sub)}</span>
                              </div>
                              <div className="flex justify-between text-slate-600">
                                <span>IVA Reintegrado (15%):</span>
                                <span className="font-bold">{formatCurrency(iva)}</span>
                              </div>
                              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-3 border-t border-slate-200">
                                <span>TOTAL A REINTEGRAR:</span>
                                <span className={tipoReintegro === 'NOTA_CREDITO' ? 'text-blue-600' : 'text-emerald-600'}>{formatCurrency(tot)}</span>
                              </div>
                            </div>
                          );
                        })()}

                        <button
                          onClick={handleProcessDevolucion}
                          disabled={processingDevolucion}
                          className="mt-5 w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                        >
                          {processingDevolucion ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                          Procesar e Imprimir Comprobante
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Dashboard de Ventas</h1>
          <p className="text-gray-500">Métricas principales de facturación, cotizaciones y cuentas por cobrar</p>
        </div>
        
        {activeTab === 'resumen' && (
          <button 
            onClick={handleExportarFacturas}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            <Download size={18} /> Exportar Todas las Facturas
          </button>
        )}
      </header>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-8 w-fit">
        <button
          onClick={() => setActiveTab('resumen')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'resumen' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          Resumen de Ventas
        </button>
        <button
          onClick={() => setActiveTab('preformas')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'preformas' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          Estadísticas de Preformas
        </button>
        <button
          onClick={() => setActiveTab('cxc')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'cxc' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          Cuentas por Cobrar (CXC)
        </button>
        <button
          onClick={() => setActiveTab('devoluciones')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'devoluciones' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          <RotateCcw size={16} /> Devolución de Factura
        </button>
      </div>

      {activeTab === 'resumen' && renderResumen()}
      {activeTab === 'preformas' && renderPreformas()}
      {activeTab === 'cxc' && renderCxC()}
      {activeTab === 'devoluciones' && renderDevoluciones()}

      {/* Modal 1: Descuentos por Vendedor de la Sucursal Seleccionada */}
      {showSucursalDescuentosModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/20 text-emerald-300 p-1.5 rounded-lg border border-emerald-500/30">
                    <Percent className="w-5 h-5" />
                  </span>
                  <h2 className="text-xl font-black tracking-tight">Descuentos por Vendedor</h2>
                </div>
                <p className="text-xs text-slate-300 mt-1 font-medium">
                  Sucursal: <strong className="text-emerald-400 font-bold">{selectedSucursalDescuentos}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowSucursalDescuentosModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {loadingVendedoresDescuentos ? (
                <div className="py-12 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">Cargando desglose de vendedores...</p>
                </div>
              ) : vendedoresDescuentosList.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-xl border border-slate-200">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">No se encontraron facturas con descuento para esta sucursal.</p>
                </div>
              ) : (
                <>
                  {/* Summary Header Cards */}
                  {(() => {
                    const totalDescuentosSucursal = vendedoresDescuentosList.reduce((acc, v) => acc + (Number(v.totaldescuento) || 0), 0);
                    const totalFacturasSucursal = vendedoresDescuentosList.reduce((acc, v) => acc + (Number(v.cantidadfacturas) || 0), 0);
                    const totalVentasSucursal = vendedoresDescuentosList.reduce((acc, v) => acc + (Number(v.totalventas) || 0), 0);

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                          <span className="text-xs text-emerald-700 font-bold uppercase block">Total Descuentos Sucursal</span>
                          <span className="text-xl font-extrabold text-emerald-900">{formatCurrency(totalDescuentosSucursal)}</span>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl">
                          <span className="text-xs text-blue-700 font-bold uppercase block">Facturas con Descuento</span>
                          <span className="text-xl font-extrabold text-blue-900">{totalFacturasSucursal} facturas</span>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 p-3.5 rounded-xl">
                          <span className="text-xs text-purple-700 font-bold uppercase block">Total Ventas Sucursal</span>
                          <span className="text-xl font-extrabold text-purple-900">{formatCurrency(totalVentasSucursal)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Vendedores Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 uppercase font-extrabold border-b border-slate-200">
                        <tr>
                          <th className="p-3">Vendedor</th>
                          <th className="p-3 text-center">Facturas</th>
                          <th className="p-3 text-right">Total Ventas</th>
                          <th className="p-3 text-right">Total Descuento</th>
                          <th className="p-3 text-center">% del Total Sucursal</th>
                          <th className="p-3 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white font-medium">
                        {(() => {
                          const totalSucursal = vendedoresDescuentosList.reduce((acc, v) => acc + (Number(v.totaldescuento) || 0), 0);
                          return vendedoresDescuentosList.map((v, idx) => {
                            const desc = Number(v.totaldescuento) || 0;
                            const pct = totalSucursal > 0 ? ((desc / totalSucursal) * 100).toFixed(1) : 0;
                            return (
                              <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3">
                                  <div className="font-bold text-slate-900">{v.vendedor}</div>
                                  <div className="text-[10px] text-slate-400 font-semibold">{v.sucursal}</div>
                                </td>
                                <td className="p-3 text-center font-bold text-slate-700">
                                  <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                                    {v.cantidadfacturas}
                                  </span>
                                </td>
                                <td className="p-3 text-right text-slate-600 font-semibold">{formatCurrency(v.totalventas)}</td>
                                <td className="p-3 text-right font-extrabold text-emerald-700 text-sm">
                                  {formatCurrency(desc)}
                                </td>
                                <td className="p-3 text-center min-w-[130px]">
                                  <div className="flex items-center gap-2">
                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                                      <div
                                        className="bg-emerald-500 h-full rounded-full transition-all"
                                        style={{ width: `${Math.min(100, pct)}%` }}
                                      />
                                    </div>
                                    <span className="text-[11px] font-extrabold text-slate-700 w-10 text-right">{pct}%</span>
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => handleOpenVendedorFacturasModal(v)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 mx-auto shadow-sm transition-all hover:scale-105"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> Ver Facturas ({v.cantidadfacturas})
                                  </button>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowSucursalDescuentosModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Tabla de Detalle de Facturas con Descuento por Vendedor */}
      {showVendedorFacturasModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="max-w-5xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowVendedorFacturasModal(false)}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Volver a lista de vendedores"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <h2 className="text-xl font-black tracking-tight">Facturas con Descuento</h2>
                </div>
                <p className="text-xs text-slate-300 mt-1 font-medium">
                  Vendedor: <strong className="text-emerald-400 font-bold">{selectedVendedorData?.vendedor}</strong> | Sucursal: <strong className="text-slate-200">{selectedSucursalDescuentos}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowVendedorFacturasModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            {/* Sub-Header & Search */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por N° factura o cliente..."
                  value={searchFacturaDescuentoFilter}
                  onChange={e => setSearchFacturaDescuentoFilter(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              {(() => {
                const totalDescVend = facturasDescuentosList.reduce((acc, f) => acc + (Number(f.montodescuento) || 0), 0);
                const avgPct = facturasDescuentosList.length > 0
                  ? (facturasDescuentosList.reduce((acc, f) => acc + (Number(f.porcentajedescuento) || 0), 0) / facturasDescuentosList.length).toFixed(1)
                  : 0;

                return (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg font-bold border border-emerald-200">
                      Total Descuento Vendedor: {formatCurrency(totalDescVend)}
                    </span>
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg font-bold border border-blue-200">
                      Promedio Descuento: {avgPct}%
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {loadingFacturasDescuentos ? (
                <div className="py-12 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">Cargando detalle de facturas...</p>
                </div>
              ) : (
                (() => {
                  const filtered = facturasDescuentosList.filter(f => {
                    const q = searchFacturaDescuentoFilter.toLowerCase();
                    return (f.numerofactura || '').toLowerCase().includes(q) || (f.cliente || '').toLowerCase().includes(q);
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-12 text-center bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-sm font-bold text-slate-600">No se encontraron facturas coincidentes.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 uppercase font-extrabold border-b border-slate-200">
                          <tr>
                            <th className="p-3"># Factura</th>
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Cliente</th>
                            <th className="p-3 text-right">Total Factura</th>
                            <th className="p-3 text-right">Monto Descuento</th>
                            <th className="p-3 text-center">% Descuento Que Representa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white font-medium">
                          {filtered.map((f, idx) => {
                            const pct = Number(f.porcentajedescuento) || 0;
                            let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                            if (pct > 15 && pct <= 25) badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
                            if (pct > 25) badgeBg = 'bg-red-50 text-red-700 border-red-200';

                            return (
                              <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3 font-extrabold text-blue-700 font-mono text-sm">
                                  #{f.numerofactura}
                                </td>
                                <td className="p-3 text-slate-600 font-medium">{formatDate(f.fecha)}</td>
                                <td className="p-3 font-bold text-slate-800">{f.cliente}</td>
                                <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(f.totalfactura)}</td>
                                <td className="p-3 text-right font-extrabold text-emerald-700 text-sm">
                                  -{formatCurrency(f.montodescuento)}
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border ${badgeBg}`}>
                                    <Tag className="w-3 h-3" /> {pct.toFixed(2)}%
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => setShowVendedorFacturasModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors flex items-center gap-1.5"
              >
                <Undo2 className="w-3.5 h-3.5" /> Volver a Vendedores
              </button>
              <button
                onClick={() => {
                  setShowVendedorFacturasModal(false);
                  setShowSucursalDescuentosModal(false);
                }}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
              >
                Cerrar Todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ventas;
