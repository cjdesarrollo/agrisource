using Microsoft.AspNetCore.Mvc;
using Npgsql;
using Dapper;

namespace AgrisourceDashboard.Api.Controllers
{
    [ApiController]
    [Route("api/caja")]
    public class CajaController : ControllerBase
    {
        private readonly string _connectionString;

        public CajaController(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection")!;
        }

        // GET /api/caja/facturas-pendientes?condicion=credito|contado&sucursalId=&startDate=&endDate=
        [HttpGet("facturas-pendientes")]
        public async Task<IActionResult> GetFacturasPendientes(
            [FromQuery] string? condicion,
            [FromQuery] string? sucursalId,
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate)
        {
            using var connection = new NpgsqlConnection(_connectionString);

            int? parsedSucursalId = null;
            if (!string.IsNullOrEmpty(sucursalId) && sucursalId != "null" && sucursalId != "undefined" && int.TryParse(sucursalId, out int sid) && sid > 0)
            {
                parsedSucursalId = sid;
            }

            var conditions = new List<string>
            {
                "f.estado_pago = 'PENDIENTE'",
                "f.estado <> 'AN'",
                "s.nombre <> 'Los Arcos'"
            };

            if (parsedSucursalId.HasValue) conditions.Add("f.sucursal_id = @sucursalId");
            if (startDate.HasValue) conditions.Add("f.fecha >= @startDate");
            if (endDate.HasValue) conditions.Add("f.fecha <= @endDate");

            if (condicion == "credito")
                conditions.Add("COALESCE(cp.dias, 0) > 0");
            else if (condicion == "contado")
                conditions.Add("COALESCE(cp.dias, 0) = 0");

            var where = "WHERE " + string.Join(" AND ", conditions);

            var query = $@"
                SELECT 
                    f.id,
                    f.numero as NumeroFactura,
                    f.fecha as Fecha,
                    f.fecha_vencimiento as FechaVencimiento,
                    c.id as ClienteId,
                    c.nombre as Cliente,
                    c.identificacion as Identificacion,
                    s.nombre as Sucursal,
                    f.sucursal_id as SucursalId,
                    cp.descripcion as CondicionPago,
                    COALESCE(cp.dias, 0) as DiasCredito,
                    f.sub_total as SubTotal,
                    f.iva as IVA,
                    f.total as Total,
                    f.estado_pago as EstadoPago,
                    f.estado as Estado,
                    COALESCE(
                        (SELECT SUM(rcd.monto_aplicado) FROM caja.recibos_caja_detalle rcd WHERE rcd.factura_id = f.id),
                        0
                    ) as MontoPagado,
                    f.total - COALESCE(
                        (SELECT SUM(rcd.monto_aplicado) FROM caja.recibos_caja_detalle rcd WHERE rcd.factura_id = f.id),
                        0
                    ) as SaldoPendiente
                FROM ventas.facturas f
                JOIN ventas.clientes c ON f.cliente_id = c.id
                JOIN public.sucursales s ON f.sucursal_id = s.id
                LEFT JOIN public.condiciones_pago cp ON f.condicion_pago_id = cp.id
                {where}
                ORDER BY f.fecha ASC, c.nombre ASC";

            var result = await connection.QueryAsync(query, new { sucursalId = parsedSucursalId, startDate, endDate });
            return Ok(result);
        }

        // GET /api/caja/pagos-resumen?startDate=&endDate=&sucursalId=
        [HttpGet("pagos-resumen")]
        public async Task<IActionResult> GetPagosResumen(
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate,
            [FromQuery] string? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);

            int? parsedSucursalId = null;
            if (!string.IsNullOrEmpty(sucursalId) && sucursalId != "null" && sucursalId != "undefined" && int.TryParse(sucursalId, out int sid) && sid > 0)
            {
                parsedSucursalId = sid;
            }

            var conditions = new List<string> { "rc.tipo = 'INGRESO'", "rc.estado <> 'ANULADO'" };
            if (startDate.HasValue) conditions.Add("rc.fecha >= @startDate::date");
            if (endDate.HasValue) conditions.Add("rc.fecha <= @endDate::date");
            if (parsedSucursalId.HasValue) conditions.Add("rc.sucursal_id = @sucursalId");
            var where = "WHERE " + string.Join(" AND ", conditions);

            // Payments by method (Grouping Transferencia & Deposito)
            var queryMetodo = $@"
                SELECT 
                    CASE 
                        WHEN UPPER(rc.metodo_pago) LIKE '%TRANSFERENCIA%' OR UPPER(rc.metodo_pago) LIKE '%DEPOSITO%' THEN 'TRANSFERENCIA / DEPOSITO'
                        WHEN UPPER(rc.metodo_pago) LIKE '%EFECTIVO%' THEN 'EFECTIVO'
                        WHEN UPPER(rc.metodo_pago) LIKE '%TARJETA%' THEN 'TARJETA'
                        WHEN UPPER(rc.metodo_pago) LIKE '%NOTA%' THEN 'NOTA DE CREDITO'
                        ELSE UPPER(rc.metodo_pago)
                    END as MetodoPago, 
                    COUNT(*) as Cantidad, 
                    COALESCE(SUM(rc.importe_total), 0) as Total
                FROM caja.recibos_caja rc
                {where}
                GROUP BY CASE 
                    WHEN UPPER(rc.metodo_pago) LIKE '%TRANSFERENCIA%' OR UPPER(rc.metodo_pago) LIKE '%DEPOSITO%' THEN 'TRANSFERENCIA / DEPOSITO'
                    WHEN UPPER(rc.metodo_pago) LIKE '%EFECTIVO%' THEN 'EFECTIVO'
                    WHEN UPPER(rc.metodo_pago) LIKE '%TARJETA%' THEN 'TARJETA'
                    WHEN UPPER(rc.metodo_pago) LIKE '%NOTA%' THEN 'NOTA DE CREDITO'
                    ELSE UPPER(rc.metodo_pago)
                END";

            // Payments by type (contado vs credito)
            var queryTipo = $@"
                SELECT 
                    CASE WHEN COALESCE(cp.dias, 0) = 0 THEN 'Contado' ELSE 'Crédito' END as TipoVenta,
                    COUNT(DISTINCT rc.id) as Cantidad,
                    COALESCE(SUM(rcd.monto_aplicado), 0) as TotalAplicado
                FROM caja.recibos_caja rc
                JOIN caja.recibos_caja_detalle rcd ON rcd.recibo_id = rc.id
                JOIN ventas.facturas f ON rcd.factura_id = f.id
                LEFT JOIN public.condiciones_pago cp ON f.condicion_pago_id = cp.id
                {where}
                GROUP BY CASE WHEN COALESCE(cp.dias, 0) = 0 THEN 'Contado' ELSE 'Crédito' END";

            // Payments by Bank & POS
            var queryBancos = $@"
                SELECT 
                    COALESCE(rmp.banco_tarjeta, 'EFECTIVO / OTRO') as Entidad,
                    COUNT(DISTINCT rc.id) as Cantidad,
                    COALESCE(SUM(rmp.monto), 0) as Total
                FROM caja.recibo_metodos_pago rmp
                JOIN caja.recibos_caja rc ON rmp.recibo_id = rc.id
                {where} AND rmp.banco_tarjeta IS NOT NULL AND rmp.banco_tarjeta <> ''
                GROUP BY rmp.banco_tarjeta
                ORDER BY Total DESC";

            // Single Unified Table of Paid & Applied Invoices
            var condUnificada = new List<string>
            {
                "f.estado <> 'AN'",
                "f.estado <> 'ANULADA'",
                "s.nombre <> 'Los Arcos'",
                "(f.estado_pago = 'PAGADO' OR EXISTS (SELECT 1 FROM caja.recibos_caja_detalle rcd JOIN caja.recibos_caja rc ON rcd.recibo_id = rc.id WHERE rcd.factura_id = f.id AND rc.estado <> 'ANULADO'))"
            };
            if (startDate.HasValue) condUnificada.Add("(f.fecha >= @startDate::date OR EXISTS (SELECT 1 FROM caja.recibos_caja_detalle rcd JOIN caja.recibos_caja rc ON rcd.recibo_id = rc.id WHERE rcd.factura_id = f.id AND rc.estado <> 'ANULADO' AND rc.fecha >= @startDate::date))");
            if (endDate.HasValue) condUnificada.Add("(f.fecha <= @endDate::date OR EXISTS (SELECT 1 FROM caja.recibos_caja_detalle rcd JOIN caja.recibos_caja rc ON rcd.recibo_id = rc.id WHERE rcd.factura_id = f.id AND rc.estado <> 'ANULADO' AND rc.fecha <= @endDate::date))");
            if (parsedSucursalId.HasValue) condUnificada.Add("f.sucursal_id = @sucursalId");
            var whereUnificada = "WHERE " + string.Join(" AND ", condUnificada);

            var queryFacturasUnificadas = $@"
                SELECT 
                    f.id,
                    f.numero as NumeroFactura,
                    f.fecha as Fecha,
                    c.nombre as Cliente,
                    s.nombre as Sucursal,
                    COALESCE(cp.descripcion, 'CONTADO') as CondicionPago,
                    CASE WHEN COALESCE(cp.dias, 0) = 0 THEN 'Contado' ELSE 'Crédito' END as TipoVenta,
                    f.total as Total,
                    COALESCE(
                        (SELECT string_agg(DISTINCT rc.metodo_pago, ', ') 
                         FROM caja.recibos_caja_detalle rcd 
                         JOIN caja.recibos_caja rc ON rcd.recibo_id = rc.id 
                         WHERE rcd.factura_id = f.id AND rc.estado <> 'ANULADO'), 
                        'EFECTIVO'
                    ) as MetodoPago,
                    COALESCE(
                        (SELECT string_agg(DISTINCT CASE WHEN rc.serie IS NOT NULL AND rc.serie <> '' THEN CONCAT(rc.serie, '-', rc.numero) ELSE rc.numero END, ', ') 
                         FROM caja.recibos_caja_detalle rcd 
                         JOIN caja.recibos_caja rc ON rcd.recibo_id = rc.id 
                         WHERE rcd.factura_id = f.id AND rc.estado <> 'ANULADO'), 
                        '-'
                    ) as ReciboNumero,
                    COALESCE(
                        (SELECT string_agg(DISTINCT rmp.banco_tarjeta, ', ') 
                         FROM caja.recibos_caja_detalle rcd 
                         JOIN caja.recibo_metodos_pago rmp ON rcd.recibo_id = rmp.recibo_id 
                         WHERE rcd.factura_id = f.id AND rmp.banco_tarjeta IS NOT NULL AND rmp.banco_tarjeta <> ''), 
                        ''
                    ) as BancoCuenta,
                    COALESCE(
                        (SELECT SUM(rcd.monto_aplicado) 
                         FROM caja.recibos_caja_detalle rcd 
                         JOIN caja.recibos_caja rc ON rcd.recibo_id = rc.id
                         WHERE rcd.factura_id = f.id AND rc.estado <> 'ANULADO'), 
                        f.total
                    ) as MontoAplicado,
                    f.estado_pago as EstadoPago
                FROM ventas.facturas f
                JOIN ventas.clientes c ON f.cliente_id = c.id
                JOIN public.sucursales s ON f.sucursal_id = s.id
                LEFT JOIN public.condiciones_pago cp ON f.condicion_pago_id = cp.id
                {whereUnificada}
                ORDER BY f.fecha DESC, f.id DESC";

            var metodos = await connection.QueryAsync(queryMetodo, new { startDate, endDate, sucursalId = parsedSucursalId });
            var tipos = await connection.QueryAsync(queryTipo, new { startDate, endDate, sucursalId = parsedSucursalId });
            var bancos = await connection.QueryAsync(queryBancos, new { startDate, endDate, sucursalId = parsedSucursalId });
            var facturasUnificadas = await connection.QueryAsync(queryFacturasUnificadas, new { startDate, endDate, sucursalId = parsedSucursalId });

            return Ok(new { Metodos = metodos, Tipos = tipos, Bancos = bancos, FacturasCanceladas = facturasUnificadas });
        }

        // GET /api/caja/notas-credito-disponibles/{clienteId}
        [HttpGet("notas-credito-disponibles/{clienteId}")]
        public async Task<IActionResult> GetNotasCreditoDisponibles(long clienteId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var query = @"
                SELECT id, numero_nota_credito as NumeroNotaCredito, fecha_emision as FechaEmision,
                       monto_subtotal as MontoSubtotal, monto_iva as MontoIva, monto_total as MontoTotal,
                       monto_aplicado as MontoAplicado, monto_saldo as MontoSaldo,
                       observacion as Observacion, estado as Estado
                FROM ventas.notas_credito
                WHERE cliente_id = @clienteId AND monto_saldo > 0 AND estado IN ('DISPONIBLE', 'PARCIAL')
                ORDER BY fecha_emision ASC, id ASC";
            
            var result = await connection.QueryAsync(query, new { clienteId });
            return Ok(result);
        }

        // GET /api/caja/recibo-detalle/{id}
        [HttpGet("recibo-detalle/{id}")]
        public async Task<IActionResult> GetReciboDetalle(long id)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var recibo = await connection.QueryFirstOrDefaultAsync(@"
                SELECT rc.id, rc.serie as Serie, rc.numero as Numero, rc.fecha as Fecha,
                       rc.tipo as Tipo, rc.metodo_pago as MetodoPago, rc.descripcion as Descripcion,
                       rc.importe_total as ImporteTotal, rc.estado as Estado,
                       rc.cliente_id as ClienteId, c.nombre as Cliente, c.identificacion as ClienteIdentificacion,
                       s.nombre as Sucursal
                FROM caja.recibos_caja rc
                LEFT JOIN ventas.clientes c ON rc.cliente_id = c.id
                LEFT JOIN public.sucursales s ON rc.sucursal_id = s.id
                WHERE rc.id = @id", new { id });

            if (recibo == null) return NotFound(new { Error = "Recibo no encontrado." });

            var facturas = await connection.QueryAsync(@"
                SELECT rcd.factura_id as FacturaId, f.numero as NumeroFactura, f.fecha as FechaFactura,
                       rcd.monto_aplicado as MontoAplicado, rcd.es_parcial as EsParcial, f.total as TotalFactura
                FROM caja.recibos_caja_detalle rcd
                JOIN ventas.facturas f ON rcd.factura_id = f.id
                WHERE rcd.recibo_id = @id", new { id });

            var metodos = await connection.QueryAsync(@"
                SELECT rmp.id, rmp.metodo_pago as MetodoPago, rmp.monto as Monto,
                       rmp.nota_credito_id as NotaCreditoId, nc.numero_nota_credito as NumeroNotaCredito,
                       rmp.banco_tarjeta as BancoTarjeta, rmp.referencia as Referencia,
                       rmp.banco as Banco, rmp.numero_cuenta as NumeroCuenta,
                       rmp.cargo_bancario as CargoBancario, rmp.comision_porcentaje as ComisionPorcentaje,
                       rmp.retencion_fuente_pos as RetencionFuentePos, rmp.retencion_pos_porcentaje as RetencionPosPorcentaje,
                       rmp.monto_neto_banco as MontoNetoBanco
                FROM caja.recibo_metodos_pago rmp
                LEFT JOIN ventas.notas_credito nc ON rmp.nota_credito_id = nc.id
                WHERE rmp.recibo_id = @id", new { id });

            var retenciones = await connection.QueryAsync(@"
                SELECT r.id, r.tipo_retencion as TipoRetencion, r.concepto as Concepto,
                       r.monto_base as MontoBase, r.porcentaje as Porcentaje,
                       r.monto_retencion as MontoRetencion, r.numero_comprobante as NumeroComprobante,
                       t.nombre as TerceroNombre, t.tipo_tercero as TipoTercero
                FROM caja.retencion r
                LEFT JOIN public.terceros t ON r.tercero_id = t.id
                WHERE r.recibo_id = @id", new { id });

            return Ok(new { Recibo = recibo, Facturas = facturas, Metodos = metodos, Retenciones = retenciones });
        }

        // POST /api/caja/aplicar-pago
        [HttpPost("aplicar-pago")]
        public async Task<IActionResult> AplicarPago([FromBody] AplicarPagoRequest req)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();

            if (!req.SucursalId.HasValue || req.SucursalId.Value == 0)
            {
                var firstFacturaId = req.Detalles?.FirstOrDefault()?.FacturaId;
                if (firstFacturaId.HasValue && firstFacturaId.Value > 0)
                {
                    req.SucursalId = await connection.QueryFirstOrDefaultAsync<int?>(
                        "SELECT sucursal_id FROM ventas.facturas WHERE id = @id", new { id = firstFacturaId.Value });
                }
            }

            if (!req.SucursalId.HasValue || req.SucursalId.Value == 0)
                return BadRequest(new { Error = "Debe especificar la sucursal para aplicar el pago." });

            var arqueoActivo = await connection.QueryFirstOrDefaultAsync(
                "SELECT id FROM caja.arqueos_caja WHERE estado = 'ABIERTO' AND sucursal_id = @sucursalId",
                new { req.SucursalId });

            if (arqueoActivo == null)
            {
                arqueoActivo = await connection.QueryFirstOrDefaultAsync(
                    "SELECT id FROM caja.arqueos_caja WHERE estado = 'ABIERTO' ORDER BY id DESC LIMIT 1");
            }

            if (arqueoActivo == null)
                return BadRequest(new { Error = "No hay una caja abierta en esta sucursal ni en el sistema. Debe abrir la caja antes de aplicar un pago." });

            using var transaction = await connection.BeginTransactionAsync();

            try
            {
                // Determine header MetodoPago summary
                string finalMetodoHeader = req.MetodoPago;
                if (req.MetodosPago != null && req.MetodosPago.Count > 0)
                {
                    var nombres = req.MetodosPago
                        .Where(m => m.Monto > 0)
                        .Select(m => m.MetodoPago == "NOTA_CREDITO" ? "NOTA CREDITO" 
                                   : m.MetodoPago == "RETENCION_IR" ? "RETENCION IR 2%" 
                                   : m.MetodoPago == "RETENCION_ALCALDIA" ? "RETENCION MUNICIPAL 1%" 
                                   : m.MetodoPago)
                        .Distinct();
                    finalMetodoHeader = "MULTIPLE (" + string.Join(", ", nombres) + ")";
                    if (finalMetodoHeader.Length > 140) finalMetodoHeader = finalMetodoHeader.Substring(0, 140);
                }

                // Insert receipt header
                var insertRecibo = @"
                    INSERT INTO caja.recibos_caja 
                        (serie, numero, fecha, cliente_id, descripcion, importe_total, metodo_pago, sucursal_id, tipo)
                    VALUES 
                        (@serie, @numero, @fecha, @clienteId, @descripcion, @importeTotal, @finalMetodoHeader, @sucursalId, 'INGRESO')
                    RETURNING id";

                var reciboId = await connection.QuerySingleAsync<long>(insertRecibo, new
                {
                    req.Serie,
                    req.Numero,
                    fecha = req.Fecha ?? DateTime.Today,
                    req.ClienteId,
                    req.Descripcion,
                    req.ImporteTotal,
                    finalMetodoHeader,
                    req.SucursalId
                }, transaction);

                long? primeraFacturaId = req.Detalles.FirstOrDefault()?.FacturaId;

                // Process Payment Methods breakdown
                if (req.MetodosPago != null && req.MetodosPago.Count > 0)
                {
                    foreach (var pm in req.MetodosPago.Where(x => x.Monto > 0))
                    {
                        string? banco = pm.Banco;
                        string? numeroCuenta = pm.NumeroCuenta;
                        decimal comisionPorcentaje = 0;
                        decimal retencionPosPorcentaje = 0;
                        decimal cargoBancario = 0;
                        decimal retencionFuentePos = 0;
                        decimal montoNetoBanco = pm.Monto;

                        if (pm.MetodoPago == "TARJETA")
                        {
                            bool isLafise = (pm.BancoTarjeta ?? "").ToUpper().Contains("LAFISE");
                            banco = isLafise ? "LAFISE" : "BAC";
                            numeroCuenta = isLafise ? "135030904" : "36237312";
                            comisionPorcentaje = isLafise ? 2.50m : 3.00m;
                            retencionPosPorcentaje = 1.50m;
                            cargoBancario = Math.Round(pm.Monto * (comisionPorcentaje / 100m), 4);
                            retencionFuentePos = Math.Round(pm.Monto * (retencionPosPorcentaje / 100m), 4);
                            montoNetoBanco = pm.Monto - cargoBancario - retencionFuentePos;
                        }

                        // 1. Insert into caja.recibo_metodos_pago
                        await connection.ExecuteAsync(@"
                            INSERT INTO caja.recibo_metodos_pago 
                                (recibo_id, metodo_pago, monto, nota_credito_id, banco_tarjeta, referencia, banco, numero_cuenta,
                                 cargo_bancario, comision_porcentaje, retencion_fuente_pos, retencion_pos_porcentaje, monto_neto_banco)
                            VALUES 
                                (@reciboId, @MetodoPago, @Monto, @NotaCreditoId, @BancoTarjeta, @Referencia, @banco, @numeroCuenta,
                                 @cargoBancario, @comisionPorcentaje, @retencionFuentePos, @retencionPosPorcentaje, @montoNetoBanco)",
                            new { reciboId, pm.MetodoPago, pm.Monto, pm.NotaCreditoId, pm.BancoTarjeta, pm.Referencia, banco, numeroCuenta, cargoBancario, comisionPorcentaje, retencionFuentePos, retencionPosPorcentaje, montoNetoBanco }, transaction);

                        // 2. Insert into caja.metodo_pago
                        await connection.ExecuteAsync(@"
                            INSERT INTO caja.metodo_pago 
                                (recibo_id, factura_id, metodo_pago, monto, monto_factura, banco_tarjeta, referencia, nota_credito_id, banco, numero_cuenta,
                                 cargo_bancario, comision_porcentaje, retencion_fuente_pos, retencion_pos_porcentaje, monto_neto_banco)
                            VALUES 
                                (@reciboId, @primeraFacturaId, @MetodoPago, @Monto, @Monto, @BancoTarjeta, @Referencia, @NotaCreditoId, @banco, @numeroCuenta,
                                 @cargoBancario, @comisionPorcentaje, @retencionFuentePos, @retencionPosPorcentaje, @montoNetoBanco)",
                            new { reciboId, primeraFacturaId, pm.MetodoPago, pm.Monto, pm.BancoTarjeta, pm.Referencia, pm.NotaCreditoId, banco, numeroCuenta, cargoBancario, comisionPorcentaje, retencionFuentePos, retencionPosPorcentaje, montoNetoBanco }, transaction);

                        // 3. Insert into caja.retencion if applicable
                        if (pm.MetodoPago == "RETENCION_IR" || pm.MetodoPago == "RETENCION_ALCALDIA")
                        {
                            bool isIr = pm.MetodoPago == "RETENCION_IR";
                            decimal porcentaje = isIr ? 2.00m : 1.00m;
                            string tipoRet = isIr ? "RETENCION_IR_2" : "RETENCION_MUNICIPAL_1";
                            string concepto = isIr ? "Retención IR en la Fuente (2%) por Cobrar DGI" : "Retención Municipal (1%) por Cobrar Alcaldía";

                            int? terceroId = null;
                            if (isIr)
                            {
                                terceroId = await connection.QueryFirstOrDefaultAsync<int?>(
                                    "SELECT id FROM public.terceros WHERE tipo_tercero = 'DGI' LIMIT 1", transaction: transaction);
                            }
                            else if (req.SucursalId.HasValue)
                            {
                                terceroId = await connection.QueryFirstOrDefaultAsync<int?>(
                                    "SELECT id FROM public.terceros WHERE tipo_tercero = 'Alcaldía' AND sucursal_id = @sucursalId LIMIT 1",
                                    new { sucursalId = req.SucursalId.Value }, transaction: transaction);
                                if (!terceroId.HasValue)
                                {
                                    terceroId = await connection.QueryFirstOrDefaultAsync<int?>(
                                        "SELECT id FROM public.terceros WHERE tipo_tercero = 'Alcaldía' LIMIT 1", transaction: transaction);
                                }
                            }

                            decimal montoBase = Math.Round(pm.Monto / (porcentaje / 100m), 4);

                            await connection.ExecuteAsync(@"
                                INSERT INTO caja.retencion 
                                    (recibo_id, factura_id, tercero_id, tipo_retencion, concepto, monto_base, porcentaje, monto_retencion, numero_comprobante, fecha)
                                VALUES 
                                    (@reciboId, @primeraFacturaId, @terceroId, @tipoRet, @concepto, @montoBase, @porcentaje, @montoRetencion, @referencia, @fecha)",
                                new {
                                    reciboId,
                                    primeraFacturaId,
                                    terceroId,
                                    tipoRet,
                                    concepto,
                                    montoBase,
                                    porcentaje,
                                    montoRetencion = pm.Monto,
                                    referencia = pm.Referencia,
                                    fecha = req.Fecha ?? DateTime.Today
                                }, transaction);
                        }

                        // If NOTA_CREDITO method is used, update ventas.notas_credito!
                        if (pm.MetodoPago == "NOTA_CREDITO" && pm.NotaCreditoId.HasValue && pm.Monto > 0)
                        {
                            var nc = await connection.QueryFirstOrDefaultAsync(@"
                                SELECT id, monto_saldo, monto_aplicado, numero_nota_credito 
                                FROM ventas.notas_credito 
                                WHERE id = @ncId AND estado IN ('DISPONIBLE', 'PARCIAL')",
                                new { ncId = pm.NotaCreditoId.Value }, transaction);

                            if (nc == null)
                            {
                                throw new Exception($"La Nota de Crédito ID {pm.NotaCreditoId} no existe o no está disponible.");
                            }

                            decimal saldoNc = (decimal)nc.monto_saldo;
                            if (pm.Monto > saldoNc + 0.0001m)
                            {
                                throw new Exception($"El monto a aplicar de la Nota de Crédito #{nc.numero_nota_credito} (C$ {pm.Monto:N2}) excede su saldo disponible (C$ {saldoNc:N2}).");
                            }

                            decimal nuevoAplicado = (decimal)nc.monto_aplicado + pm.Monto;
                            decimal nuevoSaldo = saldoNc - pm.Monto;
                            bool estaAplicada = nuevoSaldo <= 0.001m;
                            string nuevoEstado = estaAplicada ? "APLICADA" : "PARCIAL";

                            await connection.ExecuteAsync(@"
                                UPDATE ventas.notas_credito 
                                SET monto_aplicado = @nuevoAplicado,
                                    monto_saldo = @nuevoSaldo,
                                    aplicada = @estaAplicada,
                                    estado = @nuevoEstado,
                                    recibo_caja_id = @reciboId,
                                    factura_aplicada_id = COALESCE(@primeraFacturaId, factura_aplicada_id),
                                    fecha_aplicacion = NOW()
                                WHERE id = @ncId",
                                new { nuevoAplicado, nuevoSaldo, estaAplicada, nuevoEstado, reciboId, primeraFacturaId, ncId = pm.NotaCreditoId.Value }, transaction);
                        }
                    }
                }
                else
                {
                    // Single payment method default record in recibo_metodos_pago & metodo_pago
                    await connection.ExecuteAsync(@"
                        INSERT INTO caja.recibo_metodos_pago 
                            (recibo_id, metodo_pago, monto, banco_tarjeta, referencia)
                        VALUES 
                            (@reciboId, @MetodoPago, @ImporteTotal, @BancoTarjeta, @Referencia)",
                        new { reciboId, req.MetodoPago, req.ImporteTotal, req.BancoTarjeta, req.Referencia }, transaction);

                    await connection.ExecuteAsync(@"
                        INSERT INTO caja.metodo_pago 
                            (recibo_id, factura_id, metodo_pago, monto, monto_factura, banco_tarjeta, referencia)
                        VALUES 
                            (@reciboId, @primeraFacturaId, @MetodoPago, @ImporteTotal, @ImporteTotal, @BancoTarjeta, @Referencia)",
                        new { reciboId, primeraFacturaId, req.MetodoPago, req.ImporteTotal, req.BancoTarjeta, req.Referencia }, transaction);

                    if (req.MetodoPago == "RETENCION_IR" || req.MetodoPago == "RETENCION_ALCALDIA")
                    {
                        bool isIr = req.MetodoPago == "RETENCION_IR";
                        decimal porcentaje = isIr ? 2.00m : 1.00m;
                        string tipoRet = isIr ? "RETENCION_IR_2" : "RETENCION_MUNICIPAL_1";
                        string concepto = isIr ? "Retención IR en la Fuente (2%) por Cobrar DGI" : "Retención Municipal (1%) por Cobrar Alcaldía";

                        int? terceroId = null;
                        if (isIr)
                        {
                            terceroId = await connection.QueryFirstOrDefaultAsync<int?>(
                                "SELECT id FROM public.terceros WHERE tipo_tercero = 'DGI' LIMIT 1", transaction: transaction);
                        }
                        else if (req.SucursalId.HasValue)
                        {
                            terceroId = await connection.QueryFirstOrDefaultAsync<int?>(
                                "SELECT id FROM public.terceros WHERE tipo_tercero = 'Alcaldía' AND sucursal_id = @sucursalId LIMIT 1",
                                new { sucursalId = req.SucursalId.Value }, transaction: transaction);
                            if (!terceroId.HasValue)
                            {
                                terceroId = await connection.QueryFirstOrDefaultAsync<int?>(
                                    "SELECT id FROM public.terceros WHERE tipo_tercero = 'Alcaldía' LIMIT 1", transaction: transaction);
                            }
                        }

                        decimal montoBase = Math.Round(req.ImporteTotal / (porcentaje / 100m), 4);

                        await connection.ExecuteAsync(@"
                            INSERT INTO caja.retencion 
                                (recibo_id, factura_id, tercero_id, tipo_retencion, concepto, monto_base, porcentaje, monto_retencion, numero_comprobante, fecha)
                            VALUES 
                                (@reciboId, @primeraFacturaId, @terceroId, @tipoRet, @concepto, @montoBase, @porcentaje, @ImporteTotal, @Referencia, @fecha)",
                            new {
                                reciboId,
                                primeraFacturaId,
                                terceroId,
                                tipoRet,
                                concepto,
                                montoBase,
                                porcentaje,
                                req.ImporteTotal,
                                req.Referencia,
                                fecha = req.Fecha ?? DateTime.Today
                            }, transaction);
                    }
                }

                // Process each invoice payment
                foreach (var detalle in req.Detalles)
                {
                    // Insert detail
                    await connection.ExecuteAsync(@"
                        INSERT INTO caja.recibos_caja_detalle 
                            (recibo_id, factura_id, monto_aplicado, es_parcial)
                        VALUES 
                            (@reciboId, @facturaId, @montoAplicado, @esParcial)",
                        new { reciboId, detalle.FacturaId, detalle.MontoAplicado, detalle.EsParcial },
                        transaction);

                    // Update invoice status
                    if (detalle.EsParcial)
                    {
                        // Partial payment: keep PENDIENTE but change estado to AP
                        await connection.ExecuteAsync(@"
                            UPDATE ventas.facturas 
                            SET estado = 'AP'
                            WHERE id = @facturaId",
                            new { detalle.FacturaId }, transaction);
                    }
                    else
                    {
                        // Full payment: mark as PAGADO / AP
                        await connection.ExecuteAsync(@"
                            UPDATE ventas.facturas 
                            SET estado_pago = 'PAGADO', estado = 'AP'
                            WHERE id = @facturaId",
                            new { detalle.FacturaId }, transaction);
                    }
                }

                await transaction.CommitAsync();
                return Ok(new { Success = true, ReciboId = reciboId });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { Error = ex.Message });
            }
        }

        // POST /api/caja/egreso-caja-chica
        [HttpPost("egreso-caja-chica")]
        public async Task<IActionResult> EgresoCajaChica([FromBody] EgresoRequest req)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();

            if (!req.SucursalId.HasValue)
                return BadRequest(new { Error = "Debe especificar la sucursal para registrar el egreso." });

            var arqueoActivo = await connection.QueryFirstOrDefaultAsync(
                "SELECT id, efectivo_inicio, fecha FROM caja.arqueos_caja WHERE estado = 'ABIERTO' AND sucursal_id = @sucursalId",
                new { req.SucursalId });
            
            if (arqueoActivo == null)
                return BadRequest(new { Error = "No hay una caja abierta para esta sucursal." });

            if (req.MetodoPago == "EFECTIVO")
            {
                var totales = await connection.QueryFirstOrDefaultAsync(@"
                    SELECT 
                        COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN importe_total ELSE 0 END), 0) as ingresos,
                        COALESCE(SUM(CASE WHEN tipo = 'EGRESO' THEN importe_total ELSE 0 END), 0) as egresos
                    FROM caja.recibos_caja
                    WHERE sucursal_id = @sucursalId 
                      AND fecha = @fecha::date 
                      AND metodo_pago = 'EFECTIVO'
                      AND estado <> 'ANULADO'",
                    new { req.SucursalId, fecha = arqueoActivo.fecha });

                decimal disp = (decimal)arqueoActivo.efectivo_inicio + (decimal)(totales?.ingresos ?? 0) - (decimal)(totales?.egresos ?? 0);
                if (req.Importe > disp)
                    return BadRequest(new { Error = $"Fondos insuficientes en efectivo. Disponible: C$ {disp:N2}" });
            }

            var insertEgreso = @"
                INSERT INTO caja.recibos_caja 
                    (serie, numero, fecha, descripcion, importe_total, metodo_pago, sucursal_id, tipo, nombre_recibe)
                VALUES 
                    (@serie, @numero, @fecha, @descripcion, @importe, @metodoPago, @sucursalId, 'EGRESO', @nombreRecibe)
                RETURNING id";

            var id = await connection.QuerySingleAsync<long>(insertEgreso, new
            {
                req.Serie,
                req.Numero,
                fecha = req.Fecha ?? DateTime.Today,
                req.Descripcion,
                req.Importe,
                req.MetodoPago,
                req.SucursalId,
                req.NombreRecibe
            });

            return Ok(new { Success = true, Id = id });
        }

        // GET /api/caja/recibos?tipo=INGRESO|EGRESO&startDate=&endDate=&sucursalId=
        [HttpGet("recibos")]
        public async Task<IActionResult> GetRecibos(
            [FromQuery] string? tipo,
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate,
            [FromQuery] string? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);

            int? parsedSucursalId = null;
            if (!string.IsNullOrEmpty(sucursalId) && sucursalId != "null" && sucursalId != "undefined" && int.TryParse(sucursalId, out int sid) && sid > 0)
            {
                parsedSucursalId = sid;
            }

            var conditions = new List<string>();
            if (!string.IsNullOrEmpty(tipo)) conditions.Add("rc.tipo = @tipo");
            if (startDate.HasValue) conditions.Add("rc.fecha >= @startDate::date");
            if (endDate.HasValue) conditions.Add("rc.fecha <= @endDate::date");
            if (parsedSucursalId.HasValue) conditions.Add("rc.sucursal_id = @sucursalId");
            var where = conditions.Count > 0 ? "WHERE " + string.Join(" AND ", conditions) : "";

            var query = $@"
                SELECT 
                    rc.id,
                    rc.serie as Serie,
                    rc.numero as Numero,
                    rc.fecha as Fecha,
                    rc.tipo as Tipo,
                    rc.metodo_pago as MetodoPago,
                    rc.descripcion as Descripcion,
                    rc.importe_total as ImporteTotal,
                    rc.estado as Estado,
                    rc.nombre_recibe as NombreRecibe,
                    s.nombre as Sucursal,
                    c.nombre as Cliente,
                    c.identificacion as ClienteIdentificacion,
                    COALESCE((SELECT string_agg(DISTINCT rmp.banco_tarjeta, ', ') FROM caja.recibo_metodos_pago rmp WHERE rmp.recibo_id = rc.id AND rmp.banco_tarjeta IS NOT NULL AND rmp.banco_tarjeta <> ''), '') as BancoCuenta,
                    COALESCE((SELECT string_agg(DISTINCT rmp.referencia, ', ') FROM caja.recibo_metodos_pago rmp WHERE rmp.recibo_id = rc.id AND rmp.referencia IS NOT NULL AND rmp.referencia <> ''), '') as Referencia,
                    COALESCE((SELECT string_agg(DISTINCT f.numero, ', ') FROM caja.recibos_caja_detalle rcd JOIN ventas.facturas f ON rcd.factura_id = f.id WHERE rcd.recibo_id = rc.id), '') as Facturas
                FROM caja.recibos_caja rc
                LEFT JOIN public.sucursales s ON rc.sucursal_id = s.id
                LEFT JOIN ventas.clientes c ON rc.cliente_id = c.id
                {where}
                ORDER BY rc.fecha DESC, rc.created_at DESC";

            var result = await connection.QueryAsync(query, new { tipo, startDate, endDate, sucursalId = parsedSucursalId });
            return Ok(result);
        }

        // POST /api/caja/apertura
        [HttpPost("apertura")]
        public async Task<IActionResult> AbrirCaja([FromBody] AperturaCajaRequest req)
        {
            using var connection = new NpgsqlConnection(_connectionString);

            // Check if there's already an open arqueo for today/sucursal
            var existing = await connection.QueryFirstOrDefaultAsync<long?>(@"
                SELECT id FROM caja.arqueos_caja 
                WHERE estado = 'ABIERTO' AND sucursal_id = @sucursalId",
                new { req.SucursalId });

            if (existing.HasValue)
                return BadRequest(new { Error = "Ya existe una caja abierta para esta sucursal." });

            var id = await connection.QuerySingleAsync<long>(@"
                INSERT INTO caja.arqueos_caja 
                    (tipo, fecha, sucursal_id, efectivo_inicio, observaciones, estado)
                VALUES 
                    ('APERTURA', @fecha, @sucursalId, @efectivoInicio, @observaciones, 'ABIERTO')
                RETURNING id",
                new
                {
                    fecha = req.Fecha ?? DateTime.Today,
                    req.SucursalId,
                    req.EfectivoInicio,
                    req.Observaciones
                });

            return Ok(new { Success = true, Id = id });
        }

        // POST /api/caja/cierre
        [HttpPost("cierre")]
        public async Task<IActionResult> CerrarCaja([FromBody] CierreCajaRequest req)
        {
            using var connection = new NpgsqlConnection(_connectionString);

            // Get totals for today/sucursal
            var totales = await connection.QueryFirstOrDefaultAsync(@"
                SELECT 
                    COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN importe_total ELSE 0 END), 0) as TotalIngresos,
                    COALESCE(SUM(CASE WHEN tipo = 'EGRESO' THEN importe_total ELSE 0 END), 0) as TotalEgresos
                FROM caja.recibos_caja
                WHERE sucursal_id = @sucursalId AND fecha = @fecha::date",
                new { req.SucursalId, fecha = req.Fecha ?? DateTime.Today });

            decimal totalIngresos = (decimal)(totales?.totalingresos ?? 0);
            decimal totalEgresos = (decimal)(totales?.totalegresos ?? 0);
            decimal diferencia = req.EfectivoFin - (req.EfectivoInicio + totalIngresos - totalEgresos);

            // Update existing open arqueo directly
            await connection.ExecuteAsync(@"
                UPDATE caja.arqueos_caja 
                SET estado = 'CERRADO', efectivo_fin = @efectivoFin, 
                    total_ingresos = @totalIngresos, total_egresos = @totalEgresos,
                    diferencia = @diferencia, observaciones = @observaciones
                WHERE estado = 'ABIERTO' AND sucursal_id = @sucursalId",
                new
                {
                    req.EfectivoFin,
                    totalIngresos,
                    totalEgresos,
                    diferencia,
                    req.Observaciones,
                    req.SucursalId
                });

            return Ok(new { Success = true, TotalIngresos = totalIngresos, TotalEgresos = totalEgresos, Diferencia = diferencia });
        }

        // POST /api/caja/anular-recibo/{id}
        [HttpPost("anular-recibo/{id}")]
        public async Task<IActionResult> AnularRecibo(long id)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            using var transaction = await connection.BeginTransactionAsync();
            try
            {
                // Get the recibo
                var recibo = await connection.QueryFirstOrDefaultAsync(
                    "SELECT id, tipo, estado FROM caja.recibos_caja WHERE id = @id",
                    new { id }, transaction);

                if (recibo == null)
                    return NotFound(new { Error = "Recibo no encontrado." });

                if (recibo.estado == "ANULADO")
                    return BadRequest(new { Error = "El recibo ya está anulado." });

                // Mark the recibo as ANULADO
                await connection.ExecuteAsync(
                    "UPDATE caja.recibos_caja SET estado = 'ANULADO' WHERE id = @id",
                    new { id }, transaction);

                // If it was an INGRESO, reverse the invoice payments
                if (recibo.tipo == "INGRESO")
                {
                    // Get all detail records for this recibo
                    var detalles = await connection.QueryAsync(
                        "SELECT factura_id, monto_aplicado FROM caja.recibos_caja_detalle WHERE recibo_id = @id",
                        new { id }, transaction);

                    foreach (var d in detalles)
                    {
                        // Recalculate total paid for this factura excluding this recibo
                        var totalPagado = await connection.QuerySingleAsync<decimal>(@"
                            SELECT COALESCE(SUM(rcd.monto_aplicado), 0)
                            FROM caja.recibos_caja_detalle rcd
                            JOIN caja.recibos_caja rc ON rc.id = rcd.recibo_id
                            WHERE rcd.factura_id = @facturaId AND rc.estado <> 'ANULADO' AND rcd.recibo_id <> @reciboId",
                            new { facturaId = d.factura_id, reciboId = id }, transaction);

                        var facturaActual = await connection.QueryFirstOrDefaultAsync<(string? Estado, decimal Total)>(
                            "SELECT estado as Estado, total as Total FROM ventas.facturas WHERE id = @facturaId",
                            new { facturaId = d.factura_id }, transaction);

                        string nuevoEstadoPago = totalPagado >= facturaActual.Total ? "PAGADO" : "PENDIENTE";
                        bool esAnulada = facturaActual.Estado?.ToUpper() == "AN" || facturaActual.Estado?.ToUpper() == "ANULADA";

                        if (!esAnulada)
                        {
                            string nuevoEstado = totalPagado >= facturaActual.Total ? "AP" : (totalPagado > 0 ? "AP" : "PE");
                            await connection.ExecuteAsync(
                                "UPDATE ventas.facturas SET estado_pago = @nuevoEstadoPago, estado = @nuevoEstado WHERE id = @facturaId",
                                new { nuevoEstadoPago, nuevoEstado, facturaId = d.factura_id }, transaction);
                        }
                        else
                        {
                            await connection.ExecuteAsync(
                                "UPDATE ventas.facturas SET estado_pago = @nuevoEstadoPago WHERE id = @facturaId",
                                new { nuevoEstadoPago, facturaId = d.factura_id }, transaction);
                        }
                    }

                    // Reverse any Notas de Crédito applied in this receipt
                    var ncMetodos = await connection.QueryAsync(@"
                        SELECT nota_credito_id, monto 
                        FROM caja.recibo_metodos_pago 
                        WHERE recibo_id = @id AND metodo_pago = 'NOTA_CREDITO' AND nota_credito_id IS NOT NULL",
                        new { id }, transaction);

                    foreach (var nc in ncMetodos)
                    {
                        long ncId = (long)nc.nota_credito_id;
                        decimal montoRevertir = (decimal)nc.monto;

                        var ncObj = await connection.QueryFirstOrDefaultAsync(
                            "SELECT monto_aplicado, monto_saldo, monto_total FROM ventas.notas_credito WHERE id = @ncId",
                            new { ncId }, transaction);

                        if (ncObj != null)
                        {
                            decimal nuevoAplicado = Math.Max(0, (decimal)ncObj.monto_aplicado - montoRevertir);
                            decimal nuevoSaldo = (decimal)ncObj.monto_total - nuevoAplicado;
                            string nuevoEstadoNC = nuevoAplicado <= 0 ? "DISPONIBLE" : "PARCIAL";
                            bool aplicadaNC = nuevoSaldo <= 0.001m;

                            await connection.ExecuteAsync(@"
                                UPDATE ventas.notas_credito
                                SET monto_aplicado = @nuevoAplicado,
                                    monto_saldo = @nuevoSaldo,
                                    aplicada = @aplicadaNC,
                                    estado = @nuevoEstadoNC
                                WHERE id = @ncId",
                                new { nuevoAplicado, nuevoSaldo, aplicadaNC, nuevoEstadoNC, ncId }, transaction);
                        }
                    }
                }

                await transaction.CommitAsync();
                return Ok(new { Success = true, Message = "Recibo anulado correctamente." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { Error = ex.Message });
            }
        }

        // GET /api/caja/arqueo-activo?sucursalId=
        [HttpGet("arqueo-activo")]
        public async Task<IActionResult> GetArqueoActivo([FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var conditions = new List<string> { "a.estado = 'ABIERTO'" };
            if (sucursalId.HasValue) conditions.Add("a.sucursal_id = @sucursalId");
            var where = "WHERE " + string.Join(" AND ", conditions);

            var query = $@"
                SELECT a.*, s.nombre as Sucursal
                FROM caja.arqueos_caja a
                LEFT JOIN public.sucursales s ON a.sucursal_id = s.id
                {where}
                ORDER BY a.created_at DESC
                LIMIT 1";

            var result = await connection.QueryFirstOrDefaultAsync(query, new { sucursalId });
            return Ok(result);
        }

        // GET /api/caja/arqueos?sucursalId=&startDate=&endDate=
        [HttpGet("arqueos")]
        public async Task<IActionResult> GetArqueos(
            [FromQuery] int? sucursalId,
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var conditions = new List<string>();
            if (sucursalId.HasValue) conditions.Add("a.sucursal_id = @sucursalId");
            if (startDate.HasValue) conditions.Add("a.fecha >= @startDate::date");
            if (endDate.HasValue) conditions.Add("a.fecha <= @endDate::date");
            var where = conditions.Count > 0 ? "WHERE " + string.Join(" AND ", conditions) : "";

            var query = $@"
                SELECT 
                    a.id, a.tipo, a.fecha, a.sucursal_id, a.efectivo_inicio, a.efectivo_fin, a.total_ingresos, a.total_egresos, a.diferencia, a.observaciones, a.estado, a.created_at,
                    s.nombre as Sucursal,
                    COALESCE((SELECT SUM(importe_total) FROM caja.recibos_caja WHERE sucursal_id = a.sucursal_id AND fecha = a.fecha AND tipo = 'INGRESO' AND estado <> 'ANULADO'), 0) as calc_ingresos,
                    COALESCE((SELECT SUM(importe_total) FROM caja.recibos_caja WHERE sucursal_id = a.sucursal_id AND fecha = a.fecha AND tipo = 'EGRESO' AND estado <> 'ANULADO'), 0) as calc_egresos,
                    COALESCE((SELECT SUM(importe_total) FROM caja.recibos_caja WHERE sucursal_id = a.sucursal_id AND fecha = a.fecha AND tipo = 'INGRESO' AND metodo_pago = 'EFECTIVO' AND estado <> 'ANULADO'), 0) -
                    COALESCE((SELECT SUM(importe_total) FROM caja.recibos_caja WHERE sucursal_id = a.sucursal_id AND fecha = a.fecha AND tipo = 'EGRESO' AND metodo_pago = 'EFECTIVO' AND estado <> 'ANULADO'), 0) as calc_efectivo_mov,
                    COALESCE((SELECT SUM(importe_total) FROM caja.recibos_caja WHERE sucursal_id = a.sucursal_id AND fecha = a.fecha AND metodo_pago = 'TRANSFERENCIA' AND estado <> 'ANULADO'), 0) as calc_transferencias,
                    COALESCE((SELECT SUM(importe_total) FROM caja.recibos_caja WHERE sucursal_id = a.sucursal_id AND fecha = a.fecha AND metodo_pago = 'DEPOSITO' AND estado <> 'ANULADO'), 0) as calc_depositos,
                    COALESCE((SELECT SUM(importe_total) FROM caja.recibos_caja WHERE sucursal_id = a.sucursal_id AND fecha = a.fecha AND metodo_pago = 'TARJETA' AND estado <> 'ANULADO'), 0) as calc_tarjetas
                FROM caja.arqueos_caja a
                LEFT JOIN public.sucursales s ON a.sucursal_id = s.id
                {where}
                ORDER BY a.fecha DESC, a.created_at DESC";

            var result = await connection.QueryAsync(query, new { sucursalId, startDate, endDate });
            return Ok(result);
        }

        // GET /api/caja/facturas-mes?sucursalId=&startDate=&endDate=
        [HttpGet("facturas-mes")]
        public async Task<IActionResult> GetFacturasMes(
            [FromQuery] int? sucursalId,
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var conditions = new List<string>
            {
                "s.nombre <> 'Los Arcos'"
            };

            if (sucursalId.HasValue) conditions.Add("f.sucursal_id = @sucursalId");
            if (startDate.HasValue) conditions.Add("f.fecha >= @startDate");
            if (endDate.HasValue) conditions.Add("f.fecha <= @endDate");

            var where = "WHERE " + string.Join(" AND ", conditions);

            var query = $@"
                SELECT 
                    f.id,
                    f.numero as NumeroFactura,
                    f.fecha as Fecha,
                    f.fecha_vencimiento as FechaVencimiento,
                    c.id as ClienteId,
                    c.nombre as Cliente,
                    s.nombre as Sucursal,
                    f.sub_total as SubTotal,
                    f.iva as IVA,
                    f.total as Total,
                    f.estado_pago as EstadoPago,
                    f.estado as Estado
                FROM ventas.facturas f
                JOIN ventas.clientes c ON f.cliente_id = c.id
                JOIN public.sucursales s ON f.sucursal_id = s.id
                {where}
                ORDER BY f.fecha DESC, f.numero DESC";

            var result = await connection.QueryAsync(query, new { sucursalId, startDate, endDate });
            return Ok(result);
        }

        // GET /api/caja/usuarios-activos
        [HttpGet("usuarios-activos")]
        public async Task<IActionResult> GetUsuariosActivos()
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var query = "SELECT id, user_name as UserName, full_name as FullName FROM public.users WHERE active = true ORDER BY full_name";
            var result = await connection.QueryAsync(query);
            return Ok(result);
        }

        // POST /api/caja/cambiar-numero-factura
        [HttpPost("cambiar-numero-factura")]
        public async Task<IActionResult> CambiarNumeroFactura([FromBody] CambiarNumeroFacturaRequest req)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();

            if (string.IsNullOrEmpty(req.Username) || string.IsNullOrEmpty(req.Password))
                return BadRequest(new { Error = "Usuario y contraseña son requeridos." });

            var user = await connection.QueryFirstOrDefaultAsync(@"
                SELECT u.id, u.user_name
                FROM public.users u
                WHERE LOWER(u.user_name) = LOWER(@Username) AND u.active = true",
                new { req.Username });

            if (user == null)
                return BadRequest(new { Error = "Usuario no encontrado o inactivo." });

            string passwordHashSha256 = "";
            using (var sha256 = System.Security.Cryptography.SHA256.Create())
            {
                var bytes = System.Text.Encoding.UTF8.GetBytes(req.Password);
                var hash = sha256.ComputeHash(bytes);
                passwordHashSha256 = Convert.ToHexString(hash);
            }

            string passwordHashMd5 = "";
            using (var md5 = System.Security.Cryptography.MD5.Create())
            {
                var bytes = System.Text.Encoding.UTF8.GetBytes(req.Password);
                var hash = md5.ComputeHash(bytes);
                passwordHashMd5 = Convert.ToHexString(hash);
            }

            var passwordRecord = await connection.QueryFirstOrDefaultAsync(@"
                SELECT user_id 
                FROM public.users_password 
                WHERE user_id = @UserId 
                  AND (
                    LOWER(password) = LOWER(@PasswordHashSha256) 
                    OR LOWER(password) = LOWER(@PasswordHashMd5) 
                    OR password = @Password
                  ) 
                  AND (activo IS NOT FALSE)",
                new { 
                    UserId = user.id, 
                    PasswordHashSha256 = passwordHashSha256, 
                    PasswordHashMd5 = passwordHashMd5, 
                    req.Password 
                });

            if (passwordRecord == null)
                return BadRequest(new { Error = "Contraseña incorrecta." });

            var factura = await connection.QueryFirstOrDefaultAsync(@"
                SELECT id, numero FROM ventas.facturas WHERE id = @FacturaId",
                new { req.FacturaId });

            if (factura == null)
                return NotFound(new { Error = "Factura no encontrada." });

            var exists = await connection.QueryFirstOrDefaultAsync<long?>(@"
                SELECT id FROM ventas.facturas WHERE numero = @NuevoNumero AND id <> @FacturaId",
                new { NuevoNumero = req.NuevoNumero, req.FacturaId });

            if (exists.HasValue)
                return BadRequest(new { Error = "El número de factura especificado ya existe." });

            await connection.ExecuteAsync(@"
                UPDATE ventas.facturas 
                SET numero = @NuevoNumero 
                WHERE id = @FacturaId",
                new { req.NuevoNumero, req.FacturaId });

            return Ok(new { Success = true, Message = "Número de factura actualizado correctamente." });
        }

        // GET /api/caja/notas-credito?sucursalId=&clienteId=&estado=
        [HttpGet("notas-credito")]
        public async Task<IActionResult> GetNotasCredito(
            [FromQuery] int? sucursalId,
            [FromQuery] long? clienteId,
            [FromQuery] string? estado,
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var conditions = new List<string>();
            if (sucursalId.HasValue) conditions.Add("nc.sucursal_id = @sucursalId");
            if (clienteId.HasValue) conditions.Add("nc.cliente_id = @clienteId");
            if (!string.IsNullOrEmpty(estado)) conditions.Add("LOWER(nc.estado) = LOWER(@estado)");
            if (startDate.HasValue) conditions.Add("nc.fecha_emision >= @startDate");
            if (endDate.HasValue) conditions.Add("nc.fecha_emision <= @endDate");

            var where = conditions.Count > 0 ? "WHERE " + string.Join(" AND ", conditions) : "";

            var query = $@"
                SELECT 
                    nc.id,
                    nc.numero_nota_credito as NumeroNotaCredito,
                    nc.devolucion_id as DevolucionId,
                    COALESCE(d.numero_devolucion, 'S/D') as NumeroDevolucion,
                    COALESCE(f_orig.numero, 'N/A') as NumeroFacturaOrigen,
                    nc.cliente_id as ClienteId,
                    c.nombre as Cliente,
                    nc.sucursal_id as SucursalId,
                    s.nombre as Sucursal,
                    nc.fecha_emision as FechaEmision,
                    nc.monto_subtotal as MontoSubtotal,
                    nc.monto_iva as MontoIva,
                    nc.monto_total as MontoTotal,
                    nc.monto_aplicado as MontoAplicado,
                    nc.monto_saldo as MontoSaldo,
                    nc.aplicada as Aplicada,
                    nc.estado as Estado,
                    r_app.numero as ReciboAplicadoNumero,
                    f_app.numero as FacturaAplicadaNumero,
                    nc.fecha_aplicacion as FechaAplicacion,
                    nc.observacion as Observacion
                FROM ventas.notas_credito nc
                LEFT JOIN ventas.devoluciones d ON nc.devolucion_id = d.id
                LEFT JOIN ventas.facturas f_orig ON d.factura_id = f_orig.id
                JOIN ventas.clientes c ON nc.cliente_id = c.id
                JOIN public.sucursales s ON nc.sucursal_id = s.id
                LEFT JOIN caja.recibos_caja r_app ON nc.recibo_caja_id = r_app.id
                LEFT JOIN ventas.facturas f_app ON nc.factura_aplicada_id = f_app.id
                {where}
                ORDER BY nc.fecha_emision DESC, nc.id DESC";

            var result = await connection.QueryAsync(query, new { sucursalId, clienteId, estado, startDate, endDate });
            return Ok(result);
        }

        // POST /api/caja/crear-nota-credito
        [HttpPost("crear-nota-credito")]
        public async Task<IActionResult> CrearNotaCredito([FromBody] CrearNotaCreditoRequest req)
        {
            if (req == null || req.ClienteId <= 0 || req.SucursalId <= 0 || req.MontoTotal <= 0)
                return BadRequest(new { Error = "Parámetros inválidos. Cliente, sucursal y monto total son requeridos." });

            using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            using var transaction = await connection.BeginTransactionAsync();

            try
            {
                DateTime fechaEmision = req.FechaEmision ?? DateTime.Today;
                string dateStr = fechaEmision.ToString("yyMMdd");

                var existingNCs = (await connection.QueryAsync<string>(@"
                    SELECT numero_nota_credito FROM ventas.notas_credito 
                    WHERE numero_nota_credito LIKE @pattern",
                    new { pattern = $"NC-{dateStr}-%" }, transaction)).ToList();

                int ncCounter = existingNCs.Count + 1;
                string numeroNC = $"NC-{dateStr}-{ncCounter:D3}";
                while (existingNCs.Contains(numeroNC))
                {
                    ncCounter++;
                    numeroNC = $"NC-{dateStr}-{ncCounter:D3}";
                }

                var id = await connection.ExecuteScalarAsync<long>(@"
                    INSERT INTO ventas.notas_credito (
                        numero_nota_credito, devolucion_id, cliente_id, sucursal_id,
                        fecha_emision, monto_subtotal, monto_iva, monto_total,
                        monto_aplicado, monto_saldo, aplicada, estado, observacion, created_at
                    ) VALUES (
                        @numeroNC, NULL, @ClienteId, @SucursalId,
                        @fechaEmision, @MontoSubtotal, @MontoIva, @MontoTotal,
                        0, @MontoTotal, false, 'DISPONIBLE', @Observacion, NOW()
                    ) RETURNING id;",
                    new {
                        numeroNC,
                        req.ClienteId,
                        req.SucursalId,
                        fechaEmision,
                        MontoSubtotal = req.MontoSubtotal,
                        MontoIva = req.MontoIva,
                        MontoTotal = req.MontoTotal,
                        Observacion = string.IsNullOrWhiteSpace(req.Observacion) ? "Nota de crédito a favor del cliente" : req.Observacion
                    }, transaction);

                await transaction.CommitAsync();
                return Ok(new { Success = true, Message = "Nota de Crédito creada exitosamente.", Id = id, NumeroNotaCredito = numeroNC });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { Error = ex.Message });
            }
        }

        // PUT /api/caja/editar-nota-credito/{id}
        [HttpPut("editar-nota-credito/{id}")]
        public async Task<IActionResult> EditarNotaCredito(long id, [FromBody] CrearNotaCreditoRequest req)
        {
            if (req == null) return BadRequest(new { Error = "Parámetros inválidos." });

            using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();

            var nc = await connection.QueryFirstOrDefaultAsync("SELECT * FROM ventas.notas_credito WHERE id = @id", new { id });
            if (nc == null) return NotFound(new { Error = "Nota de Crédito no encontrada." });

            decimal aplicado = (decimal)(nc.monto_aplicado ?? 0m);
            bool aplicada = nc.aplicada ?? false;
            string estado = (string)(nc.estado ?? "");

            if (aplicado > 0 || aplicada)
                return BadRequest(new { Error = "No se puede editar una Nota de Crédito que ya ha sido aplicada parcial o totalmente." });

            if (estado == "ANULADA")
                return BadRequest(new { Error = "No se puede editar una Nota de Crédito anulada." });

            decimal sub = req.MontoSubtotal;
            decimal iva = req.MontoIva;
            decimal tot = req.MontoTotal > 0 ? req.MontoTotal : sub + iva;

            await connection.ExecuteAsync(@"
                UPDATE ventas.notas_credito
                SET cliente_id = @ClienteId,
                    sucursal_id = @SucursalId,
                    fecha_emision = @FechaEmision,
                    monto_subtotal = @sub,
                    monto_iva = @iva,
                    monto_total = @tot,
                    monto_saldo = @tot,
                    observacion = @Observacion
                WHERE id = @id",
                new {
                    id,
                    req.ClienteId,
                    req.SucursalId,
                    FechaEmision = req.FechaEmision ?? DateTime.Today,
                    sub,
                    iva,
                    tot,
                    Observacion = string.IsNullOrWhiteSpace(req.Observacion) ? "Nota de crédito modificada" : req.Observacion
                });

            return Ok(new { Success = true, Message = "Nota de Crédito actualizada exitosamente." });
        }

        // POST /api/caja/anular-nota-credito/{id}
        [HttpPost("anular-nota-credito/{id}")]
        public async Task<IActionResult> AnularNotaCredito(long id)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();

            var nc = await connection.QueryFirstOrDefaultAsync("SELECT * FROM ventas.notas_credito WHERE id = @id", new { id });
            if (nc == null) return NotFound(new { Error = "Nota de Crédito no encontrada." });

            decimal aplicado = (decimal)(nc.monto_aplicado ?? 0m);
            bool aplicada = nc.aplicada ?? false;

            if (aplicado > 0 || aplicada)
                return BadRequest(new { Error = "No se puede anular una Nota de Crédito que ya ha sido aplicada." });

            await connection.ExecuteAsync(@"
                UPDATE ventas.notas_credito
                SET estado = 'ANULADA',
                    monto_saldo = 0
                WHERE id = @id", new { id });

            return Ok(new { Success = true, Message = "Nota de Crédito anulada correctamente." });
        }

        // POST /api/caja/aplicar-nota-credito
        [HttpPost("aplicar-nota-credito")]
        public async Task<IActionResult> AplicarNotaCredito([FromBody] AplicarNotaCreditoRequest req)
        {
            if (req == null || req.NotaCreditoId <= 0 || req.MontoAAplicar <= 0)
                return BadRequest(new { Error = "Parámetros inválidos." });

            using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            using var transaction = await connection.BeginTransactionAsync();

            try
            {
                var nc = await connection.QueryFirstOrDefaultAsync(@"
                    SELECT * FROM ventas.notas_credito WHERE id = @id",
                    new { id = req.NotaCreditoId }, transaction);

                if (nc == null)
                    return NotFound(new { Error = "Nota de Crédito no encontrada." });

                if ((bool)nc.aplicada || (string)nc.estado == "ANULADA")
                    return BadRequest(new { Error = "La Nota de Crédito ya se encuentra aplicada o anulada." });

                decimal saldoActual = (decimal)nc.monto_saldo;
                if (req.MontoAAplicar > saldoActual)
                    return BadRequest(new { Error = $"El monto a aplicar ({req.MontoAAplicar}) supera el saldo disponible ({saldoActual})." });

                decimal nuevoAplicado = (decimal)nc.monto_aplicado + req.MontoAAplicar;
                decimal nuevoSaldo = saldoActual - req.MontoAAplicar;
                bool estaAplicadaTotal = nuevoSaldo <= 0;
                string nuevoEstado = estaAplicadaTotal ? "APLICADA" : "PARCIAL";

                await connection.ExecuteAsync(@"
                    UPDATE ventas.notas_credito
                    SET monto_aplicado = @nuevoAplicado,
                        monto_saldo = @nuevoSaldo,
                        aplicada = @estaAplicadaTotal,
                        estado = @nuevoEstado,
                        recibo_caja_id = COALESCE(@reciboId, recibo_caja_id),
                        factura_aplicada_id = COALESCE(@facturaId, factura_aplicada_id),
                        fecha_aplicacion = NOW()
                    WHERE id = @id",
                    new {
                        nuevoAplicado,
                        nuevoSaldo,
                        estaAplicadaTotal,
                        nuevoEstado,
                        reciboId = req.ReciboCajaId,
                        facturaId = req.FacturaAplicadaId,
                        id = req.NotaCreditoId
                    }, transaction);

                await transaction.CommitAsync();
                return Ok(new { Success = true, Message = "Nota de crédito aplicada correctamente." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { Error = ex.Message });
            }
        }

        // PUT /api/caja/editar-metodo-pago/{id}
        [HttpPut("editar-metodo-pago/{id}")]
        public async Task<IActionResult> EditarMetodoPago(long id, [FromBody] EditarMetodoPagoRequest req)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            using var transaction = await connection.BeginTransactionAsync();

            try
            {
                var recibo = await connection.QueryFirstOrDefaultAsync(
                    "SELECT id, estado, importe_total FROM caja.recibos_caja WHERE id = @id",
                    new { id }, transaction);

                if (recibo == null)
                    return NotFound(new { Error = "Recibo no encontrado." });

                if (recibo.estado == "ANULADO")
                    return BadRequest(new { Error = "No se puede editar un recibo anulado." });

                string finalMetodoHeader = req.MetodoPago;
                if (req.MetodosPago != null && req.MetodosPago.Count > 0)
                {
                    var nombres = req.MetodosPago
                        .Where(m => m.Monto > 0)
                        .Select(m => m.MetodoPago == "NOTA_CREDITO" ? "NOTA CREDITO" : m.MetodoPago)
                        .Distinct();
                    finalMetodoHeader = "MULTIPLE (" + string.Join(", ", nombres) + ")";
                    if (finalMetodoHeader.Length > 140) finalMetodoHeader = finalMetodoHeader.Substring(0, 140);
                }

                // Update receipt header
                await connection.ExecuteAsync(
                    "UPDATE caja.recibos_caja SET metodo_pago = @finalMetodoHeader WHERE id = @id",
                    new { finalMetodoHeader, id }, transaction);

                // Clear existing breakdown
                await connection.ExecuteAsync(
                    "DELETE FROM caja.recibo_metodos_pago WHERE recibo_id = @id",
                    new { id }, transaction);

                // Re-insert metodos breakdown
                if (req.MetodosPago != null && req.MetodosPago.Count > 0)
                {
                    foreach (var pm in req.MetodosPago.Where(x => x.Monto > 0))
                    {
                        await connection.ExecuteAsync(@"
                            INSERT INTO caja.recibo_metodos_pago 
                                (recibo_id, metodo_pago, monto, nota_credito_id, banco_tarjeta, referencia)
                            VALUES 
                                (@reciboId, @MetodoPago, @Monto, @NotaCreditoId, @BancoTarjeta, @Referencia)",
                            new { reciboId = id, pm.MetodoPago, pm.Monto, pm.NotaCreditoId, pm.BancoTarjeta, pm.Referencia }, transaction);
                    }
                }
                else
                {
                    await connection.ExecuteAsync(@"
                        INSERT INTO caja.recibo_metodos_pago 
                            (recibo_id, metodo_pago, monto, banco_tarjeta, referencia)
                        VALUES 
                            (@reciboId, @MetodoPago, @importeTotal, @BancoTarjeta, @Referencia)",
                        new { reciboId = id, req.MetodoPago, importeTotal = (decimal)recibo.importe_total, req.BancoTarjeta, req.Referencia }, transaction);
                }

                await transaction.CommitAsync();
                return Ok(new { Success = true, Message = "Método de pago del recibo actualizado correctamente." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { Error = ex.Message });
            }
        }

        // PUT /api/caja/editar-recibo/{id}
        [HttpPut("editar-recibo/{id}")]
        public async Task<IActionResult> EditarRecibo(long id, [FromBody] EditarReciboRequest req)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            using var transaction = await connection.BeginTransactionAsync();

            try
            {
                var recibo = await connection.QueryFirstOrDefaultAsync(
                    "SELECT id, estado, importe_total FROM caja.recibos_caja WHERE id = @id",
                    new { id }, transaction);

                if (recibo == null)
                    return NotFound(new { Error = "Recibo no encontrado." });

                if (recibo.estado == "ANULADO")
                    return BadRequest(new { Error = "No se puede editar un recibo anulado." });

                string finalMetodoHeader = req.MetodoPago;
                if (req.MetodosPago != null && req.MetodosPago.Count > 0)
                {
                    var nombres = req.MetodosPago
                        .Where(m => m.Monto > 0)
                        .Select(m => m.MetodoPago == "NOTA_CREDITO" ? "NOTA CREDITO" : m.MetodoPago)
                        .Distinct();
                    finalMetodoHeader = "MULTIPLE (" + string.Join(", ", nombres) + ")";
                    if (finalMetodoHeader.Length > 140) finalMetodoHeader = finalMetodoHeader.Substring(0, 140);
                }

                decimal nuevoImporte = req.ImporteTotal ?? (decimal)recibo.importe_total;

                // Update receipt header with full fields
                await connection.ExecuteAsync(@"
                    UPDATE caja.recibos_caja 
                    SET serie = COALESCE(@Serie, serie),
                        numero = COALESCE(@Numero, numero),
                        fecha = COALESCE(@Fecha, fecha),
                        cliente_id = COALESCE(@ClienteId, cliente_id),
                        sucursal_id = COALESCE(@SucursalId, sucursal_id),
                        descripcion = COALESCE(@Descripcion, descripcion),
                        importe_total = @nuevoImporte,
                        metodo_pago = @finalMetodoHeader
                    WHERE id = @id",
                    new {
                        id,
                        req.Serie,
                        req.Numero,
                        req.Fecha,
                        req.ClienteId,
                        req.SucursalId,
                        req.Descripcion,
                        nuevoImporte,
                        finalMetodoHeader
                    }, transaction);

                // Clear existing breakdown
                await connection.ExecuteAsync(
                    "DELETE FROM caja.recibo_metodos_pago WHERE recibo_id = @id",
                    new { id }, transaction);

                // Re-insert metodos breakdown
                if (req.MetodosPago != null && req.MetodosPago.Count > 0)
                {
                    foreach (var pm in req.MetodosPago.Where(x => x.Monto > 0))
                    {
                        await connection.ExecuteAsync(@"
                            INSERT INTO caja.recibo_metodos_pago 
                                (recibo_id, metodo_pago, monto, nota_credito_id, banco_tarjeta, referencia)
                            VALUES 
                                (@reciboId, @MetodoPago, @Monto, @NotaCreditoId, @BancoTarjeta, @Referencia)",
                            new { reciboId = id, pm.MetodoPago, pm.Monto, pm.NotaCreditoId, pm.BancoTarjeta, pm.Referencia }, transaction);
                    }
                }
                else
                {
                    await connection.ExecuteAsync(@"
                        INSERT INTO caja.recibo_metodos_pago 
                            (recibo_id, metodo_pago, monto, banco_tarjeta, referencia)
                        VALUES 
                            (@reciboId, @MetodoPago, @nuevoImporte, @BancoTarjeta, @Referencia)",
                        new { reciboId = id, req.MetodoPago, nuevoImporte, req.BancoTarjeta, req.Referencia }, transaction);
                }

                await transaction.CommitAsync();
                return Ok(new { Success = true, Message = "Recibo actualizado correctamente." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { Error = ex.Message });
            }
        }

        // PUT /api/caja/editar-egreso/{id}
        [HttpPut("editar-egreso/{id}")]
        public async Task<IActionResult> EditarEgreso(long id, [FromBody] EditarEgresoRequest req)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();

            try
            {
                var recibo = await connection.QueryFirstOrDefaultAsync(
                    "SELECT id, estado FROM caja.recibos_caja WHERE id = @id AND tipo = 'EGRESO'",
                    new { id });

                if (recibo == null)
                    return NotFound(new { Error = "Egreso no encontrado." });

                if (recibo.estado == "ANULADO")
                    return BadRequest(new { Error = "No se puede editar un egreso anulado." });

                await connection.ExecuteAsync(@"
                    UPDATE caja.recibos_caja 
                    SET serie = COALESCE(@Serie, serie),
                        numero = COALESCE(@Numero, numero),
                        fecha = COALESCE(@Fecha, fecha),
                        nombre_recibe = COALESCE(@NombreRecibe, nombre_recibe),
                        descripcion = COALESCE(@Descripcion, descripcion),
                        importe_total = COALESCE(@Importe, importe_total),
                        metodo_pago = COALESCE(@MetodoPago, metodo_pago)
                    WHERE id = @id AND tipo = 'EGRESO'",
                    new
                    {
                        id,
                        req.Serie,
                        req.Numero,
                        req.Fecha,
                        req.NombreRecibe,
                        req.Descripcion,
                        req.Importe,
                        req.MetodoPago
                    });

                return Ok(new { Success = true, Message = "Egreso actualizado correctamente." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Error = ex.Message });
            }
        }


        // GET /api/caja/cuentas-bancarias?includeInactive=false
        [HttpGet("cuentas-bancarias")]
        public async Task<IActionResult> GetCuentasBancarias([FromQuery] bool includeInactive = false)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var sql = @"
                SELECT b.id, b.banco, b.tipo_cuenta as TipoCuenta, b.moneda,
                       b.numero_cuenta as NumeroCuenta, b.nombre_titular as NombreTitular,
                       b.sucursal_id as SucursalId, s.nombre as SucursalNombre,
                       b.comision_pos_porcentaje as ComisionPosPorcentaje,
                       b.retencion_pos_porcentaje as RetencionPosPorcentaje,
                       b.es_pos as EsPos, b.activo, b.created_at as CreatedAt
                FROM caja.bancos_cuentas b
                LEFT JOIN public.sucursales s ON b.sucursal_id = s.id
                " + (includeInactive ? "" : "WHERE b.activo = true ") + @"
                ORDER BY b.banco ASC, b.tipo_cuenta ASC, b.id ASC";

            var result = await connection.QueryAsync(sql);
            return Ok(result);
        }

        // POST /api/caja/cuentas-bancarias
        [HttpPost("cuentas-bancarias")]
        public async Task<IActionResult> CrearCuentaBancaria([FromBody] BancoCuentaRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Banco) || string.IsNullOrWhiteSpace(req.NumeroCuenta))
                return BadRequest(new { Error = "El banco y el número de cuenta son obligatorios." });

            using var connection = new NpgsqlConnection(_connectionString);
            var sql = @"
                INSERT INTO caja.bancos_cuentas 
                    (banco, tipo_cuenta, moneda, numero_cuenta, nombre_titular, sucursal_id, comision_pos_porcentaje, retencion_pos_porcentaje, es_pos, activo)
                VALUES 
                    (@Banco, @TipoCuenta, @Moneda, @NumeroCuenta, @NombreTitular, @SucursalId, @ComisionPosPorcentaje, @RetencionPosPorcentaje, @EsPos, @Activo)
                RETURNING id";

            var id = await connection.QuerySingleAsync<long>(sql, req);
            return Ok(new { Success = true, Id = id, Message = "Cuenta bancaria creada exitosamente." });
        }

        // PUT /api/caja/cuentas-bancarias/{id}
        [HttpPut("cuentas-bancarias/{id}")]
        public async Task<IActionResult> ActualizarCuentaBancaria(long id, [FromBody] BancoCuentaRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Banco) || string.IsNullOrWhiteSpace(req.NumeroCuenta))
                return BadRequest(new { Error = "El banco y el número de cuenta son obligatorios." });

            using var connection = new NpgsqlConnection(_connectionString);
            var sql = @"
                UPDATE caja.bancos_cuentas 
                SET banco = @Banco,
                    tipo_cuenta = @TipoCuenta,
                    moneda = @Moneda,
                    numero_cuenta = @NumeroCuenta,
                    nombre_titular = @NombreTitular,
                    sucursal_id = @SucursalId,
                    comision_pos_porcentaje = @ComisionPosPorcentaje,
                    retencion_pos_porcentaje = @RetencionPosPorcentaje,
                    es_pos = @EsPos,
                    activo = @Activo
                WHERE id = @id";

            var rows = await connection.ExecuteAsync(sql, new {
                id,
                req.Banco,
                req.TipoCuenta,
                req.Moneda,
                req.NumeroCuenta,
                req.NombreTitular,
                req.SucursalId,
                req.ComisionPosPorcentaje,
                req.RetencionPosPorcentaje,
                req.EsPos,
                req.Activo
            });

            if (rows == 0) return NotFound(new { Error = "Cuenta bancaria no encontrada." });
            return Ok(new { Success = true, Message = "Cuenta bancaria actualizada exitosamente." });
        }

        // PATCH /api/caja/cuentas-bancarias/{id}/toggle-status
        [HttpPatch("cuentas-bancarias/{id}/toggle-status")]
        public async Task<IActionResult> ToggleEstadoCuentaBancaria(long id)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var sql = "UPDATE caja.bancos_cuentas SET activo = NOT activo WHERE id = @id RETURNING activo";
            var nuevoEstado = await connection.QueryFirstOrDefaultAsync<bool?>(sql, new { id });
            if (!nuevoEstado.HasValue) return NotFound(new { Error = "Cuenta bancaria no encontrada." });
            return Ok(new { Success = true, Activo = nuevoEstado.Value, Message = $"Cuenta {(nuevoEstado.Value ? "activada" : "desactivada")} correctamente." });
        }
    }

    public class EditarMetodoPagoRequest
    {
        public string MetodoPago { get; set; } = "EFECTIVO";
        public string? BancoTarjeta { get; set; }
        public string? Referencia { get; set; }
        public List<PagoMetodoDetalleDto>? MetodosPago { get; set; }
    }

    public class EditarReciboRequest
    {
        public string? Serie { get; set; }
        public string? Numero { get; set; }
        public DateTime? Fecha { get; set; }
        public long? ClienteId { get; set; }
        public int? SucursalId { get; set; }
        public string? Descripcion { get; set; }
        public decimal? ImporteTotal { get; set; }
        public string MetodoPago { get; set; } = "EFECTIVO";
        public string? BancoTarjeta { get; set; }
        public string? Referencia { get; set; }
        public List<PagoMetodoDetalleDto>? MetodosPago { get; set; }
    }

    public class EditarEgresoRequest
    {
        public string? Serie { get; set; }
        public string? Numero { get; set; }
        public DateTime? Fecha { get; set; }
        public string? NombreRecibe { get; set; }
        public string? Descripcion { get; set; }
        public decimal? Importe { get; set; }
        public string MetodoPago { get; set; } = "EFECTIVO";
    }

    public class AplicarNotaCreditoRequest
    {
        public long NotaCreditoId { get; set; }
        public long? ReciboCajaId { get; set; }
        public long? FacturaAplicadaId { get; set; }
        public decimal MontoAAplicar { get; set; }
    }

    public class CrearNotaCreditoRequest
    {
        public long ClienteId { get; set; }
        public long SucursalId { get; set; }
        public DateTime? FechaEmision { get; set; }
        public decimal MontoSubtotal { get; set; }
        public decimal MontoIva { get; set; }
        public decimal MontoTotal { get; set; }
        public string? Observacion { get; set; }
    }

    public class CambiarNumeroFacturaRequest
    {
        public long FacturaId { get; set; }
        public string NuevoNumero { get; set; } = "";
        public string Username { get; set; } = "";
        public string Password { get; set; } = "";
    }

    // ---- Request Models ----

    public class PagoDetalleRequest
    {
        public long FacturaId { get; set; }
        public decimal MontoAplicado { get; set; }
        public bool EsParcial { get; set; }
    }

    public class PagoMetodoDetalleDto
    {
        public string MetodoPago { get; set; } = string.Empty; // EFECTIVO, TRANSFERENCIA, DEPOSITO, TARJETA, NOTA_CREDITO
        public decimal Monto { get; set; }
        public long? NotaCreditoId { get; set; }
        public string? BancoTarjeta { get; set; }
        public string? Referencia { get; set; }
        public string? Banco { get; set; }
        public string? NumeroCuenta { get; set; }
    }

    public class AplicarPagoRequest
    {
        public string Serie { get; set; } = "";
        public string Numero { get; set; } = "";
        public DateTime? Fecha { get; set; }
        public long? ClienteId { get; set; }
        public string? Descripcion { get; set; }
        public decimal ImporteTotal { get; set; }
        public string MetodoPago { get; set; } = "EFECTIVO";
        public string? BancoTarjeta { get; set; }
        public string? Referencia { get; set; }
        public string? Banco { get; set; }
        public string? NumeroCuenta { get; set; }
        public int? SucursalId { get; set; }
        public List<PagoDetalleRequest> Detalles { get; set; } = new();
        public List<PagoMetodoDetalleDto>? MetodosPago { get; set; } = new();
    }

    public class EgresoRequest
    {
        public string Serie { get; set; } = "";
        public string Numero { get; set; } = "";
        public DateTime? Fecha { get; set; }
        public string Descripcion { get; set; } = "";
        public decimal Importe { get; set; }
        public string MetodoPago { get; set; } = "EFECTIVO";
        public int? SucursalId { get; set; }
        public string? NombreRecibe { get; set; }
    }

    public class AperturaCajaRequest
    {
        public DateTime? Fecha { get; set; }
        public int? SucursalId { get; set; }
        public decimal EfectivoInicio { get; set; }
        public string? Observaciones { get; set; }
    }

    public class CierreCajaRequest
    {
        public DateTime? Fecha { get; set; }
        public int? SucursalId { get; set; }
        public decimal EfectivoInicio { get; set; }
        public decimal EfectivoFin { get; set; }
        public string? Observaciones { get; set; }
    }

    public class BancoCuentaRequest
    {
        public string Banco { get; set; } = "";
        public string TipoCuenta { get; set; } = "AHORRO";
        public string Moneda { get; set; } = "NIO";
        public string NumeroCuenta { get; set; } = "";
        public string NombreTitular { get; set; } = "AGRISOURCE S.A.";
        public int? SucursalId { get; set; }
        public decimal ComisionPosPorcentaje { get; set; } = 0;
        public decimal RetencionPosPorcentaje { get; set; } = 0;
        public bool EsPos { get; set; } = false;
        public bool Activo { get; set; } = true;
    }
}
