import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import {
  Banknote, CreditCard, ArrowUpCircle, ArrowDownCircle,
  Search, FileDown, Printer, CheckCircle, AlertCircle,
  ClipboardList, Lock, Unlock, ChevronDown, ChevronUp,
  X, Receipt, DollarSign, Plus, Trash2, RefreshCw, Edit, XCircle, Eye, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import logoImg from '../assets/logo.jpg';


const API_BASE_URL = import.meta.env.VITE_API_URL.replace('/dashboard', '');
const CAJA_URL = `${API_BASE_URL}/caja`;

const formatDate = (ds) => {
  if (!ds) return '';
  const p = (ds + '').split('T')[0];
  const [y, m, d] = p.split('-');
  return `${d}/${m}/${y}`;
};

const today = () => new Date().toISOString().split('T')[0];

const cleanParams = (p) => {
  if (!p) return {};
  const cleaned = {};
  Object.keys(p).forEach(k => {
    const v = p[k];
    if (v !== null && v !== undefined && v !== '' && v !== 'null' && v !== 'undefined') {
      cleaned[k] = v;
    }
  });
  return cleaned;
};

const CUENTAS_BANCARIAS = [
  {
    banco: 'Banpro',
    cuentas: [
      { id: 'banpro_ahorro_cs', label: 'Banpro Ahorro C$ 10020508700932' },
      { id: 'banpro_ahorro_usd', label: 'Banpro Ahorro U$ 10020518700948' },
      { id: 'banpro_corr_cs', label: 'Banpro Corriente C$ 10010508700916' },
      { id: 'banpro_corr_usd', label: 'Banpro Corriente U$ 10010518700922' },
    ]
  },
  {
    banco: 'Avanz',
    cuentas: [
      { id: 'avanz_ahorro_cs_1', label: 'Avanz Ahorro C$ 154906140101' },
      { id: 'avanz_ahorro_usd_1', label: 'Avanz Ahorro U$ 1547518002' },
      { id: 'avanz_ahorro_usd_2', label: 'Avanz Ahorro U$ 154906220102' },
      { id: 'avanz_corr_cs_1', label: 'Avanz Corriente C$ 1547341901' },
      { id: 'avanz_corr_usd_1', label: 'Avanz Corriente U$ 1547342702' },
      { id: 'avanz_corr_usd_2', label: 'Avanz Corriente U$ 1547517202' },
    ]
  },
  {
    banco: 'BAC Credomatic',
    cuentas: [
      { id: 'bac_ahorro_usd_1', label: 'Bac Ahorro U$ 362375594' },
      { id: 'bac_ahorro_usd_2', label: 'Bac Ahorro U$ 365157999' },
      { id: 'bac_corr_cs_1', label: 'Bac Corriente C$ 362347312' },
      { id: 'bac_corr_usd_1', label: 'Bac Corriente U$ 362347973' },
    ]
  },
  {
    banco: 'Lafise Bancentro',
    cuentas: [
      { id: 'lafise_ahorro_cs', label: 'Lafise Bancentro Ahorro C$ 135030904' },
      { id: 'lafise_ahorro_usd', label: 'Lafise Bancentro Ahorro U$ 131276294' },
      { id: 'lafise_corr_cs', label: 'Lafise Bancentro Corriente C$ 106015087' },
    ]
  }
];

export const printReciboIngresoDocument = (reciboDetail, formatCurrency, isReprint = true) => {
  if (!reciboDetail) return;
  const recibo = reciboDetail.recibo || reciboDetail.Recibo;
  const facturas = reciboDetail.facturas || reciboDetail.Facturas || [];
  const metodos = reciboDetail.metodos || reciboDetail.Metodos || [];
  if (!recibo) return;
  const printWindow = window.open('', '_blank');
  const safeFormat = formatCurrency || ((val) => `C$ ${Number(val || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  const printContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Recibo Oficial ${recibo.serie || ''}-${recibo.numero || ''}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; max-width: 850px; margin: 0 auto; position: relative; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
          .logo-container { display: flex; align-items: center; gap: 15px; }
          .logo { height: 60px; object-fit: contain; }
          .company-title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
          .company-sub { font-size: 12px; color: #475569; margin: 2px 0 0 0; }
          .doc-box { text-align: right; border: 2px solid #059669; background-color: #ecfdf5; padding: 12px 18px; border-radius: 10px; }
          .doc-title { font-size: 15px; font-weight: 800; color: #047857; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
          .doc-num { font-size: 18px; font-family: monospace; font-weight: 800; color: #059669; margin: 4px 0; }
          .doc-date { font-size: 11px; color: #64748b; }
          
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 12px; }
          .info-title { font-weight: 700; color: #64748b; text-transform: uppercase; font-size: 10px; margin-bottom: 4px; }
          .info-val { font-size: 13px; font-weight: 700; color: #0f172a; }
          
          table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background-color: #0f172a; color: #ffffff; font-weight: 700; text-transform: uppercase; font-size: 11px; }
          .text-right { text-align: right; }
          .font-mono { font-family: monospace; }
          .grand-total { background-color: #ecfdf5; font-weight: 800; font-size: 14px; color: #065f46; }
          
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; text-align: center; font-size: 11px; }
          .sig-line { border-top: 1px solid #94a3b8; padding-top: 6px; font-weight: 700; color: #334155; }
          
          .watermark {
            position: absolute;
            top: 45%; left: 50%;
            transform: translate(-50%, -50%) rotate(-25deg);
            font-size: 55px; font-weight: 900;
            color: rgba(5, 150, 105, 0.09);
            border: 8px solid rgba(5, 150, 105, 0.09);
            padding: 10px 25px; border-radius: 12px;
            text-transform: uppercase; letter-spacing: 0.1em;
            pointer-events: none; z-index: 1000;
          }
        </style>
      </head>
      <body>
        ${isReprint ? '<div class="watermark">REIMPRESIÓN / COPIA</div>' : ''}
        <div class="header">
          <div class="logo-container">
            <img src="${window.location.origin}${logoImg}" class="logo" alt="Logo" />
            <div>
              <h1 class="company-title">AGRISOURCE S.A.</h1>
              <p class="company-sub">Soluciones Agrícolas e Industriales</p>
              <p class="company-sub">Sucursal: <strong>${recibo.sucursal || 'Central'}</strong></p>
            </div>
          </div>
          <div class="doc-box">
            <div class="doc-title">Recibo Oficial de Caja</div>
            <div class="doc-num">${recibo.serie || ''}-${recibo.numero || ''}</div>
            <div class="doc-date">Fecha: <strong>${formatDate(recibo.fecha)}</strong></div>
          </div>
        </div>

        <div class="info-grid">
          <div>
            <div class="info-title">Recibido de</div>
            <div class="info-val">${recibo.cliente || 'Cliente General'}</div>
            ${recibo.clienteidentificacion ? `<div style="color: #475569; margin-top: 2px;">RUC/ID: ${recibo.clienteidentificacion}</div>` : ''}
          </div>
          <div>
            <div class="info-title">Concepto / Descripción</div>
            <div style="font-size: 12px; color: #334155; font-weight: 600;">${recibo.descripcion || 'Pago de Facturas'}</div>
            <div style="margin-top: 4px; font-size: 11px;">Estado: <strong style="color: ${recibo.estado === 'ANULADO' ? '#dc2626' : '#059669'};">${recibo.estado || 'ACTIVO'}</strong></div>
          </div>
        </div>

        <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; color: #475569; margin-bottom: 6px;">Facturas Liquidadas / Aplicadas:</div>
        <table>
          <thead>
            <tr>
              <th>Factura N°</th>
              <th>Fecha Factura</th>
              <th class="text-right">Monto Aplicado</th>
              <th>Tipo Aplicación</th>
            </tr>
          </thead>
          <tbody>
            ${facturas && facturas.length > 0 ? facturas.map(f => `
              <tr>
                <td class="font-mono" style="font-weight: 700; color: #1d4ed8;">#${f.numerofactura}</td>
                <td>${formatDate(f.fechafactura)}</td>
                <td class="text-right font-mono" style="font-weight: 700; color: #059669;">${safeFormat(f.montoaplicado)}</td>
                <td>${f.esparcial ? '<span style="color: #d97706; font-weight: 700;">Abono Parcial</span>' : '<span style="color: #059669; font-weight: 700;">Cancelación Total</span>'}</td>
              </tr>
            `).join('') : '<tr><td colSpan="4" style="text-align: center; color: #94a3b8;">Sin detalles de facturas</td></tr>'}
          </tbody>
        </table>

        <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; color: #475569; margin-top: 15px; margin-bottom: 6px;">Forma(s) de Pago:</div>
        <table>
          <thead>
            <tr>
              <th>Método</th>
              <th>Banco / Cuenta Seleccionada</th>
              <th>N° Referencia / Comprobante</th>
              <th class="text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            ${metodos && metodos.length > 0 ? metodos.map(m => `
              <tr>
                <td style="font-weight: 700;">${m.metodopago || m.metodoPago}</td>
                <td>${m.bancotarjeta || m.bancoTarjeta || 'N/A'}</td>
                <td class="font-mono">${m.referencia || (m.numeronotacredito ? 'NC #' + m.numeronotacredito : 'N/A')}</td>
                <td class="text-right font-mono" style="font-weight: 700;">${safeFormat(m.monto)}</td>
              </tr>
            `).join('') : `
              <tr>
                <td style="font-weight: 700;">${recibo.metodopago}</td>
                <td>N/A</td>
                <td>N/A</td>
                <td class="text-right font-mono" style="font-weight: 700;">${safeFormat(recibo.importetotal)}</td>
              </tr>
            `}
            <tr class="grand-total">
              <td colSpan="3" class="text-right">MONTO TOTAL RECIBIDO:</td>
              <td class="text-right font-mono">${safeFormat(recibo.importetotal)}</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-line">
            Recibido por (Caja)
            <div style="font-size: 9px; color: #94a3b8; font-weight: normal;">Firma / Sello</div>
          </div>
          <div class="sig-line">
            Entregado Conforme (Cliente)
            <div style="font-size: 9px; color: #94a3b8; font-weight: normal;">Firma Cliente</div>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(printContent);
  printWindow.document.close();
};

export const printNotaCreditoDocument = (nc, formatCurrency) => {
  if (!nc) return;
  const printWindow = window.open('', '_blank');
  const safeFormat = formatCurrency || ((val) => `C$ ${Number(val || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  const printContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Nota de Crédito ${nc.numeronotacredito || nc.numeroNotaCredito || ''}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; max-width: 850px; margin: 0 auto; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
          .logo-container { display: flex; align-items: center; gap: 15px; }
          .logo { height: 60px; object-fit: contain; }
          .company-title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
          .company-sub { font-size: 12px; color: #475569; margin: 2px 0 0 0; }
          .doc-box { text-align: right; border: 2px solid #2563eb; background-color: #eff6ff; padding: 12px 18px; border-radius: 10px; }
          .doc-title { font-size: 15px; font-weight: 800; color: #1e40af; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
          .doc-num { font-size: 18px; font-family: monospace; font-weight: 800; color: #1d4ed8; margin: 4px 0; }
          .doc-date { font-size: 11px; color: #64748b; }
          
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 12px; }
          .info-title { font-weight: 700; color: #64748b; text-transform: uppercase; font-size: 10px; margin-bottom: 4px; }
          .info-val { font-size: 13px; font-weight: 700; color: #0f172a; }
          
          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
          th { background-color: #0f172a; color: #ffffff; font-weight: 700; text-transform: uppercase; font-size: 11px; }
          .text-right { text-align: right; }
          .font-mono { font-family: monospace; }
          .total-row { background-color: #f1f5f9; font-weight: bold; }
          .grand-total { background-color: #eff6ff; font-weight: 800; font-size: 13px; color: #1e3a8a; }
          
          .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 60px; text-align: center; font-size: 11px; }
          .sig-line { border-top: 1px solid #94a3b8; padding-top: 6px; font-weight: 700; color: #334155; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-container">
            <img src="${logoImg}" class="logo" alt="Logo" />
            <div>
              <h1 class="company-title">AGRISOURCE S.A.</h1>
              <p class="company-sub">Soluciones Agrícolas e Industriales</p>
              <p class="company-sub">Sucursal: <strong>${nc.sucursal || nc.sucursalNombre || 'Central'}</strong></p>
            </div>
          </div>
          <div class="doc-box">
            <div class="doc-title">Nota de Crédito</div>
            <div class="doc-num">${nc.numeronotacredito || nc.numeroNotaCredito || nc.numeroNC || 'NC-000'}</div>
            <div class="doc-date">Fecha: <strong>${formatDate(nc.fechaemision || nc.fechaEmision || nc.createdat)}</strong></div>
          </div>
        </div>

        <div class="info-grid">
          <div>
            <div class="info-title">Cliente / Beneficiario</div>
            <div class="info-val">${nc.cliente || nc.clienteNombre || 'Cliente General'}</div>
            ${nc.clienteidentificacion ? `<div style="color: #475569; margin-top: 2px;">RUC/ID: ${nc.clienteidentificacion}</div>` : ''}
          </div>
          <div>
            <div class="info-title">Referencias de Origen</div>
            <div>Devolución N°: <strong class="font-mono">${nc.numerodevolucion || nc.numeroDevolucion || 'N/A'}</strong></div>
            <div style="margin-top: 2px;">Factura Origen: <strong class="font-mono">${nc.numerofacturaorigen && nc.numerofacturaorigen !== 'N/A' ? '#' + nc.numerofacturaorigen : 'N/A'}</strong></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Concepto / Detalle</th>
              <th class="text-right" style="width: 150px;">Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div style="font-weight: 700; color: #0f172a;">Nota de Crédito a Favor del Cliente</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 3px;">${nc.observacion || 'Saldo a favor del cliente registrado en caja'}</div>
              </td>
              <td class="text-right font-mono">${safeFormat(nc.montosubtotal ?? nc.montoSubtotal)}</td>
            </tr>
            <tr class="total-row">
              <td class="text-right">Subtotal:</td>
              <td class="text-right font-mono">${safeFormat(nc.montosubtotal ?? nc.montoSubtotal)}</td>
            </tr>
            <tr class="total-row">
              <td class="text-right">IVA (15%):</td>
              <td class="text-right font-mono">${safeFormat(nc.montoiva ?? nc.montoIva)}</td>
            </tr>
            <tr class="grand-total">
              <td class="text-right">MONTO TOTAL DE NOTA CRÉDITO:</td>
              <td class="text-right font-mono">${safeFormat(nc.montototal ?? nc.montoTotal)}</td>
            </tr>
            <tr class="total-row">
              <td class="text-right" style="color: #059669;">Monto Aplicado:</td>
              <td class="text-right font-mono" style="color: #059669;">${safeFormat(nc.montoaplicado ?? nc.montoAplicado)}</td>
            </tr>
            <tr class="grand-total" style="background-color: #dbeafe;">
              <td class="text-right" style="color: #1e40af;">SALDO DISPONIBLE A FAVOR:</td>
              <td class="text-right font-mono" style="color: #1e40af; font-size: 14px;">${safeFormat(nc.montosaldo ?? nc.montoSaldo)}</td>
            </tr>
          </tbody>
        </table>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; font-size: 11px; margin-top: 15px;">
          <strong>Estado de la Nota de Crédito:</strong> ${nc.aplicada || nc.estado === 'APLICADA' ? 'APLICADA TOTALMENTE' : nc.estado === 'PARCIAL' ? 'PARCIALMENTE APLICADA' : (nc.estado === 'ANULADA' ? 'ANULADA' : 'DISPONIBLE PARA COBROS/FACTURAS')}
        </div>

        <div class="signatures">
          <div class="sig-line">
            Elaborado por
            <div style="font-size: 9px; color: #94a3b8; font-weight: normal;">Firma / Sello</div>
          </div>
          <div class="sig-line">
            Autorizado por
            <div style="font-size: 9px; color: #94a3b8; font-weight: normal;">Firma Caja / Gerencia</div>
          </div>
          <div class="sig-line">
            Recibido Conforme
            <div style="font-size: 9px; color: #94a3b8; font-weight: normal;">Cliente</div>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(printContent);
  printWindow.document.close();
};

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];
const METODO_COLORS = { EFECTIVO: '#10B981', TRANSFERENCIA: '#3B82F6', DEPOSITO: '#F59E0B', TARJETA: '#EC4899' };

const Caja = ({ filters, currentUser }) => {
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('caja_active_tab') || 'dashboard');
  const [sucursalCajaId, setSucursalCajaId] = useState('');
  const [sucursalesCaja, setSucursalesCaja] = useState([]);

  useEffect(() => { sessionStorage.setItem('caja_active_tab', activeTab); }, [activeTab]);

  useEffect(() => {
    const fetchSucursales = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/sucursales`);
        // Filter out "Los Arcos" and set sucursales
        let list = res.data.filter(s => s.nombre !== 'Los Arcos');
        if (currentUser && currentUser.Sucursales && currentUser.Sucursales.length > 0 && !currentUser.IsAdmin) {
          const allowedIds = currentUser.Sucursales.map(s => Number(s.id));
          list = list.filter(s => allowedIds.includes(Number(s.id)));
        }
        setSucursalesCaja(list);
      } catch (e) {
        console.error("Error fetching sucursales", e);
      }
    };
    fetchSucursales();
  }, [currentUser]);

  const mergedFilters = {
    ...filters,
    sucursalId: sucursalCajaId ? Number(sucursalCajaId) : null
  };

  const formatCurrency = (val) => {
    let v = Number(val) || 0;
    const prefix = filters?.moneda === 'USD' ? '$' : 'C$';
    if (filters?.moneda === 'USD' && filters?.tipoCambio) v = v / filters.tipoCambio;
    return `${prefix} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}`;
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <Banknote size={16} /> },
    { id: 'recibos', label: 'Recibos / CxC', icon: <Receipt size={16} /> },
    { id: 'facturas', label: 'Facturas', icon: <Receipt size={16} /> },
    { id: 'caja_chica', label: 'Caja Chica', icon: <ArrowDownCircle size={16} /> },
    { id: 'arqueo', label: 'Arqueo de Caja', icon: <ClipboardList size={16} /> },
    { id: 'notas_credito', label: 'Notas de Crédito', icon: <CreditCard size={16} /> },
    { id: 'cuentas_bancarias', label: 'Cuentas Bancarias', icon: <Banknote size={16} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Banknote className="text-emerald-600" /> Modulo de Caja
          </h1>
          <p className="text-xs text-slate-500 mt-1">Control integral de cobros, recibos, caja chica, arqueos y notas de crédito</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 mb-1">Sucursal de Caja</label>
          <select 
            value={sucursalCajaId}
            onChange={(e) => setSucursalCajaId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="">Todas las Sucursales</option>
            {sucursalesCaja.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200/80 shadow-inner">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === t.id
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && <DashboardTab filters={mergedFilters} formatCurrency={formatCurrency} onOpenPago={() => setActiveTab('recibos')} onOpenEgreso={() => setActiveTab('caja_chica')} />}
      {activeTab === 'recibos' && <RecibosTab filters={mergedFilters} formatCurrency={formatCurrency} />}
      {activeTab === 'facturas' && <FacturasTab filters={mergedFilters} formatCurrency={formatCurrency} />}
      {activeTab === 'caja_chica' && <CajaChicaTab filters={mergedFilters} formatCurrency={formatCurrency} />}
      {activeTab === 'arqueo' && <ArqueoTab filters={mergedFilters} formatCurrency={formatCurrency} />}
      {activeTab === 'notas_credito' && <NotasCreditoTab filters={mergedFilters} formatCurrency={formatCurrency} sucursalesCaja={sucursalesCaja} />}
      {activeTab === 'cuentas_bancarias' && <CuentasBancariasTab />}
    </div>
  );
};

/* ======================== DASHBOARD TAB ======================== */
const DashboardTab = ({ filters, formatCurrency, onOpenPago, onOpenEgreso }) => {
  const [data, setData] = useState({ metodos: [], tipos: [], bancos: [], facturasCanceladas: [] });
  const [loading, setLoading] = useState(true);
  const [selectedGraphSection, setSelectedGraphSection] = useState(null);

  const [facturasPage, setFacturasPage] = useState(1);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${CAJA_URL}/pagos-resumen`, { params: cleanParams(filters) });
        const raw = res.data || {};
        setData({
          metodos: raw.metodos || raw.Metodos || [],
          tipos: raw.tipos || raw.Tipos || [],
          bancos: raw.bancos || raw.Bancos || [],
          facturasCanceladas: raw.facturasCanceladas || raw.FacturasCanceladas || []
        });
        setFacturasPage(1);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();
  }, [filters]);

  const metodosList = data.metodos || [];
  const tiposList = data.tipos || [];
  const bancosList = data.bancos || [];
  const facturasList = data.facturasCanceladas || [];

  const metodosChart = metodosList.map(m => ({
    name: m.metodopago || m.MetodoPago || m.metodoPago || '',
    Total: Number(m.total || m.Total) || 0,
    Cantidad: Number(m.cantidad || m.Cantidad) || 0
  }));

  const tiposChart = tiposList.map(t => ({
    name: t.tipoventa || t.TipoVenta || t.tipoVenta || '',
    Total: Number(t.totalaplicado || t.TotalAplicado || t.totalAplicado) || 0,
    Cantidad: Number(t.cantidad || t.Cantidad) || 0
  }));

  const bancosChart = bancosList.map(b => ({
    name: b.entidad || b.Entidad || '',
    Total: Number(b.total || b.Total) || 0,
    Cantidad: Number(b.cantidad || b.Cantidad) || 0
  }));

  return (
    <div className="space-y-8">
      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={onOpenPago}
          className="flex items-center gap-4 p-6 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-2xl shadow-lg hover:shadow-xl hover:from-emerald-600 hover:to-emerald-800 transition-all group"
        >
          <ArrowUpCircle size={48} className="opacity-80 group-hover:scale-110 transition-transform" />
          <div className="text-left">
            <div className="text-xl font-extrabold">Registrar Pago CxC</div>
            <div className="text-sm opacity-80 mt-1">Aplicar pago a facturas pendientes de crédito o contado</div>
          </div>
        </button>
        <button
          onClick={onOpenEgreso}
          className="flex items-center gap-4 p-6 bg-gradient-to-br from-rose-500 to-rose-700 text-white rounded-2xl shadow-lg hover:shadow-xl hover:from-rose-600 hover:to-rose-800 transition-all group"
        >
          <ArrowDownCircle size={48} className="opacity-80 group-hover:scale-110 transition-transform" />
          <div className="text-left">
            <div className="text-xl font-extrabold">Egreso Caja Chica</div>
            <div className="text-sm opacity-80 mt-1">Registrar salida de efectivo de caja chica</div>
          </div>
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400 animate-pulse py-10 text-center">Cargando datos...</div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Bar - Pagos por Tipo de Venta (Credito vs Contado) */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <CreditCard size={18} className="text-blue-600" /> Pagos: Crédito vs Contado
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">Clic para ver detalle</span>
              </div>
              {tiposChart.length === 0 ? (
                <div className="h-[240px] flex items-center justify-center text-slate-400 text-xs">Sin pagos en este período</div>
              ) : (
                <div className="h-[240px] cursor-pointer">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tiposChart} margin={{ top: 10, right: 10, left: 0, bottom: 5 }} onClick={(e) => {
                      if (e && e.activePayload && e.activePayload[0]) {
                        setSelectedGraphSection({ title: 'Detalle de Pagos por Tipo de Venta', category: e.activePayload[0].payload.name, list: facturasList });
                      }
                    }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v)} width={70} />
                      <Tooltip formatter={(v) => formatCurrency(v)} />
                      <Bar dataKey="Total" fill="#3B82F6" radius={[6, 6, 0, 0]} name="Total Aplicado" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Chart 2: Bar - Pagos Recibidos por Método (Agrupado Transferencia/Depósito) */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <Banknote size={18} className="text-emerald-600" /> Pagos por Método
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">Clic para ver detalle</span>
              </div>
              {metodosChart.length === 0 ? (
                <div className="h-[240px] flex items-center justify-center text-slate-400 text-xs">Sin pagos en este período</div>
              ) : (
                <div className="h-[240px] cursor-pointer">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metodosChart} margin={{ top: 10, right: 10, left: 0, bottom: 5 }} onClick={(e) => {
                      if (e && e.activePayload && e.activePayload[0]) {
                        setSelectedGraphSection({ title: 'Detalle de Pagos por Método de Pago', category: e.activePayload[0].payload.name, list: facturasList });
                      }
                    }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v)} width={70} />
                      <Tooltip formatter={(v) => formatCurrency(v)} />
                      <Bar dataKey="Total" fill="#10B981" radius={[6, 6, 0, 0]} name="Total Recibido" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Chart 3: Bar / Cards - Totales por Banco General y POS */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between lg:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <Receipt size={18} className="text-purple-600" /> Totales por Banco y POS
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">Clic para ver detalle</span>
              </div>
              {bancosChart.length === 0 ? (
                <div className="h-[240px] flex items-center justify-center text-slate-400 text-xs">Sin movimientos bancarios/POS en este período</div>
              ) : (
                <div className="h-[240px] cursor-pointer">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bancosChart} layout="vertical" margin={{ top: 5, right: 10, left: 20, bottom: 5 }} onClick={(e) => {
                      if (e && e.activePayload && e.activePayload[0]) {
                        setSelectedGraphSection({ title: 'Detalle de Pagos por Banco / POS', category: e.activePayload[0].payload.name, list: facturasList });
                      }
                    }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v)} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={110} />
                      <Tooltip formatter={(v) => formatCurrency(v)} />
                      <Bar dataKey="Total" fill="#8B5CF6" radius={[0, 6, 6, 0]} name="Total Ingresado" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Unified Cancelled / Paid Invoices Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <CheckCircle size={20} className="text-emerald-600" />
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Facturas Canceladas y con Pagos Aplicados en el Período</h3>
                  <p className="text-xs text-slate-500">Listado consolidado de facturas de contado y crédito liquidadas</p>
                </div>
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-full">
                {facturasList.length} Facturas
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">Factura</th>
                    <th className="px-4 py-3 text-left">N° Recibo</th>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Cliente</th>
                    <th className="px-4 py-3 text-left">Sucursal</th>
                    <th className="px-4 py-3 text-center">Tipo Venta</th>
                    <th className="px-4 py-3 text-center">Método Pago</th>
                    <th className="px-4 py-3 text-right">Total Factura</th>
                    <th className="px-4 py-3 text-right">Monto Cancelado</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {facturasList.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-10 text-slate-400">Sin facturas canceladas en este período</td></tr>
                  ) : (
                    (() => {
                      const facturasPageSize = 10;
                      const paginated = facturasList.slice((facturasPage - 1) * facturasPageSize, facturasPage * facturasPageSize);
                      return paginated.map((f, i) => {
                        const num = f.numerofactura || f.NumeroFactura || f.numeroFactura || f.numero;
                        const recNum = f.recibonumero || f.ReciboNumero || f.reciboNumero || '-';
                        const fech = f.fecha || f.Fecha;
                        const cli = f.cliente || f.Cliente;
                        const suc = f.sucursal || f.Sucursal;
                        const tv = f.tipoventa || f.TipoVenta || f.tipoVenta || 'Contado';
                        const cp = f.condicionpago || f.CondicionPago || f.condicionPago || 'CONTADO';
                        const mp = f.metodopago || f.MetodoPago || f.metodoPago || 'EFECTIVO';
                        const tot = Number(f.total || f.Total) || 0;
                        const mto = Number(f.montoaplicado || f.MontoAplicado || f.montoAplicado || tot) || tot;
                        const est = f.estadopago || f.EstadoPago || f.estadoPago || 'PAGADO';

                        return (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-mono text-blue-700 font-bold">#{num}</td>
                            <td className="px-4 py-3 font-mono text-emerald-700 font-bold text-xs">
                              {recNum !== '-' ? (
                                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-mono">
                                  #{recNum}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{formatDate(fech)}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{cli}</td>
                            <td className="px-4 py-3 text-slate-500">{suc}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                tv === 'Contado' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                              }`}>
                                {tv} ({cp})
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                                {mp}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700">{formatCurrency(tot)}</td>
                            <td className="px-4 py-3 text-right font-extrabold text-emerald-700">{formatCurrency(mto)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                est === 'PAGADO' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {est}
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })()
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {facturasList.length > 0 && (
              <div className="p-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
                <span className="text-xs text-slate-500 font-medium">
                  Mostrando {facturasList.length === 0 ? 0 : (facturasPage - 1) * 10 + 1} a {Math.min(facturasPage * 10, facturasList.length)} de {facturasList.length} Facturas
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={facturasPage === 1}
                    onClick={() => setFacturasPage(p => Math.max(p - 1, 1))}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition-colors"
                  >
                    Anterior
                  </button>
                  <span className="text-xs font-bold text-slate-700 px-2">
                    Página {facturasPage} de {Math.ceil(facturasList.length / 10) || 1}
                  </span>
                  <button
                    disabled={facturasPage >= Math.ceil(facturasList.length / 10)}
                    onClick={() => setFacturasPage(p => Math.min(p + 1, Math.ceil(facturasList.length / 10)))}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal for Chart Section Details */}
      {selectedGraphSection && (
        <GraficoDetallesModal
          title={selectedGraphSection.title}
          category={selectedGraphSection.category}
          recibosList={selectedGraphSection.list}
          onClose={() => setSelectedGraphSection(null)}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
};

/* ======================== GRAFICO DETALLES MODAL ======================== */
const GraficoDetallesModal = ({ title, category, recibosList, onClose, formatCurrency }) => {
  const filtered = (recibosList || []).filter(r => {
    if (!category) return true;
    const catUpper = (category + '').toUpperCase().trim();
    const metUpper = (r.metodopago || r.MetodoPago || r.metodoPago || '').toUpperCase();
    const bancoUpper = (r.bancocuenta || r.bancoCuenta || r.BancoCuenta || r.entidad || r.Entidad || '').toUpperCase();
    const tipoUpper = (r.tipoventa || r.TipoVenta || r.tipoVenta || '').toUpperCase();

    if (catUpper.includes('TRANSFERENCIA') || catUpper.includes('DEPOSITO')) {
      return metUpper.includes('TRANSFERENCIA') || metUpper.includes('DEPOSITO');
    }
    if (catUpper === 'CONTADO' || catUpper === 'CRÉDITO' || catUpper === 'CREDITO') {
      return tipoUpper === catUpper || (catUpper === 'CREDITO' && (tipoUpper === 'CRÉDITO' || tipoUpper === 'CREDITO')) || (catUpper === 'CRÉDITO' && (tipoUpper === 'CREDITO' || tipoUpper === 'CRÉDITO'));
    }
    return metUpper.includes(catUpper) || bancoUpper.includes(catUpper) || catUpper.includes(bancoUpper);
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base">{title}</h3>
            <p className="text-xs text-blue-100 mt-0.5">Filtro: <span className="font-bold underline">{category}</span> ({filtered.length} registros)</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-white"><X size={20} /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-medium">No hay registros detallados para esta sección.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="px-3 py-2.5 text-left">N° Recibo / Factura</th>
                  <th className="px-3 py-2.5 text-left">Fecha</th>
                  <th className="px-3 py-2.5 text-left">Cliente</th>
                  <th className="px-3 py-2.5 text-left">Sucursal</th>
                  <th className="px-3 py-2.5 text-left">Método / Banco</th>
                  <th className="px-3 py-2.5 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item, idx) => {
                  const numRecibo = item.recibonumero || item.ReciboNumero || item.reciboNumero;
                  const numFactura = item.numerofactura || item.NumeroFactura || item.numeroFactura || item.numero;
                  const displayNum = numRecibo && numRecibo !== '-' 
                    ? `#${numRecibo} (Fact: #${numFactura})` 
                    : (numFactura ? `#${numFactura}` : item.serie ? `#${item.serie}-${item.numero}` : '—');
                  const fech = item.fecha || item.Fecha;
                  const cli = item.cliente || item.Cliente;
                  const suc = item.sucursal || item.Sucursal;
                  const met = item.bancocuenta || item.bancoCuenta || item.metodopago || item.MetodoPago || 'Efectivo';
                  const mto = Number(item.importetotal || item.ImporteTotal || item.montoaplicado || item.MontoAplicado || item.total || item.Total) || 0;

                  return (
                    <tr key={idx} className="hover:bg-slate-50 font-medium">
                      <td className="px-3 py-2.5 font-mono font-bold text-blue-700">{displayNum}</td>
                      <td className="px-3 py-2.5 text-slate-600">{formatDate(fech)}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">{cli}</td>
                      <td className="px-3 py-2.5 text-slate-500">{suc}</td>
                      <td className="px-3 py-2.5">
                        <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                          {met}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-emerald-700">
                        {formatCurrency(mto)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

/* ======================== EDITAR METODO PAGO MODAL ======================== */
const EditarMetodoPagoModal = ({ recibo, onClose, onSuccess, formatCurrency }) => {
  const [metodoPago, setMetodoPago] = useState(recibo.metodopago || 'EFECTIVO');
  const [bancoTarjeta, setBancoTarjeta] = useState(recibo.bancocuenta || recibo.bancoCuenta || '');
  const [referencia, setReferencia] = useState(recibo.referencia || recibo.Referencia || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      await axios.put(`${CAJA_URL}/editar-metodo-pago/${recibo.id}`, {
        MetodoPago: metodoPago,
        BancoTarjeta: (metodoPago === 'TRANSFERENCIA' || metodoPago === 'DEPOSITO' || metodoPago === 'TARJETA') ? bancoTarjeta : null,
        Referencia: (metodoPago === 'TRANSFERENCIA' || metodoPago === 'DEPOSITO') ? referencia : null
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.Error || 'Error al actualizar el método de pago.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-base">
            <Edit size={20} />
            <span>Editar Método de Pago - Recibo #{recibo.serie}-{recibo.numero}</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4 text-sm">
          {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs">{error}</div>}

          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase mb-1 block">Forma de Pago</label>
            <select
              value={metodoPago}
              onChange={e => setMetodoPago(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-medium focus:ring-2 focus:ring-amber-500"
            >
              <option value="EFECTIVO">💵 Efectivo</option>
              <option value="TRANSFERENCIA">🏦 Transferencia Bancaria</option>
              <option value="DEPOSITO">📋 Depósito Bancario</option>
              <option value="TARJETA">💳 Tarjeta de Crédito / Débito</option>
              <option value="NOTA_CREDITO">📜 Nota de Crédito</option>
              <option value="RETENCION_IR">🏷️ Retención IR en la Fuente (2%)</option>
              <option value="RETENCION_ALCALDIA">🏛️ Retención Municipal (1%)</option>
            </select>
          </div>

          {(metodoPago === 'TRANSFERENCIA' || metodoPago === 'DEPOSITO') && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase mb-1 block">Banco y N° Cuenta *</label>
                <select
                  value={bancoTarjeta}
                  onChange={e => setBancoTarjeta(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold bg-white focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Seleccionar Banco y Cuenta --</option>
                  {CUENTAS_BANCARIAS.map(group => (
                    <optgroup key={group.banco} label={group.banco}>
                      {group.cuentas.map(c => (
                        <option key={c.id} value={c.label}>{c.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase mb-1 block">N° Referencia *</label>
                <input
                  type="text"
                  placeholder="N° Referencia"
                  value={referencia}
                  onChange={e => setReferencia(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </>
          )}

          {metodoPago === 'TARJETA' && (
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase mb-1 block">Terminal POS *</label>
              <select
                value={bancoTarjeta}
                onChange={e => setBancoTarjeta(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-medium bg-white focus:ring-2 focus:ring-amber-500"
              >
                <option value="POS BAC">POS BAC</option>
                <option value="POS LAFISE">POS LAFISE</option>
                <option value="OTRO POS">OTRO POS</option>
              </select>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow transition-all disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ======================== RECIBOS DETALLE MODAL ======================== */
const ReciboDetalleModal = ({ reciboId, onClose, formatCurrency }) => {
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (reciboId) {
      setLoading(true);
      axios.get(`${CAJA_URL}/recibo-detalle/${reciboId}`)
        .then(res => setDetalle(res.data))
        .catch(err => setError(err.response?.data?.Error || 'Error al cargar el detalle del recibo'))
        .finally(() => setLoading(false));
    }
  }, [reciboId]);

  if (!reciboId) return null;

  const recibo = detalle?.recibo || detalle?.Recibo;
  const facturas = detalle?.facturas || detalle?.Facturas || [];
  const metodos = detalle?.metodos || detalle?.Metodos || [];
  const retenciones = detalle?.retenciones || detalle?.Retenciones || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-700 to-emerald-800 text-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <Receipt size={22} />
            <div>
              <h2 className="text-base font-bold">Detalle del Recibo de Pago</h2>
              {recibo && (
                <p className="text-xs opacity-90 font-mono">#{recibo.serie}-{recibo.numero}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5 text-sm">
          {loading ? (
            <div className="py-12 text-center text-slate-400 animate-pulse">Cargando detalle del recibo...</div>
          ) : error ? (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl">{error}</div>
          ) : recibo ? (
            <>
              {/* Header Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase block">Cliente</span>
                  <span className="font-semibold text-slate-800">{recibo.cliente || 'N/A'}</span>
                  {recibo.clienteidentificacion && (
                    <span className="text-xs text-slate-500 block">ID: {recibo.clienteidentificacion}</span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase block">Fecha</span>
                  <span className="font-semibold text-slate-800">{formatDate(recibo.fecha)}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase block">Sucursal</span>
                  <span className="font-semibold text-slate-800">{recibo.sucursal || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase block">Estado</span>
                  <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    recibo.estado === 'ANULADO' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {recibo.estado || 'ACTIVO'}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase block">Método General</span>
                  <span className="font-bold text-emerald-700 uppercase">{recibo.metodopago}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase block">Importe Total</span>
                  <span className="font-extrabold text-emerald-700 text-base">{formatCurrency(recibo.importetotal)}</span>
                </div>
              </div>

              {recibo.descripcion && (
                <div className="bg-white p-3 border border-slate-200 rounded-xl">
                  <span className="text-xs font-bold text-slate-400 uppercase block">Concepto / Descripción</span>
                  <p className="text-slate-700 text-xs mt-0.5">{recibo.descripcion}</p>
                </div>
              )}

              {/* Facturas Aplicadas */}
              <div>
                <h4 className="font-bold text-slate-700 text-xs uppercase mb-2 flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-emerald-600" /> Facturas Liquidadas / Aplicadas
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Factura</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Fecha</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-600">Total Factura</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-600">Monto Aplicado</th>
                        <th className="px-3 py-2 text-center font-semibold text-slate-600">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {facturas && facturas.length > 0 ? (
                        facturas.map((f, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono text-blue-700 font-bold">#{f.numerofactura}</td>
                            <td className="px-3 py-2 text-slate-600">{formatDate(f.fechafactura)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-700">{formatCurrency(f.totalfactura)}</td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-700">{formatCurrency(f.montoaplicado)}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                f.esparcial ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {f.esparcial ? 'Abono Parcial' : 'Cancelado'}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="5" className="text-center py-4 text-slate-400">Sin detalles de facturas</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Formas de Pago Desglosadas */}
              <div>
                <h4 className="font-bold text-slate-700 text-xs uppercase mb-2 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-blue-600" /> Desglose de Forma(s) de Pago
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Forma de Pago</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Banco / Cuenta Seleccionada</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">N° Ref / Nota Crédito</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-600">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {metodos && metodos.length > 0 ? (
                        metodos.map((m, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-bold text-slate-800">
                              {m.metodopago}
                              {m.metodopago === 'TARJETA' && ((m.cargobancario || m.cargoBancario) > 0) && (
                                <span className="block text-[10px] font-medium text-amber-900 mt-0.5">
                                  Comisión POS ({m.comisionporcentaje || m.comisionPorcentaje}%): -{formatCurrency(m.cargobancario || m.cargoBancario)} | Ret. Fuente (1.5%): -{formatCurrency(m.retencionfuentepos || m.retencionFuentePos)}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {m.bancotarjeta || '—'}
                              {(m.numerocuenta || m.numeroCuenta) && (
                                <span className="block text-[10px] font-mono text-emerald-800 font-bold mt-0.5">Cta: {m.numerocuenta || m.numeroCuenta}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-700">
                              {m.referencia || (m.numeronotacredito ? `NC #${m.numeronotacredito}` : '—')}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-700">
                              {formatCurrency(m.monto)}
                              {m.metodopago === 'TARJETA' && (m.montonetobanco || m.montoNetoBanco) && (
                                <span className="block text-[10px] font-extrabold text-blue-700 mt-0.5">
                                  Neto Banco: {formatCurrency(m.montonetobanco || m.montoNetoBanco)}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-2 font-bold text-slate-800">{recibo.metodopago}</td>
                          <td className="px-3 py-2 text-slate-700">—</td>
                          <td className="px-3 py-2 font-mono text-slate-700">—</td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700">{formatCurrency(recibo.importetotal)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Retenciones de Ley Aplicadas */}
              {retenciones && retenciones.length > 0 && (
                <div>
                  <h4 className="font-bold text-amber-800 text-xs uppercase mb-2 flex items-center gap-1.5">
                    <FileText size={14} className="text-amber-600" /> Retenciones de Ley Aplicadas
                  </h4>
                  <div className="border border-amber-200 bg-amber-50/50 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-amber-100/60 border-b border-amber-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-amber-900">Entidad / Tercero</th>
                          <th className="px-3 py-2 text-left font-semibold text-amber-900">Tipo Retención</th>
                          <th className="px-3 py-2 text-right font-semibold text-amber-900">Monto Base</th>
                          <th className="px-3 py-2 text-center font-semibold text-amber-900">%</th>
                          <th className="px-3 py-2 text-right font-semibold text-amber-900">Monto Retención</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100">
                        {retenciones.map((r, i) => (
                          <tr key={i} className="hover:bg-amber-100/40 font-medium">
                            <td className="px-3 py-2 font-bold text-amber-950">{r.terceronombre || r.TerceroNombre || 'Entidad Fiscal'}</td>
                            <td className="px-3 py-2 text-amber-900">{r.concepto || r.Concepto}</td>
                            <td className="px-3 py-2 text-right font-medium text-amber-900">{formatCurrency(r.montobase || r.MontoBase)}</td>
                            <td className="px-3 py-2 text-center font-bold text-amber-800">{r.porcentaje || r.Porcentaje}%</td>
                            <td className="px-3 py-2 text-right font-extrabold text-amber-900">{formatCurrency(r.montoretencion || r.MontoRetencion)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  onClick={() => printReciboIngresoDocument(detalle, formatCurrency, true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Printer size={15} /> Reimprimir Recibo (Membrete)
                </button>
                <button
                  onClick={onClose}
                  className="border border-slate-300 text-slate-700 font-semibold text-xs px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

/* ======================== RECIBOS / CXC TAB ======================== */
const RecibosTab = ({ filters, formatCurrency }) => {
  const [subTab, setSubTab] = useState('aplicados'); // 'aplicados' | 'cobrar'

  // Applied Receipts state
  const [recibosAplicados, setRecibosAplicados] = useState([]);
  const [loadingAplicados, setLoadingAplicados] = useState(false);
  const [searchAplicados, setSearchAplicados] = useState('');
  const [selectedReciboId, setSelectedReciboId] = useState(null);
  const [editingRecibo, setEditingRecibo] = useState(null);

  // Recibos Header Filters and Pagination
  const [reciboHeaderFilters, setReciboHeaderFilters] = useState({
    recibo: '',
    fecha: '',
    cliente: '',
    sucursal: '',
    metodo: '',
    banco: '',
    referencia: '',
    estado: ''
  });
  const [recibosPage, setRecibosPage] = useState(1);

  // Pending Invoices state
  const [condicion, setCondicion] = useState('credito');
  const [facturas, setFacturas] = useState([]);
  const [loadingFacturas, setLoadingFacturas] = useState(false);
  const [selectedFacturas, setSelectedFacturas] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showGestionBancos, setShowGestionBancos] = useState(false);
  const [searchCliente, setSearchCliente] = useState('');
  const [colFiltros, setColFiltros] = useState({
    factura: '',
    fecha: '',
    vencimiento: '',
    cliente: '',
    sucursal: '',
    total: ''
  });

  const fetchRecibosAplicados = async () => {
    setLoadingAplicados(true);
    try {
      const res = await axios.get(`${CAJA_URL}/recibos`, {
        params: cleanParams({ tipo: 'INGRESO', ...filters })
      });
      setRecibosAplicados(res.data || []);
      setRecibosPage(1);
    } catch (e) {
      console.error("Error al obtener recibos aplicados", e);
    } finally {
      setLoadingAplicados(false);
    }
  };

  const fetchFacturas = async () => {
    setLoadingFacturas(true);
    try {
      const res = await axios.get(`${CAJA_URL}/facturas-pendientes`, {
        params: cleanParams({
          condicion,
          startDate: filters?.startDate,
          endDate: filters?.endDate,
          sucursalId: filters?.sucursalId
        })
      });
      setFacturas(res.data);
    } catch (e) { console.error(e); }
    finally { setLoadingFacturas(false); }
  };

  useEffect(() => {
    if (subTab === 'aplicados') {
      fetchRecibosAplicados();
    } else {
      fetchFacturas();
    }
  }, [subTab, condicion, filters]);

  const handleAnularRecibo = async (recibo) => {
    if (!window.confirm(`¿Está seguro de ANULAR el Recibo No. ${recibo.serie}-${recibo.numero}? Esta acción revertirá el pago de las facturas asociadas.`)) return;
    try {
      await axios.post(`${CAJA_URL}/anular-recibo/${recibo.id}`);
      alert('Recibo de pago anulado correctamente.');
      fetchRecibosAplicados();
    } catch (err) {
      alert(err.response?.data?.Error || 'Error al anular el recibo.');
    }
  };

  const handleReimprimirRecibo = async (recibo) => {
    try {
      const res = await axios.get(`${CAJA_URL}/recibo-detalle/${recibo.id}`);
      if (res.data) {
        printReciboIngresoDocument(res.data, formatCurrency, true);
      }
    } catch (err) {
      alert('Error al obtener el detalle del recibo para reimprimir.');
    }
  };

  const filteredAplicados = recibosAplicados.filter(r => {
    const q = searchAplicados.toLowerCase();
    const matchesGlobal = !q ||
      (r.serie + '-' + r.numero).toLowerCase().includes(q) ||
      (r.cliente || '').toLowerCase().includes(q) ||
      (r.bancocuenta || r.bancoCuenta || '').toLowerCase().includes(q) ||
      (r.referencia || '').toLowerCase().includes(q) ||
      (r.sucursal || '').toLowerCase().includes(q) ||
      (r.metodopago || '').toLowerCase().includes(q);

    const recNum = (r.serie ? `${r.serie}-${r.numero}` : r.numero || '').toLowerCase();
    const matchRecibo = !reciboHeaderFilters.recibo || recNum.includes(reciboHeaderFilters.recibo.toLowerCase());
    const matchFecha = !reciboHeaderFilters.fecha || formatDate(r.fecha).toLowerCase().includes(reciboHeaderFilters.fecha.toLowerCase());
    const matchCliente = !reciboHeaderFilters.cliente || (r.cliente || '').toLowerCase().includes(reciboHeaderFilters.cliente.toLowerCase());
    const matchSucursal = !reciboHeaderFilters.sucursal || (r.sucursal || '').toLowerCase().includes(reciboHeaderFilters.sucursal.toLowerCase());
    const matchMetodo = !reciboHeaderFilters.metodo || (r.metodopago || '').toLowerCase().includes(reciboHeaderFilters.metodo.toLowerCase());
    const matchBanco = !reciboHeaderFilters.banco || (r.bancocuenta || r.bancoCuenta || '').toLowerCase().includes(reciboHeaderFilters.banco.toLowerCase());
    const matchRef = !reciboHeaderFilters.referencia || ((r.referencia || '') + ' ' + (r.facturas || '')).toLowerCase().includes(reciboHeaderFilters.referencia.toLowerCase());
    const matchEstado = !reciboHeaderFilters.estado || (r.estado || '').toLowerCase() === reciboHeaderFilters.estado.toLowerCase();

    return matchesGlobal && matchRecibo && matchFecha && matchCliente && matchSucursal && matchMetodo && matchBanco && matchRef && matchEstado;
  });

  const filteredFacturas = facturas.filter(f => {
    const matchClienteGlobal = !searchCliente || (f.cliente || '').toLowerCase().includes(searchCliente.toLowerCase());
    const matchFactura = !colFiltros.factura || (f.numerofactura || '').toLowerCase().includes(colFiltros.factura.toLowerCase());
    const matchFecha = !colFiltros.fecha || formatDate(f.fecha).toLowerCase().includes(colFiltros.fecha.toLowerCase());
    const matchVenc = !colFiltros.vencimiento || formatDate(f.fechavencimiento).toLowerCase().includes(colFiltros.vencimiento.toLowerCase());
    const matchClienteCol = !colFiltros.cliente || (f.cliente || '').toLowerCase().includes(colFiltros.cliente.toLowerCase());
    const matchSucursal = !colFiltros.sucursal || (f.sucursal || '').toLowerCase().includes(colFiltros.sucursal.toLowerCase());
    const matchTotal = !colFiltros.total || (f.total || '').toString().includes(colFiltros.total);
    
    return matchClienteGlobal && matchFactura && matchFecha && matchVenc && matchClienteCol && matchSucursal && matchTotal;
  });

  const toggleFactura = (f) => {
    setSelectedFacturas(prev => {
      const exists = prev.find(x => x.id === f.id);
      if (exists) return prev.filter(x => x.id !== f.id);
      return [...prev, { ...f, montoAplicar: Number(f.saldopendiente) }];
    });
  };

  const totalAplicadoGeneral = recibosAplicados.filter(r => r.estado !== 'ANULADO').reduce((sum, r) => sum + (Number(r.importetotal) || 0), 0);

  const recibosPageSize = 10;
  const totalRecibosPages = Math.ceil(filteredAplicados.length / recibosPageSize);
  const paginatedAplicados = filteredAplicados.slice((recibosPage - 1) * recibosPageSize, recibosPage * recibosPageSize);

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation Banner */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setSubTab('aplicados')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === 'aplicados'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Receipt size={16} /> Recibos Aplicados (Vista General)
          </button>
          <button
            onClick={() => setSubTab('cobrar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === 'cobrar'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Plus size={16} /> Registrar Pago / Cobrar Facturas
          </button>
          <button
            onClick={() => setShowGestionBancos(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-slate-800 hover:bg-slate-900 text-white shadow-md"
          >
            <Banknote size={16} /> 🏦 Cuentas Bancarias
          </button>
        </div>

        {subTab === 'aplicados' ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-semibold">Total Recibido: <strong className="text-emerald-700 text-sm">{formatCurrency(totalAplicadoGeneral)}</strong></span>
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <Search size={15} className="text-slate-400" />
              <input
                value={searchAplicados}
                onChange={e => { setSearchAplicados(e.target.value); setRecibosPage(1); }}
                placeholder="Buscar por Recibo, Cliente, Banco, Ref..."
                className="bg-transparent text-xs outline-none w-56 font-medium"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              {['credito', 'contado'].map(c => (
                <button key={c} onClick={() => setCondicion(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${condicion === c ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {c === 'credito' ? '💳 Crédito' : '💵 Contado'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <Search size={15} className="text-slate-400" />
              <input
                value={searchCliente}
                onChange={e => setSearchCliente(e.target.value)}
                placeholder="Buscar cliente..."
                className="bg-transparent text-xs outline-none w-44 font-medium"
              />
            </div>
            {selectedFacturas.length > 0 && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                <Receipt size={15} /> Aplicar Pago ({selectedFacturas.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* VIEW 1: REPOSITORIO DE RECIBOS APLICADOS */}
      {subTab === 'aplicados' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-emerald-600" />
              <h3 className="font-bold text-slate-800 text-sm">Historial General de Recibos Aplicados</h3>
            </div>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full">
              {filteredAplicados.length} Recibos
            </span>
          </div>

          <div className="overflow-x-auto">
            {loadingAplicados ? (
              <div className="py-12 text-center text-slate-400 animate-pulse">Cargando recibos aplicados...</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-xs border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">No. Recibo</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Sucursal</th>
                    <th className="px-4 py-3">Método Pago</th>
                    <th className="px-4 py-3">Banco / Cuenta</th>
                    <th className="px-4 py-3">N° Referencia</th>
                    <th className="px-4 py-3 text-right">Importe Total</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-center w-36">Acciones</th>
                  </tr>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-xs normal-case">
                    <th className="p-1.5"><input value={reciboHeaderFilters.recibo} onChange={e => { setReciboHeaderFilters({...reciboHeaderFilters, recibo: e.target.value}); setRecibosPage(1); }} placeholder="N° Recibo..." className="w-full text-[11px] px-2 py-1 border border-slate-300 rounded font-normal bg-white" /></th>
                    <th className="p-1.5"><input value={reciboHeaderFilters.fecha} onChange={e => { setReciboHeaderFilters({...reciboHeaderFilters, fecha: e.target.value}); setRecibosPage(1); }} placeholder="DD/MM/AAAA..." className="w-full text-[11px] px-2 py-1 border border-slate-300 rounded font-normal bg-white" /></th>
                    <th className="p-1.5"><input value={reciboHeaderFilters.cliente} onChange={e => { setReciboHeaderFilters({...reciboHeaderFilters, cliente: e.target.value}); setRecibosPage(1); }} placeholder="Cliente..." className="w-full text-[11px] px-2 py-1 border border-slate-300 rounded font-normal bg-white" /></th>
                    <th className="p-1.5"><input value={reciboHeaderFilters.sucursal} onChange={e => { setReciboHeaderFilters({...reciboHeaderFilters, sucursal: e.target.value}); setRecibosPage(1); }} placeholder="Sucursal..." className="w-full text-[11px] px-2 py-1 border border-slate-300 rounded font-normal bg-white" /></th>
                    <th className="p-1.5"><input value={reciboHeaderFilters.metodo} onChange={e => { setReciboHeaderFilters({...reciboHeaderFilters, metodo: e.target.value}); setRecibosPage(1); }} placeholder="Método..." className="w-full text-[11px] px-2 py-1 border border-slate-300 rounded font-normal bg-white" /></th>
                    <th className="p-1.5"><input value={reciboHeaderFilters.banco} onChange={e => { setReciboHeaderFilters({...reciboHeaderFilters, banco: e.target.value}); setRecibosPage(1); }} placeholder="Banco/Cuenta..." className="w-full text-[11px] px-2 py-1 border border-slate-300 rounded font-normal bg-white" /></th>
                    <th className="p-1.5"><input value={reciboHeaderFilters.referencia} onChange={e => { setReciboHeaderFilters({...reciboHeaderFilters, referencia: e.target.value}); setRecibosPage(1); }} placeholder="Ref/Facturas..." className="w-full text-[11px] px-2 py-1 border border-slate-300 rounded font-normal bg-white" /></th>
                    <th className="p-1.5"></th>
                    <th className="p-1.5">
                      <select value={reciboHeaderFilters.estado} onChange={e => { setReciboHeaderFilters({...reciboHeaderFilters, estado: e.target.value}); setRecibosPage(1); }} className="w-full text-[11px] px-1 py-1 border border-slate-300 rounded font-normal bg-white">
                        <option value="">Todos</option>
                        <option value="APLICADO">APLICADO</option>
                        <option value="ANULADO">ANULADO</option>
                      </select>
                    </th>
                    <th className="p-1.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAplicados.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-12 text-slate-400">Sin recibos aplicados registrados</td></tr>
                  ) : (
                    paginatedAplicados.map((r) => (
                      <tr key={r.id} className={`hover:bg-slate-50/80 transition-colors ${r.estado === 'ANULADO' ? 'bg-red-50/40 opacity-75' : ''}`}>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-700">#{r.serie}-{r.numero}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(r.fecha)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{r.cliente || 'Cliente General'}</td>
                        <td className="px-4 py-3 text-slate-600">{r.sucursal}</td>
                        <td className="px-4 py-3">
                          <span className="bg-emerald-100 text-emerald-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                            {r.metodopago}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 text-xs font-medium max-w-[180px] truncate" title={r.bancocuenta || r.bancoCuenta}>
                          {r.bancocuenta || r.bancoCuenta || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {r.referencia || r.Referencia ? (
                            <div className="font-semibold text-slate-800">{r.referencia || r.Referencia}</div>
                          ) : null}
                          {(r.facturas || r.Facturas) ? (
                            <div className="text-[11px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100/60 inline-block mt-0.5">
                              Facturas: #{r.facturas || r.Facturas}
                            </div>
                          ) : (!r.referencia && !r.Referencia && '—')}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-emerald-700">{formatCurrency(r.importetotal)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            r.estado === 'ANULADO' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {r.estado || 'ACTIVO'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setSelectedReciboId(r.id)}
                              className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Ver Detalle del Recibo"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => handleReimprimirRecibo(r)}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Reimprimir Recibo (Membrete)"
                            >
                              <Printer size={16} />
                            </button>
                            {r.estado !== 'ANULADO' && (
                              <>
                                <button
                                  onClick={() => setEditingRecibo(r)}
                                  className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                                  title="Editar Método de Pago"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => handleAnularRecibo(r)}
                                  className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Anular Recibo"
                                >
                                  <XCircle size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Controls for Recibos */}
          {filteredAplicados.length > 0 && (
            <div className="p-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
              <span className="text-xs text-slate-500 font-medium">
                Mostrando {(recibosPage - 1) * recibosPageSize + 1} a {Math.min(recibosPage * recibosPageSize, filteredAplicados.length)} de {filteredAplicados.length} Recibos
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={recibosPage === 1}
                  onClick={() => setRecibosPage(p => Math.max(p - 1, 1))}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition-colors"
                >
                  Anterior
                </button>
                <span className="text-xs font-bold text-slate-700 px-2">
                  Página {recibosPage} de {totalRecibosPages || 1}
                </span>
                <button
                  disabled={recibosPage >= totalRecibosPages}
                  onClick={() => setRecibosPage(p => Math.min(p + 1, totalRecibosPages))}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: COBRAR FACTURAS PENDIENTES */}
      {subTab === 'cobrar' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
            <AlertCircle size={16} className="text-amber-500" />
            <span className="font-semibold text-slate-700 text-sm">Facturas Pendientes de Cobro - {condicion === 'credito' ? 'Crédito' : 'Contado'}</span>
            <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold">{filteredFacturas.length} facturas</span>
          </div>
          <div className="overflow-x-auto">
            {loadingFacturas ? (
              <div className="py-12 text-center text-slate-400 animate-pulse">Cargando facturas...</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 text-left w-8 align-top"></th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                      <div>Factura</div>
                      <input
                        type="text"
                        placeholder="Filtro..."
                        value={colFiltros.factura}
                        onChange={e => setColFiltros({ ...colFiltros, factura: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        className="mt-1 border border-slate-200 rounded px-2 py-0.5 text-xs font-normal normal-case text-slate-700 bg-white w-24 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                      <div>Fecha</div>
                      <input
                        type="text"
                        placeholder="Filtro..."
                        value={colFiltros.fecha}
                        onChange={e => setColFiltros({ ...colFiltros, fecha: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        className="mt-1 border border-slate-200 rounded px-2 py-0.5 text-xs font-normal normal-case text-slate-700 bg-white w-20 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                      <div>Vencimiento</div>
                      <input
                        type="text"
                        placeholder="Filtro..."
                        value={colFiltros.vencimiento}
                        onChange={e => setColFiltros({ ...colFiltros, vencimiento: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        className="mt-1 border border-slate-200 rounded px-2 py-0.5 text-xs font-normal normal-case text-slate-700 bg-white w-20 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                      <div>Cliente</div>
                      <input
                        type="text"
                        placeholder="Filtro..."
                        value={colFiltros.cliente}
                        onChange={e => setColFiltros({ ...colFiltros, cliente: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        className="mt-1 border border-slate-200 rounded px-2 py-0.5 text-xs font-normal normal-case text-slate-700 bg-white w-36 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                      <div>Sucursal</div>
                      <input
                        type="text"
                        placeholder="Filtro..."
                        value={colFiltros.sucursal}
                        onChange={e => setColFiltros({ ...colFiltros, sucursal: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        className="mt-1 border border-slate-200 rounded px-2 py-0.5 text-xs font-normal normal-case text-slate-700 bg-white w-24 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase align-top pt-3">
                      <div>Total</div>
                      <input
                        type="text"
                        placeholder="Filtro..."
                        value={colFiltros.total}
                        onChange={e => setColFiltros({ ...colFiltros, total: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        className="mt-1 border border-slate-200 rounded px-2 py-0.5 text-xs font-normal normal-case text-slate-700 bg-white w-20 focus:outline-none focus:ring-1 focus:ring-blue-400 text-right"
                      />
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase align-top pt-3">Pagado</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase align-top pt-3">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredFacturas.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-12 text-slate-400">No hay facturas pendientes</td></tr>
                  ) : (
                    filteredFacturas.map(f => {
                      const isSelected = !!selectedFacturas.find(x => x.id === f.id);
                      const vencDate = f.fechavencimiento ? new Date(f.fechavencimiento) : null;
                      const isVencida = vencDate && vencDate < new Date();
                      return (
                        <tr key={f.id}
                          className={`cursor-pointer hover:bg-slate-50 transition-colors ${isSelected ? 'bg-emerald-50' : ''}`}
                          onClick={() => toggleFactura(f)}>
                          <td className="px-3 py-3">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                              {isSelected && <CheckCircle size={12} className="text-white" />}
                            </div>
                          </td>
                          <td className="px-3 py-3 font-mono text-blue-700 font-bold">#{f.numerofactura}</td>
                          <td className="px-3 py-3 text-slate-600">{formatDate(f.fecha)}</td>
                          <td className="px-3 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isVencida ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                              {formatDate(f.fechavencimiento) || 'N/A'}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-medium text-slate-800">{f.cliente}</td>
                          <td className="px-3 py-3 text-slate-500">{f.sucursal}</td>
                          <td className="px-3 py-3 text-right text-slate-700">{formatCurrency(f.total)}</td>
                          <td className="px-3 py-3 text-right text-emerald-600">{formatCurrency(f.montopagado)}</td>
                          <td className="px-3 py-3 text-right font-bold text-rose-600">{formatCurrency(f.saldopendiente)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Recibo Detalle Modal */}
      {selectedReciboId && (
        <ReciboDetalleModal
          reciboId={selectedReciboId}
          onClose={() => setSelectedReciboId(null)}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Edit Payment Method Modal */}
      {editingRecibo && (
        <EditarMetodoPagoModal
          recibo={editingRecibo}
          onClose={() => setEditingRecibo(null)}
          onSuccess={() => { setEditingRecibo(null); fetchRecibosAplicados(); }}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Bank Accounts Management Modal */}
      {showGestionBancos && (
        <GestionCuentasBancariasModal
          onClose={() => setShowGestionBancos(false)}
        />
      )}

      {/* Payment Modal */}
      {showModal && (
        <PaymentModal
          selectedFacturas={selectedFacturas}
          setSelectedFacturas={setSelectedFacturas}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); setSelectedFacturas([]); fetchFacturas(); fetchRecibosAplicados(); }}
          formatCurrency={formatCurrency}
          filters={filters}
        />
      )}
    </div>
  );
};

/* ======================== PAYMENT MODAL ======================== */
const PaymentModal = ({ selectedFacturas, setSelectedFacturas, onClose, onSuccess, formatCurrency, filters }) => {
  const [serie, setSerie] = useState('A');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(today());
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [bancoTarjeta, setBancoTarjeta] = useState('POS BAC');
  const [selectedNCId, setSelectedNCId] = useState('');
  const [referencia, setReferencia] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [montosParciales, setMontosParciales] = useState(() =>
    selectedFacturas.reduce((acc, f) => ({ ...acc, [f.id]: Number(f.saldopendiente) }), {})
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Multi Payment Methods State
  const [isMultiMetodo, setIsMultiMetodo] = useState(false);
  const [metodosPagoList, setMetodosPagoList] = useState([
    { id: 1, metodoPago: 'EFECTIVO', monto: 0, notaCreditoId: '', bancoTarjeta: 'POS BAC', referencia: '' }
  ]);

  // Customer Credit Notes State
  const [availableNotasCredito, setAvailableNotasCredito] = useState([]);
  const [loadingNC, setLoadingNC] = useState(false);

  const clienteNombre = selectedFacturas[0]?.cliente || '';
  const clienteId = selectedFacturas[0]?.clienteid || selectedFacturas[0]?.clienteId || null;
  const importeTotal = selectedFacturas.reduce((acc, f) => acc + (montosParciales[f.id] || 0), 0);
  const subtotalEstimado = Math.round((importeTotal / 1.15) * 100) / 100;

  const handleAddRetencion = (tipo, tasa) => {
    setIsMultiMetodo(true);
    const montoRet = Math.round((importeTotal / 1.15 * tasa) * 100) / 100;
    const tipoLabel = tipo === 'RETENCION_IR' ? 'Retención IR (2%) DGI' : 'Retención Municipal (1%) Alcaldía';

    const numComp = window.prompt(`Ingrese el N° de Comprobante / Constancia de ${tipoLabel}:`);
    if (numComp === null) return; // Usuario canceló

    setMetodosPagoList(prev => {
      const filtered = prev.filter(m => m.metodoPago !== tipo);

      const updated = filtered.map(m => {
        if (m.metodoPago === 'EFECTIVO' && m.monto > montoRet) {
          return { ...m, monto: Math.max(0, Math.round((m.monto - montoRet) * 100) / 100) };
        }
        return m;
      });

      return [
        ...updated,
        {
          id: Date.now(),
          metodoPago: tipo,
          monto: montoRet,
          notaCreditoId: '',
          bancoTarjeta: tipo === 'RETENCION_IR' ? 'DGI' : 'Alcaldía',
          referencia: numComp ? numComp.trim() : ''
        }
      ];
    });
  };

  // Auto initialize first method amount to total when single method changes
  useEffect(() => {
    if (!isMultiMetodo && metodosPagoList.length === 1) {
      setMetodosPagoList([{ id: 1, metodoPago, monto: importeTotal, notaCreditoId: selectedNCId, bancoTarjeta, referencia: '' }]);
    }
  }, [importeTotal, isMultiMetodo]);

  useEffect(() => {
    if (clienteId) {
      setLoadingNC(true);
      axios.get(`${CAJA_URL}/notas-credito-disponibles/${clienteId}`)
        .then(res => setAvailableNotasCredito(res.data || []))
        .catch(() => setAvailableNotasCredito([]))
        .finally(() => setLoadingNC(false));
    }
  }, [clienteId]);

  const totalMetodosIngresados = isMultiMetodo
    ? metodosPagoList.reduce((acc, m) => acc + (Number(m.monto) || 0), 0)
    : importeTotal;

  const diferenciaMetodos = importeTotal - totalMetodosIngresados;

  const handleAddMetodoRow = () => {
    const rem = Math.max(0, diferenciaMetodos);
    setMetodosPagoList(prev => [
      ...prev,
      { id: Date.now(), metodoPago: 'EFECTIVO', monto: rem, notaCreditoId: '', bancoTarjeta: 'POS BAC', referencia: '' }
    ]);
  };

  const handleRemoveMetodoRow = (id) => {
    if (metodosPagoList.length <= 1) return;
    setMetodosPagoList(prev => prev.filter(m => m.id !== id));
  };

  const handleUpdateMetodoRow = (id, field, value) => {
    setMetodosPagoList(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleSingleMontoChange = (newVal) => {
    const numVal = parseFloat(newVal) || 0;
    if (selectedFacturas.length === 1) {
      const fId = selectedFacturas[0].id;
      setMontosParciales({ [fId]: numVal });
    } else {
      let rem = numVal;
      const newMontos = {};
      for (const f of selectedFacturas) {
        const s = Number(f.saldopendiente);
        const allocated = Math.min(rem, s);
        newMontos[f.id] = allocated;
        rem -= allocated;
      }
      setMontosParciales(newMontos);
    }
  };

  const handleSubmit = async () => {
    if (!serie || !numero) { setError('Serie y Número son requeridos.'); return; }
    if (importeTotal <= 0) { setError('El importe total debe ser mayor a 0.'); return; }

    if (isMultiMetodo) {
      if (Math.abs(diferenciaMetodos) > 0.01) {
        setError(`La suma de los métodos de pago (${formatCurrency(totalMetodosIngresados)}) no coincide con el Total del Recibo (${formatCurrency(importeTotal)}). Faltan ${formatCurrency(diferenciaMetodos)}.`);
        return;
      }

      for (const m of metodosPagoList) {
        if (m.metodoPago === 'NOTA_CREDITO') {
          if (!m.notaCreditoId) {
            setError('Debe seleccionar la Nota de Crédito a aplicar en la línea correspondiente.');
            return;
          }
          const ncObj = availableNotasCredito.find(n => String(n.id) === String(m.notaCreditoId));
          const saldoNC = ncObj ? Number(ncObj.montosaldo || ncObj.montoSaldo) : 0;
          if (Number(m.monto) > saldoNC + 0.001) {
            setError(`El monto ingresado para la Nota de Crédito (${formatCurrency(m.monto)}) excede su saldo disponible (${formatCurrency(saldoNC)}).`);
            return;
          }
        }

        if ((m.metodoPago === 'RETENCION_IR' || m.metodoPago === 'RETENCION_ALCALDIA') && (!m.referencia || !m.referencia.trim())) {
          const tipoLabel = m.metodoPago === 'RETENCION_IR' ? 'Retención IR (2%)' : 'Retención Municipal (1%)';
          setError(`Debe ingresar el N° de Comprobante / Constancia para la ${tipoLabel}.`);
          return;
        }
      }
    } else if (metodoPago === 'NOTA_CREDITO') {
      if (!selectedNCId) {
        setError('Debe seleccionar la Nota de Crédito a aplicar.');
        return;
      }
      const ncObj = availableNotasCredito.find(n => String(n.id) === String(selectedNCId));
      const saldoNC = ncObj ? Number(ncObj.montosaldo || ncObj.montoSaldo) : 0;
      if (importeTotal > saldoNC + 0.001) {
        setError(`El total del recibo (${formatCurrency(importeTotal)}) excede el saldo disponible de la Nota de Crédito (${formatCurrency(saldoNC)}). Use la opción de Múltiples Métodos de Pago.`);
        return;
      }
    } else if ((metodoPago === 'RETENCION_IR' || metodoPago === 'RETENCION_ALCALDIA') && (!referencia || !referencia.trim())) {
      setError('Debe ingresar el N° de Comprobante / Constancia de Retención.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const detalles = selectedFacturas.map(f => {
        const montoAplicado = montosParciales[f.id] || 0;
        const esParcial = montoAplicado < Number(f.saldopendiente);
        return { FacturaId: f.id, MontoAplicado: montoAplicado, EsParcial: esParcial };
      });

      const parseBancoCuenta = (label) => {
        if (!label) return { banco: null, numeroCuenta: null };
        const parts = label.trim().split(' ');
        const banco = parts[0] || null;
        const numMatch = label.match(/\d+/);
        const numeroCuenta = numMatch ? numMatch[0] : null;
        return { banco, numeroCuenta };
      };

      const finalMetodos = isMultiMetodo
        ? metodosPagoList.filter(m => Number(m.monto) > 0).map(m => {
            const bc = parseBancoCuenta((m.metodoPago === 'TRANSFERENCIA' || m.metodoPago === 'DEPOSITO') ? m.bancoTarjeta : null);
            return {
              MetodoPago: m.metodoPago,
              Monto: Number(m.monto) || 0,
              NotaCreditoId: m.metodoPago === 'NOTA_CREDITO' ? (Number(m.notaCreditoId) || null) : null,
              BancoTarjeta: (m.metodoPago === 'TARJETA' || m.metodoPago === 'TRANSFERENCIA' || m.metodoPago === 'DEPOSITO') ? m.bancoTarjeta : null,
              Referencia: m.referencia || null,
              Banco: bc.banco,
              NumeroCuenta: bc.numeroCuenta
            };
          })
        : (metodoPago === 'NOTA_CREDITO' ? [{
            MetodoPago: 'NOTA_CREDITO',
            Monto: importeTotal,
            NotaCreditoId: Number(selectedNCId),
            BancoTarjeta: null,
            Referencia: null,
            Banco: null,
            NumeroCuenta: null
          }] : (() => {
            const bc = parseBancoCuenta((metodoPago === 'TRANSFERENCIA' || metodoPago === 'DEPOSITO') ? bancoTarjeta : null);
            return [{
              MetodoPago: metodoPago,
              Monto: importeTotal,
              BancoTarjeta: (metodoPago === 'TARJETA' || metodoPago === 'TRANSFERENCIA' || metodoPago === 'DEPOSITO') ? bancoTarjeta : null,
              Referencia: (metodoPago === 'TRANSFERENCIA' || metodoPago === 'DEPOSITO' || metodoPago === 'RETENCION_IR' || metodoPago === 'RETENCION_ALCALDIA') ? referencia : null,
              Banco: bc.banco,
              NumeroCuenta: bc.numeroCuenta
            }];
          })());

      const finalDescripcion = isMultiMetodo
        ? `[Multi-pago] ${descripcion || `Pago de facturas - ${clienteNombre}`}`
        : ((metodoPago === 'TRANSFERENCIA' || metodoPago === 'DEPOSITO' || metodoPago === 'TARJETA')
          ? `[${metodoPago}: ${bancoTarjeta || ''}] ${descripcion || `Pago de facturas - ${clienteNombre}`}`
          : (descripcion || `Pago de facturas - ${clienteNombre}`));

      const payload = {
        Serie: serie,
        Numero: numero,
        Fecha: fecha,
        ClienteId: clienteId,
        Descripcion: finalDescripcion,
        ImporteTotal: importeTotal,
        MetodoPago: isMultiMetodo ? 'MULTIPLE' : metodoPago,
        BancoTarjeta: (metodoPago === 'TARJETA' || metodoPago === 'TRANSFERENCIA' || metodoPago === 'DEPOSITO') ? bancoTarjeta : null,
        Referencia: (metodoPago === 'TRANSFERENCIA' || metodoPago === 'DEPOSITO') ? referencia : null,
        SucursalId: filters?.sucursalId || null,
        Detalles: detalles,
        MetodosPago: finalMetodos
      };

      await axios.post(`${CAJA_URL}/aplicar-pago`, payload);
      onSuccess();
    } catch (e) {
      setError(e.response?.data?.Error || 'Error al registrar el pago');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <Receipt size={24} />
            <div>
              <h2 className="text-lg font-bold">Recibo de Pago</h2>
              <p className="text-sm opacity-90">{clienteNombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X size={22} /></button>
        </div>

        <div className="p-6 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">{error}</div>}

          {/* Customer Credit Notes Banner */}
          {availableNotasCredito.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl text-indigo-900 text-xs flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <span className="font-bold text-indigo-950 block text-sm">NOTAS DE CRÉDITO DISPONIBLES</span>
                  <span className="text-indigo-800">
                    Este cliente posee {availableNotasCredito.length} nota(s) de crédito con un saldo a favor disponible de <strong>{formatCurrency(availableNotasCredito.reduce((acc, n) => acc + Number(n.montosaldo || n.montoSaldo), 0))}</strong>.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMultiMetodo(true);
                  const firstNC = availableNotasCredito[0];
                  const ncId = firstNC ? firstNC.id : '';
                  const ncSaldo = firstNC ? Number(firstNC.montosaldo || firstNC.montoSaldo) : 0;
                  const applyAmt = Math.min(importeTotal, ncSaldo);

                  setMetodosPagoList([
                    { id: Date.now(), metodoPago: 'NOTA_CREDITO', monto: applyAmt, notaCreditoId: ncId, bancoTarjeta: '', referencia: '' },
                    ...(importeTotal > applyAmt ? [{ id: Date.now() + 1, metodoPago: 'EFECTIVO', monto: importeTotal - applyAmt, notaCreditoId: '', bancoTarjeta: 'BAC', referencia: '' }] : [])
                  ]);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0 shadow-sm"
              >
                ＋ Usar Nota de Crédito
              </button>
            </div>
          )}

          {/* Quick Retenciones Controls */}
          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <span className="font-bold text-amber-950 block text-xs uppercase tracking-wide">Aplicar Retenciones por Cobrar (DGI / Alcaldía)</span>
                <span className="text-amber-800 text-[11px]">Subtotal Estimado: <strong>{formatCurrency(subtotalEstimado)}</strong></span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleAddRetencion('RETENCION_IR', 0.02)}
                className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-sm"
              >
                🏷️ 2% IR ({formatCurrency(subtotalEstimado * 0.02)})
              </button>
              <button
                type="button"
                onClick={() => handleAddRetencion('RETENCION_ALCALDIA', 0.01)}
                className="bg-amber-800 hover:bg-amber-900 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-sm"
              >
                🏛️ 1% Municipal ({formatCurrency(subtotalEstimado * 0.01)})
              </button>
            </div>
          </div>

          {/* Receipt Header Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Serie *</label>
              <input value={serie} onChange={e => setSerie(e.target.value)} placeholder="A, B, C..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Número *</label>
              <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="001"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          {/* Payment Method Mode Section */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-700 font-extrabold uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" /> Método de Pago
              </label>
              <button
                type="button"
                onClick={() => {
                  const next = !isMultiMetodo;
                  setIsMultiMetodo(next);
                  if (next) {
                    setMetodosPagoList([
                      { id: Date.now(), metodoPago: metodoPago, monto: importeTotal, notaCreditoId: selectedNCId, bancoTarjeta: bancoTarjeta, referencia: referencia }
                    ]);
                  }
                }}
                className={`text-xs font-bold px-3 py-1 rounded-lg border transition-all ${
                  isMultiMetodo 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {isMultiMetodo ? '✓ Múltiples Métodos Activo' : '＋ Habilitar Múltiples Métodos'}
              </button>
            </div>

            {!isMultiMetodo ? (
              /* Single Method Mode */
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className={
                    metodoPago === 'TARJETA' || metodoPago === 'NOTA_CREDITO' || metodoPago === 'TRANSFERENCIA' || metodoPago === 'DEPOSITO' 
                      ? 'sm:col-span-5' 
                      : 'sm:col-span-7'
                  }>
                    <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Forma de Pago</label>
                    <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="EFECTIVO">💵 Efectivo</option>
                      <option value="TRANSFERENCIA">🏦 Transferencia Bancaria</option>
                      <option value="DEPOSITO">📋 Depósito Bancario</option>
                      <option value="TARJETA">💳 Tarjeta de Crédito / Débito</option>
                      <option value="NOTA_CREDITO">📜 Nota de Crédito del Cliente</option>
                      <option value="RETENCION_IR">🏷️ Retención IR en la Fuente (2%)</option>
                      <option value="RETENCION_ALCALDIA">🏛️ Retención Municipal (1%)</option>
                    </select>
                  </div>

                  {metodoPago === 'TARJETA' && (
                    <div className="sm:col-span-3">
                      <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Terminal POS</label>
                      <select value={bancoTarjeta} onChange={e => setBancoTarjeta(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option value="POS BAC">POS BAC</option>
                        <option value="POS LAFISE">POS LAFISE</option>
                        <option value="OTRO POS">OTRO POS</option>
                      </select>
                    </div>
                  )}

                  {(metodoPago === 'TRANSFERENCIA' || metodoPago === 'DEPOSITO') && (
                    <>
                      <div className="sm:col-span-4">
                        <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Banco y N° Cuenta *</label>
                        <select
                          value={bancoTarjeta}
                          onChange={e => setBancoTarjeta(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">-- Seleccionar Banco y Cuenta --</option>
                          {CUENTAS_BANCARIAS.map(group => (
                            <optgroup key={group.banco} label={group.banco}>
                              {group.cuentas.map(c => (
                                <option key={c.id} value={c.label}>{c.label}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">N° Referencia *</label>
                        <input
                          type="text"
                          placeholder="N° Referencia"
                          value={referencia}
                          onChange={e => setReferencia(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </>
                  )}

                  {(metodoPago === 'RETENCION_IR' || metodoPago === 'RETENCION_ALCALDIA') && (
                    <div className="sm:col-span-3">
                      <label className="text-xs text-amber-800 font-bold uppercase mb-1 block">N° Comprobante Retención *</label>
                      <input
                        type="text"
                        placeholder="N° Comprobante / Constancia"
                        value={referencia}
                        onChange={e => setReferencia(e.target.value)}
                        className="w-full border border-amber-300 rounded-xl px-3 py-2 text-sm bg-amber-50/50 font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  )}

                  {metodoPago === 'NOTA_CREDITO' && (
                    <div className="sm:col-span-3">
                      <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Nota de Crédito</label>
                      <select value={selectedNCId} onChange={e => setSelectedNCId(e.target.value)}
                        className="w-full border border-indigo-300 rounded-xl px-3 py-2 text-sm bg-indigo-50/50 font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">-- Seleccionar NC --</option>
                        {availableNotasCredito.map(nc => (
                          <option key={nc.id} value={nc.id}>
                            #{nc.numeronotacredito || nc.numeroNotaCredito} — Saldo: {formatCurrency(nc.montosaldo || nc.montoSaldo)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className={
                    metodoPago === 'TARJETA' || metodoPago === 'NOTA_CREDITO' || metodoPago === 'TRANSFERENCIA' || metodoPago === 'DEPOSITO'
                      ? 'sm:col-span-4' 
                      : 'sm:col-span-5'
                  }>
                    <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Monto del Pago (C$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={importeTotal}
                      onChange={e => handleSingleMontoChange(e.target.value)}
                      className="w-full border border-emerald-300 rounded-xl px-3 py-2 text-sm font-extrabold text-emerald-800 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50/30"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Multi Payment Methods Mode */
              <div className="space-y-3">
                <p className="text-xs text-slate-500">Desglose el pago utilizando múltiples formas de pago (Efectivo, Notas de Crédito, Transferencia, etc.):</p>
                <div className="space-y-2.5">
                  {metodosPagoList.map((m, idx) => (
                    <div key={m.id} className="bg-white border border-slate-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                      <div className="sm:col-span-4">
                        <select
                          value={m.metodoPago}
                          onChange={e => handleUpdateMetodoRow(m.id, 'metodoPago', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="EFECTIVO">💵 Efectivo</option>
                          <option value="TRANSFERENCIA">🏦 Transferencia</option>
                          <option value="DEPOSITO">📋 Depósito</option>
                          <option value="TARJETA">💳 Tarjeta</option>
                          <option value="NOTA_CREDITO">📜 Nota de Crédito</option>
                          <option value="RETENCION_IR">🏷️ Retención IR (2%)</option>
                          <option value="RETENCION_ALCALDIA">🏛️ Retención Municipal (1%)</option>
                        </select>
                      </div>

                      <div className="sm:col-span-4">
                        {m.metodoPago === 'NOTA_CREDITO' ? (
                          <select
                            value={m.notaCreditoId}
                            onChange={e => handleUpdateMetodoRow(m.id, 'notaCreditoId', e.target.value)}
                            className="w-full border border-indigo-300 rounded-lg px-2 py-1.5 text-xs bg-indigo-50 font-medium text-indigo-900 focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">-- Seleccionar NC --</option>
                            {availableNotasCredito.map(nc => (
                              <option key={nc.id} value={nc.id}>
                                #{nc.numeronotacredito || nc.numeroNotaCredito} ({formatCurrency(nc.montosaldo || nc.montoSaldo)})
                              </option>
                            ))}
                          </select>
                        ) : m.metodoPago === 'TARJETA' ? (
                          <select
                            value={m.bancoTarjeta || 'POS BAC'}
                            onChange={e => handleUpdateMetodoRow(m.id, 'bancoTarjeta', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white font-medium focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="POS BAC">POS BAC</option>
                            <option value="POS LAFISE">POS LAFISE</option>
                            <option value="OTRO POS">OTRO POS</option>
                          </select>
                        ) : (m.metodoPago === 'TRANSFERENCIA' || m.metodoPago === 'DEPOSITO') ? (
                          <div className="space-y-1">
                            <select
                              value={m.bancoTarjeta || ''}
                              onChange={e => handleUpdateMetodoRow(m.id, 'bancoTarjeta', e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold bg-white focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">-- Banco y Cuenta --</option>
                              {CUENTAS_BANCARIAS.map(group => (
                                <optgroup key={group.banco} label={group.banco}>
                                  {group.cuentas.map(c => (
                                    <option key={c.id} value={c.label}>{c.label}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="N° Referencia"
                              value={m.referencia || ''}
                              onChange={e => handleUpdateMetodoRow(m.id, 'referencia', e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        ) : (m.metodoPago === 'RETENCION_IR' || m.metodoPago === 'RETENCION_ALCALDIA') ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              placeholder="N° Comprobante *"
                              value={m.referencia || ''}
                              onChange={e => handleUpdateMetodoRow(m.id, 'referencia', e.target.value)}
                              className="w-full border border-amber-300 bg-amber-50/60 rounded-lg px-2 py-1 text-xs font-bold text-amber-950 focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium pl-1">Moneda Local (C$)</span>
                        )}
                      </div>

                      <div className="sm:col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Monto"
                          value={m.monto}
                          onChange={e => handleUpdateMetodoRow(m.id, 'monto', parseFloat(e.target.value) || 0)}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 text-right focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveMetodoRow(m.id)}
                          disabled={metodosPagoList.length <= 1}
                          className="text-slate-400 hover:text-red-600 disabled:opacity-30 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleAddMetodoRow}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Plus size={14} /> Agregar Forma de Pago
                  </button>

                  {diferenciaMetodos !== 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const rem = Math.max(0, diferenciaMetodos);
                        setMetodosPagoList(prev => {
                          const copy = [...prev];
                          if (copy.length > 0) {
                            copy[copy.length - 1].monto = Number((copy[copy.length - 1].monto + rem).toFixed(2));
                          }
                          return copy;
                        });
                      }}
                      className="text-[11px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      ⚡ Auto-asignar Restante ({formatCurrency(diferenciaMetodos)})
                    </button>
                  )}
                </div>

                {/* Validation Status Badge */}
                <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between ${
                  Math.abs(diferenciaMetodos) < 0.01 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}>
                  <span>Asignado: {formatCurrency(totalMetodosIngresados)} / Total Recibo: {formatCurrency(importeTotal)}</span>
                  <span>
                    {Math.abs(diferenciaMetodos) < 0.01 
                      ? '✓ Coincide Exactamente' 
                      : (diferenciaMetodos > 0 ? `Faltan ${formatCurrency(diferenciaMetodos)}` : `Exceso de ${formatCurrency(-diferenciaMetodos)}`)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Descripción / Concepto</label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Descripción del pago..." rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>

          {/* Selected Invoices */}
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-2 block">Facturas a Cancelar (Detalles de Saldos)</label>
            <div className="space-y-3">
              {selectedFacturas.map(f => {
                const montoAplicar = montosParciales[f.id] || 0;
                const totalOriginal = Number(f.total || f.saldopendiente);
                const montopagadoAnterior = Number(f.montopagado || 0);
                const saldoPendiente = Number(f.saldopendiente);
                const saldoPosterior = Math.max(0, saldoPendiente - montoAplicar);
                const esCancelada = saldoPosterior < 0.001;

                return (
                  <div key={f.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 shadow-sm space-y-3">
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-blue-700 font-bold text-base">#{f.numerofactura}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">{f.condicionpago || 'Contado'}</span>
                      </div>
                      {esCancelada ? (
                        <span className="text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                          ✓ Cancelación Total
                        </span>
                      ) : (
                        <span className="text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full">
                          Abono Parcial (Resta: {formatCurrency(saldoPosterior)})
                        </span>
                      )}
                    </div>

                    {/* Detailed Balances Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-3 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-slate-400 block font-medium">Total Factura:</span>
                        <span className="font-bold text-slate-800">{formatCurrency(totalOriginal)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Pagado Anterior:</span>
                        <span className="font-semibold text-emerald-600">{formatCurrency(montopagadoAnterior)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Saldo Pendiente:</span>
                        <span className="font-bold text-rose-600">{formatCurrency(saldoPendiente)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Saldo Restante:</span>
                        <span className={`font-bold ${esCancelada ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {formatCurrency(saldoPosterior)}
                        </span>
                      </div>
                    </div>

                    {/* Amount Input */}
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-xs font-bold text-slate-700 shrink-0">Monto a aplicar en esta factura:</span>
                      <input
                        type="number"
                        step="0.01"
                        value={montosParciales[f.id] || 0}
                        onChange={e => setMontosParciales(prev => ({ ...prev, [f.id]: parseFloat(e.target.value) || 0 }))}
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex justify-between items-center">
            <span className="font-bold text-slate-700">Total del Recibo</span>
            <span className="text-2xl font-extrabold text-emerald-700">{formatCurrency(importeTotal)}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSubmit} disabled={loading || (isMultiMetodo && Math.abs(diferenciaMetodos) > 0.01)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <RefreshCw className="animate-spin" size={18} /> : '✓ Confirmar Pago'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ======================== CAJA CHICA TAB ======================== */
const CajaChicaTab = ({ filters, formatCurrency }) => {
  const [serie, setSerie] = useState('CC');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(today());
  const [nombreRecibe, setNombreRecibe] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [importe, setImporte] = useState('');
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [egresos, setEgresos] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const fetchEgresos = async () => {
    setLoadingList(true);
    try {
      const res = await axios.get(`${CAJA_URL}/recibos`, { params: { tipo: 'EGRESO', ...filters } });
      setEgresos(res.data);
    } catch (e) { console.error(e); }
    finally { setLoadingList(false); }
  };

  useEffect(() => { fetchEgresos(); }, [filters]);

  const handleAnularRecibo = async (egreso) => {
    if (!window.confirm(`¿Está seguro que desea ANULAR el recibo ${egreso.serie}-${egreso.numero}? Esta acción no se puede deshacer.`)) return;
    try {
      await axios.post(`${CAJA_URL}/anular-recibo/${egreso.id}`);
      alert('Recibo anulado correctamente.');
      fetchEgresos();
    } catch (e) {
      alert(e.response?.data?.Error || 'Error al anular el recibo.');
    }
  };

  const printReceipt = (recData, isReprint = false) => {
    const printWindow = window.open('', '_blank');
    const todayStr = new Date(recData.fecha).toLocaleDateString('es-ES');
    const printContent = `
      <html>
        <head>
          <title>Recibo de Egreso #${recData.serie}-${recData.numero}</title>
          <style>
            body { 
              font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
              color: #1e293b; 
              margin: 40px; 
              line-height: 1.6;
              position: relative;
            }
            .header { 
              text-align: center; 
              border-bottom: 3px double #cbd5e1; 
              padding-bottom: 20px; 
              margin-bottom: 25px; 
            }
            .logo { 
              height: 55px; 
              object-fit: contain; 
              margin-bottom: 10px; 
            }
            .subtitle {
              font-size: 11px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              margin-bottom: 8px;
            }
            .company-details {
              font-size: 11px;
              color: #475569;
              margin-bottom: 4px;
            }
            .title { 
              font-size: 16px; 
              font-weight: 800; 
              color: #0f172a; 
              letter-spacing: 0.05em; 
              margin-top: 15px;
              text-transform: uppercase;
              background-color: #f1f5f9;
              padding: 6px 12px;
              border-radius: 6px;
              display: inline-block;
            }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; margin-top: 15px; }
            .info-table td { padding: 10px 12px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
            .info-table td.label { font-weight: bold; color: #475569; width: 150px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.03em; }
            .amount-box { 
              background-color: #f8fafc; 
              border: 1px dashed #cbd5e1; 
              padding: 18px; 
              text-align: right; 
              font-size: 22px; 
              font-weight: 800; 
              border-radius: 8px; 
              margin-bottom: 50px; 
            }
            .signature-area { margin-top: 80px; display: flex; justify-content: space-between; }
            .signature-line { width: 240px; border-top: 1.5px solid #94a3b8; text-align: center; padding-top: 10px; font-size: 12px; font-weight: bold; color: #334155; text-transform: uppercase; }
            
            /* Watermark design */
            .watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-25deg);
              font-size: 60px;
              font-weight: 900;
              color: rgba(225, 29, 72, 0.08);
              border: 8px solid rgba(225, 29, 72, 0.08);
              padding: 10px 25px;
              border-radius: 12px;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              white-space: nowrap;
              pointer-events: none;
              user-select: none;
              z-index: 1000;
            }
          </style>
        </head>
        <body>
          ${isReprint ? '<div class="watermark">COPIA / REIMPRESION</div>' : ''}
          <div class="header">
            <img src="${window.location.origin}${logoImg}" class="logo" />
            <div class="subtitle">Venta de Maquinaria y Repuestos Agrícolas en general</div>
            <div class="company-details"><strong>RUC:</strong> J0310000054703 | <strong>Email:</strong> agrisource@deshonsupply.com</div>
            <div class="company-details"><strong>Celular:</strong> 8694-0217 / 8492-9388</div>
            <div class="title">Recibo de Egreso de Caja Chica</div>
          </div>
          <table class="info-table">
            <tr>
              <td class="label">Recibo No:</td>
              <td style="font-family: monospace; font-weight: bold; font-size: 16px; color: #e11d48;">${recData.serie}-${recData.numero}</td>
              <td class="label" style="text-align: right;">Fecha:</td>
              <td style="text-align: right; font-weight: 600;">${todayStr}</td>
            </tr>
            <tr>
              <td class="label">Recibe:</td>
              <td colspan="3" style="font-size: 15px; font-weight: 700; color: #0f172a;">${recData.nombreRecibe || recData.nombrerecibe || ''}</td>
            </tr>
            <tr>
              <td class="label">Método de Pago:</td>
              <td colspan="3" style="font-weight: 500;">${recData.metodoPago || recData.metodopago || ''}</td>
            </tr>
            <tr>
              <td class="label">Concepto:</td>
              <td colspan="3" style="color: #334155; font-size: 13.5px;">${recData.descripcion}</td>
            </tr>
          </table>
          <div class="amount-box">
            Monto Entregado: <span style="color: #e11d48;">${formatCurrency(recData.importe || recData.importetotal || 0)}</span>
          </div>
          <div class="signature-area">
            <div class="signature-line">Entregado Por (Caja)</div>
            <div class="signature-line">Recibido Por (Firma)</div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const handleSubmit = async () => {
    if (!descripcion || !importe || !numero || !nombreRecibe) { setError('Todos los campos, incluyendo el nombre de quien recibe, son requeridos.'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const dataPayload = {
        Serie: serie, Numero: numero, Fecha: fecha,
        Descripcion: descripcion, Importe: parseFloat(importe),
        MetodoPago: metodoPago, SucursalId: filters?.sucursalId || null,
        NombreRecibe: nombreRecibe
      };
      await axios.post(`${CAJA_URL}/egreso-caja-chica`, dataPayload);
      setSuccess('Egreso registrado exitosamente. Se ha mandado a imprimir el recibo.');
      setNumero(''); setDescripcion(''); setImporte(''); setNombreRecibe('');
      fetchEgresos();
      printReceipt({
        serie,
        numero,
        fecha,
        descripcion,
        importe: parseFloat(importe),
        metodoPago,
        nombreRecibe
      }, false);
    } catch (e) { setError(e.response?.data?.Error || 'Error al registrar el egreso.'); }
    finally { setLoading(false); }
  };

  const handleExportExcel = () => {
    if (egresos.length === 0) { alert('No hay egresos para exportar.'); return; }
    const ws = XLSX.utils.json_to_sheet(egresos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Egresos_Caja_Chica');
    XLSX.writeFile(wb, `Egresos_CajaChica_${today()}.xlsx`);
  };

  const totalEgresos = egresos.reduce((acc, e) => acc + (Number(e.importetotal) || 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Form */}
      <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
        <h3 className="font-bold text-slate-700 mb-5 flex items-center gap-2">
          <ArrowDownCircle size={18} className="text-rose-600" /> Nuevo Egreso Caja Chica
        </h3>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">{error}</div>}
        {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-sm mb-4">{success}</div>}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Serie</label>
              <input value={serie} onChange={e => setSerie(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Número *</label>
              <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="001" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Nombre de quien Recibe *</label>
            <input value={nombreRecibe} onChange={e => setNombreRecibe(e.target.value)} placeholder="Nombre completo..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Concepto / Descripción *</label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Detalle del egreso..." rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Importe *</label>
            <input type="number" step="0.01" value={importe} onChange={e => setImporte(e.target.value)} placeholder="0.00"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Método de Pago</label>
            <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-500">
              <option value="EFECTIVO">💵 Efectivo</option>
              <option value="TRANSFERENCIA">🏦 Transferencia</option>
              <option value="DEPOSITO">📋 Depósito</option>
            </select>
          </div>
          <button onClick={handleSubmit} disabled={loading}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-60">
            {loading ? 'Guardando...' : '+ Registrar Egreso'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <ArrowDownCircle size={16} className="text-rose-500" />
          <span className="font-bold text-slate-700">Egresos de Caja Chica</span>
          <span className="ml-auto text-sm font-bold text-rose-700">{formatCurrency(totalEgresos)}</span>
          <button onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold ml-2 transition-colors">
            <FileDown size={14} /> Excel
          </button>
        </div>
        <div className="overflow-x-auto">
          {loadingList ? (
            <div className="py-10 text-center text-slate-400 animate-pulse">Cargando egresos...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Serie/No.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Recibe</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Descripción</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Método</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Importe</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {egresos.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-400">Sin egresos registrados</td></tr>
                ) : (
                  egresos.map((e, i) => (
                    <tr key={i} className={`hover:bg-slate-50 ${e.estado === 'ANULADO' ? 'opacity-60 bg-red-50' : ''}`}>
                      <td className={`px-4 py-3 font-mono ${e.estado === 'ANULADO' ? 'text-red-400 line-through' : 'text-slate-700'}`}>{e.serie}-{e.numero}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{e.nombrerecibe || 'N/A'}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(e.fecha)}</td>
                      <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">{e.descripcion}</td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full">{e.metodopago}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          e.estado === 'ANULADO' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>{e.estado || 'ACTIVO'}</span>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${e.estado === 'ANULADO' ? 'text-red-400 line-through' : 'text-rose-600'}`}>{formatCurrency(e.importetotal)}</td>
                      <td className="px-4 py-3 text-center flex gap-1 justify-center">
                        <button
                          onClick={() => printReceipt(e, true)}
                          title="Reimprimir Recibo (Copia)"
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center"
                        >
                          <Printer size={16} />
                        </button>
                        {e.estado !== 'ANULADO' && (
                          <button
                            onClick={() => handleAnularRecibo(e)}
                            title="Anular Recibo"
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const ArqueoTab = ({ filters, formatCurrency }) => {
  const [arqueoActivo, setArqueoActivo] = useState(null);
  const [arqueos, setArqueos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApertura, setShowApertura] = useState(false);
  const [showCierre, setShowCierre] = useState(false);
  const [showGestionBancos, setShowGestionBancos] = useState(false);

  // Apertura form
  const [efectivoInicio, setEfectivoInicio] = useState('');
  const [observApertura, setObservApertura] = useState('');
  // Cierre form
  const [efectivoFin, setEfectivoFin] = useState('');
  const [observCierre, setObservCierre] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const [activo, historial] = await Promise.all([
        axios.get(`${CAJA_URL}/arqueo-activo`, { params: { sucursalId: filters?.sucursalId } }),
        axios.get(`${CAJA_URL}/arqueos`, { params: { ...filters } })
      ]);
      setArqueoActivo(activo.data);
      setArqueos(historial.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [filters]);

  const handleApertura = async () => {
    if (!filters?.sucursalId) { setActionMsg('Debe seleccionar una sucursal en el encabezado de Caja.'); return; }
    setActionLoading(true); setActionMsg('');
    try {
      await axios.post(`${CAJA_URL}/apertura`, {
        Fecha: today(), SucursalId: parseInt(filters.sucursalId),
        EfectivoInicio: parseFloat(efectivoInicio) || 0, Observaciones: observApertura
      });
      setShowApertura(false); setEfectivoInicio(''); setObservApertura('');
      fetch();
    } catch (e) { setActionMsg(e.response?.data?.Error || 'Error al abrir caja.'); }
    finally { setActionLoading(false); }
  };

  const handleCierre = async () => {
    if (!filters?.sucursalId) { setActionMsg('Debe seleccionar una sucursal en el encabezado de Caja.'); return; }
    setActionLoading(true); setActionMsg('');
    try {
      await axios.post(`${CAJA_URL}/cierre`, {
        Fecha: today(), SucursalId: parseInt(filters.sucursalId),
        EfectivoInicio: parseFloat(arqueoActivo?.efectivo_inicio || 0),
        EfectivoFin: parseFloat(efectivoFin) || 0, Observaciones: observCierre
      });
      setShowCierre(false); setEfectivoFin(''); setObservCierre('');
      fetch();
    } catch (e) { setActionMsg(e.response?.data?.Error || 'Error al cerrar caja.'); }
    finally { setActionLoading(false); }
  };

  return (
    <div className="space-y-6">
      {actionMsg && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{actionMsg}</div>}

      {/* Current Status */}
      {loading ? (
        <div className="text-slate-400 animate-pulse py-10 text-center">Cargando...</div>
      ) : (
        <div className={`rounded-2xl p-6 border-2 ${arqueoActivo ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {arqueoActivo ? <Unlock size={28} className="text-emerald-600" /> : <Lock size={28} className="text-amber-600" />}
              <div>
                <h3 className={`text-lg font-bold ${arqueoActivo ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {arqueoActivo ? '✅ Caja Abierta' : '🔒 Caja Cerrada'}
                </h3>
                {arqueoActivo && (
                  <p className="text-sm text-emerald-600">
                    Sucursal: <strong>{arqueoActivo.sucursal}</strong> — Apertura: <strong>{formatCurrency(arqueoActivo.efectivo_inicio)}</strong>
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowGestionBancos(true)}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors shadow-sm"
              >
                <Banknote size={16} /> 🏦 Cuentas Bancarias
              </button>
              {!arqueoActivo && (
                <button onClick={() => setShowApertura(v => !v)}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors">
                  <Unlock size={16} /> Abrir Caja
                </button>
              )}
              {arqueoActivo && (
                <button onClick={() => setShowCierre(v => !v)}
                  className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors">
                  <Lock size={16} /> Cerrar Caja
                </button>
              )}
            </div>
          </div>

          {showGestionBancos && (
            <GestionCuentasBancariasModal
              onClose={() => setShowGestionBancos(false)}
              onRefreshAccounts={() => {}}
            />
          )}

          {/* Apertura Form */}
          {showApertura && (
            <div className="mt-5 border-t border-emerald-200 pt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Efectivo Inicial</label>
                <input type="number" step="0.01" value={efectivoInicio} onChange={e => setEfectivoInicio(e.target.value)} placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Observaciones</label>
                <input value={observApertura} onChange={e => setObservApertura(e.target.value)} placeholder="Notas..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
              </div>
              <button onClick={handleApertura} disabled={actionLoading}
                className="col-span-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60">
                {actionLoading ? 'Procesando...' : '✓ Confirmar Apertura'}
              </button>
            </div>
          )}

          {/* Cierre Form */}
          {showCierre && (
            <div className="mt-5 border-t border-rose-200 pt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Efectivo al Cierre</label>
                <input type="number" step="0.01" value={efectivoFin} onChange={e => setEfectivoFin(e.target.value)} placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Observaciones</label>
                <input value={observCierre} onChange={e => setObservCierre(e.target.value)} placeholder="Notas de cierre..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white" />
              </div>
              <button onClick={handleCierre} disabled={actionLoading}
                className="col-span-full bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60">
                {actionLoading ? 'Procesando...' : '🔒 Confirmar Cierre de Caja'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Arqueos History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <ClipboardList size={16} className="text-indigo-500" />
          <span className="font-bold text-slate-700">Historial de Arqueos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Sucursal</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Ef. Inicio</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Ef. Fin (Calc)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Ingresos</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Egresos</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Transferencias</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Depósitos</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Tarjetas</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {arqueos.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-10 text-slate-400">Sin arqueos registrados</td></tr>
              ) : (
                arqueos.map((a, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${a.tipo === 'APERTURA' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {a.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(a.fecha)}</td>
                    <td className="px-4 py-3 text-slate-700">{a.sucursal}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(a.efectivo_inicio)}</td>
                    <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(Number(a.efectivo_inicio) + Number(a.calc_efectivo_mov || 0))}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(a.calc_ingresos || 0)}</td>
                    <td className="px-4 py-3 text-right text-rose-600">{formatCurrency(a.calc_egresos || 0)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(a.calc_transferencias || 0)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(a.calc_depositos || 0)}</td>
                    <td className="px-4 py-3 text-right text-pink-600">{formatCurrency(a.calc_tarjetas || 0)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.estado === 'ABIERTO' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {a.estado}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ======================== FACTURAS POR MES TAB ======================== */
const FacturasTab = ({ filters, formatCurrency }) => {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [activeAccordion, setActiveAccordion] = useState(null);

  // Header filters state
  const [filterNumero, setFilterNumero] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [filterEstadoPago, setFilterEstadoPago] = useState('');

  const fetchFacturas = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${CAJA_URL}/facturas-mes`, { params: filters });
      setFacturas(res.data);
    } catch (e) {
      console.error("Error al obtener facturas", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacturas();
  }, [filters]);

  // Filter facturas locally before grouping
  const filteredFacturas = facturas.filter(f => {
    const matchNumero = !filterNumero || f.numerofactura?.toLowerCase().includes(filterNumero.toLowerCase());
    const matchCliente = !filterCliente || f.cliente?.toLowerCase().includes(filterCliente.toLowerCase());
    const matchEstado = !filterEstadoPago || f.estadopago === filterEstadoPago;
    return matchNumero && matchCliente && matchEstado;
  });

  // Group filtered invoices by Month/Year (eg. "Enero 2026")
  const groupedFacturas = filteredFacturas.reduce((groups, f) => {
    if (!f.fecha) return groups;
    const date = new Date(f.fecha);
    const monthName = date.toLocaleString('es-ES', { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const key = `${capitalizedMonth} ${date.getFullYear()}`;
    
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
    return groups;
  }, {});

  const groupKeys = Object.keys(groupedFacturas);

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-700 text-lg flex items-center gap-2">
            <Receipt className="text-emerald-600" /> Historial de Facturas
          </h3>
          <p className="text-sm text-slate-500 mt-1">Listado de facturas emitidas filtradas según los filtros globales y locales, agrupadas por mes.</p>
        </div>
        <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
          {filteredFacturas.length} Facturas filtradas
        </span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 animate-pulse">Cargando listado de facturas...</div>
      ) : groupKeys.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-slate-400">
          No se encontraron facturas para los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-4">
          {groupKeys.map(groupKey => {
            const list = groupedFacturas[groupKey];
            const isOpen = activeAccordion === groupKey;
            const totalGroupAmount = list.reduce((sum, f) => sum + (Number(f.total) || 0), 0);

            return (
              <div key={groupKey} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setActiveAccordion(isOpen ? null : groupKey)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-700 text-base">{groupKey}</span>
                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                      {list.length} {list.length === 1 ? 'factura' : 'facturas'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-slate-500">
                      Total: <strong className="text-emerald-700">{formatCurrency(totalGroupAmount)}</strong>
                    </span>
                    {isOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                            <div className="flex flex-col">
                              <span>Factura</span>
                              <input
                                type="text"
                                placeholder="Filtro..."
                                value={filterNumero}
                                onChange={e => setFilterNumero(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className="mt-1.5 border border-slate-200 rounded px-2 py-1 text-xs font-normal bg-white text-slate-700 w-32 focus:ring-1 focus:ring-emerald-500 outline-none"
                              />
                            </div>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase align-top pt-3">Fecha</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                            <div className="flex flex-col">
                              <span>Cliente</span>
                              <input
                                type="text"
                                placeholder="Filtro..."
                                value={filterCliente}
                                onChange={e => setFilterCliente(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className="mt-1.5 border border-slate-200 rounded px-2 py-1 text-xs font-normal bg-white text-slate-700 w-48 focus:ring-1 focus:ring-emerald-500 outline-none"
                              />
                            </div>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase align-top pt-3">Sucursal</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                            <div className="flex flex-col">
                              <span>Estado Pago</span>
                              <select
                                value={filterEstadoPago}
                                onChange={e => setFilterEstadoPago(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className="mt-1.5 border border-slate-200 rounded px-2 py-1 text-xs font-normal bg-white text-slate-700 w-32 focus:ring-1 focus:ring-emerald-500 outline-none"
                              >
                                <option value="">Todos</option>
                                <option value="PENDIENTE">PENDIENTE</option>
                                <option value="PAGADO">PAGADO</option>
                              </select>
                            </div>
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase align-top pt-3">Total</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase w-28 align-top pt-3">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {list.map(f => (
                          <tr key={f.id} className="hover:bg-slate-50/40">
                            <td className="px-4 py-3 font-mono text-blue-700 font-semibold">#{f.numerofactura}</td>
                            <td className="px-4 py-3 text-slate-600">{formatDate(f.fecha)}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{f.cliente}</td>
                            <td className="px-4 py-3 text-slate-500">{f.sucursal}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                f.estadopago === 'PAGADO' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}>{f.estadopago}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-700">{formatCurrency(f.total)}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setSelectedFactura(f)}
                                className="bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow-md"
                              >
                                Editar No.
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedFactura && (
        <ChangeInvoiceNumberModal
          factura={selectedFactura}
          onClose={() => setSelectedFactura(null)}
          onSuccess={() => { setSelectedFactura(null); fetchFacturas(); }}
        />
      )}
    </div>
  );
};

/* ======================== CHANGE INVOICE NUMBER MODAL ======================== */
const ChangeInvoiceNumberModal = ({ factura, onClose, onSuccess }) => {
  const [nuevoNumero, setNuevoNumero] = useState(factura.numerofactura);
  const [usuarios, setUsuarios] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get(`${CAJA_URL}/usuarios-activos`);
        setUsuarios(res.data);
        if (res.data.length > 0) {
          setSelectedUser(res.data[0].username);
        }
      } catch (e) {
        console.error("Error al cargar usuarios activos", e);
      }
    };
    fetchUsers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nuevoNumero.trim()) { setError('El nuevo número es requerido.'); return; }
    if (!selectedUser) { setError('Debe seleccionar un usuario autorizador.'); return; }
    if (!password) { setError('La contraseña es requerida.'); return; }

    setLoading(true);
    setError('');

    try {
      await axios.post(`${CAJA_URL}/cambiar-numero-factura`, {
        FacturaId: factura.id,
        NuevoNumero: nuevoNumero,
        Username: selectedUser,
        Password: password
      });
      alert('Número de factura actualizado correctamente.');
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.Error || 'Error al cambiar número de factura');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-slate-700 to-slate-800 text-white">
          <div className="flex items-center gap-2">
            <Lock size={18} />
            <h2 className="text-base font-bold">Cambiar Número de Factura</h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Número Actual</label>
            <input
              type="text"
              value={factura.numerofactura}
              disabled
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-100 text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Nuevo Número de Factura *</label>
            <input
              type="text"
              value={nuevoNumero}
              onChange={e => setNuevoNumero(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="Ej: F001-00029"
              required
            />
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-amber-600 font-semibold mb-2 flex items-center gap-1">
              <AlertCircle size={14} /> Requiere Autorización del Supervisor
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Usuario Autorizador *</label>
                <select
                  value={selectedUser}
                  onChange={e => setSelectedUser(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  {usuarios.map(u => (
                    <option key={u.id} value={u.username}>{u.fullname} ({u.username})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Contraseña *</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                  placeholder="Ingrese contraseña..."
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 px-4 py-2 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl font-semibold transition-colors disabled:opacity-60"
            >
              {loading ? 'Validando...' : '✓ Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ======================== NOTAS DE CRÉDITO TAB ======================== */
const NotasCreditoTab = ({ filters, formatCurrency, sucursalesCaja }) => {
  const [ncs, setNcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNC, setEditingNC] = useState(null);

  const fetchNCs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${CAJA_URL}/notas-credito`, {
        params: {
          ...filters,
          estado: filterEstado || null
        }
      });
      setNcs(res.data);
    } catch (e) {
      console.error("Error fetching notas de credito", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNCs();
  }, [filters, filterEstado]);

  const handleAnularNC = async (ncItem) => {
    if (!window.confirm(`¿Está seguro de anular la Nota de Crédito ${ncItem.numeronotacredito}? Esta acción no se puede deshacer.`)) return;
    try {
      await axios.post(`${CAJA_URL}/anular-nota-credito/${ncItem.id}`);
      alert(`Nota de Crédito ${ncItem.numeronotacredito} anulada exitosamente.`);
      fetchNCs();
    } catch (err) {
      alert(err.response?.data?.Error || 'Error al anular la Nota de Crédito.');
    }
  };

  const filtered = ncs.filter(nc => {
    const q = search.toLowerCase();
    return !q ||
      (nc.numeronotacredito || '').toLowerCase().includes(q) ||
      (nc.numerodevolucion || '').toLowerCase().includes(q) ||
      (nc.numerofacturaorigen || '').toLowerCase().includes(q) ||
      (nc.cliente || '').toLowerCase().includes(q) ||
      (nc.sucursal || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="text-blue-600" size={20} />
            Control de Notas de Crédito de Clientes
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Detalle de saldo disponible, aplicación en recibos/facturas y trazabilidad de notas de crédito.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los estados</option>
            <option value="DISPONIBLE">Disponibles (Sin aplicar)</option>
            <option value="PARCIAL">Parcialmente aplicadas</option>
            <option value="APLICADA">Aplicadas (Total)</option>
            <option value="ANULADA">Anuladas</option>
          </select>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Plus size={16} /> Crear Nota de Crédito
          </button>
        </div>
      </div>

      {/* Search & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase">Total Notas de Crédito</span>
          <h4 className="text-2xl font-extrabold text-slate-900 mt-1">{ncs.length}</h4>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase">Monto Total Saldo Disponible</span>
          <h4 className="text-2xl font-extrabold text-emerald-600 mt-1">
            {formatCurrency(ncs.filter(x => x.estado !== 'ANULADA').reduce((a, b) => a + Number(b.montosaldo || 0), 0))}
          </h4>
        </div>
        <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase">Monto Total Aplicado</span>
          <h4 className="text-2xl font-extrabold text-indigo-600 mt-1">
            {formatCurrency(ncs.reduce((a, b) => a + Number(b.montoaplicado || 0), 0))}
          </h4>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3">
        <Search className="text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Buscar por Nota Crédito, Devolución, Factura u Origen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full text-sm border-none focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400">Cargando notas de crédito...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-xs border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Nota Crédito #</th>
                  <th className="px-4 py-3">Devolución #</th>
                  <th className="px-4 py-3">Factura Origen</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3">Fecha Emisión</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">IVA</th>
                  <th className="px-4 py-3 text-right">Monto Total</th>
                  <th className="px-4 py-3 text-right">Monto Aplicado</th>
                  <th className="px-4 py-3 text-right">Saldo Dispon.</th>
                  <th className="px-4 py-3 text-center">Estado / Aplicada</th>
                  <th className="px-4 py-3">Aplicada En</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="text-center py-10 text-slate-400">
                      No se encontraron notas de crédito registradas.
                    </td>
                  </tr>
                ) : (
                  filtered.map((nc, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-600">{nc.numeronotacredito}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{nc.numerodevolucion || '—'}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{nc.numerofacturaorigen && nc.numerofacturaorigen !== 'N/A' ? `#${nc.numerofacturaorigen}` : 'N/A'}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{nc.cliente}</td>
                      <td className="px-4 py-3 text-slate-600">{nc.sucursal}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(nc.fechaemision)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(nc.montosubtotal)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(nc.montoiva)}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(nc.montototal)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{formatCurrency(nc.montoaplicado)}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-blue-600">{formatCurrency(nc.montosaldo)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          nc.estado === 'ANULADA' ? 'bg-red-100 text-red-800 border border-red-200' :
                          nc.aplicada || nc.estado === 'APLICADA' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          nc.estado === 'PARCIAL' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          {nc.estado === 'ANULADA' ? 'ANULADA' : (nc.aplicada || nc.estado === 'APLICADA' ? 'APLICADA' : nc.estado === 'PARCIAL' ? 'PARCIAL' : 'DISPONIBLE')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {nc.reciboaplicadonumero ? (
                          <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 block font-semibold">
                            Recibo #{nc.reciboaplicadonumero}
                          </span>
                        ) : nc.facturaaplicadanumero ? (
                          <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 block font-semibold">
                            Factura #{nc.facturaaplicadanumero}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => printNotaCreditoDocument(nc, formatCurrency)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                            title="Imprimir Nota de Crédito con Membrete"
                          >
                            <Printer size={13} /> Imprimir
                          </button>

                          {nc.estado !== 'ANULADA' && !nc.aplicada && Number(nc.montoaplicado || 0) === 0 && (
                            <>
                              <button
                                onClick={() => setEditingNC(nc)}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                                title="Editar Nota de Crédito"
                              >
                                <Edit size={13} /> Editar
                              </button>

                              <button
                                onClick={() => handleAnularNC(nc)}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                                title="Anular Nota de Crédito"
                              >
                                <XCircle size={13} /> Anular
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CrearNotaCreditoModal
          sucursales={sucursalesCaja || []}
          sucursalActualId={filters?.sucursalId}
          formatCurrency={formatCurrency}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { setShowCreateModal(false); fetchNCs(); }}
        />
      )}

      {editingNC && (
        <EditarNotaCreditoModal
          nc={editingNC}
          sucursales={sucursalesCaja || []}
          onClose={() => setEditingNC(null)}
          onSuccess={() => { setEditingNC(null); fetchNCs(); }}
        />
      )}
    </div>
  );
};

/* ======================== EDITAR NOTA DE CRÉDITO MODAL ======================== */
const EditarNotaCreditoModal = ({ nc, sucursales, onClose, onSuccess }) => {
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState(nc.clienteid || nc.clienteId || '');
  const [sucursalId, setSucursalId] = useState(nc.sucursalid || nc.sucursalId || (sucursales[0]?.id || ''));
  const [fechaEmision, setFechaEmision] = useState(nc.fechaemision ? nc.fechaemision.split('T')[0] : today());
  const [montoSubtotal, setMontoSubtotal] = useState(nc.montosubtotal || nc.montoSubtotal || 0);
  const [montoIva, setMontoIva] = useState(nc.montoiva || nc.montoIva || 0);
  const [montoTotal, setMontoTotal] = useState(nc.montototal || nc.montoTotal || 0);
  const [observacion, setObservacion] = useState(nc.observacion || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/clientes`)
      .then(res => setClientes(res.data || []))
      .catch(() => {});
  }, []);

  const handleSubtotalChange = (val) => {
    setMontoSubtotal(val);
    const sub = parseFloat(val) || 0;
    const iva = +(sub * 0.15).toFixed(2);
    setMontoIva(iva.toString());
    setMontoTotal((sub + iva).toFixed(2));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clienteId) { setError('Por favor seleccione un cliente.'); return; }
    if (!sucursalId) { setError('Por favor seleccione una sucursal.'); return; }
    const sub = parseFloat(montoSubtotal) || 0;
    const iva = parseFloat(montoIva) || 0;
    const tot = parseFloat(montoTotal) || 0;
    if (tot <= 0) { setError('El monto total debe ser mayor a 0.'); return; }

    setLoading(true);
    setError('');

    try {
      await axios.put(`${CAJA_URL}/editar-nota-credito/${nc.id}`, {
        ClienteId: Number(clienteId),
        SucursalId: Number(sucursalId),
        FechaEmision: fechaEmision,
        MontoSubtotal: sub,
        MontoIva: iva,
        MontoTotal: tot,
        Observacion: observacion
      });
      alert('Nota de Crédito modificada exitosamente.');
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.Error || 'Error al modificar la Nota de Crédito.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-amber-600 to-amber-700 text-white">
          <div className="flex items-center gap-2">
            <Edit size={20} />
            <h2 className="text-base font-bold">Editar Nota de Crédito {nc.numeronotacredito}</h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Cliente *</label>
            <select
              value={clienteId}
              onChange={e => setClienteId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            >
              <option value="">-- Seleccionar Cliente --</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} {c.identificacion ? `(${c.identificacion})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Sucursal *</label>
              <select
                value={sucursalId}
                onChange={e => setSucursalId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              >
                <option value="">-- Seleccionar --</option>
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Fecha Emisión *</label>
              <input
                type="date"
                value={fechaEmision}
                onChange={e => setFechaEmision(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="text-xs text-slate-600 font-bold mb-1 block">Subtotal (C$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={montoSubtotal}
                onChange={e => handleSubtotalChange(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white font-semibold text-slate-800"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-600 font-bold mb-1 block">IVA 15%</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={montoIva}
                onChange={e => {
                  setMontoIva(e.target.value);
                  setMontoTotal(((parseFloat(montoSubtotal) || 0) + (parseFloat(e.target.value) || 0)).toFixed(2));
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white font-semibold text-slate-800"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="text-xs text-amber-700 font-extrabold mb-1 block">Monto Total</label>
              <input
                type="number"
                step="0.01"
                readOnly
                value={montoTotal}
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-amber-50 font-black text-amber-800"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Observación / Motivo</label>
            <textarea
              rows={3}
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl font-bold transition-colors disabled:opacity-60"
            >
              {loading ? 'Guardando...' : '✓ Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ======================== CREAR NOTA DE CRÉDITO MODAL ======================== */
const CrearNotaCreditoModal = ({ sucursales, sucursalActualId, formatCurrency, onClose, onSuccess }) => {
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [sucursalId, setSucursalId] = useState(sucursalActualId || (sucursales[0]?.id || ''));
  const [fechaEmision, setFechaEmision] = useState(today());
  const [montoSubtotal, setMontoSubtotal] = useState('');
  const [calcularIva, setCalcularIva] = useState(true);
  const [montoIva, setMontoIva] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [observacion, setObservacion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/clientes`);
        setClientes(res.data || []);
      } catch (e) {
        console.error("Error al cargar clientes", e);
      }
    };
    fetchClientes();
  }, []);

  const handleSubtotalChange = (val) => {
    setMontoSubtotal(val);
    const sub = parseFloat(val) || 0;
    if (calcularIva) {
      const iva = +(sub * 0.15).toFixed(2);
      setMontoIva(iva.toString());
      setMontoTotal((sub + iva).toFixed(2));
    } else {
      const iva = parseFloat(montoIva) || 0;
      setMontoTotal((sub + iva).toFixed(2));
    }
  };

  const handleIvaChange = (val) => {
    setMontoIva(val);
    const sub = parseFloat(montoSubtotal) || 0;
    const iva = parseFloat(val) || 0;
    setMontoTotal((sub + iva).toFixed(2));
  };

  const handleToggleCalcularIva = (checked) => {
    setCalcularIva(checked);
    const sub = parseFloat(montoSubtotal) || 0;
    if (checked) {
      const iva = +(sub * 0.15).toFixed(2);
      setMontoIva(iva.toString());
      setMontoTotal((sub + iva).toFixed(2));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clienteId) { setError('Por favor seleccione un cliente.'); return; }
    if (!sucursalId) { setError('Por favor seleccione una sucursal.'); return; }
    const sub = parseFloat(montoSubtotal) || 0;
    const iva = parseFloat(montoIva) || 0;
    const tot = parseFloat(montoTotal) || 0;
    if (tot <= 0) { setError('El monto total debe ser mayor a 0.'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${CAJA_URL}/crear-nota-credito`, {
        ClienteId: Number(clienteId),
        SucursalId: Number(sucursalId),
        FechaEmision: fechaEmision,
        MontoSubtotal: sub,
        MontoIva: iva,
        MontoTotal: tot,
        Observacion: observacion || 'Nota de Crédito a favor del cliente'
      });

      const clienteObj = clientes.find(c => String(c.id) === String(clienteId));
      const sucursalObj = sucursales.find(s => String(s.id) === String(sucursalId));
      const createdNC = {
        id: res.data.id || res.data.Id,
        numeronotacredito: res.data.numeroNotaCredito || res.data.NumeroNotaCredito,
        cliente: clienteObj ? clienteObj.nombre : 'Cliente',
        clienteidentificacion: clienteObj ? clienteObj.identificacion : '',
        sucursal: sucursalObj ? sucursalObj.nombre : 'Sucursal',
        fechaemision: fechaEmision,
        montosubtotal: sub,
        montoiva: iva,
        montototal: tot,
        montoaplicado: 0,
        montosaldo: tot,
        observacion: observacion || 'Nota de Crédito a favor del cliente'
      };

      printNotaCreditoDocument(createdNC, formatCurrency);
      alert('Nota de Crédito creada e impresa exitosamente.');
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.Error || 'Error al crear la Nota de Crédito.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-emerald-800 text-white">
          <div className="flex items-center gap-2">
            <Plus size={20} />
            <h2 className="text-base font-bold">Crear Nota de Crédito a Favor del Cliente</h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Cliente *</label>
            <select
              value={clienteId}
              onChange={e => setClienteId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            >
              <option value="">-- Seleccionar Cliente --</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} {c.identificacion ? `(${c.identificacion})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Sucursal *</label>
              <select
                value={sucursalId}
                onChange={e => setSucursalId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="">-- Seleccionar --</option>
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Fecha Emisión *</label>
              <input
                type="date"
                value={fechaEmision}
                onChange={e => setFechaEmision(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="text-xs text-slate-600 font-bold mb-1 block">Subtotal (C$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={montoSubtotal}
                onChange={e => handleSubtotalChange(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white font-semibold text-slate-800"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-600 font-bold">IVA 15%</label>
                <label className="text-[10px] text-emerald-700 flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={calcularIva}
                    onChange={e => handleToggleCalcularIva(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  Auto
                </label>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={calcularIva}
                value={montoIva}
                onChange={e => handleIvaChange(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white font-semibold text-slate-800 disabled:bg-slate-100 disabled:text-slate-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="text-xs text-emerald-700 font-extrabold mb-1 block">Monto Total</label>
              <input
                type="number"
                step="0.01"
                readOnly
                value={montoTotal}
                className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-sm bg-emerald-50 font-black text-emerald-700"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">Observación / Motivo</label>
            <textarea
              rows={3}
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              placeholder="Ej: Saldo a favor por anticipo, ajuste post-venta, nota a favor del cliente..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold transition-colors disabled:opacity-60"
            >
              {loading ? 'Guardando...' : '✓ Crear Nota de Crédito'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ======================== IMPRIMIR NOTA DE CRÉDITO MODAL ======================== */
const ImprimirNotaCreditoModal = ({ nc, formatCurrency, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none print:rounded-none">
        {/* Modal Toolbar - Hidden in print */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-800 text-white print:hidden">
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-emerald-400" />
            <h3 className="font-bold text-sm">Vista Previa de Impresión - Nota de Crédito</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Printer size={16} /> Imprimir Documento
            </button>
            <button onClick={onClose} className="text-slate-300 hover:text-white"><X size={20} /></button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-8 space-y-6 text-slate-800 bg-white" id="printable-nc">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
            <div className="flex items-center gap-4">
              <img src={logoImg} alt="Agrisource Logo" className="h-16 w-auto object-contain" />
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">AGRISOURCE S.A.</h1>
                <p className="text-xs text-slate-600">Soluciones Agrícolas e Industriales</p>
                <p className="text-xs text-slate-500">Sucursal: <strong className="text-slate-700">{nc.sucursal || 'Central'}</strong></p>
              </div>
            </div>
            <div className="text-right border border-blue-200 bg-blue-50/50 p-3 rounded-xl">
              <h2 className="text-sm font-bold text-blue-900 uppercase tracking-wide">NOTA DE CRÉDITO</h2>
              <div className="text-lg font-mono font-extrabold text-blue-700 mt-1">{nc.numeronotacredito}</div>
              <div className="text-xs text-slate-500 mt-1">Fecha: <strong>{formatDate(nc.fechaemision)}</strong></div>
            </div>
          </div>

          {/* Client & Origin Info */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="font-bold text-slate-500 uppercase block mb-1">DATOS DEL CLIENTE</span>
              <div className="text-sm font-bold text-slate-800">{nc.cliente}</div>
              {nc.clienteidentificacion && <div className="text-slate-600 mt-0.5">Identificación: {nc.clienteidentificacion}</div>}
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="font-bold text-slate-500 uppercase block mb-1">REFERENCIAS DE ORIGEN</span>
              <div>Devolución #: <strong className="font-mono text-slate-800">{nc.numerodevolucion || 'N/A'}</strong></div>
              <div className="mt-0.5">Factura Origen: <strong className="font-mono text-slate-800">{nc.numerofacturaorigen && nc.numerofacturaorigen !== 'N/A' ? `#${nc.numerofacturaorigen}` : 'N/A'}</strong></div>
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div>
            <table className="w-full text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-800 text-white font-bold uppercase">
                  <th className="p-2.5 text-left border border-slate-800">Concepto / Descripción</th>
                  <th className="p-2.5 text-right border border-slate-800 w-32">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                <tr>
                  <td className="p-3 border border-slate-300">
                    <div className="font-semibold text-slate-900">Nota de Crédito a Favor del Cliente</div>
                    <div className="text-slate-500 text-[11px] mt-1">{nc.observacion || 'Ajuste / Crédito disponible'}</div>
                  </td>
                  <td className="p-3 text-right font-mono border border-slate-300 text-slate-800">{formatCurrency(nc.montosubtotal)}</td>
                </tr>
                <tr>
                  <td className="p-2.5 text-right font-semibold text-slate-600 border border-slate-300">Subtotal:</td>
                  <td className="p-2.5 text-right font-mono font-semibold border border-slate-300 text-slate-800">{formatCurrency(nc.montosubtotal)}</td>
                </tr>
                <tr>
                  <td className="p-2.5 text-right font-semibold text-slate-600 border border-slate-300">IVA (15%):</td>
                  <td className="p-2.5 text-right font-mono font-semibold border border-slate-300 text-slate-800">{formatCurrency(nc.montoiva)}</td>
                </tr>
                <tr className="bg-slate-100 font-bold">
                  <td className="p-3 text-right text-slate-900 text-sm border border-slate-300">MONTO TOTAL DE NOTA CRÉDITO:</td>
                  <td className="p-3 text-right font-mono text-slate-900 text-sm border border-slate-300">{formatCurrency(nc.montototal)}</td>
                </tr>
                <tr>
                  <td className="p-2.5 text-right font-semibold text-emerald-700 border border-slate-300">Monto Aplicado:</td>
                  <td className="p-2.5 text-right font-mono font-bold text-emerald-700 border border-slate-300">{formatCurrency(nc.montoaplicado)}</td>
                </tr>
                <tr className="bg-blue-50 font-bold">
                  <td className="p-3 text-right text-blue-900 text-sm border border-slate-300">SALDO DISPONIBLE A FAVOR:</td>
                  <td className="p-3 text-right font-mono text-blue-900 text-base border border-slate-300">{formatCurrency(nc.montosaldo)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Status badge & application note */}
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <div>
              Estado de la Nota de Crédito: <strong className="uppercase text-blue-700">{nc.aplicada || nc.estado === 'APLICADA' ? 'APLICADA TOTALMENTE' : nc.estado === 'PARCIAL' ? 'PARCIALMENTE APLICADA' : 'DISPONIBLE PARA COBROS/FACTURAS'}</strong>
            </div>
            {nc.reciboaplicadonumero && <div>Aplicada en Recibo #: <strong className="font-mono text-emerald-700">{nc.reciboaplicadonumero}</strong></div>}
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-6 pt-12 text-center text-xs">
            <div className="border-t border-slate-400 pt-2">
              <span className="font-bold text-slate-700 block">Elaborado por</span>
              <span className="text-slate-400 text-[10px]">Firma / Sello</span>
            </div>
            <div className="border-t border-slate-400 pt-2">
              <span className="font-bold text-slate-700 block">Autorizado por</span>
              <span className="text-slate-400 text-[10px]">Firma Caja / Gerencia</span>
            </div>
            <div className="border-t border-slate-400 pt-2">
              <span className="font-bold text-slate-700 block">Recibido Conforme</span>
              <span className="text-slate-400 text-[10px]">Cliente</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ======================== CUENTAS BANCARIAS TAB ======================== */
const CuentasBancariasTab = () => {
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    banco: '',
    tipoCuenta: 'AHORRO',
    moneda: 'NIO',
    numeroCuenta: '',
    nombreTitular: 'AGRISOURCE S.A.',
    comisionPosPorcentaje: 0,
    retencionPosPorcentaje: 0,
    esPos: false,
    activo: true
  });

  const fetchCuentas = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${CAJA_URL}/cuentas-bancarias?includeInactive=true`);
      setCuentas(res.data || []);
    } catch (err) {
      setError('Error al cargar las cuentas bancarias.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCuentas();
  }, []);

  const handleToggle = async (id, estadoActual) => {
    const accion = estadoActual ? 'INHABILITAR' : 'HABILITAR';
    if (!window.confirm(`¿Está seguro de que desea ${accion} esta cuenta bancaria?`)) return;
    try {
      await axios.patch(`${CAJA_URL}/cuentas-bancarias/${id}/toggle-status`);
      fetchCuentas();
    } catch (err) {
      alert('Error al cambiar el estado de la cuenta bancaria.');
    }
  };

  const handleEdit = (c) => {
    setEditingId(c.id);
    setForm({
      banco: c.banco || '',
      tipoCuenta: c.tipocuenta || c.tipoCuenta || 'AHORRO',
      moneda: c.moneda || 'NIO',
      numeroCuenta: c.numerocuenta || c.numeroCuenta || '',
      nombreTitular: c.nombretitular || c.nombreTitular || 'AGRISOURCE S.A.',
      comisionPosPorcentaje: c.comisionposporcentaje || c.comisionPosPorcentaje || 0,
      retencionPosPorcentaje: c.retencionposporcentaje || c.retencionPosPorcentaje || 0,
      esPos: c.espos || c.esPos || false,
      activo: c.activo !== undefined ? c.activo : true
    });
    setShowForm(true);
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setForm({
      banco: '',
      tipoCuenta: 'AHORRO',
      moneda: 'NIO',
      numeroCuenta: '',
      nombreTitular: 'AGRISOURCE S.A.',
      comisionPosPorcentaje: 0,
      retencionPosPorcentaje: 0,
      esPos: false,
      activo: true
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.banco || !form.numeroCuenta) {
      alert('El nombre del banco y el número de cuenta son obligatorios.');
      return;
    }

    try {
      if (editingId) {
        await axios.put(`${CAJA_URL}/cuentas-bancarias/${editingId}`, form);
      } else {
        await axios.post(`${CAJA_URL}/cuentas-bancarias`, form);
      }
      setShowForm(false);
      fetchCuentas();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar la cuenta bancaria.');
    }
  };

  const filteredCuentas = cuentas.filter(c => {
    const q = search.toLowerCase();
    return !q ||
      (c.banco || '').toLowerCase().includes(q) ||
      (c.numerocuenta || c.numeroCuenta || '').toLowerCase().includes(q) ||
      (c.nombretitular || c.nombreTitular || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Banknote className="text-emerald-600" size={20} />
            Gestión de Cuentas Bancarias y Terminales POS
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Administre, habilite o inhabilite cuentas de depósito y configure porcentajes de retención/comisión POS.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Buscar banco o número de cuenta..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-slate-800 outline-none w-64"
            />
          </div>
          <button
            onClick={handleCreateNew}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Plus size={16} /> Nueva Cuenta Bancaria
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-xl text-xs font-semibold">{error}</div>}

      {/* Inline Form */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="font-bold text-sm uppercase text-slate-800 flex items-center gap-2">
              <Banknote size={18} className="text-emerald-600" />
              {editingId ? 'Editar Cuenta Bancaria' : 'Registrar Nueva Cuenta Bancaria'}
            </h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 mb-1 block">Banco *</label>
              <input
                type="text"
                placeholder="Ej. Banpro, BAC, LAFISE, FICO..."
                value={form.banco}
                onChange={e => setForm({ ...form, banco: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 font-bold"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 mb-1 block">Tipo de Cuenta</label>
              <select
                value={form.tipoCuenta}
                onChange={e => setForm({ ...form, tipoCuenta: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="AHORRO">Ahorro</option>
                <option value="CORRIENTE">Corriente</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 mb-1 block">Moneda</label>
              <select
                value={form.moneda}
                onChange={e => setForm({ ...form, moneda: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 bg-white font-bold"
              >
                <option value="NIO">Córdobas (C$ NIO)</option>
                <option value="USD">Dólares ($ USD)</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 mb-1 block">N° de Cuenta *</label>
              <input
                type="text"
                placeholder="10020508700932"
                value={form.numeroCuenta}
                onChange={e => setForm({ ...form, numeroCuenta: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 mb-1 block">Titular de la Cuenta</label>
              <input
                type="text"
                value={form.nombreTitular}
                onChange={e => setForm({ ...form, nombreTitular: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 mb-1 block">Estado de Habilitación</label>
              <select
                value={form.activo ? 'true' : 'false'}
                onChange={e => setForm({ ...form, activo: e.target.value === 'true' })}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 bg-white font-bold"
              >
                <option value="true">● Habilitada (Activa)</option>
                <option value="false">○ Inhabilitada (Desactivada)</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <label className="flex items-center gap-2 cursor-pointer font-extrabold text-slate-800 text-xs bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 w-full">
                <input
                  type="checkbox"
                  checked={form.esPos}
                  onChange={e => setForm({ ...form, esPos: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                Es Terminal POS
              </label>
            </div>
            {form.esPos && (
              <>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Comisión POS (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.comisionPosPorcentaje}
                    onChange={e => setForm({ ...form, comisionPosPorcentaje: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-amber-300 bg-amber-50/50 rounded-xl px-3 py-2 font-bold focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Retención Fuente POS (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.retencionPosPorcentaje}
                    onChange={e => setForm({ ...form, retencionPosPorcentaje: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-amber-300 bg-amber-50/50 rounded-xl px-3 py-2 font-bold focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md transition-colors"
            >
              ✓ Guardar Cuenta Bancaria
            </button>
          </div>
        </form>
      )}

      {/* Accounts List Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Banco</th>
              <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Tipo & Moneda</th>
              <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">N° Cuenta</th>
              <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Titular</th>
              <th className="px-4 py-3 text-center font-bold uppercase tracking-wider">Configuración POS</th>
              <th className="px-4 py-3 text-center font-bold uppercase tracking-wider">Estado</th>
              <th className="px-4 py-3 text-center font-bold uppercase tracking-wider">Acción Habilitación</th>
              <th className="px-4 py-3 text-right font-bold uppercase tracking-wider">Editar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="8" className="text-center py-10 text-slate-400 animate-pulse">Cargando cuentas bancarias...</td></tr>
            ) : filteredCuentas.length === 0 ? (
              <tr><td colSpan="8" className="text-center py-10 text-slate-400">No se encontraron cuentas bancarias.</td></tr>
            ) : (
              filteredCuentas.map(c => (
                <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${!c.activo ? 'opacity-50 bg-slate-50' : ''}`}>
                  <td className="px-4 py-3.5 font-extrabold text-slate-900 text-sm">{c.banco}</td>
                  <td className="px-4 py-3.5 text-slate-700 font-bold">{c.tipocuenta || c.tipoCuenta} ({c.moneda})</td>
                  <td className="px-4 py-3.5 font-mono font-extrabold text-emerald-700 text-sm">{c.numerocuenta || c.numeroCuenta}</td>
                  <td className="px-4 py-3.5 text-slate-600 font-medium">{c.nombretitular || c.nombreTitular}</td>
                  <td className="px-4 py-3.5 text-center">
                    {(c.espos || c.esPos) ? (
                      <span className="bg-amber-100 text-amber-950 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-300">
                        POS ({c.comisionposporcentaje || c.comisionPosPorcentaje}% Com. / {c.retencionposporcentaje || c.retencionPosPorcentaje}% Ret.)
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      c.activo ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      {c.activo ? '● ACTIVA' : '○ INACTIVA'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button
                      onClick={() => handleToggle(c.id, c.activo)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                        c.activo
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {c.activo ? '🔴 Inhabilitar' : '🟢 Habilitar'}
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => handleEdit(c)}
                      className="text-blue-600 hover:text-blue-800 font-bold p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                      title="Editar cuenta"
                    >
                      <Edit size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ======================== GESTION CUENTAS BANCARIAS MODAL ======================== */
const GestionCuentasBancariasModal = ({ onClose, onRefreshAccounts }) => {
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    banco: '',
    tipoCuenta: 'AHORRO',
    moneda: 'NIO',
    numeroCuenta: '',
    nombreTitular: 'AGRISOURCE S.A.',
    comisionPosPorcentaje: 0,
    retencionPosPorcentaje: 0,
    esPos: false,
    activo: true
  });

  const fetchCuentas = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${CAJA_URL}/cuentas-bancarias?includeInactive=true`);
      setCuentas(res.data || []);
    } catch (err) {
      setError('Error al cargar cuentas bancarias.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCuentas();
  }, []);

  const handleToggle = async (id, estadoActual) => {
    const accion = estadoActual ? 'INHABILITAR' : 'HABILITAR';
    if (!window.confirm(`¿Está seguro de que desea ${accion} esta cuenta bancaria?`)) return;
    try {
      await axios.patch(`${CAJA_URL}/cuentas-bancarias/${id}/toggle-status`);
      fetchCuentas();
      if (onRefreshAccounts) onRefreshAccounts();
    } catch (err) {
      alert('Error al cambiar el estado de la cuenta bancaria.');
    }
  };

  const handleEdit = (c) => {
    setEditingId(c.id);
    setForm({
      banco: c.banco || '',
      tipoCuenta: c.tipocuenta || c.tipoCuenta || 'AHORRO',
      moneda: c.moneda || 'NIO',
      numeroCuenta: c.numerocuenta || c.numeroCuenta || '',
      nombreTitular: c.nombretitular || c.nombreTitular || 'AGRISOURCE S.A.',
      comisionPosPorcentaje: c.comisionposporcentaje || c.comisionPosPorcentaje || 0,
      retencionPosPorcentaje: c.retencionposporcentaje || c.retencionPosPorcentaje || 0,
      esPos: c.espos || c.esPos || false,
      activo: c.activo !== undefined ? c.activo : true
    });
    setShowForm(true);
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setForm({
      banco: '',
      tipoCuenta: 'AHORRO',
      moneda: 'NIO',
      numeroCuenta: '',
      nombreTitular: 'AGRISOURCE S.A.',
      comisionPosPorcentaje: 0,
      retencionPosPorcentaje: 0,
      esPos: false,
      activo: true
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.banco || !form.numeroCuenta) {
      alert('El nombre del banco y el número de cuenta son obligatorios.');
      return;
    }

    try {
      if (editingId) {
        await axios.put(`${CAJA_URL}/cuentas-bancarias/${editingId}`, form);
      } else {
        await axios.post(`${CAJA_URL}/cuentas-bancarias`, form);
      }
      setShowForm(false);
      fetchCuentas();
      if (onRefreshAccounts) onRefreshAccounts();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar la cuenta bancaria.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-xl">
              <Banknote size={20} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-base">Gestión de Cuentas Bancarias</h3>
              <p className="text-xs text-slate-400">Configure, habilite o inhabilite cuentas de depósito y POS bancarios</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs font-semibold">{error}</div>}

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Cuentas Registradas ({cuentas.length})</span>
            <button
              onClick={handleCreateNew}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus size={15} /> Nueva Cuenta Bancaria
            </button>
          </div>

          {/* Inline Form */}
          {showForm && (
            <form onSubmit={handleSave} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 shadow-inner">
              <h4 className="font-bold text-xs uppercase text-slate-700">{editingId ? 'Editar Cuenta Bancaria' : 'Registrar Nueva Cuenta Bancaria'}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-600 mb-1 block">Banco *</label>
                  <input
                    type="text"
                    placeholder="Ej. Banpro, BAC, LAFISE..."
                    value={form.banco}
                    onChange={e => setForm({ ...form, banco: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 mb-1 block">Tipo de Cuenta</label>
                  <select
                    value={form.tipoCuenta}
                    onChange={e => setForm({ ...form, tipoCuenta: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="AHORRO">Ahorro</option>
                    <option value="CORRIENTE">Corriente</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 mb-1 block">Moneda</label>
                  <select
                    value={form.moneda}
                    onChange={e => setForm({ ...form, moneda: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500 bg-white font-bold"
                  >
                    <option value="NIO">Córdobas (C$ NIO)</option>
                    <option value="USD">Dólares ($ USD)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 mb-1 block">N° de Cuenta *</label>
                  <input
                    type="text"
                    placeholder="10020508700932"
                    value={form.numeroCuenta}
                    onChange={e => setForm({ ...form, numeroCuenta: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 mb-1 block">Titular de Cuenta</label>
                  <input
                    type="text"
                    value={form.nombreTitular}
                    onChange={e => setForm({ ...form, nombreTitular: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 mb-1 block">Estado</label>
                  <select
                    value={form.activo ? 'true' : 'false'}
                    onChange={e => setForm({ ...form, activo: e.target.value === 'true' })}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500 bg-white font-bold"
                  >
                    <option value="true">● Habilitada</option>
                    <option value="false">○ Inhabilitada</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-xs">
                    <input
                      type="checkbox"
                      checked={form.esPos}
                      onChange={e => setForm({ ...form, esPos: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    Es Terminal POS
                  </label>
                </div>
                {form.esPos && (
                  <>
                    <div>
                      <label className="font-semibold text-slate-600 mb-1 block">Comisión POS (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.comisionPosPorcentaje}
                        onChange={e => setForm({ ...form, comisionPosPorcentaje: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 mb-1 block">Retención Fuente POS (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.retencionPosPorcentaje}
                        onChange={e => setForm({ ...form, retencionPosPorcentaje: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 font-semibold hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-sm"
                >
                  Guardar Cuenta
                </button>
              </div>
            </form>
          )}

          {/* Accounts List Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-700">Banco</th>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-700">Tipo & Moneda</th>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-700">N° Cuenta</th>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-700">Titular</th>
                  <th className="px-3 py-2.5 text-center font-bold text-slate-700">POS / Comisiones</th>
                  <th className="px-3 py-2.5 text-center font-bold text-slate-700">Estado</th>
                  <th className="px-3 py-2.5 text-center font-bold text-slate-700">Acción Habilitación</th>
                  <th className="px-3 py-2.5 text-right font-bold text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan="8" className="text-center py-6 text-slate-400">Cargando cuentas bancarias...</td></tr>
                ) : cuentas.length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-6 text-slate-400">No hay cuentas bancarias registradas.</td></tr>
                ) : (
                  cuentas.map(c => (
                    <tr key={c.id} className={`hover:bg-slate-50 ${!c.activo ? 'opacity-50 bg-slate-50/50' : ''}`}>
                      <td className="px-3 py-2.5 font-extrabold text-slate-900">{c.banco}</td>
                      <td className="px-3 py-2.5 text-slate-700 font-medium">{c.tipocuenta || c.tipoCuenta} ({c.moneda})</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-emerald-800">{c.numerocuenta || c.numeroCuenta}</td>
                      <td className="px-3 py-2.5 text-slate-600">{c.nombretitular || c.nombreTitular}</td>
                      <td className="px-3 py-2.5 text-center">
                        {(c.espos || c.esPos) ? (
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                            POS ({c.comisionposporcentaje || c.comisionPosPorcentaje}% / {c.retencionposporcentaje || c.retencionPosPorcentaje}%)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] ${c.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {c.activo ? '● ACTIVA' : '○ INACTIVA'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => handleToggle(c.id, c.activo)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shadow-sm ${
                            c.activo
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {c.activo ? '🔴 Inhabilitar' : '🟢 Habilitar'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => handleEdit(c)}
                          className="text-blue-600 hover:text-blue-800 font-bold p-1 rounded hover:bg-blue-50 transition-colors"
                          title="Editar cuenta"
                        >
                          <Edit size={15} />
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
    </div>
  );
};

export default Caja;
