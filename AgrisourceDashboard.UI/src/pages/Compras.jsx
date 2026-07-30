import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { ShoppingCart, Download, Printer, Search, Briefcase, FileWarning, AlertCircle, Calendar, Upload, FileSpreadsheet, CheckCircle2, Info, ChevronRight, Building2, User, CreditCard, Tag, ClipboardList, FileText, TrendingUp, Users, Layers, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const formatDate = (dateString) => {
  if (!dateString) return '';
  const datePart = dateString.split('T')[0];
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
};

const Compras = ({ filters }) => {
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('compras_active_tab') || 'resumen';
  });

  useEffect(() => {
    sessionStorage.setItem('compras_active_tab', activeTab);
  }, [activeTab]);
  
  // Resumen States
  const [compras, setCompras] = useState([]);
  const [comprasListado, setComprasListado] = useState([]);
  const [searchCompra, setSearchCompra] = useState('');
  const [comprasResumen, setComprasResumen] = useState({
    solicitudes: { totalsolicitudes: 0, solicitudesaprobadas: 0, solicitudestransito: 0 },
    ordenes: { totalordenes: 0, montototalordenes: 0, ordenescompradas: 0, montocomprado: 0, ordenespendientes: 0, montopendiente: 0 },
    diario: []
  });
  const [loadingResumen, setLoadingResumen] = useState(true);

  // Compras Realizadas States
  const [comprasRealizadas, setComprasRealizadas] = useState([]);
  const [loadingRealizadas, setLoadingRealizadas] = useState(true);
  const [searchRealizada, setSearchRealizada] = useState('');

  // CXP States
  const [cxpProveedores, setCxpProveedores] = useState([]);
  const [cxpDetalle, setCxpDetalle] = useState([]);
  const [loadingCxp, setLoadingCxp] = useState(true);
  
  // Search filter for providers list
  const [searchProvider, setSearchProvider] = useState('');

  // ──────────────────────────────────────────────────
  // Cargador OC — Form + Excel detalles
  // ──────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];

  // Catalogs for dropdowns
  const [catSucursales, setCatSucursales] = useState([]);
  const [catProveedores, setCatProveedores] = useState([]);
  const [catCondiciones, setCatCondiciones] = useState([]);
  const [catSolicitudes, setCatSolicitudes] = useState([]);

  // Header form state
  const [ocForm, setOcForm] = useState({
    FechaSolicitud: today,
    SucursalId: '',
    SolicitudId: '21',
    ProveedorId: '',
    TipoPago: 'contado',     // 'contado' | 'credito'
    DiasPago: 30,            // días de crédito
    AplicarIva: true,
    PorcentajeDescuento: 0,
    Observacion: '',
    MonedaId: 1,             // 1=NIO  2=USD
    TipoCompra: 'nacional',  // 'nacional' | 'internacional'
    CreatedBy: 1
  });

  // Excel file and parsed details
  const [file, setFile] = useState(null);
  const [detallesExcel, setDetallesExcel] = useState([]);
  const [importStatus, setImportStatus] = useState({ loading: false, success: null, error: null, result: null });

  const [catArticulos, setCatArticulos] = useState([]);

  // Load catalogs when tab is active
  useEffect(() => {
    if (activeTab === 'cargar') {
      const loadCatalogs = async () => {
        try {
          const [sucRes, provRes, condRes, artRes] = await Promise.all([
            axios.get(`${API_BASE_URL}/sucursales`),
            axios.get(`${API_BASE_URL}/proveedores-catalogo`),
            axios.get(`${API_BASE_URL}/condiciones-pago-catalogo`),
            axios.get(`${API_BASE_URL}/articulos-catalogo`)
          ]);
          setCatSucursales(sucRes.data || []);
          setCatProveedores(provRes.data || []);
          setCatCondiciones(condRes.data || []);
          setCatArticulos(artRes.data || []);
        } catch (e) {
          console.error('Error cargando catálogos', e);
        }
      };
      loadCatalogs();
    }
  }, [activeTab]);

  // Load solicitudes when sucursal changes — filtered by sucursal
  useEffect(() => {
    setCatSolicitudes([]);
    if (!ocForm.SucursalId) return;
    axios.get(`${API_BASE_URL}/solicitudes-compra-catalogo`, {
      params: { sucursalId: ocForm.SucursalId }
    })
      .then(r => setCatSolicitudes(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCatSolicitudes([]));
  }, [ocForm.SucursalId]);

  const handleOcFormChange = (field, value) => {
    setOcForm(prev => ({ ...prev, [field]: value }));
  };

  // Parse the Excel file to read ONLY the article details
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setImportStatus({ loading: false, success: null, error: null, result: null });
    setDetallesExcel([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(evt.target.result, { type: 'binary', cellDates: false });
        // Accept either 'cargar_articulos' or 'Orden_Compra_Detalles'
        const sheetName = workbook.SheetNames.find(s =>
          ['cargar_articulos', 'referencia_articulos', 'Detalles'].includes(s)
        ) || workbook.SheetNames[0];
        const ws = workbook.Sheets[sheetName];
        // Start reading from row 4 (index 3) to skip titles
        const rows = XLSX.utils.sheet_to_json(ws, { range: 2, defval: '' });

        const detalles = rows
          .map(r => {
            const dropdownVal = String(r['Buscar y Seleccionar Artículo *'] || r['Buscar y Seleccionar Artículo'] || '').trim();
            const artIdStr = r['ID Artículo (Fórmula)'] || r['ID Artículo'] || r['ID Articulo'] || r['id'] || r['ID'];
            const cantStr = r['Cantidad *'] || r['Cantidad'] || r['cantidad'] || r['Cant.'];
            const precioStr = r['Costo Unitario *'] || r['Costo Unitario'] || r['costo_unitario'] || r['precio_cu'] || r['Precio U.'];
            
            let aId = parseInt(artIdStr) || 0;
            let match = null;

            // If ID from formula is missing (e.g. not recalculated), try parsing code from dropdown "CODE - NAME"
            if (aId === 0 && dropdownVal && dropdownVal.includes(' - ')) {
              const codePart = dropdownVal.split(' - ')[0].trim();
              match = catArticulos.find(x => String(x.code ?? x.Code ?? x.codigo ?? '').toLowerCase() === codePart.toLowerCase());
              if (match) {
                aId = match.id ?? match.Id ?? match.ID ?? 0;
              }
            } else if (aId > 0) {
              match = catArticulos.find(x => (x.id ?? x.Id ?? x.ID) === aId);
            }

            return {
              ArticuloId: aId,
              Codigo: match ? (match.code ?? match.Code ?? match.codigo ?? '') : (dropdownVal ? dropdownVal.split(' - ')[0] : ''),
              Nombre: match ? (match.name ?? match.Name ?? match.nombre ?? '') : (dropdownVal ? dropdownVal.split(' - ')[1] : ''), 
              Cantidad: parseFloat(cantStr) || 0,
              PrecioCu: parseFloat(precioStr) || 0
            };
          })
          .filter(r => r.ArticuloId > 0 && r.Cantidad > 0);

        if (detalles.length === 0) {
          throw new Error('No se encontraron artículos válidos en la hoja "cargar_articulos". Asegúrese de seleccionar artículos de la lista y que la Cantidad y Costo Unitario estén llenos.');
        }
        setDetallesExcel(detalles);
      } catch (err) {
        setImportStatus({ loading: false, success: null, error: err.message, result: null });
        setDetallesExcel([]);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  // Computed totals for the live preview
  const ocTotals = (() => {
    const sub = detallesExcel.reduce((acc, d) => acc + d.Cantidad * d.PrecioCu, 0);
    const desc = sub * ((parseFloat(ocForm.PorcentajeDescuento) || 0) / 100);
    const base = sub - desc;
    const iva = ocForm.AplicarIva ? base * 0.15 : 0;
    return { sub, desc, iva, total: base + iva };
  })();

  // Derive CondicionPago ID from catalog based on TipoPago + DiasPago
  const deriveCondicionPagoId = () => {
    if (catCondiciones.length === 0) return 1; // fallback
    if (ocForm.TipoPago === 'contado') {
      // Find contado: dias = 0 or smallest dias
      const c = catCondiciones.find(x => (x.dias ?? x.Dias) === 0)
             || catCondiciones.reduce((a, b) => ((a.dias ?? a.Dias) < (b.dias ?? b.Dias) ? a : b));
      return c.id ?? c.Id ?? 1;
    }
    // Crédito: find closest dias match
    const target = parseInt(ocForm.DiasPago) || 30;
    const c = catCondiciones.reduce((prev, curr) => {
      const pd = Math.abs((prev.dias ?? prev.Dias ?? 0) - target);
      const cd = Math.abs((curr.dias ?? curr.Dias ?? 0) - target);
      return cd < pd ? curr : prev;
    });
    return c.id ?? c.Id ?? 1;
  };

  const isFormValid = ocForm.SucursalId && ocForm.ProveedorId &&
    (ocForm.TipoPago === 'contado' || (ocForm.TipoPago === 'credito' && ocForm.DiasPago > 0)) &&
    detallesExcel.length > 0;

  const handleImportar = async () => {
    if (!isFormValid) return;
    setImportStatus({ loading: true, success: null, error: null, result: null });
    const condicionId = deriveCondicionPagoId();
    const obsExtra = ocForm.TipoCompra === 'internacional' ? '[IMPORTACIÓN] ' : '';
    try {
      const payload = {
        Cabecera: {
          FechaSolicitud: new Date(ocForm.FechaSolicitud).toISOString(),
          SucursalId: parseInt(ocForm.SucursalId),
          SolicitudId: ocForm.SolicitudId ? parseInt(ocForm.SolicitudId) : null,
          ProveedorId: parseInt(ocForm.ProveedorId),
          CondicionPago: condicionId,
          AplicarIva: Boolean(ocForm.AplicarIva),
          PorcentajeDescuento: parseFloat(ocForm.PorcentajeDescuento) || 0,
          Observacion: obsExtra + (ocForm.Observacion || ''),
          MonedaId: parseInt(ocForm.MonedaId) || 1,
          CreatedBy: 1
        },
        Detalles: detallesExcel.map(d => ({
          ArticuloId: d.ArticuloId,
          Cantidad: d.Cantidad,
          PrecioCu: d.PrecioCu
        }))
      };
      const res = await axios.post(`${API_BASE_URL}/cargar-compras`, payload);
      setImportStatus({ loading: false, success: res.data.message, error: null, result: res.data });
      setDetallesExcel([]);
      setFile(null);
      setOcForm(prev => ({ ...prev, SolicitudId: '', Observacion: '' }));
      fetchResumen();
      fetchCxp();
    } catch (err) {
      const errMsg = err.response?.data || err.message || 'Error desconocido.';
      setImportStatus({ loading: false, success: null, error: typeof errMsg === 'object' ? JSON.stringify(errMsg) : String(errMsg), result: null });
    }
  };


  useEffect(() => {
    if (activeTab === 'resumen') {
      fetchResumen();
    } else if (activeTab === 'realizadas') {
      fetchComprasRealizadas();
    } else {
      fetchCxp();
    }
  }, [filters, activeTab]);

  const fetchResumen = async () => {
    setLoadingResumen(true);
    try {
      const [resComp, resArt, listRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/compras-resumen-comparativo`, { params: filters }),
        axios.get(`${API_BASE_URL}/compras-articulos`, { params: filters }),
        axios.get(`${API_BASE_URL}/compras-listado`, { params: filters })
      ]);
      setComprasResumen(resComp.data);
      setCompras(resArt.data);
      setComprasListado(listRes.data || []);
    } catch (error) {
      console.error("Error fetching compras data:", error);
    } finally {
      setLoadingResumen(false);
    }
  };

  const fetchComprasRealizadas = async () => {
    setLoadingRealizadas(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/compras-realizadas`, { params: filters });
      setComprasRealizadas(res.data || []);
    } catch (e) {
      console.error("Error fetching compras realizadas:", e);
    } finally {
      setLoadingRealizadas(false);
    }
  };

  const fetchCxp = async () => {
    setLoadingCxp(true);
    try {
      const [provRes, detRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/cuentas-pagar-pendientes`, { params: filters }),
        axios.get(`${API_BASE_URL}/cuentas-pagar-detalle`, { params: filters })
      ]);
      setCxpProveedores(provRes.data);
      setCxpDetalle(detRes.data);
    } catch (error) {
      console.error("Error fetching cxp data:", error);
    } finally {
      setLoadingCxp(false);
    }
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

  const handleExportarComprasListado = () => {
    if (comprasListado.length === 0) {
      alert("No hay registros de compras para exportar.");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(comprasListado.map(c => ({
      'N° Orden': c.numeroOrden || c.numeroorden || `OC-${c.id}`,
      'N° Factura': c.numeroFactura || c.numerofactura || 'Sin Factura',
      Fecha: formatDate(c.fecha),
      Proveedor: c.proveedor,
      Sucursal: c.sucursal,
      'Condición Pago': c.condicionPago || c.condicionpago,
      Estado: c.estado,
      SubTotal: c.subTotal ?? c.subtotal,
      IVA: c.iva,
      Total: c.total
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Detalle_Compras");
    XLSX.writeFile(workbook, `Compras_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrintComprasListadoReport = () => {
    if (comprasListado.length === 0) return;
    const printWindow = window.open('', '_blank');
    const printContent = `
      <html>
        <head>
          <title>Reporte Detallado de Compras</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #333; }
            .header { border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-bottom: 20px; }
            .header-top { display: flex; justify-content: space-between; align-items: center; }
            h1 { color: #065f46; margin: 0; font-size: 24px; }
            .meta { display: flex; justify-content: space-between; margin-top: 15px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 25px; font-size: 13px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { background-color: #f8fafc; font-weight: 600; color: #475569; }
            .text-right { text-align: right; }
            .total-row { font-weight: bold; background-color: #e6f4ea; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <h1>REPORTE DETALLADO DE COMPRAS Y ÓRDENES</h1>
            </div>
            <div class="meta">
              <div><p><strong>Módulo:</strong> Compras</p></div>
              <div style="text-align: right;">
                <p><strong>Fecha Reporte:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Total Registros:</strong> ${comprasListado.length}</p>
              </div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>N° Orden</th>
                <th>N° Factura</th>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Sucursal</th>
                <th>Condición Pago</th>
                <th>Estado</th>
                <th class="text-right">SubTotal</th>
                <th class="text-right">IVA</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${comprasListado.map(c => `
                <tr>
                  <td><strong>${c.numeroOrden || c.numeroorden || 'OC-'+c.id}</strong></td>
                  <td>${c.numeroFactura || c.numerofactura || 'Sin Factura'}</td>
                  <td>${formatDate(c.fecha)}</td>
                  <td>${c.proveedor}</td>
                  <td>${c.sucursal}</td>
                  <td>${c.condicionPago || c.condicionpago}</td>
                  <td>${c.estado}</td>
                  <td class="text-right">${formatCurrency(c.subTotal ?? c.subtotal)}</td>
                  <td class="text-right">${formatCurrency(c.iva)}</td>
                  <td class="text-right">${formatCurrency(c.total)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="9">Total General Compras</td>
                <td class="text-right">${formatCurrency(comprasListado.reduce((acc, x) => acc + (x.total || 0), 0))}</td>
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

  // Export Providers summary (Excel)
  const handleExportarCxp = () => {
    if (cxpProveedores.length === 0) {
      alert("No hay saldos por pagar para exportar.");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(cxpProveedores);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "CXP_Saldos_Proveedores");
    XLSX.writeFile(workbook, `CXP_Proveedores_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export Detailed upcoming/critical payments (Excel)
  const handleExportarCxpDetalle = () => {
    if (cxpDetalle.length === 0) {
      alert("No hay detalles de cuentas por pagar para exportar.");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(cxpDetalle);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "CXP_Vencimientos");
    XLSX.writeFile(workbook, `CXP_Detalle_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Print CXP Summary (PDF)
  const handlePrintCxpReport = () => {
    if (cxpProveedores.length === 0) return;
    const printWindow = window.open('', '_blank');
    const printContent = `
      <html>
        <head>
          <title>Reporte de Cuentas por Pagar (CXP) - Resumen</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #333; }
            .header { border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-bottom: 20px; }
            .header-top { display: flex; justify-content: space-between; align-items: center; }
            h1 { color: #065f46; margin: 0; font-size: 24px; }
            .logo { height: 45px; object-fit: contain; }
            .meta { display: flex; justify-content: space-between; margin-top: 15px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 25px; font-size: 13px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { background-color: #f8fafc; font-weight: 600; color: #475569; }
            .text-right { text-align: right; }
            .total-row { font-weight: bold; background-color: #e6f4ea; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <h1>RESUMEN DE CUENTAS POR PAGAR (CXP)</h1>
              <img src="/src/assets/logo.jpg" class="logo" />
            </div>
            <div class="meta">
              <div>
                <p><strong>Tipo:</strong> Estado de Cuentas de Proveedores</p>
              </div>
              <div style="text-align: right;">
                <p><strong>Fecha Reporte:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Deuda Total CXP:</strong> ${formatCurrency(cxpProveedores.reduce((acc, p) => acc + (p.deudatotal || 0), 0))}</p>
              </div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Nit</th>
                <th>Órdenes/Facturas Pendientes</th>
                <th class="text-right">Total Pendiente</th>
              </tr>
            </thead>
            <tbody>
              ${cxpProveedores.map(p => `
                <tr>
                  <td>${p.proveedor}</td>
                  <td>${p.nit || 'N/A'}</td>
                  <td>${p.facturaspendientes} facturas</td>
                  <td class="text-right" style="font-weight: 600;">${formatCurrency(p.deudatotal)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="3">Total General CXP</td>
                <td class="text-right" style="font-weight: bold;">${formatCurrency(cxpProveedores.reduce((acc, p) => acc + (p.deudatotal || 0), 0))}</td>
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

  // Filter critical invoices (overdue, or expiring in less than 5 days)
  const criticalInvoices = cxpDetalle.filter(
    (d) => d.diasvencidos > 0 || (d.diasvencidos >= -5 && d.diasvencidos <= 0)
  );

  const renderResumen = () => {
    if (loadingResumen) return <div className="text-gray-500 animate-pulse text-lg">Cargando Compras...</div>;

    const chartData = comprasResumen.diario.map(d => ({
      fecha: formatDate(d.fecha),
      "Solicitudes": d.solicitudes,
      "Órdenes Realizadas": d.ordenesrealizadas,
      "Órdenes Compradas": d.ordenescompradas
    }));

    const filteredCompras = comprasListado.filter(c => {
      const numO = (c.numeroOrden || c.numeroorden || '').toLowerCase();
      const numF = (c.numeroFactura || c.numerofactura || '').toLowerCase();
      const prov = (c.proveedor || '').toLowerCase();
      const suc = (c.sucursal || '').toLowerCase();
      const q = searchCompra.toLowerCase();
      return numO.includes(q) || numF.includes(q) || prov.includes(q) || suc.includes(q);
    });

    return (
      <div className="space-y-8 mb-8">
        {/* KPI Cards Solicitudes */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Solicitudes de Compras</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <span className="text-sm text-gray-500 font-medium">Total Solicitudes</span>
              <span className="text-3xl font-extrabold text-slate-800 mt-2">{comprasResumen.solicitudes?.totalsolicitudes || 0}</span>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col border-l-4 border-l-blue-500">
              <span className="text-sm text-gray-500 font-medium">Solicitudes Aprobadas</span>
              <span className="text-3xl font-extrabold text-blue-600 mt-2">{comprasResumen.solicitudes?.solicitudesaprobadas || 0}</span>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col border-l-4 border-l-yellow-500">
              <span className="text-sm text-gray-500 font-medium">Solicitudes en Tránsito</span>
              <span className="text-3xl font-extrabold text-yellow-600 mt-2">{comprasResumen.solicitudes?.solicitudestransito || 0}</span>
            </div>
          </div>
        </div>

        {/* KPI Cards Ordenes */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Órdenes de Compras</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <span className="text-sm text-gray-500 font-medium">Órdenes Realizadas (Total)</span>
              <span className="text-3xl font-extrabold text-slate-800 mt-2">{comprasResumen.ordenes?.totalordenes || 0}</span>
              <span className="text-sm font-semibold text-slate-500 mt-1">{formatCurrency(comprasResumen.ordenes?.montototalordenes)}</span>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col border-l-4 border-l-emerald-500">
              <span className="text-sm text-gray-500 font-medium">Órdenes Compradas (Recibidas)</span>
              <span className="text-3xl font-extrabold text-emerald-600 mt-2">{comprasResumen.ordenes?.ordenescompradas || 0}</span>
              <span className="text-sm font-semibold text-emerald-500 mt-1">{formatCurrency(comprasResumen.ordenes?.montocomprado)}</span>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col border-l-4 border-l-indigo-500">
              <span className="text-sm text-gray-500 font-medium">Órdenes Pendientes</span>
              <span className="text-3xl font-extrabold text-indigo-600 mt-2">{comprasResumen.ordenes?.ordenespendientes || 0}</span>
              <span className="text-sm font-semibold text-indigo-500 mt-1">{formatCurrency(comprasResumen.ordenes?.montopendiente)}</span>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Grouped Comparative Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-indigo-500"/> Comparativo de Solicitudes y Órdenes de Compra
            </h2>
            <div className="h-[400px]">
              {chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">No hay movimientos en este periodo</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="fecha" tick={{fontSize: 11}} />
                    <YAxis tick={{fontSize: 11}} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="Solicitudes" fill="#3B82F6" name="Solicitudes" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Órdenes Realizadas" fill="#6366F1" name="Órdenes Realizadas" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Órdenes Compradas" fill="#10B981" name="Órdenes Compradas (Finalizadas)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top Articles (Top 10) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
              <ShoppingCart className="w-5 h-5 mr-2 text-emerald-500"/> Artículos Más Comprados
            </h2>
            <div className="h-[400px]">
              {compras.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">Sin datos de artículos</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compras.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 10, left: 30, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB"/>
                    <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(value)} tick={{fontSize: 10}} />
                    <YAxis dataKey="articulo" type="category" axisLine={false} tickLine={false} width={80} tick={{fontSize: 10}} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="totalcomprado" fill="#10B981" radius={[0, 4, 4, 0]} name="Total Comprado" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Purchases Table Grouped by Order / Invoice */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> Registro Detallado de Compras (Agrupado por Factura / Orden)
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Listado de órdenes de compra registradas, N° de factura del proveedor, sucursal, estado y montos</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por N° orden, factura, proveedor..."
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={searchCompra}
                  onChange={(e) => setSearchCompra(e.target.value)}
                />
              </div>
              <button
                onClick={handleExportarComprasListado}
                title="Exportar a Excel"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
              >
                <Download size={14} /> Excel
              </button>
              <button
                onClick={handlePrintComprasListadoReport}
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
                  <th className="px-4 py-3">N° Orden</th>
                  <th className="px-4 py-3">N° Factura</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3">Condición Pago</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">IVA</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompras.map((c, i) => {
                  const numOrden = c.numeroOrden || c.numeroorden;
                  const numFactura = c.numeroFactura || c.numerofactura || 'Sin Factura';
                  const proveedor = c.proveedor;
                  const sucursal = c.sucursal;
                  const condicion = c.condicionPago || c.condicionpago;
                  const estadoVal = c.estado;
                  const subtotalVal = c.subTotal ?? c.subtotal;

                  return (
                    <tr key={i} className="bg-white border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-emerald-700">#{numOrden || `OC-${c.id}`}</td>
                      <td className="px-4 py-3 font-semibold text-indigo-700">{numFactura}</td>
                      <td className="px-4 py-3">{formatDate(c.fecha)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{proveedor}</td>
                      <td className="px-4 py-3 text-xs">{sucursal}</td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-600">{condicion}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          estadoVal === 'Aprobado' || estadoVal === 'Finalizado' || estadoVal === 'APL' || estadoVal === 'FN' ? 'bg-emerald-100 text-emerald-800' :
                          estadoVal === 'Transito' || estadoVal === 'TR' ? 'bg-amber-100 text-amber-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {estadoVal || 'Aprobado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(subtotalVal)}</td>
                      <td className="px-4 py-3 text-right text-gray-400">{formatCurrency(c.iva)}</td>
                      <td className="px-4 py-3 font-bold text-slate-800 text-right">{formatCurrency(c.total)}</td>
                    </tr>
                  );
                })}
                {filteredCompras.length === 0 && (
                  <tr>
                    <td colSpan="10" className="text-center py-8 text-gray-400">No se encontraron órdenes de compra con el filtro seleccionado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCxp = () => {
    return (
      <>
        {/* Critical Invoices Alert Section */}
        {criticalInvoices.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
            <h2 className="text-lg font-bold text-red-800 flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-red-600 animate-bounce" />
              Alertas de Facturas Críticas de Pago
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {criticalInvoices.map((c, i) => (
                <div key={i} className="bg-white rounded-lg p-4 border border-red-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-bold text-gray-800">#{c.numeroorden}</span>
                      <span className={`px-2 py-0.5 rounded text-xxs font-bold ${
                        c.diasvencidos > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {c.diasvencidos > 0 ? `${c.diasvencidos} días vencida` : 'Próxima a vencer'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-700">{c.proveedor}</p>
                    <p className="text-xs text-gray-500 mb-2">{c.sucursal}</p>
                    <div className="flex items-center gap-1.5 text-xs text-red-600 mb-1">
                      <Calendar size={13} />
                      Vencimiento: {formatDate(c.fechavencimiento)}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t flex justify-between items-center">
                    <span className="text-xs text-gray-400">Total a pagar:</span>
                    <span className="text-sm font-bold text-red-600">{formatCurrency(c.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Provider accounts summary */}
          <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center"><Briefcase className="w-5 h-5 mr-2 text-gray-500"/> Saldos por Proveedor</h2>
              <div className="flex gap-1">
                <button 
                  onClick={handleExportarCxp}
                  title="Exportar a Excel"
                  className="bg-green-600 hover:bg-green-700 text-white p-1.5 rounded-lg transition-colors"
                >
                  <Download size={14} />
                </button>
                <button 
                  onClick={handlePrintCxpReport}
                  title="Imprimir PDF"
                  className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-lg transition-colors"
                >
                  <Printer size={14} />
                </button>
              </div>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Buscar proveedor..." 
                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                value={searchProvider}
                onChange={(e) => setSearchProvider(e.target.value)}
              />
            </div>

            {loadingCxp ? (
              <div className="text-gray-500 animate-pulse py-8 text-center">Cargando saldos...</div>
            ) : (
              <div className="overflow-y-auto max-h-[400px]">
                {cxpProveedores
                  .filter(p => p.proveedor.toLowerCase().includes(searchProvider.toLowerCase()))
                  .map((p, i) => (
                    <div key={i} className="flex justify-between items-center py-3 border-b hover:bg-gray-50 px-2 rounded-lg transition-colors">
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{p.proveedor}</p>
                        <p className="text-xs text-gray-400">NIT: {p.nit || 'N/A'} • {p.facturaspendientes} facturas</p>
                      </div>
                      <span className="font-bold text-sm text-emerald-600">{formatCurrency(p.deudatotal)}</span>
                    </div>
                ))}
                {cxpProveedores.length === 0 && (
                  <div className="text-center py-8 text-gray-400">No hay saldos pendientes.</div>
                )}
              </div>
            )}
          </div>

          {/* Upcoming Invoices Table */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center"><FileWarning className="w-5 h-5 mr-2 text-emerald-500"/> Próximas Facturas a Vencer</h2>
              <button 
                onClick={handleExportarCxpDetalle}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Download size={14} /> Exportar Detalle
              </button>
            </div>

            {loadingCxp ? (
              <div className="text-gray-500 animate-pulse py-8 text-center">Cargando vencimientos...</div>
            ) : (
              <div className="overflow-x-auto max-h-[450px]">
                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 font-semibold">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg">Fecha</th>
                      <th className="px-4 py-3">N° Orden</th>
                      <th className="px-4 py-3">Proveedor</th>
                      <th className="px-4 py-3">Sucursal</th>
                      <th className="px-4 py-3">Vencimiento</th>
                      <th className="px-4 py-3">Plazo</th>
                      <th className="px-4 py-3 rounded-tr-lg text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cxpDetalle.map((d, i) => (
                      <tr key={i} className="bg-white border-b hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">{formatDate(d.fecha)}</td>
                        <td className="px-4 py-3 font-bold text-emerald-600">#{d.numeroorden}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{d.proveedor}</td>
                        <td className="px-4 py-3 text-xs">{d.sucursal}</td>
                        <td className="px-4 py-3">{formatDate(d.fechavencimiento)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            d.diasvencidos > 0 ? 'bg-red-100 text-red-700' :
                            d.diasvencidos >= -5 ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {d.diasvencidos > 0 ? `${d.diasvencidos} días mora` : `${Math.abs(d.diasvencidos)} días`}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-800 text-right">{formatCurrency(d.total)}</td>
                      </tr>
                    ))}
                    {cxpDetalle.length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center py-6 text-gray-400">No hay facturas registradas pendientes de vencimiento.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderCargador = () => {
    const fmtC = (v) => {
      const prefix = filters.moneda === 'USD' ? '$' : 'C$';
      let n = Number(v) || 0;
      if (filters.moneda === 'USD' && filters.tipoCambio) n = n / filters.tipoCambio;
      return `${prefix} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
    };

    return (
      <div className="space-y-6 mb-8 animate-fadeIn">

        {/* Top banner: download template */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold flex items-center gap-2"><Download className="w-5 h-5" /> Plantilla de Artículos para OC</h2>
            <p className="text-emerald-100 text-xs max-w-2xl">Descarga la plantilla Excel. En la hoja <strong>cargar_articulos</strong> busca los artículos del catálogo, llena cantidad y costo, y sube el archivo aquí.</p>
          </div>
          <a href="/Formato_Cargador_Compras.xlsx" download className="bg-white text-emerald-700 hover:bg-emerald-50 px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2 shrink-0">
            <Download size={15} /> Descargar Plantilla
          </a>
        </div>

        {/* Success / Error alerts */}
        {importStatus.success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">¡Orden de Compra Creada!</h4>
              <p className="text-xs text-emerald-700 mt-1">{importStatus.success}</p>
              {importStatus.result && (
                <div className="mt-2 flex gap-3 flex-wrap">
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded"># {importStatus.result.numeroOrden}</span>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded">Total: {fmtC(importStatus.result.total)}</span>
                </div>
              )}
            </div>
          </div>
        )}
        {importStatus.error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div><h4 className="font-bold text-sm">Error</h4><p className="text-xs text-red-700 mt-1">{importStatus.error}</p></div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* ── LEFT: OC Header form ── */}
          <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 pb-2 border-b">
              <ClipboardList className="w-5 h-5 text-emerald-600" /> Datos Generales de la OC
            </h3>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Fecha de Solicitud</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" value={ocForm.FechaSolicitud} onChange={e => handleOcFormChange('FechaSolicitud', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
            </div>

            {/* Sucursal */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Sucursal <span className="text-red-500">*</span></label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select value={ocForm.SucursalId} onChange={e => handleOcFormChange('SucursalId', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 appearance-none bg-white">
                  <option value="">Selecciona sucursal...</option>
                  {catSucursales.map(s => <option key={s.id || s.Id} value={s.id || s.Id}>{s.nombre || s.Nombre}</option>)}
                </select>
              </div>
            </div>

            {/* Proveedor */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Proveedor <span className="text-red-500">*</span></label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select value={ocForm.ProveedorId} onChange={e => handleOcFormChange('ProveedorId', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 appearance-none bg-white">
                  <option value="">
                    {catProveedores.length === 0 ? 'Cargando proveedores...' : 'Selecciona proveedor...'}
                  </option>
                  {catProveedores.map(p => {
                    const id     = p.id     ?? p.Id     ?? '';
                    const nombre = p.nombre ?? p.Nombre ?? '';
                    const nit    = p.nit    ?? p.Nit    ?? '';
                    return <option key={id} value={id}>{nombre}{nit ? ` — ${nit}` : ''}</option>;
                  })}
                </select>
              </div>
            </div>

            {/* Condición de Pago: Contado / Crédito */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Condición de Pago <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 mb-2">
                {['contado', 'credito'].map(tipo => (
                  <button key={tipo} type="button"
                    onClick={() => handleOcFormChange('TipoPago', tipo)}
                    className={`flex-1 py-2 text-xs rounded-lg font-bold border transition-all ${
                      ocForm.TipoPago === tipo
                        ? tipo === 'contado'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}>
                    {tipo === 'contado' ? '💳 Contado / Débito' : '📅 Crédito'}
                  </button>
                ))}
              </div>
              {ocForm.TipoPago === 'credito' && (
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  <span className="text-xs text-orange-700 font-semibold whitespace-nowrap">Días de crédito:</span>
                  <input
                    type="number" min="1" max="365" step="1"
                    value={ocForm.DiasPago}
                    onChange={e => handleOcFormChange('DiasPago', parseInt(e.target.value) || 30)}
                    className="flex-1 px-2 py-1 text-sm rounded border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white font-bold text-orange-800"
                  />
                  <span className="text-xs text-orange-600">días</span>
                </div>
              )}
              {ocForm.TipoPago === 'contado' && (
                <p className="text-xs text-blue-600 mt-1">Pago inmediato al recibir la mercadería.</p>
              )}
            </div>

            {/* Moneda y Tipo Compra */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Moneda</label>
                <div className="flex gap-1">
                  {[{ id: 1, label: 'C$ NIO', color: 'emerald' }, { id: 2, label: '$ USD', color: 'indigo' }].map(m => (
                    <button key={m.id} type="button"
                      onClick={() => handleOcFormChange('MonedaId', m.id)}
                      className={`flex-1 py-2 text-xs rounded-lg font-bold border transition-all ${
                        ocForm.MonedaId === m.id
                          ? m.color === 'emerald' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}>{m.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Origen</label>
                <div className="flex gap-1">
                  {[{ v: 'nacional', label: '🇳🇮 Nacional' }, { v: 'internacional', label: '✈️ Import.' }].map(t => (
                    <button key={t.v} type="button"
                      onClick={() => handleOcFormChange('TipoCompra', t.v)}
                      className={`flex-1 py-2 text-xs rounded-lg font-bold border transition-all ${
                        ocForm.TipoCompra === t.v
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}>{t.label}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* IVA y Descuento */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Aplicar IVA (15%)</label>
                <div className="flex gap-2 pt-0.5">
                  <button type="button" onClick={() => handleOcFormChange('AplicarIva', true)}
                    className={`flex-1 py-1.5 text-xs rounded-lg font-bold border transition-colors ${
                      ocForm.AplicarIva ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-400 border-gray-200 hover:border-emerald-400'
                    }`}>Sí</button>
                  <button type="button" onClick={() => handleOcFormChange('AplicarIva', false)}
                    className={`flex-1 py-1.5 text-xs rounded-lg font-bold border transition-colors ${
                      !ocForm.AplicarIva ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-400 border-gray-200 hover:border-red-400'
                    }`}>No</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">% Descuento</label>
                <input type="number" min="0" max="100" step="0.5" value={ocForm.PorcentajeDescuento}
                  onChange={e => handleOcFormChange('PorcentajeDescuento', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="0" />
              </div>
            </div>

            {/* Observación */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Observación</label>
              <textarea value={ocForm.Observacion} onChange={e => handleOcFormChange('Observacion', e.target.value)} rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" placeholder="Notas u observaciones..." />
            </div>
          </div>

          {/* ── RIGHT: Excel upload + preview ── */}
          <div className="xl:col-span-3 space-y-5">

            {/* Drop zone */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 pb-2 border-b mb-4">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> Cargar Artículos desde Excel
              </h3>
              <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors relative cursor-pointer group ${
                detallesExcel.length > 0 ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-emerald-400'
              }`}>
                <input type="file" accept=".xlsx,.xls" onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className={`p-3 rounded-full group-hover:scale-110 transition-transform ${
                    detallesExcel.length > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-400'
                  }`}>
                    <FileSpreadsheet className="w-8 h-8" />
                  </div>
                  <div className="text-sm font-semibold text-gray-700">
                    {file ? file.name : 'Selecciona o arrastra tu archivo Excel'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {detallesExcel.length > 0
                      ? <span className="text-emerald-600 font-semibold">{detallesExcel.length} artículos encontrados</span>
                      : 'Usa la plantilla descargada — hoja: cargar_articulos'}
                  </div>
                </div>
              </div>
            </div>

            {/* Totals summary */}
            {detallesExcel.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-bold text-gray-700">Resumen de la OC</h4>
                  <span className="text-xs text-gray-400">{detallesExcel.length} líneas</span>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="font-medium">{fmtC(ocTotals.sub)}</span></div>
                  {ocTotals.desc > 0 && <div className="flex justify-between text-orange-600"><span>Descuento ({ocForm.PorcentajeDescuento}%)</span><span>- {fmtC(ocTotals.desc)}</span></div>}
                  {ocForm.AplicarIva && <div className="flex justify-between text-gray-600"><span>IVA (15%)</span><span>{fmtC(ocTotals.iva)}</span></div>}
                  <div className="flex justify-between text-gray-900 font-bold border-t pt-2 mt-1 text-base"><span>Total</span><span className="text-emerald-700">{fmtC(ocTotals.total)}</span></div>
                </div>
              </div>
            )}

            {/* Article preview table */}
            {detallesExcel.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h4 className="text-sm font-bold text-gray-700 mb-3">Vista Previa de Artículos</h4>
                <div className="overflow-x-auto max-h-64 border rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-600 uppercase font-semibold sticky top-0">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Artículo</th>
                        <th className="px-3 py-2 text-right">Cant.</th>
                        <th className="px-3 py-2 text-right">Costo U.</th>
                        <th className="px-3 py-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detallesExcel.map((d, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-1.5">
                            <span className="font-semibold text-gray-800">{d.Codigo}</span>
                            {d.Nombre && <span className="text-gray-500 ml-1">— {d.Nombre}</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right font-medium">{d.Cantidad}</td>
                          <td className="px-3 py-1.5 text-right">{fmtC(d.PrecioCu)}</td>
                          <td className="px-3 py-1.5 text-right font-bold text-gray-800">{fmtC(d.Cantidad * d.PrecioCu)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleImportar}
              disabled={!isFormValid || importStatus.loading}
              className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 ${
                isFormValid && !importStatus.loading
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {importStatus.loading ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Guardando OC...</>
              ) : (
                <><CheckCircle2 size={16} /> {isFormValid ? `Crear Orden de Compra (${detallesExcel.length} artículos)` : 'Completa el formulario y carga el Excel'} <ChevronRight size={16} /></>
              )}
            </button>

          </div>
        </div>
      </div>
    );
  };

  const handleExportarComprasRealizadas = () => {
    if (comprasRealizadas.length === 0) {
      alert("No hay registros de compras realizadas para exportar.");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(comprasRealizadas.map(c => ({
      'N° Orden': c.numeroOrden || c.numeroorden || `OC-${c.id}`,
      'N° Factura': c.numeroFactura || c.numerofactura || 'Sin Factura',
      Fecha: formatDate(c.fecha),
      Proveedor: c.proveedor,
      Sucursal: c.sucursal,
      'Condición Pago': c.condicionPago || c.condicionpago,
      Estado: c.estado,
      SubTotal: c.subTotal ?? c.subtotal,
      IVA: c.iva,
      Total: c.total
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Compras_Realizadas");
    XLSX.writeFile(workbook, `Compras_Realizadas_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrintComprasRealizadasReport = () => {
    if (comprasRealizadas.length === 0) return;
    const printWindow = window.open('', '_blank');
    const printContent = `
      <html>
        <head>
          <title>Reporte de Compras Realizadas y Recepciones</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #333; }
            .header { border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-bottom: 20px; }
            .header-top { display: flex; justify-content: space-between; align-items: center; }
            h1 { color: #065f46; margin: 0; font-size: 24px; }
            .meta { display: flex; justify-content: space-between; margin-top: 15px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 25px; font-size: 13px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { background-color: #f8fafc; font-weight: 600; color: #475569; }
            .text-right { text-align: right; }
            .total-row { font-weight: bold; background-color: #e6f4ea; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <h1>REPORTE DE COMPRAS REALIZADAS Y ÓRDENES RECIBIDAS</h1>
            </div>
            <div class="meta">
              <div><p><strong>Módulo:</strong> Compras - Vista de Compras Realizadas</p></div>
              <div style="text-align: right;">
                <p><strong>Fecha Reporte:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Total Registros:</strong> ${comprasRealizadas.length}</p>
              </div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>N° Orden</th>
                <th>N° Factura</th>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Sucursal</th>
                <th>Condición Pago</th>
                <th>Estado</th>
                <th class="text-right">SubTotal</th>
                <th class="text-right">IVA</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${comprasRealizadas.map(c => `
                <tr>
                  <td><strong>${c.numeroOrden || c.numeroorden || 'OC-'+c.id}</strong></td>
                  <td>${c.numeroFactura || c.numerofactura || 'Sin Factura'}</td>
                  <td>${formatDate(c.fecha)}</td>
                  <td>${c.proveedor}</td>
                  <td>${c.sucursal}</td>
                  <td>${c.condicionPago || c.condicionpago}</td>
                  <td>${c.estado}</td>
                  <td class="text-right">${formatCurrency(c.subTotal ?? c.subtotal)}</td>
                  <td class="text-right">${formatCurrency(c.iva)}</td>
                  <td class="text-right">${formatCurrency(c.total)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="9">Total General Compras Realizadas</td>
                <td class="text-right">${formatCurrency(comprasRealizadas.reduce((acc, x) => acc + (x.total || 0), 0))}</td>
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

  const renderComprasRealizadas = () => {
    if (loadingRealizadas) return <div className="text-gray-500 animate-pulse text-lg py-8">Cargando Compras Realizadas...</div>;

    const filtered = comprasRealizadas.filter(c => {
      const numO = (c.numeroOrden || c.numeroorden || '').toLowerCase();
      const numF = (c.numeroFactura || c.numerofactura || '').toLowerCase();
      const prov = (c.proveedor || '').toLowerCase();
      const suc = (c.sucursal || '').toLowerCase();
      const q = searchRealizada.toLowerCase();
      return numO.includes(q) || numF.includes(q) || prov.includes(q) || suc.includes(q);
    });

    const totalMontoComprado = comprasRealizadas.reduce((acc, x) => acc + (x.total || 0), 0);
    const facturasVinculadasCount = comprasRealizadas.filter(x => (x.numeroFactura || x.numerofactura) && (x.numeroFactura || x.numerofactura) !== 'Sin Factura').length;

    return (
      <div className="space-y-8 mb-8 animate-fadeIn">
        {/* KPI Header Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col border-l-4 border-l-emerald-500">
            <div className="flex justify-between items-center text-gray-500">
              <span className="text-sm font-medium">Total Compras Realizadas</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-3xl font-extrabold text-emerald-600 mt-2">{comprasRealizadas.length}</span>
            <span className="text-xs text-gray-400 mt-1">Órdenes recibidas y finalizadas</span>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col border-l-4 border-l-blue-500">
            <div className="flex justify-between items-center text-gray-500">
              <span className="text-sm font-medium">Monto Total Adquirido</span>
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-3xl font-extrabold text-slate-800 mt-2">{formatCurrency(totalMontoComprado)}</span>
            <span className="text-xs text-gray-400 mt-1">Inversión acumulada en compras</span>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col border-l-4 border-l-indigo-500">
            <div className="flex justify-between items-center text-gray-500">
              <span className="text-sm font-medium">Facturas de Proveedor</span>
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <span className="text-3xl font-extrabold text-indigo-600 mt-2">{facturasVinculadasCount}</span>
            <span className="text-xs text-emerald-600 font-semibold mt-1">Con número de factura registrado</span>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Historial de Compras Realizadas y Recepciones
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Relación de órdenes finalizadas, recepciones de inventario y facturas asociadas</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por N° orden, factura, proveedor..."
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={searchRealizada}
                  onChange={(e) => setSearchRealizada(e.target.value)}
                />
              </div>
              <button
                onClick={handleExportarComprasRealizadas}
                title="Exportar a Excel"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
              >
                <Download size={14} /> Excel
              </button>
              <button
                onClick={handlePrintComprasRealizadasReport}
                title="Imprimir PDF"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
              >
                <Printer size={14} /> PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[550px]">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 font-semibold">
                <tr>
                  <th className="px-4 py-3">N° Orden</th>
                  <th className="px-4 py-3">N° Factura</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3">Condición Pago</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">IVA</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const numOrden = c.numeroOrden || c.numeroorden;
                  const numFactura = c.numeroFactura || c.numerofactura || 'Sin Factura';
                  const proveedor = c.proveedor;
                  const sucursal = c.sucursal;
                  const condicion = c.condicionPago || c.condicionpago;
                  const estadoVal = c.estado;
                  const subtotalVal = c.subTotal ?? c.subtotal;

                  return (
                    <tr key={i} className="bg-white border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-emerald-700">#{numOrden || `OC-${c.id}`}</td>
                      <td className="px-4 py-3 font-semibold">
                        {numFactura !== 'Sin Factura' ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-xs font-mono">
                            #{numFactura}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Sin Factura</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{formatDate(c.fecha)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{proveedor}</td>
                      <td className="px-4 py-3 text-xs">{sucursal}</td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-600">{condicion}</td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                          <CheckCircle2 size={12} /> {estadoVal || 'Finalizado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(subtotalVal)}</td>
                      <td className="px-4 py-3 text-right text-gray-400">{formatCurrency(c.iva)}</td>
                      <td className="px-4 py-3 font-bold text-slate-800 text-right">{formatCurrency(c.total)}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="10" className="text-center py-8 text-gray-400">No se encontraron compras realizadas con el filtro seleccionado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Dashboard de Compras</h1>
          <p className="text-gray-500">Métricas de adquisiciones y administración de Cuentas por Pagar (CXP)</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-8 w-fit">
        <button
          onClick={() => setActiveTab('resumen')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'resumen' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          Resumen de Compras
        </button>
        <button
          onClick={() => setActiveTab('realizadas')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'realizadas' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          Compras Realizadas
        </button>
        <button
          onClick={() => setActiveTab('cxp')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'cxp' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          Cuentas por Pagar (CXP)
        </button>
        <button
          onClick={() => setActiveTab('cargar')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'cargar' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
          }`}
        >
          Cargar OC
        </button>
      </div>

      {activeTab === 'resumen' && renderResumen()}
      {activeTab === 'realizadas' && renderComprasRealizadas()}
      {activeTab === 'cxp' && renderCxp()}
      {activeTab === 'cargar' && renderCargador()}

    </div>
  );
};

export default Compras;
