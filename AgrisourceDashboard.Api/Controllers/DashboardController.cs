using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Dapper;

namespace AgrisourceDashboard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly string _connectionString;

        public DashboardController(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection") ?? "";
        }

        private string GetFilterConditions(DateTime? startDate, DateTime? endDate, int? sucursalId, string dateCol, string sucursalCol)
        {
            var filters = new List<string>();
            if (startDate.HasValue) filters.Add($"{dateCol} >= @startDate");
            if (endDate.HasValue) filters.Add($"{dateCol} <= @endDate");
            if (sucursalId.HasValue) filters.Add($"{sucursalCol} = @sucursalId");
            filters.Add($"{sucursalCol} <> 8");
            return " WHERE " + string.Join(" AND ", filters);
        }

        private string GetFilterConditionsWithExistingWhere(DateTime? startDate, DateTime? endDate, int? sucursalId, string dateCol, string sucursalCol)
        {
            var filters = new List<string>();
            if (startDate.HasValue) filters.Add($"{dateCol} >= @startDate");
            if (endDate.HasValue) filters.Add($"{dateCol} <= @endDate");
            if (sucursalId.HasValue) filters.Add($"{sucursalCol} = @sucursalId");
            filters.Add($"{sucursalCol} <> 8");
            return " AND " + string.Join(" AND ", filters);
        }

        private string GetFilterConditionsInventario(DateTime? startDate, DateTime? endDate, int? sucursalId, string dateCol, string sucursalCol)
        {
            var filters = new List<string>();
            if (startDate.HasValue) filters.Add($"{dateCol} >= @startDate");
            if (endDate.HasValue) filters.Add($"{dateCol} <= @endDate");
            if (sucursalId.HasValue) filters.Add($"{sucursalCol} = @sucursalId");
            return filters.Count > 0 ? " WHERE " + string.Join(" AND ", filters) : "";
        }

        private string GetFilterConditionsWithExistingWhereInventario(DateTime? startDate, DateTime? endDate, int? sucursalId, string dateCol, string sucursalCol)
        {
            var filters = new List<string>();
            if (startDate.HasValue) filters.Add($"{dateCol} >= @startDate");
            if (endDate.HasValue) filters.Add($"{dateCol} <= @endDate");
            if (sucursalId.HasValue) filters.Add($"{sucursalCol} = @sucursalId");
            return filters.Count > 0 ? " AND " + string.Join(" AND ", filters) : "";
        }

        [HttpGet("sucursales")]
        public async Task<IActionResult> GetSucursales([FromQuery] bool includeLosArcos = false)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var query = includeLosArcos 
                ? "SELECT id, nombre FROM public.sucursales ORDER BY nombre"
                : "SELECT id, nombre FROM public.sucursales WHERE nombre <> 'Los Arcos' ORDER BY nombre";
            var result = await connection.QueryAsync(query);
            return Ok(result);
        }

        [HttpGet("ventas-sucursal")]
        public async Task<IActionResult> GetVentasSucursal([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filters = GetFilterConditions(startDate, endDate, sucursalId, "f.fecha", "f.sucursal_id");
            var query = $@"
                SELECT s.nombre as Sucursal, 
                       COALESCE(SUM(f.total), 0) as TotalVentas, 
                       COUNT(f.id) as CantidadFacturas 
                FROM public.sucursales s
                LEFT JOIN (SELECT * FROM ventas.facturas f {filters}) f ON f.sucursal_id = s.id
                WHERE s.nombre <> 'Los Arcos'
                GROUP BY s.nombre
                ORDER BY TotalVentas DESC";
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("compras-articulos")]
        public async Task<IActionResult> GetComprasArticulos([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filters = GetFilterConditions(startDate, endDate, sucursalId, "oc.created_at", "oc.sucursal_id");
            var query = $@"
                SELECT a.name as Articulo, 
                       SUM(cd.cantidad) as CantidadComprada, 
                       SUM(cd.cantidad * cd.precio_cu) as TotalComprado 
                FROM public.orden_compra_detalles cd 
                JOIN public.orden_compra oc ON cd.orden_id = oc.id_orden
                JOIN public.articulos a ON cd.articulo_id = a.id 
                {filters}
                GROUP BY a.name 
                ORDER BY TotalComprado DESC 
                LIMIT 20";
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("compras-resumen-comparativo")]
        public async Task<IActionResult> GetComprasResumenComparativo([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            
            var filtersCs = GetFilterConditions(startDate, endDate, sucursalId, "cs.fecha", "cs.sucursal_id");
            var filtersOc = GetFilterConditions(startDate, endDate, sucursalId, "oc.created_at", "oc.sucursal_id");

            var querySolicitudes = $@"
                SELECT 
                    COUNT(*) as TotalSolicitudes,
                    COUNT(CASE WHEN cs.estado_id = 2 THEN 1 END) as SolicitudesAprobadas,
                    COUNT(CASE WHEN cs.estado_id = 1 THEN 1 END) as SolicitudesTransito
                FROM public.compras_solicitudes cs
                JOIN public.sucursales s ON cs.sucursal_id = s.id
                {filtersCs}";

            var queryOrdenes = $@"
                SELECT 
                    COUNT(*) as TotalOrdenes,
                    COALESCE(SUM(oc.total), 0) as MontoTotalOrdenes,
                    COUNT(CASE WHEN oc.estado_id = 5 THEN 1 END) as OrdenesCompradas,
                    COALESCE(SUM(CASE WHEN oc.estado_id = 5 THEN oc.total ELSE 0 END), 0) as MontoComprado,
                    COUNT(CASE WHEN oc.estado_id = 2 THEN 1 END) as OrdenesPendientes,
                    COALESCE(SUM(CASE WHEN oc.estado_id = 2 THEN oc.total ELSE 0 END), 0) as MontoPendiente
                FROM public.orden_compra oc
                JOIN public.sucursales s ON oc.sucursal_id = s.id
                {filtersOc}";

            var queryDiario = $@"
                SELECT 
                    fecha as Fecha, 
                    SUM(solicitudes) as Solicitudes, 
                    SUM(ordenes_realizadas) as OrdenesRealizadas, 
                    SUM(ordenes_compradas) as OrdenesCompradas
                FROM (
                    SELECT cs.fecha::date as fecha, COUNT(*) as solicitudes, 0 as ordenes_realizadas, 0 as ordenes_compradas
                    FROM public.compras_solicitudes cs
                    JOIN public.sucursales s ON cs.sucursal_id = s.id
                    {filtersCs}
                    GROUP BY cs.fecha::date

                    UNION ALL

                    SELECT oc.created_at::date as fecha, 0 as solicitudes, COUNT(*) as ordenes_realizadas, COUNT(CASE WHEN oc.estado_id = 5 THEN 1 END) as ordenes_compradas
                    FROM public.orden_compra oc
                    JOIN public.sucursales s ON oc.sucursal_id = s.id
                    {filtersOc}
                    GROUP BY oc.created_at::date
                ) t
                GROUP BY fecha
                ORDER BY fecha ASC";

            var solicitudes = await connection.QueryFirstOrDefaultAsync(querySolicitudes, new { startDate, endDate, sucursalId });
            var ordenes = await connection.QueryFirstOrDefaultAsync(queryOrdenes, new { startDate, endDate, sucursalId });
            var diario = await connection.QueryAsync(queryDiario, new { startDate, endDate, sucursalId });

            return Ok(new {
                Solicitudes = solicitudes,
                Ordenes = ordenes,
                Diario = diario
            });
        }

        [HttpGet("movimientos-inventario")]
        public async Task<IActionResult> GetMovimientosInventario([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filters = GetFilterConditions(startDate, endDate, sucursalId, "t.created_at", "t.sucursal_id");
            var query = $@"
                SELECT m.movimiento as Movimiento, 
                       SUM(t.cantidad) as CantidadTotal 
                FROM inventario.transacciones_inventario t 
                JOIN inventario.movimientos m ON t.movimiento_id = m.id 
                {filters} AND (t.anulado IS FALSE OR t.anulado IS NULL)
                GROUP BY m.movimiento
                ORDER BY CantidadTotal DESC";
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("movimientos-inventario-sucursal")]
        public async Task<IActionResult> GetMovimientosInventarioSucursal([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filters = GetFilterConditions(startDate, endDate, sucursalId, "t.created_at", "t.sucursal_id");
            var query = $@"
                SELECT s.nombre as Sucursal, 
                       m.movimiento as Movimiento, 
                       SUM(t.cantidad) as CantidadTotal 
                FROM inventario.transacciones_inventario t 
                JOIN inventario.movimientos m ON t.movimiento_id = m.id 
                JOIN public.sucursales s ON t.sucursal_id = s.id
                {filters} AND (t.anulado IS FALSE OR t.anulado IS NULL)
                GROUP BY s.nombre, m.movimiento
                ORDER BY s.nombre, m.movimiento";
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("descuentos-sucursal")]
        public async Task<IActionResult> GetDescuentosSucursal([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filters = GetFilterConditions(startDate, endDate, sucursalId, "f.fecha", "f.sucursal_id");
            var query = $@"
                SELECT s.nombre as Sucursal, 
                       COALESCE(SUM(fd.descuento), 0) as TotalDescuentos 
                FROM public.sucursales s
                LEFT JOIN (SELECT * FROM ventas.facturas f {filters}) f ON f.sucursal_id = s.id
                LEFT JOIN ventas.factura_detalles fd ON fd.factura_id = f.id
                WHERE s.nombre <> 'Los Arcos'
                GROUP BY s.nombre
                ORDER BY TotalDescuentos DESC";
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("descuentos-vendedores-sucursal")]
        public async Task<IActionResult> GetDescuentosVendedoresSucursal([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] string? sucursal, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var query = @"
                SELECT 
                    v.id as VendedorId,
                    COALESCE(v.nombre_completo, 'Sin Vendedor Asignado') as Vendedor,
                    s.nombre as Sucursal,
                    COUNT(DISTINCT f.id) as CantidadFacturas,
                    COALESCE(SUM(fd.descuento), 0) as TotalDescuento,
                    COALESCE(SUM(f.total), 0) as TotalVentas
                FROM ventas.facturas f
                JOIN ventas.factura_detalles fd ON fd.factura_id = f.id
                JOIN public.sucursales s ON f.sucursal_id = s.id
                LEFT JOIN ventas.vendedores v ON f.vendedor_id = v.id
                WHERE f.estado <> 'AN'
                  AND fd.descuento > 0
                  AND (@sucursal::text IS NULL OR LOWER(s.nombre) = LOWER(@sucursal::text) OR (@sucursalId::int IS NOT NULL AND s.id = @sucursalId::int))
                  AND (@startDate::date IS NULL OR f.fecha >= @startDate::date)
                  AND (@endDate::date IS NULL OR f.fecha <= @endDate::date)
                GROUP BY v.id, v.nombre_completo, s.nombre
                ORDER BY TotalDescuento DESC";

            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursal, sucursalId });
            return Ok(result);
        }

        [HttpGet("descuentos-facturas-vendedor")]
        public async Task<IActionResult> GetDescuentosFacturasVendedor([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] string? sucursal, [FromQuery] int? vendedorId, [FromQuery] string? vendedor)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var query = @"
                SELECT 
                    f.id as FacturaId,
                    f.numero as NumeroFactura,
                    f.fecha as Fecha,
                    COALESCE(cl.nombre, 'Cliente General') as Cliente,
                    f.total as TotalFactura,
                    COALESCE(SUM(fd.descuento), 0) as MontoDescuento,
                    ROUND((COALESCE(SUM(fd.descuento), 0) / NULLIF(f.total + COALESCE(SUM(fd.descuento), 0), 0) * 100)::numeric, 2) as PorcentajeDescuento
                FROM ventas.facturas f
                JOIN ventas.factura_detalles fd ON fd.factura_id = f.id
                JOIN public.sucursales s ON f.sucursal_id = s.id
                LEFT JOIN ventas.clientes cl ON f.cliente_id = cl.id
                LEFT JOIN ventas.vendedores v ON f.vendedor_id = v.id
                WHERE f.estado <> 'AN'
                  AND fd.descuento > 0
                  AND (@vendedorId::int IS NULL OR f.vendedor_id = @vendedorId::int)
                  AND (@vendedor::text IS NULL OR LOWER(v.nombre_completo) = LOWER(@vendedor::text))
                  AND (@sucursal::text IS NULL OR LOWER(s.nombre) = LOWER(@sucursal::text))
                  AND (@startDate::date IS NULL OR f.fecha >= @startDate::date)
                  AND (@endDate::date IS NULL OR f.fecha <= @endDate::date)
                GROUP BY f.id, f.numero, f.fecha, cl.nombre, f.total
                HAVING SUM(fd.descuento) > 0
                ORDER BY MontoDescuento DESC";

            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursal, vendedorId, vendedor });
            return Ok(result);
        }

        [HttpGet("vendedores")]
        public async Task<IActionResult> GetVendedores([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filters = GetFilterConditions(startDate, endDate, sucursalId, "f.fecha", "f.sucursal_id");
            var query = $@"
                SELECT v.id as VendedorId,
                       v.nombre_completo as Vendedor, 
                       s.nombre as Sucursal, 
                       COUNT(CASE WHEN f.id IS NOT NULL AND UPPER(COALESCE(f.estado, '')) <> 'ANULADA' AND UPPER(COALESCE(f.estado, '')) <> 'AN' THEN f.id END) as TotalFacturas, 
                       COALESCE(SUM(CASE WHEN cp.dias = 0 AND UPPER(COALESCE(f.estado, '')) <> 'ANULADA' AND UPPER(COALESCE(f.estado, '')) <> 'AN' THEN f.total ELSE 0 END), 0) as TotalContado,
                       COALESCE(SUM(CASE WHEN cp.dias > 0 AND UPPER(COALESCE(f.estado, '')) <> 'ANULADA' AND UPPER(COALESCE(f.estado, '')) <> 'AN' THEN f.total ELSE 0 END), 0) as TotalCredito,
                       COALESCE(SUM(CASE WHEN UPPER(COALESCE(f.estado, '')) <> 'ANULADA' AND UPPER(COALESCE(f.estado, '')) <> 'AN' THEN f.total ELSE 0 END), 0) as TotalVentas 
                FROM ventas.vendedores v 
                LEFT JOIN (SELECT * FROM ventas.facturas f {filters}) f ON v.id = f.vendedor_id 
                LEFT JOIN public.condiciones_pago cp ON f.condicion_pago_id = cp.id
                LEFT JOIN public.sucursales s ON v.sucursal_id = s.id 
                GROUP BY v.id, v.nombre_completo, s.nombre
                ORDER BY TotalVentas DESC";
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("inventario-dashboard-metrics")]
        public async Task<IActionResult> GetInventarioDashboardMetrics([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filterStr = GetFilterConditionsWithExistingWhereInventario(startDate, endDate, sucursalId, "t.created_at", "t.sucursal_id");

            // 1. movements by category and branch
            var queryCatMovi = $@"
                SELECT s.nombre as Sucursal, ac.description as Categoria, SUM(ABS(t.cantidad)) as Cantidad
                FROM inventario.transacciones_inventario t
                JOIN public.sucursales s ON t.sucursal_id = s.id
                JOIN public.articulos a ON t.articulo_id = a.id
                JOIN public.articulos_categorias ac ON a.categoria_id = ac.id
                WHERE (@sucursalId IS NULL OR s.id = @sucursalId) AND (t.anulado IS FALSE OR t.anulado IS NULL)
                  {filterStr}
                GROUP BY s.nombre, ac.description
                ORDER BY Cantidad DESC";

            // 2. stock status (under min, over max, zero count) grouped by sucursal
            var queryStockStatus = $@"
                SELECT 
                    s.nombre as Sucursal,
                    COUNT(CASE WHEN e.cantidad = 0 THEN 1 END) as StockCero,
                    COUNT(CASE WHEN e.cantidad > 0 AND e.cantidad <= a.stock_min THEN 1 END) as StockMinimo,
                    COUNT(CASE WHEN e.cantidad >= a.stock_max THEN 1 END) as StockMaximo,
                    COUNT(CASE WHEN e.cantidad > a.stock_min AND e.cantidad < a.stock_max THEN 1 END) as StockNormal
                FROM inventario.exstencias e
                JOIN public.articulos a ON e.articulo_id = a.id
                JOIN public.sucursales s ON e.sucursal_id = s.id
                WHERE (@sucursalId IS NULL OR s.id = @sucursalId)
                GROUP BY s.nombre";

            // 3. top sold categories
            var queryTopSoldCategories = $@"
                SELECT ac.description as Categoria, SUM(fd.cantidad) as TotalVendido
                FROM ventas.factura_detalles fd
                JOIN public.articulos a ON fd.articulo_id = a.id
                JOIN public.articulos_categorias ac ON a.categoria_id = ac.id
                JOIN ventas.facturas f ON fd.factura_id = f.id
                JOIN public.sucursales s ON f.sucursal_id = s.id
                WHERE (@sucursalId IS NULL OR f.sucursal_id = @sucursalId)
                  AND f.estado <> 'AN'
                  AND f.fecha >= COALESCE(@startDate::date, CURRENT_DATE - INTERVAL '30 days')
                  AND f.fecha <= COALESCE(@endDate::date, CURRENT_DATE)
                GROUP BY ac.description
                ORDER BY TotalVendido DESC
                LIMIT 10";

            var catMovements = await connection.QueryAsync(queryCatMovi, new { startDate, endDate, sucursalId });
            var stockStatus = await connection.QueryAsync(queryStockStatus, new { sucursalId });
            var topCategories = await connection.QueryAsync(queryTopSoldCategories, new { startDate, endDate, sucursalId });

            return Ok(new {
                CatMovements = catMovements,
                StockStatus = stockStatus,
                TopCategories = topCategories
            });
        }

        [HttpGet("inventario-trends")]
        public async Task<IActionResult> GetInventarioTrends([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filterStr = GetFilterConditionsWithExistingWhereInventario(startDate, endDate, sucursalId, "t.created_at", "t.sucursal_id");

            // Daily trend for 4 types of movements (TE, CI, TS, CP) by sucursal
            var query = $@"
                SELECT 
                    t.created_at::date as Fecha,
                    s.nombre as Sucursal,
                    m.movimiento as TipoMovimiento,
                    SUM(ABS(t.cantidad)) as Cantidad
                FROM inventario.transacciones_inventario t
                JOIN public.sucursales s ON t.sucursal_id = s.id
                JOIN inventario.movimientos m ON t.movimiento_id = m.id
                WHERE (@sucursalId IS NULL OR s.id = @sucursalId) AND (t.anulado IS FALSE OR t.anulado IS NULL)
                  {filterStr}
                GROUP BY t.created_at::date, s.nombre, m.movimiento
                ORDER BY Fecha ASC";

            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        // --- NUEVOS ENDPOINTS ---

        [HttpGet("top-articulos-movimiento")]
        public async Task<IActionResult> GetTopArticulosMovimiento([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filters = GetFilterConditions(startDate, endDate, sucursalId, "t.created_at", "t.sucursal_id");
            var query = $@"
                SELECT TRIM(CONCAT_WS(' - ', NULLIF(a.code, ''), NULLIF(a.name, ''), NULLIF(a.description, ''))) as Articulo, 
                       SUM(ABS(t.cantidad)) as VolumenTotal
                FROM inventario.transacciones_inventario t 
                JOIN public.articulos a ON t.articulo_id = a.id
                {filters} AND (t.anulado IS FALSE OR t.anulado IS NULL)
                GROUP BY a.code, a.name, a.description
                ORDER BY VolumenTotal DESC
                LIMIT 10";
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("consumos-ubicaciones")]
        public async Task<IActionResult> GetConsumosUbicaciones([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filterStr = GetFilterConditionsWithExistingWhere(startDate, endDate, sucursalId, "t.created_at", "t.sucursal_id");
            
            var query = $@"
                SELECT 
                       t.bodega_id as BodegaId,
                       b.descripcion as BodegaNombre,
                       t.ubicacion_id as UbicacionId,
                       COALESCE(u.nivel_1, 'SIN UBICACION') || '-' || COALESCE(u.nivel_2, '') as UbicacionNombre,
                       SUM(ABS(t.cantidad)) as CantidadConsumida
                FROM inventario.transacciones_inventario t
                LEFT JOIN public.bodega_ubicaciones u ON t.ubicacion_id = u.id
                LEFT JOIN public.bodegas b ON t.bodega_id = b.id
                JOIN inventario.movimientos m ON t.movimiento_id = m.id
                WHERE t.cantidad < 0 AND (t.anulado IS FALSE OR t.anulado IS NULL) {filterStr}
                GROUP BY t.bodega_id, b.descripcion, t.ubicacion_id, u.nivel_1, u.nivel_2
                ORDER BY CantidadConsumida DESC
                LIMIT 10";
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("existencias-detalle")]
        public async Task<IActionResult> GetExistenciasDetalle([FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var query = @"
                SELECT 
                    TRIM(CONCAT_WS(' - ', NULLIF(a.code, ''), NULLIF(a.name, ''), NULLIF(a.description, ''))) as Articulo,
                    s.nombre as Sucursal,
                    b.descripcion as Bodega,
                    COALESCE(u.nivel_1, 'N/A') || CASE WHEN u.nivel_2 IS NOT NULL AND u.nivel_2 <> '' THEN '-' || u.nivel_2 ELSE '' END as Ubicacion,
                    SUM(e.cantidad) as Existencia,
                    SUM(e.cantidad) as Cantidad
                FROM inventario.exstencias e
                JOIN public.articulos a ON e.articulo_id = a.id
                JOIN public.sucursales s ON e.sucursal_id = s.id
                JOIN public.bodegas b ON e.bodega_id = b.id
                LEFT JOIN public.bodega_ubicaciones u ON e.ubicacion_id = u.id
                WHERE (@sucursalId IS NULL OR e.sucursal_id = @sucursalId)
                GROUP BY a.code, a.description, a.name, s.nombre, b.descripcion, u.nivel_1, u.nivel_2
                HAVING SUM(e.cantidad) > 0
                ORDER BY s.nombre, b.descripcion, a.code";
            var result = await connection.QueryAsync(query, new { sucursalId });
            return Ok(result);
        }

        [HttpGet("ingresos-detalle")]
        public async Task<IActionResult> GetIngresosDetalle([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filterStr = GetFilterConditionsWithExistingWhere(startDate, endDate, sucursalId, "t.created_at", "t.sucursal_id");
            
            var query = $@"
                SELECT 
                    COALESCE(oc.numero_orden::text, t.documento_referencia) as Documento,
                    m.movimiento as TipoMovimiento,
                    TRIM(CONCAT_WS(' - ', NULLIF(a.code, ''), NULLIF(a.name, ''), NULLIF(a.description, ''))) as Articulo,
                    s.nombre as Sucursal,
                    b.descripcion as Bodega,
                    COALESCE(u.nivel_1, 'N/A') || '-' || COALESCE(u.nivel_2, '') as Ubicacion,
                    ABS(t.cantidad) as Cantidad,
                    t.created_at as Fecha
                FROM inventario.transacciones_inventario t
                JOIN inventario.movimientos m ON t.movimiento_id = m.id
                JOIN public.articulos a ON t.articulo_id = a.id
                JOIN public.sucursales s ON t.sucursal_id = s.id
                JOIN public.bodegas b ON t.bodega_id = b.id
                LEFT JOIN public.bodega_ubicaciones u ON t.ubicacion_id = u.id
                LEFT JOIN public.orden_compra oc ON m.movimiento = 'CP' AND oc.id_orden::text = t.documento_referencia
                WHERE (t.anulado IS FALSE OR t.anulado IS NULL)
                  AND (m.movimiento = 'CP' OR m.movimiento = 'DEV' OR 
                       (m.movimiento = 'TE' AND NOT EXISTS (
                           SELECT 1 FROM inventario.traslados tr WHERE tr.numero_traslado = t.documento_referencia AND tr.sucursal_origen_id = tr.sucursal_destino_id
                       )))
                  {filterStr}
                ORDER BY t.created_at DESC, t.id DESC";
                
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("egresos-detalle")]
        public async Task<IActionResult> GetEgresosDetalle([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filterStr = GetFilterConditionsWithExistingWhere(startDate, endDate, sucursalId, "t.created_at", "t.sucursal_id");
            
            var query = $@"
                SELECT 
                    t.documento_referencia as Documento,
                    m.movimiento as TipoMovimiento,
                    TRIM(CONCAT_WS(' - ', NULLIF(a.code, ''), NULLIF(a.name, ''), NULLIF(a.description, ''))) as Articulo,
                    s.nombre as Sucursal,
                    b.descripcion as Bodega,
                    COALESCE(u.nivel_1, 'N/A') || '-' || COALESCE(u.nivel_2, '') as Ubicacion,
                    ABS(t.cantidad) as Cantidad,
                    t.created_at as Fecha
                FROM inventario.transacciones_inventario t
                JOIN inventario.movimientos m ON t.movimiento_id = m.id
                JOIN public.articulos a ON t.articulo_id = a.id
                JOIN public.sucursales s ON t.sucursal_id = s.id
                JOIN public.bodegas b ON t.bodega_id = b.id
                LEFT JOIN public.bodega_ubicaciones u ON t.ubicacion_id = u.id
                WHERE (t.anulado IS FALSE OR t.anulado IS NULL)
                  AND (m.movimiento = 'CI' OR 
                       (m.movimiento = 'TS' AND NOT EXISTS (
                           SELECT 1 FROM inventario.traslados tr WHERE tr.numero_traslado = t.documento_referencia AND tr.sucursal_origen_id = tr.sucursal_destino_id
                       )))
                  {filterStr}
                ORDER BY t.created_at DESC, t.id DESC";
                
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("traslados-internos")]
        public async Task<IActionResult> GetTrasladosInternos([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filterStr = GetFilterConditionsWithExistingWhere(startDate, endDate, sucursalId, "tr.fecha_traslado", "tr.sucursal_origen_id");
            
            var query = $@"
                SELECT 
                    tr.numero_traslado as Documento,
                    tr.fecha_traslado as Fecha,
                    TRIM(CONCAT_WS(' - ', NULLIF(a.code, ''), NULLIF(a.name, ''), NULLIF(a.description, ''))) as Articulo,
                    ABS(t_out.cantidad) as CantidadMovida,
                    b_out.descripcion as BodegaOrigen,
                    COALESCE(u_out.nivel_1, 'N/A') || '-' || COALESCE(u_out.nivel_2, '') as UbicacionOrigen,
                    b_in.descripcion as BodegaDestino,
                    COALESCE(u_in.nivel_1, 'N/A') || '-' || COALESCE(u_in.nivel_2, '') as UbicacionDestino
                FROM inventario.traslados tr
                JOIN inventario.transacciones_inventario t_out ON tr.numero_traslado = t_out.documento_referencia AND (SELECT movimiento FROM inventario.movimientos WHERE id = t_out.movimiento_id) = 'TS' AND (t_out.anulado IS FALSE OR t_out.anulado IS NULL)
                JOIN inventario.transacciones_inventario t_in ON tr.numero_traslado = t_in.documento_referencia AND (SELECT movimiento FROM inventario.movimientos WHERE id = t_in.movimiento_id) = 'TE' AND t_out.articulo_id = t_in.articulo_id AND (t_in.anulado IS FALSE OR t_in.anulado IS NULL)
                JOIN public.articulos a ON t_out.articulo_id = a.id
                JOIN public.bodegas b_out ON t_out.bodega_id = b_out.id
                LEFT JOIN public.bodega_ubicaciones u_out ON t_out.ubicacion_id = u_out.id
                JOIN public.bodegas b_in ON t_in.bodega_id = b_in.id
                LEFT JOIN public.bodega_ubicaciones u_in ON t_in.ubicacion_id = u_in.id
                WHERE tr.sucursal_origen_id = tr.sucursal_destino_id
                  {filterStr}
                ORDER BY tr.fecha_traslado DESC, tr.id DESC";
                
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("debug")]
        public async Task<IActionResult> Debug()
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var m = await connection.QueryAsync("SELECT m.movimiento, COUNT(*), SUM(t.cantidad) FROM inventario.transacciones_inventario t JOIN inventario.movimientos m ON t.movimiento_id = m.id GROUP BY m.movimiento");
            var t = await connection.QueryAsync("SELECT COUNT(*) FROM inventario.traslados WHERE sucursal_origen_id = sucursal_destino_id");
            var e = await connection.QueryAsync("SELECT COUNT(*) FROM inventario.transacciones_inventario t JOIN inventario.movimientos m ON t.movimiento_id = m.id WHERE t.cantidad < 0 AND (m.movimiento = 'CI' OR m.movimiento = 'TS')");
            return Ok(new { movimientos = m, traslados_internos = t, egresos = e });
        }

        [HttpGet("cuentas-cobrar-pendientes")]
        public async Task<IActionResult> GetCuentasCobrarPendientes([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filterStr = GetFilterConditionsWithExistingWhere(startDate, endDate, sucursalId, "f.fecha", "f.sucursal_id");
            var query = $@"
                SELECT s.nombre as Sucursal,
                       COUNT(f.id) as FacturasPendientes,
                       SUM(f.total) as DeudaTotal
                FROM ventas.facturas f
                JOIN public.sucursales s ON f.sucursal_id = s.id
                LEFT JOIN public.condiciones_pago cp ON f.condicion_pago_id = cp.id
                WHERE f.estado_pago = 'PENDIENTE' 
                  AND UPPER(COALESCE(f.estado, '')) NOT IN ('AN', 'ANULADA')
                  AND COALESCE(cp.dias, 0) > 0 
                  {filterStr}
                GROUP BY s.nombre
                ORDER BY DeudaTotal DESC";
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("consumos-detalle")]
        public async Task<IActionResult> GetConsumosDetalle([FromQuery] long? bodegaId, [FromQuery] long? ubicacionId, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filterStr = GetFilterConditionsWithExistingWhere(startDate, endDate, sucursalId, "t.created_at", "t.sucursal_id");
            
            if (bodegaId.HasValue) filterStr += " AND t.bodega_id = @bodegaId ";
            if (ubicacionId.HasValue) filterStr += " AND t.ubicacion_id = @ubicacionId ";
            else if (!bodegaId.HasValue && !ubicacionId.HasValue) return BadRequest();

            var query = $@"
                SELECT f.numero as Factura,
                       v.nombre_completo as Vendedor,
                       ABS(t.cantidad) as Cantidad,
                       t.created_at as Fecha,
                       TRIM(CONCAT_WS(' - ', NULLIF(a.code, ''), NULLIF(a.name, ''), NULLIF(a.description, ''))) as Articulo
                FROM inventario.transacciones_inventario t
                JOIN ventas.facturas f ON t.documento_referencia = f.numero
                LEFT JOIN ventas.vendedores v ON f.vendedor_id = v.id
                JOIN public.articulos a ON t.articulo_id = a.id
                WHERE t.cantidad < 0 AND (t.anulado IS FALSE OR t.anulado IS NULL) AND f.estado <> 'AN' {filterStr}
                ORDER BY t.created_at DESC
                LIMIT 50";
            var result = await connection.QueryAsync(query, new { bodegaId, ubicacionId, startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("ventas-resumen")]
        public async Task<IActionResult> GetVentasResumen([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filterStr = GetFilterConditionsWithExistingWhere(startDate, endDate, sucursalId, "f.fecha", "f.sucursal_id");
            var query = $@"
                SELECT 
                    CASE WHEN cp.dias = 0 THEN 'Contado' ELSE 'Crédito (' || cp.dias || ' días)' END as TipoVenta,
                    SUM(f.total) as TotalVentas,
                    COUNT(f.id) as CantidadFacturas
                FROM ventas.facturas f
                JOIN public.condiciones_pago cp ON f.condicion_pago_id = cp.id
                WHERE f.estado <> 'AN' {filterStr}
                GROUP BY cp.dias
                ORDER BY cp.dias ASC";
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("ventas-sucursal-comparativo")]
        public async Task<IActionResult> GetVentasSucursalComparativo([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            
            DateTime start = startDate ?? new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1);
            DateTime end = endDate ?? DateTime.Now;
            
            var diff = end - start;
            DateTime priorStart = start.AddDays(-diff.TotalDays - 1);
            DateTime priorEnd = start.AddDays(-1);

            var query = $@"
                SELECT s.nombre as Sucursal, 
                       COALESCE(SUM(CASE WHEN f.fecha >= @start AND f.fecha <= @end THEN f.total ELSE 0 END), 0) as VentasActual,
                       COALESCE(SUM(CASE WHEN f.fecha >= @priorStart AND f.fecha <= @priorEnd THEN f.total ELSE 0 END), 0) as VentasAnterior
                FROM public.sucursales s
                LEFT JOIN ventas.facturas f ON f.sucursal_id = s.id AND f.estado <> 'AN' AND ((f.fecha >= @start AND f.fecha <= @end) OR (f.fecha >= @priorStart AND f.fecha <= @priorEnd))
                WHERE (@sucursalId IS NULL OR s.id = @sucursalId) AND s.nombre <> 'Los Arcos'
                GROUP BY s.nombre
                ORDER BY VentasActual DESC";
            
            var result = await connection.QueryAsync(query, new { start, end, priorStart, priorEnd, sucursalId });
            return Ok(result);
        }

        [HttpGet("descuentos-vendedor-comparativo")]
        public async Task<IActionResult> GetDescuentosVendedorComparativo([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            
            DateTime start = startDate ?? new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1);
            DateTime end = endDate ?? DateTime.Now;
            
            var diff = end - start;
            DateTime priorStart = start.AddDays(-diff.TotalDays - 1);
            DateTime priorEnd = start.AddDays(-1);

            var query = $@"
                SELECT v.nombre_completo as Vendedor,
                       s.nombre as Sucursal, 
                       COALESCE(SUM(CASE WHEN f.fecha >= @start AND f.fecha <= @end THEN fd.descuento ELSE 0 END), 0) as DescuentosActual,
                       COALESCE(SUM(CASE WHEN f.fecha >= @priorStart AND f.fecha <= @priorEnd THEN fd.descuento ELSE 0 END), 0) as DescuentosAnterior
                FROM ventas.vendedores v
                LEFT JOIN public.sucursales s ON v.sucursal_id = s.id
                LEFT JOIN ventas.facturas f ON f.vendedor_id = v.id AND ((f.fecha >= @start AND f.fecha <= @end) OR (f.fecha >= @priorStart AND f.fecha <= @priorEnd))
                LEFT JOIN ventas.factura_detalles fd ON fd.factura_id = f.id
                WHERE (@sucursalId IS NULL OR s.id = @sucursalId) AND s.nombre <> 'Los Arcos'
                GROUP BY v.nombre_completo, s.nombre
                HAVING SUM(fd.descuento) > 0
                ORDER BY DescuentosActual DESC";
            
            var result = await connection.QueryAsync(query, new { start, end, priorStart, priorEnd, sucursalId });
            return Ok(result);
        }

        [HttpGet("cuentas-cobrar-detalle")]
        public async Task<IActionResult> GetCuentasCobrarDetalle([FromQuery] string? cliente, [FromQuery] int? sucursalId, [FromQuery] int? vendedorId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var query = $@"
                SELECT f.id as FacturaId,
                       f.numero as NumeroFactura,
                       f.fecha as Fecha,
                       c.nombre as Cliente,
                       s.nombre as Sucursal,
                       COALESCE(cp.dias, 0) as DiasCredito,
                       (CURRENT_DATE - f.fecha::date) as DiasTranscurridos,
                       (f.fecha + (COALESCE(cp.dias, 0) || ' days')::interval) as FechaVencimiento,
                       f.total as TotalFactura,
                       COALESCE(pagos.monto_pagado, 0) as MontoPagado,
                       COALESCE(devs.monto_devuelto, 0) as MontoDevuelto,
                       (f.total - COALESCE(pagos.monto_pagado, 0) - COALESCE(devs.monto_devuelto, 0)) as Deuda,
                       devs.numeros_devoluciones as DevolucionAplicada
                FROM ventas.facturas f
                JOIN ventas.clientes c ON f.cliente_id = c.id
                JOIN public.sucursales s ON f.sucursal_id = s.id
                LEFT JOIN public.condiciones_pago cp ON f.condicion_pago_id = cp.id
                LEFT JOIN (
                    SELECT rcd.factura_id, SUM(rcd.monto_aplicado) as monto_pagado
                    FROM caja.recibos_caja_detalle rcd
                    JOIN caja.recibos_caja rc ON rcd.recibo_id = rc.id
                    WHERE rc.estado <> 'ANULADO'
                    GROUP BY rcd.factura_id
                ) pagos ON pagos.factura_id = f.id
                LEFT JOIN (
                    SELECT d.factura_id, SUM(d.total) as monto_devuelto, string_agg(d.numero_devolucion, ', ') as numeros_devoluciones
                    FROM ventas.devoluciones d
                    WHERE d.estado <> 'ANULADA'
                    GROUP BY d.factura_id
                ) devs ON devs.factura_id = f.id
                WHERE f.estado_pago = 'PENDIENTE'
                  AND UPPER(COALESCE(f.estado, '')) NOT IN ('AN', 'ANULADA')
                  AND s.nombre <> 'Los Arcos'
                  AND COALESCE(cp.dias, 0) > 0
                  AND (f.total - COALESCE(pagos.monto_pagado, 0) - COALESCE(devs.monto_devuelto, 0)) > 0.01
                  AND (@sucursalId IS NULL OR f.sucursal_id = @sucursalId)
                  AND (@vendedorId IS NULL OR f.vendedor_id = @vendedorId)
                  AND (@cliente IS NULL OR c.nombre ILIKE '%' || @cliente || '%')
                ORDER BY f.fecha ASC";
            
            var result = await connection.QueryAsync(query, new { sucursalId, vendedorId, cliente });
            return Ok(result);
        }

        [HttpGet("cuentas-cobrar-cliente")]
        public async Task<IActionResult> GetCuentasCobrarCliente([FromQuery] int clienteId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var query = @"
                SELECT f.id as FacturaId,
                       f.numero as NumeroFactura,
                       f.fecha as Fecha,
                       COALESCE(cp.dias, 0) as DiasCredito,
                       (f.fecha + (COALESCE(cp.dias, 0) || ' days')::interval)::date as FechaVencimiento,
                       f.sub_total as SubTotal,
                       f.iva as IVA,
                       f.total as Total,
                       COALESCE(pagos.monto_pagado, 0) as MontoPagado,
                       COALESCE(devs.monto_devuelto, 0) as MontoDevuelto,
                       (f.total - COALESCE(pagos.monto_pagado, 0) - COALESCE(devs.monto_devuelto, 0)) as SaldoPendiente,
                       devs.numeros_devoluciones as DevolucionAplicada,
                       f.estado_pago as EstadoPago,
                       (CASE WHEN f.estado_pago = 'PENDIENTE' AND (f.fecha + (COALESCE(cp.dias, 0) || ' days')::interval)::date < CURRENT_DATE THEN 'VENCIDA'
                             WHEN f.estado_pago = 'PENDIENTE' THEN 'PENDIENTE'
                             ELSE 'PAGADA' END) as EstadoMora
                FROM ventas.facturas f
                LEFT JOIN public.condiciones_pago cp ON f.condicion_pago_id = cp.id
                LEFT JOIN (
                    SELECT rcd.factura_id, SUM(rcd.monto_aplicado) as monto_pagado
                    FROM caja.recibos_caja_detalle rcd
                    JOIN caja.recibos_caja rc ON rcd.recibo_id = rc.id
                    WHERE rc.estado <> 'ANULADO'
                    GROUP BY rcd.factura_id
                ) pagos ON pagos.factura_id = f.id
                LEFT JOIN (
                    SELECT d.factura_id, SUM(d.total) as monto_devuelto, string_agg(d.numero_devolucion, ', ') as numeros_devoluciones
                    FROM ventas.devoluciones d
                    WHERE d.estado <> 'ANULADA'
                    GROUP BY d.factura_id
                ) devs ON devs.factura_id = f.id
                WHERE f.cliente_id = @clienteId AND COALESCE(cp.dias, 0) > 0 AND f.estado <> 'AN'
                ORDER BY f.fecha DESC";
            var result = await connection.QueryAsync(query, new { clienteId });
            return Ok(result);
        }

        [HttpGet("facturas-exportar")]
        public async Task<IActionResult> GetFacturasParaExportar([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filterStr = GetFilterConditionsWithExistingWhere(startDate, endDate, sucursalId, "f.fecha", "f.sucursal_id");
            var query = $@"
                SELECT 
                    f.numero as NumeroFactura,
                    f.fecha as Fecha,
                    c.nombre as Cliente,
                    s.nombre as Sucursal,
                    COALESCE(v.nombre_completo, 'Sin Vendedor') as Vendedor,
                    CASE WHEN cp.dias = 0 THEN 'Contado' ELSE 'Crédito (' || cp.dias || ' días)' END as Condicion,
                    COALESCE(f.estado_pago, 'PENDIENTE') as EstadoPago,
                    COALESCE(f.estado, 'PE') as Estado,
                    f.sub_total as SubTotal,
                    COALESCE(SUM(fd.descuento), 0) as Descuento,
                    f.iva as IVA,
                    f.total as Total
                FROM ventas.facturas f
                LEFT JOIN ventas.clientes c ON f.cliente_id = c.id
                LEFT JOIN public.sucursales s ON f.sucursal_id = s.id
                LEFT JOIN ventas.vendedores v ON f.vendedor_id = v.id
                LEFT JOIN public.condiciones_pago cp ON f.condicion_pago_id = cp.id
                LEFT JOIN ventas.factura_detalles fd ON fd.factura_id = f.id
                WHERE 1=1 {filterStr}
                GROUP BY f.id, f.numero, f.fecha, c.nombre, s.nombre, v.nombre_completo, cp.dias, f.estado_pago, f.estado, f.sub_total, f.iva, f.total
                ORDER BY f.fecha DESC, f.numero DESC";
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("clientes")]
        public async Task<IActionResult> GetClientes()
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var query = @"
                SELECT DISTINCT c.id, c.nombre, c.identificacion 
                FROM ventas.clientes c
                JOIN ventas.facturas f ON f.cliente_id = c.id
                JOIN public.sucursales s ON f.sucursal_id = s.id
                WHERE f.estado_pago = 'PENDIENTE' AND UPPER(COALESCE(f.estado, '')) NOT IN ('AN', 'ANULADA') AND s.nombre <> 'Los Arcos'
                ORDER BY c.nombre";
            var result = await connection.QueryAsync(query);
            return Ok(result);
        }

        [HttpGet("cuentas-cobrar-condiciones")]
        public async Task<IActionResult> GetCuentasCobrarCondiciones([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filterStr = GetFilterConditionsWithExistingWhere(startDate, endDate, sucursalId, "f.fecha", "f.sucursal_id");
            var query = $@"
                SELECT 
                    CASE WHEN cp.dias = 0 THEN 'Contado' ELSE 'Crédito (' || cp.dias || ' días)' END as Condicion,
                    COUNT(f.id) as CantidadFacturas,
                    SUM(f.total) as DeudaTotal
                FROM ventas.facturas f
                JOIN public.condiciones_pago cp ON f.condicion_pago_id = cp.id
                WHERE f.estado_pago = 'PENDIENTE' AND UPPER(COALESCE(f.estado, '')) NOT IN ('AN', 'ANULADA') AND COALESCE(cp.dias, 0) > 0 {filterStr}
                GROUP BY cp.dias, cp.descripcion
                ORDER BY cp.dias ASC";
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("cuentas-cobrar-vencidas")]
        public async Task<IActionResult> GetCuentasCobrarVencidas([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filterStr = GetFilterConditionsWithExistingWhere(startDate, endDate, sucursalId, "f.fecha", "f.sucursal_id");
            var query = $@"
                SELECT f.numero as NumeroFactura,
                       f.fecha as Fecha,
                       c.nombre as Cliente,
                       s.nombre as Sucursal,
                       COALESCE(cp.dias, 0) as DiasCredito,
                       (CURRENT_DATE - (f.fecha + (COALESCE(cp.dias, 0) || ' days')::interval)::date) as DiasVencidos,
                       (f.fecha + (COALESCE(cp.dias, 0) || ' days')::interval)::date as FechaVencimiento,
                       f.total as Deuda
                FROM ventas.facturas f
                JOIN ventas.clientes c ON f.cliente_id = c.id
                JOIN public.sucursales s ON f.sucursal_id = s.id
                LEFT JOIN public.condiciones_pago cp ON f.condicion_pago_id = cp.id
                WHERE f.estado_pago = 'PENDIENTE'
                  AND UPPER(COALESCE(f.estado, '')) NOT IN ('AN', 'ANULADA')
                  AND COALESCE(cp.dias, 0) > 0
                  AND (f.fecha + (COALESCE(cp.dias, 0) || ' days')::interval)::date < CURRENT_DATE
                  {filterStr}
                ORDER BY DiasVencidos DESC";
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("ventas-resumen-detallado")]
        public async Task<IActionResult> GetVentasResumenDetallado([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filterStr = GetFilterConditionsWithExistingWhere(startDate, endDate, sucursalId, "f.fecha", "f.sucursal_id");
            var query = $@"
                SELECT 
                    COALESCE(SUM(CASE WHEN UPPER(COALESCE(f.estado, '')) NOT IN ('AN', 'ANULADA') THEN f.sub_total ELSE 0 END), 0) as SubtotalBruto,
                    COALESCE(SUM(CASE WHEN UPPER(COALESCE(f.estado, '')) NOT IN ('AN', 'ANULADA') THEN COALESCE(fd.descuento, 0) ELSE 0 END), 0) as TotalDescuento,
                    COALESCE(SUM(CASE WHEN UPPER(COALESCE(f.estado, '')) NOT IN ('AN', 'ANULADA') THEN f.sub_total - COALESCE(fd.descuento, 0) ELSE 0 END), 0) as SubtotalNeto,
                    COALESCE(SUM(CASE WHEN UPPER(COALESCE(f.estado, '')) NOT IN ('AN', 'ANULADA') THEN f.sub_total - COALESCE(fd.descuento, 0) ELSE 0 END), 0) as SubtotalVentas,
                    COALESCE(SUM(CASE WHEN UPPER(COALESCE(f.estado, '')) NOT IN ('AN', 'ANULADA') THEN f.iva ELSE 0 END), 0) as IvaVentas,
                    COALESCE(SUM(CASE WHEN UPPER(COALESCE(f.estado, '')) NOT IN ('AN', 'ANULADA') THEN (f.sub_total - COALESCE(fd.descuento, 0)) + f.iva ELSE 0 END), 0) as TotalVentas,
                    COALESCE(SUM(CASE WHEN UPPER(COALESCE(f.estado, '')) IN ('AN', 'ANULADA') THEN f.total ELSE 0 END), 0) as TotalAnulado,
                    COUNT(CASE WHEN UPPER(COALESCE(f.estado, '')) IN ('AN', 'ANULADA') THEN 1 END) as CantidadAnuladas,
                    COALESCE(SUM(CASE WHEN UPPER(COALESCE(f.estado, '')) NOT IN ('AN', 'ANULADA') AND cp.dias = 0 THEN f.total ELSE 0 END), 0) as VentasContado,
                    COALESCE(SUM(CASE WHEN UPPER(COALESCE(f.estado, '')) NOT IN ('AN', 'ANULADA') AND cp.dias > 0 THEN f.total ELSE 0 END), 0) as VentasCredito
                FROM ventas.facturas f
                LEFT JOIN public.condiciones_pago cp ON f.condicion_pago_id = cp.id
                LEFT JOIN (
                    SELECT factura_id, SUM(descuento) as descuento 
                    FROM ventas.factura_detalles 
                    GROUP BY factura_id
                ) fd ON fd.factura_id = f.id
                WHERE 1=1 {filterStr}";
            var result = await connection.QueryFirstOrDefaultAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("facturas-anuladas")]
        public async Task<IActionResult> GetFacturasAnuladas([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filterStr = GetFilterConditionsWithExistingWhere(startDate, endDate, sucursalId, "f.fecha", "f.sucursal_id");
            var query = $@"
                SELECT 
                    f.id,
                    f.numero as NumeroFactura,
                    f.fecha as Fecha,
                    c.nombre as Cliente,
                    c.identificacion as Identificacion,
                    s.nombre as Sucursal,
                    v.nombre_completo as Vendedor,
                    f.sub_total as SubTotal,
                    COALESCE(SUM(fd.descuento), 0) as Descuento,
                    f.iva as IVA,
                    f.total as Total
                FROM ventas.facturas f
                JOIN ventas.clientes c ON f.cliente_id = c.id
                JOIN public.sucursales s ON f.sucursal_id = s.id
                LEFT JOIN ventas.vendedores v ON f.vendedor_id = v.id
                LEFT JOIN ventas.factura_detalles fd ON fd.factura_id = f.id
                WHERE UPPER(COALESCE(f.estado, '')) IN ('AN', 'ANULADA') {filterStr}
                GROUP BY f.id, f.numero, f.fecha, c.nombre, c.identificacion, s.nombre, v.nombre_completo, f.sub_total, f.iva, f.total
                ORDER BY f.fecha DESC";
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("cuentas-pagar-pendientes")]
        public async Task<IActionResult> GetCuentasPagarPendientes([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filterStr = GetFilterConditionsWithExistingWhere(startDate, endDate, sucursalId, "oc.created_at", "oc.sucursal_id");
            var query = $@"
                SELECT 
                    p.id as ProveedorId,
                    p.nombre as Proveedor,
                    p.nit as Nit,
                    COUNT(oc.id_orden) as FacturasPendientes,
                    COALESCE(SUM(oc.total), 0) as DeudaTotal
                FROM public.orden_compra oc
                JOIN public.proveedores p ON oc.proveedor_id = p.id
                LEFT JOIN public.condiciones_pago cp ON oc.condicion_pago = cp.id
                WHERE oc.estado_id = 2 -- Aprobado (Pending payment)
                  AND COALESCE(cp.dias, 0) > 0
                  {filterStr}
                GROUP BY p.id, p.nombre, p.nit
                ORDER BY DeudaTotal DESC";
            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("cuentas-pagar-detalle")]
        public async Task<IActionResult> GetCuentasPagarDetalle([FromQuery] int? proveedorId, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filterStr = GetFilterConditionsWithExistingWhere(startDate, endDate, sucursalId, "oc.created_at", "oc.sucursal_id");
            if (proveedorId.HasValue) filterStr += " AND oc.proveedor_id = @proveedorId";
            var query = $@"
                SELECT 
                    oc.id_orden as IdOrden,
                    oc.numero_orden as NumeroOrden,
                    p.nombre as Proveedor,
                    s.nombre as Sucursal,
                    oc.created_at as Fecha,
                    COALESCE(cp.dias, 0) as DiasCredito,
                    (oc.created_at + (COALESCE(cp.dias, 0) || ' days')::interval)::date as FechaVencimiento,
                    (CURRENT_DATE - (oc.created_at + (COALESCE(cp.dias, 0) || ' days')::interval)::date) as DiasVencidos,
                    oc.total as Total
                FROM public.orden_compra oc
                JOIN public.proveedores p ON oc.proveedor_id = p.id
                JOIN public.sucursales s ON oc.sucursal_id = s.id
                LEFT JOIN public.condiciones_pago cp ON oc.condicion_pago = cp.id
                WHERE oc.estado_id = 2 -- Aprobado
                  AND COALESCE(cp.dias, 0) > 0
                  {filterStr}
                ORDER BY FechaVencimiento ASC";
            var result = await connection.QueryAsync(query, new { proveedorId, startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("existencias-estatus-stock")]
        public async Task<IActionResult> GetExistenciasEstatusStock([FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var query = @"
                SELECT 
                    a.code as Codigo,
                    TRIM(CONCAT_WS(' - ', NULLIF(a.code, ''), NULLIF(a.name, ''), NULLIF(a.description, ''))) as Articulo,
                    s.nombre as Sucursal,
                    b.descripcion as Bodega,
                    COALESCE(u.nivel_1, 'N/A') || '-' || COALESCE(u.nivel_2, '') as Ubicacion,
                    e.cantidad as Existencia,
                    a.stock_min as StockMin,
                    a.stock_max as StockMax,
                    CASE 
                        WHEN e.cantidad = 0 THEN 'En Cero'
                        WHEN e.cantidad > 0 AND e.cantidad <= a.stock_min THEN 'Bajo Mínimo'
                        WHEN e.cantidad >= a.stock_max THEN 'Sobre Máximo'
                        ELSE 'Normal'
                    END as EstatusStock
                FROM inventario.exstencias e
                JOIN public.articulos a ON e.articulo_id = a.id
                JOIN public.sucursales s ON e.sucursal_id = s.id
                JOIN public.bodegas b ON e.bodega_id = b.id
                LEFT JOIN public.bodega_ubicaciones u ON e.ubicacion_id = u.id
                WHERE (@sucursalId IS NULL OR e.sucursal_id = @sucursalId)
                ORDER BY s.nombre, b.descripcion, a.code";
            var result = await connection.QueryAsync(query, new { sucursalId });
            return Ok(result);
        }

        [HttpGet("proveedores-catalogo")]
        public async Task<IActionResult> GetProveedoresCatalogo()
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var query = @"SELECT id, nit, nombre FROM public.proveedores WHERE activo = true ORDER BY nombre";
            var result = await connection.QueryAsync(query);
            return Ok(result);
        }

        [HttpGet("condiciones-pago-catalogo")]
        public async Task<IActionResult> GetCondicionesPagoCatalogo()
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var query = @"SELECT id, descripcion, COALESCE(dias, 0) as dias FROM public.condiciones_pago ORDER BY dias";
            var result = await connection.QueryAsync(query);
            return Ok(result);
        }

        [HttpGet("solicitudes-compra-catalogo")]
        public async Task<IActionResult> GetSolicitudesCompraCatalogo([FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            // Include estados 1 (pendiente), 2 (aprobada), 3 (en proceso) — exclude only cancelled/completed
            var sucursalFilter = sucursalId.HasValue
                ? "WHERE cs.sucursal_id = @sucursalId AND cs.estado_id IN (1, 2, 3)"
                : "WHERE cs.estado_id IN (1, 2, 3)";
            var query = $@"
                SELECT cs.id, cs.numero_solicitud, cs.fecha, COALESCE(cs.observacion, '') as observacion
                FROM public.compras_solicitudes cs
                {sucursalFilter}
                ORDER BY cs.created_at DESC
                LIMIT 100";
            var result = await connection.QueryAsync(query, new { sucursalId });
            return Ok(result);
        }

        [HttpGet("articulos-catalogo")]
        public async Task<IActionResult> GetArticulosCatalogo()
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var query = @"
                SELECT 
                    a.id as Id,
                    a.code as Codigo,
                    a.name as Nombre,
                    COALESCE(a.description, '') as Descripcion,
                    COALESCE(u.description, '') as Unidad
                FROM public.articulos a
                LEFT JOIN public.unidades u ON a.unidad_id = u.id
                ORDER BY a.code";
            var result = await connection.QueryAsync(query);
            return Ok(result);
        }

        [HttpPost("cargar-compras")]
        public async Task<IActionResult> CargarCompras([FromBody] CargarComprasRequest request)
        {
            if (request == null || request.Cabecera == null || request.Detalles == null || !request.Detalles.Any())
            {
                return BadRequest("Se requieren los datos de la cabecera y al menos un artículo en los detalles.");
            }

            using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            using var transaction = await connection.BeginTransactionAsync();

            try
            {
                var cab = request.Cabecera;

                // 1. Get next order number
                var maxIdResult = await connection.QuerySingleOrDefaultAsync<int?>(
                    "SELECT MAX(id_orden) FROM public.orden_compra", transaction: transaction);
                int nextId = (maxIdResult ?? 0) + 1;

                // Get next order number string
                var maxNumResult = await connection.QuerySingleOrDefaultAsync<string?>(
                    "SELECT numero_orden FROM public.orden_compra ORDER BY id_orden DESC LIMIT 1", transaction: transaction);
                int nextNum = 1;
                if (maxNumResult != null && maxNumResult.StartsWith("OC-"))
                {
                    int.TryParse(maxNumResult.Replace("OC-", ""), out nextNum);
                    nextNum++;
                }
                string numeroOrden = $"OC-{nextNum:D6}";

                // 2. Calculate totals from details
                decimal subTotal = request.Detalles.Sum(d => d.Cantidad * d.PrecioCu);
                decimal descuento = subTotal * (cab.PorcentajeDescuento / 100m);
                decimal baseGravable = subTotal - descuento;
                decimal iva = cab.AplicarIva ? baseGravable * 0.15m : 0m;
                decimal total = baseGravable + iva;

                // 3. Insert header
                var insertCabeceraQuery = @"
                    INSERT INTO public.orden_compra (
                        id_orden, sucursal_id, solicitud_id, proveedor_id, condicion_pago, aplicar_iva,
                        porcentaje_descuento, observacion, moneda_id, created_at, created_by,
                        numero_orden, fecha_solicitud, estado_id, sub_total, iva, total, descuento,
                        updated_at, updated_by
                    ) VALUES (
                        @IdOrden, @SucursalId, @SolicitudId, @ProveedorId, @CondicionPago, @AplicarIva,
                        @PorcentajeDescuento, @Observacion, @MonedaId, @FechaSolicitud, @CreatedBy,
                        @NumeroOrden, @FechaSolicitud, @EstadoId, @SubTotal, @Iva, @Total, @Descuento,
                        @FechaSolicitud, @CreatedBy
                    )";

                await connection.ExecuteAsync(insertCabeceraQuery, new
                {
                    IdOrden = nextId,
                    cab.SucursalId,
                    SolicitudId = cab.SolicitudId.HasValue ? (object)cab.SolicitudId.Value : null,
                    cab.ProveedorId,
                    cab.CondicionPago,
                    cab.AplicarIva,
                    cab.PorcentajeDescuento,
                    cab.Observacion,
                    MonedaId = cab.MonedaId,
                    FechaSolicitud = cab.FechaSolicitud == default ? DateTime.Today : cab.FechaSolicitud,
                    cab.CreatedBy,
                    NumeroOrden = numeroOrden,
                    EstadoId = 2, // Aprobado
                    SubTotal = subTotal,
                    Iva = iva,
                    Total = total,
                    Descuento = descuento
                }, transaction);

                // 4. Insert details
                var insertDetalleQuery = @"
                    INSERT INTO public.orden_compra_detalles (
                        orden_id, articulo_id, precio_cu, cantidad, created_by, created_at
                    ) VALUES (
                        @OrdenId, @ArticuloId, @PrecioCu, @Cantidad, @CreatedBy, @CreatedAt
                    )";

                var detallesParaInsertar = request.Detalles.Select(d => new
                {
                    OrdenId = nextId,
                    d.ArticuloId,
                    d.PrecioCu,
                    d.Cantidad,
                    CreatedBy = cab.CreatedBy,
                    CreatedAt = (cab.FechaSolicitud == default ? DateTime.Today : cab.FechaSolicitud).Date
                }).ToList();

                await connection.ExecuteAsync(insertDetalleQuery, detallesParaInsertar, transaction);

                await transaction.CommitAsync();

                return Ok(new
                {
                    message = $"Orden {numeroOrden} creada exitosamente con {request.Detalles.Count} artículo(s). Total: {total:C2}",
                    numeroOrden,
                    idOrden = nextId,
                    total,
                    subTotal,
                    iva,
                    descuento
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Error al crear la orden de compra: {ex.Message}");
            }
        }

        [HttpGet("preformas-estadisticas")]
        public async Task<IActionResult> GetPreformasEstadisticas([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filters = GetFilterConditionsInventario(startDate, endDate, sucursalId, "p.fecha", "p.sucursal_id");

            var queryKpis = $@"
                SELECT 
                    COUNT(DISTINCT p.id) as TotalPreformas,
                    COUNT(DISTINCT CASE WHEN f.id IS NOT NULL THEN p.id END) as PreformasFacturadas,
                    COUNT(DISTINCT CASE WHEN f.id IS NULL AND p.fecha_expiracion >= CURRENT_DATE THEN p.id END) as PreformasVigentes,
                    COUNT(DISTINCT CASE WHEN f.id IS NULL AND p.fecha_expiracion < CURRENT_DATE THEN p.id END) as PreformasVencidas,
                    COALESCE(SUM(p.total), 0) as MontoTotal,
                    COALESCE(SUM(CASE WHEN f.id IS NOT NULL THEN p.total ELSE 0 END), 0) as MontoFacturado,
                    COALESCE(AVG(p.total), 0) as PromedioPreforma
                FROM ventas.preformas p
                LEFT JOIN ventas.facturas f ON f.preforma_id = p.id
                LEFT JOIN public.sucursales s ON p.sucursal_id = s.id
                {filters}";

            var queryDiario = $@"
                SELECT 
                    p.fecha::date as Fecha,
                    COUNT(DISTINCT p.id) as PreformasEmitidas,
                    COUNT(DISTINCT CASE WHEN f.id IS NOT NULL THEN p.id END) as PreformasFacturadas,
                    COALESCE(SUM(p.total), 0) as MontoPreformas,
                    COALESCE(SUM(CASE WHEN f.id IS NOT NULL THEN p.total ELSE 0 END), 0) as MontoFacturado
                FROM ventas.preformas p
                LEFT JOIN ventas.facturas f ON f.preforma_id = p.id
                LEFT JOIN public.sucursales s ON p.sucursal_id = s.id
                {filters}
                GROUP BY p.fecha::date
                ORDER BY Fecha ASC";

            var querySucursal = $@"
                SELECT 
                    COALESCE(s.nombre, 'Sin Sucursal') as Sucursal,
                    COUNT(DISTINCT p.id) as Cantidad,
                    COUNT(DISTINCT CASE WHEN f.id IS NOT NULL THEN p.id END) as Facturadas,
                    COALESCE(SUM(p.total), 0) as MontoTotal,
                    COALESCE(SUM(CASE WHEN f.id IS NOT NULL THEN p.total ELSE 0 END), 0) as MontoFacturado
                FROM ventas.preformas p
                LEFT JOIN ventas.facturas f ON f.preforma_id = p.id
                LEFT JOIN public.sucursales s ON p.sucursal_id = s.id
                {filters}
                GROUP BY s.nombre
                ORDER BY MontoTotal DESC";

            var queryTopArticulos = $@"
                SELECT 
                    TRIM(CONCAT_WS(' - ', NULLIF(a.code, ''), NULLIF(a.name, ''), NULLIF(a.description, ''))) as Articulo,
                    SUM(pd.cantidad) as CantidadTotal,
                    COALESCE(SUM(pd.total), 0) as MontoTotal
                FROM ventas.preforma_detalles pd
                JOIN ventas.preformas p ON pd.preforma_id = p.id
                LEFT JOIN public.sucursales s ON p.sucursal_id = s.id
                JOIN public.articulos a ON pd.articulo_id = a.id
                {filters}
                GROUP BY a.code, a.name, a.description
                ORDER BY MontoTotal DESC
                LIMIT 10";

            var queryTopClientes = $@"
                SELECT 
                    COALESCE(c.nombre, 'Cliente #' || p.cliente_id) as Cliente,
                    COUNT(DISTINCT p.id) as CantidadPreformas,
                    COUNT(DISTINCT CASE WHEN f.id IS NOT NULL THEN p.id END) as PreformasFacturadas,
                    COALESCE(SUM(p.total), 0) as MontoTotal,
                    COALESCE(SUM(CASE WHEN f.id IS NOT NULL THEN p.total ELSE 0 END), 0) as MontoFacturado
                FROM ventas.preformas p
                LEFT JOIN ventas.facturas f ON f.preforma_id = p.id
                LEFT JOIN ventas.clientes c ON p.cliente_id = c.id
                LEFT JOIN public.sucursales s ON p.sucursal_id = s.id
                {filters}
                GROUP BY c.nombre, p.cliente_id
                ORDER BY MontoTotal DESC
                LIMIT 10";

            var kpis = await connection.QueryFirstOrDefaultAsync(queryKpis, new { startDate, endDate, sucursalId });
            var diario = await connection.QueryAsync(queryDiario, new { startDate, endDate, sucursalId });
            var porSucursal = await connection.QueryAsync(querySucursal, new { startDate, endDate, sucursalId });
            var topArticulos = await connection.QueryAsync(queryTopArticulos, new { startDate, endDate, sucursalId });
            var topClientes = await connection.QueryAsync(queryTopClientes, new { startDate, endDate, sucursalId });

            return Ok(new
            {
                Kpis = kpis,
                Diario = diario,
                PorSucursal = porSucursal,
                TopArticulos = topArticulos,
                TopClientes = topClientes
            });
        }

        [HttpGet("preformas-listado")]
        public async Task<IActionResult> GetPreformasListado([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filters = GetFilterConditionsInventario(startDate, endDate, sucursalId, "p.fecha", "p.sucursal_id");

            var query = $@"
                SELECT 
                    p.id as Id,
                    COALESCE(p.documento, 'PF-' || p.id) as Documento,
                    f.numero as NumeroFactura,
                    p.fecha as Fecha,
                    p.fecha_expiracion as FechaExpiracion,
                    COALESCE(c.nombre, 'Cliente #' || p.cliente_id) as Cliente,
                    COALESCE(s.nombre, 'Sucursal #' || p.sucursal_id) as Sucursal,
                    p.total as Total,
                    p.sub_total as SubTotal,
                    p.iva as Iva,
                    CASE 
                        WHEN f.id IS NOT NULL THEN 'Facturada' 
                        WHEN p.fecha_expiracion >= CURRENT_DATE THEN 'Vigente' 
                        ELSE 'Vencida' 
                    END as EstadoVigencia
                FROM ventas.preformas p
                LEFT JOIN ventas.facturas f ON f.preforma_id = p.id
                LEFT JOIN ventas.clientes c ON p.cliente_id = c.id
                LEFT JOIN public.sucursales s ON p.sucursal_id = s.id
                {filters}
                ORDER BY p.fecha DESC, p.id DESC";

            var result = await connection.QueryAsync<PreformaListadoDto>(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("compras-listado")]
        public async Task<IActionResult> GetComprasListado([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filters = GetFilterConditionsInventario(startDate, endDate, sucursalId, "oc.created_at", "oc.sucursal_id");

            var query = $@"
                SELECT 
                    oc.id_orden as Id,
                    oc.numero_orden as NumeroOrden,
                    COALESCE(em.factura, 'Sin Factura') as NumeroFactura,
                    oc.fecha_solicitud as Fecha,
                    p.nombre as Proveedor,
                    s.nombre as Sucursal,
                    COALESCE(cp.descripcion, 'Contado') as CondicionPago,
                    oc.sub_total as SubTotal,
                    oc.iva as Iva,
                    oc.total as Total,
                    COALESCE(eo.estado, 'Aprobado') as Estado
                FROM public.orden_compra oc
                LEFT JOIN public.embarques em ON em.orden_id = oc.id_orden
                LEFT JOIN public.proveedores p ON oc.proveedor_id = p.id
                LEFT JOIN public.sucursales s ON oc.sucursal_id = s.id
                LEFT JOIN public.condiciones_pago cp ON oc.condicion_pago = cp.id
                LEFT JOIN public.estados_operaciones eo ON oc.estado_id = eo.id
                {filters}
                ORDER BY oc.fecha_solicitud DESC, oc.id_orden DESC";

            var result = await connection.QueryAsync<CompraListadoDto>(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        [HttpGet("compras-realizadas")]
        public async Task<IActionResult> GetComprasRealizadas([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? sucursalId)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var filters = GetFilterConditionsWithExistingWhereInventario(startDate, endDate, sucursalId, "em.created_at", "COALESCE(em.sucursal_id, oc.sucursal_id)");

            var query = $@"
                SELECT 
                    em.id as Id,
                    COALESCE(oc.numero_orden, 'SIN-OC') as NumeroOrden,
                    em.factura as NumeroFactura,
                    COALESCE(em.factura_fecha, em.created_at) as Fecha,
                    COALESCE(p.nombre, p_oc.nombre, 'Sin Proveedor') as Proveedor,
                    s.nombre as Sucursal,
                    COALESCE(cp.descripcion, 'Contado') as CondicionPago,
                    em.sub_total as SubTotal,
                    em.iva as Iva,
                    em.total as Total,
                    COALESCE(eo.estado, 'Aplicado') as Estado
                FROM public.embarques em
                LEFT JOIN public.orden_compra oc ON em.orden_id = oc.id_orden
                LEFT JOIN public.proveedores p ON em.proveedor_id = p.id
                LEFT JOIN public.proveedores p_oc ON oc.proveedor_id = p_oc.id
                LEFT JOIN public.sucursales s ON COALESCE(em.sucursal_id, oc.sucursal_id) = s.id
                LEFT JOIN public.condiciones_pago cp ON em.condicion_pago_id = cp.id
                LEFT JOIN public.estados_operaciones eo ON em.estado_id = eo.id
                WHERE 1=1 {filters}
                ORDER BY em.created_at DESC, em.id DESC";

            var result = await connection.QueryAsync<CompraListadoDto>(query, new { startDate, endDate, sucursalId });
            return Ok(result);
        }

        // --- ENDPOINTS DE DEVOLUCION Y NOTAS DE CREDITO ---

        [HttpGet("factura-devolucion-info/{query}")]
        public async Task<IActionResult> GetFacturaDevolucionInfo(string query)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();

            var factura = await connection.QueryFirstOrDefaultAsync(@"
                SELECT f.id, f.numero as Numero, f.fecha as Fecha, 
                       f.cliente_id as ClienteId, c.nombre as Cliente,
                       f.sucursal_id as SucursalId, s.nombre as Sucursal, s.codigo as SucursalCodigo,
                       f.sub_total as SubTotal, f.iva as IVA, f.total as Total, f.estado as Estado
                FROM ventas.facturas f
                JOIN ventas.clientes c ON f.cliente_id = c.id
                JOIN public.sucursales s ON f.sucursal_id = s.id
                WHERE (f.id::text = @query OR LOWER(f.numero) = LOWER(@query)) AND f.estado <> 'AN'",
                new { query });

            if (factura == null)
                return NotFound(new { Error = "Factura no encontrada o se encuentra anulada." });

            var detalles = await connection.QueryAsync(@"
                SELECT 
                    fd.id as FacturaDetalleId,
                    fd.articulo_id as ArticuloId,
                    art.code as ArticuloCodigo,
                    COALESCE(NULLIF(art.description, ''), art.name) as ArticuloNombre,
                    fd.bodega_id as BodegaId,
                    b.descripcion as BodegaNombre,
                    fd.ubicacion_id as UbicacionId,
                    COALESCE(ub.nivel_1, 'N/A') as UbicacionNombre,
                    fd.cantidad as CantidadFacturada,
                    COALESCE(dev_prev.cantidad_devuelta, 0) as CantidadDevuelta,
                    (fd.cantidad - COALESCE(dev_prev.cantidad_devuelta, 0)) as CantidadDisponible,
                    fd.precio_unitario as PrecioUnitario,
                    fd.descuento as Descuento,
                    fd.porcentaje_descuento as PorcentajeDescuento
                FROM ventas.factura_detalles fd
                JOIN public.articulos art ON fd.articulo_id = art.id
                LEFT JOIN public.bodegas b ON fd.bodega_id = b.id
                LEFT JOIN public.bodega_ubicaciones ub ON fd.ubicacion_id = ub.id
                LEFT JOIN (
                    SELECT dd.factura_detalle_id, SUM(dd.cantidad) as cantidad_devuelta
                    FROM ventas.devolucion_detalles dd
                    JOIN ventas.devoluciones d ON dd.devolucion_id = d.id
                    WHERE d.factura_id = @facturaId
                    GROUP BY dd.factura_detalle_id
                ) dev_prev ON dev_prev.factura_detalle_id = fd.id
                WHERE fd.factura_id = @facturaId
                ORDER BY fd.id ASC", new { facturaId = (long)factura.id });

            return Ok(new { Factura = factura, Detalles = detalles });
        }

        [HttpPost("devoluciones")]
        public async Task<IActionResult> ProcessDevolucion([FromBody] DevolucionCreateDto dto)
        {
            if (dto == null || dto.Items == null || dto.Items.Count == 0)
                return BadRequest(new { Error = "Debe proporcionar al menos un ítem a devolver." });

            using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            using var transaction = await connection.BeginTransactionAsync();

            try
            {
                var factura = await connection.QueryFirstOrDefaultAsync(@"
                    SELECT f.id, f.numero, f.cliente_id, f.sucursal_id, f.total, f.estado_pago, f.estado,
                           s.nombre as sucursal_nombre, COALESCE(cp.dias, 0) as dias_credito
                    FROM ventas.facturas f
                    JOIN public.sucursales s ON f.sucursal_id = s.id
                    LEFT JOIN public.condiciones_pago cp ON f.condicion_pago_id = cp.id
                    WHERE f.id = @facturaId AND f.estado <> 'AN'",
                    new { facturaId = dto.FacturaId }, transaction);

                if (factura == null)
                    return BadRequest(new { Error = "La factura especificada no existe o está anulada." });

                long sucursalId = (long)factura.sucursal_id;
                long clienteId = (long)factura.cliente_id;
                bool esFacturaCredito = (long)factura.dias_credito > 0 || (string)factura.estado_pago == "PENDIENTE";

                var movDevId = await connection.QueryFirstOrDefaultAsync<long?>(
                    "SELECT id FROM inventario.movimientos WHERE movimiento = 'DEV'", null, transaction);
                if (!movDevId.HasValue)
                {
                    movDevId = await connection.QuerySingleAsync<long>(
                        "INSERT INTO inventario.movimientos (id, movimiento, descripcion, naturaleza, created_at) VALUES (COALESCE((SELECT MAX(id) FROM inventario.movimientos), 0) + 1, 'DEV', 'Devolución de Factura', 'E', CURRENT_DATE) RETURNING id", null, transaction);
                }

                string dateStr = DateTime.Now.ToString("yyMMdd");

                var existingDevs = (await connection.QueryAsync<string>(
                    "SELECT numero_devolucion FROM ventas.devoluciones WHERE numero_devolucion LIKE @pattern",
                    new { pattern = $"DEV-{dateStr}-%" }, transaction)).ToList();

                int devCounter = existingDevs.Count + 1;
                string numDevolucion = $"DEV-{dateStr}-{devCounter:D3}";
                while (existingDevs.Contains(numDevolucion))
                {
                    devCounter++;
                    numDevolucion = $"DEV-{dateStr}-{devCounter:D3}";
                }

                decimal totalSubtotal = 0;
                decimal totalIva = 0;
                decimal totalGeneral = 0;

                var itemsToProcess = new List<DevolucionDetalleProcessed>();

                foreach (var item in dto.Items.Where(i => i.CantidadADevolver > 0))
                {
                    var fdet = await connection.QueryFirstOrDefaultAsync(@"
                        SELECT fd.*, 
                               COALESCE(dev_prev.cantidad_devuelta, 0) as cantidad_devuelta
                        FROM ventas.factura_detalles fd
                        LEFT JOIN (
                            SELECT dd.factura_detalle_id, SUM(dd.cantidad) as cantidad_devuelta
                            FROM ventas.devolucion_detalles dd
                            JOIN ventas.devoluciones d ON dd.devolucion_id = d.id
                            WHERE d.factura_id = @facturaId
                            GROUP BY dd.factura_detalle_id
                        ) dev_prev ON dev_prev.factura_detalle_id = fd.id
                        WHERE fd.id = @detalleId",
                        new { detalleId = item.FacturaDetalleId, facturaId = dto.FacturaId }, transaction);

                    if (fdet == null)
                        return BadRequest(new { Error = $"El detalle de factura {item.FacturaDetalleId} no existe." });

                    decimal cantDisponible = (decimal)fdet.cantidad - (decimal)fdet.cantidad_devuelta;
                    if (item.CantidadADevolver > cantDisponible)
                    {
                        return BadRequest(new { Error = $"La cantidad a devolver ({item.CantidadADevolver}) excede la cantidad disponible ({cantDisponible})." });
                    }

                    decimal precioUnit = (decimal)fdet.precio_unitario;
                    decimal descUnit = (decimal)fdet.cantidad > 0 ? ((decimal)fdet.descuento / (decimal)fdet.cantidad) : 0;
                    decimal itemSubtotal = (precioUnit - descUnit) * item.CantidadADevolver;
                    decimal itemIva = Math.Round(itemSubtotal * 0.15m, 4);
                    decimal itemTotal = itemSubtotal + itemIva;

                    totalSubtotal += itemSubtotal;
                    totalIva += itemIva;
                    totalGeneral += itemTotal;

                    itemsToProcess.Add(new DevolucionDetalleProcessed
                    {
                        FacturaDetalleId = fdet.id,
                        ArticuloId = fdet.articulo_id,
                        BodegaId = item.BodegaId > 0 ? item.BodegaId : fdet.bodega_id,
                        UbicacionId = item.UbicacionId.HasValue && item.UbicacionId > 0 ? item.UbicacionId : fdet.ubicacion_id,
                        Cantidad = item.CantidadADevolver,
                        PrecioUnitario = precioUnit,
                        Descuento = descUnit * item.CantidadADevolver,
                        Subtotal = itemSubtotal,
                        Iva = itemIva,
                        Total = itemTotal
                    });
                }

                if (itemsToProcess.Count == 0)
                    return BadRequest(new { Error = "No se especificaron cantidades válidas a devolver." });

                // Calculate if return is TOTAL vs PARTIAL
                decimal cantPendienteTotal = await connection.QueryFirstOrDefaultAsync<decimal>(@"
                    SELECT COALESCE(SUM(fd.cantidad - COALESCE(dev_prev.cantidad_devuelta, 0)), 0)
                    FROM ventas.factura_detalles fd
                    LEFT JOIN (
                        SELECT dd.factura_detalle_id, SUM(dd.cantidad) as cantidad_devuelta
                        FROM ventas.devolucion_detalles dd
                        JOIN ventas.devoluciones d ON dd.devolucion_id = d.id
                        WHERE d.factura_id = @facturaId
                        GROUP BY dd.factura_detalle_id
                    ) dev_prev ON dev_prev.factura_detalle_id = fd.id
                    WHERE fd.factura_id = @facturaId",
                    new { facturaId = dto.FacturaId }, transaction);

                decimal cantDevueltaHoy = itemsToProcess.Sum(x => x.Cantidad);
                bool esDevolucionTotalArticulos = (cantPendienteTotal - cantDevueltaHoy) <= 0.0001m;

                decimal totalPagadoPrevio = await connection.QueryFirstOrDefaultAsync<decimal>(@"
                    SELECT COALESCE(SUM(rcd.monto_aplicado), 0)
                    FROM caja.recibos_caja_detalle rcd
                    JOIN caja.recibos_caja rc ON rcd.recibo_id = rc.id
                    WHERE rcd.factura_id = @facturaId AND rc.estado <> 'ANULADO'",
                    new { facturaId = dto.FacturaId }, transaction);

                decimal totalDevueltoPrevio = await connection.QueryFirstOrDefaultAsync<decimal>(@"
                    SELECT COALESCE(SUM(total), 0)
                    FROM ventas.devoluciones
                    WHERE factura_id = @facturaId AND estado <> 'ANULADA'",
                    new { facturaId = dto.FacturaId }, transaction);

                decimal saldoDeudaActual = (decimal)factura.total - (totalPagadoPrevio + totalDevueltoPrevio);
                bool esDevolucionTotalSaldo = (saldoDeudaActual - totalGeneral) <= 0.01m;

                bool esDevolucionTotal = esDevolucionTotalArticulos || esDevolucionTotalSaldo;

                string tipoReintegro = esFacturaCredito ? "NOTA_CREDITO" : (dto.TipoReintegro?.ToUpper() == "EFECTIVO" ? "EFECTIVO" : "NOTA_CREDITO");

                // Update invoice status if credit invoice
                if (esFacturaCredito)
                {
                    if (esDevolucionTotal)
                    {
                        // CANCEL THE CXC FOR THIS INVOICE
                        await connection.ExecuteAsync(@"
                            UPDATE ventas.facturas 
                            SET estado_pago = 'PAGADO', estado = 'AP' 
                            WHERE id = @facturaId",
                            new { facturaId = dto.FacturaId }, transaction);
                    }
                    else
                    {
                        await connection.ExecuteAsync(@"
                            UPDATE ventas.facturas 
                            SET estado = 'AP' 
                            WHERE id = @facturaId",
                            new { facturaId = dto.FacturaId }, transaction);
                    }
                }

                long devolucionId = await connection.QuerySingleAsync<long>(@"
                    INSERT INTO ventas.devoluciones (
                        numero_devolucion, factura_id, sucursal_id, cliente_id, tipo_reintegro, 
                        fecha, sub_total, iva, total, observacion, estado, created_at
                    ) VALUES (
                        @numDevolucion, @facturaId, @sucursalId, @clienteId, @tipoReintegro,
                        CURRENT_DATE, @totalSubtotal, @totalIva, @totalGeneral, @observacion, 'APLICADA', NOW()
                    ) RETURNING id",
                    new {
                        numDevolucion,
                        facturaId = dto.FacturaId,
                        sucursalId,
                        clienteId,
                        tipoReintegro,
                        totalSubtotal,
                        totalIva,
                        totalGeneral,
                        observacion = dto.Observacion ?? (esFacturaCredito ? $"Devolución sobre factura de crédito #{factura.numero}" : "")
                    }, transaction);

                foreach (var itp in itemsToProcess)
                {
                    await connection.ExecuteAsync(@"
                        INSERT INTO ventas.devolucion_detalles (
                            devolucion_id, factura_detalle_id, articulo_id, bodega_id, ubicacion_id,
                            cantidad, precio_unitario, descuento, sub_total, iva, total
                        ) VALUES (
                            @devolucionId, @facturaDetalleId, @articuloId, @bodegaId, @ubicacionId,
                            @cantidad, @precioUnitario, @descuento, @subtotal, @iva, @total
                        )",
                        new {
                            devolucionId,
                            facturaDetalleId = itp.FacturaDetalleId,
                            articuloId = itp.ArticuloId,
                            bodegaId = itp.BodegaId,
                            ubicacionId = itp.UbicacionId,
                            cantidad = itp.Cantidad,
                            precioUnitario = itp.PrecioUnitario,
                            descuento = itp.Descuento,
                            subtotal = itp.Subtotal,
                            iva = itp.Iva,
                            total = itp.Total
                        }, transaction);

                    int updatedStock = await connection.ExecuteAsync(@"
                        UPDATE inventario.exstencias 
                        SET cantidad = cantidad + @cantidad 
                        WHERE articulo_id = @articuloId AND sucursal_id = @sucursalId 
                          AND bodega_id = @bodegaId 
                          AND (ubicacion_id = @ubicacionId OR (ubicacion_id IS NULL AND @ubicacionId IS NULL))",
                        new { cantidad = itp.Cantidad, articuloId = itp.ArticuloId, sucursalId, bodegaId = itp.BodegaId, ubicacionId = itp.UbicacionId }, transaction);

                    if (updatedStock == 0)
                    {
                        await connection.ExecuteAsync(@"
                            INSERT INTO inventario.exstencias (articulo_id, sucursal_id, bodega_id, ubicacion_id, cantidad, stock_min, stock_max)
                            VALUES (@articuloId, @sucursalId, @bodegaId, @ubicacionId, @cantidad, 0, 1000)",
                            new { articuloId = itp.ArticuloId, sucursalId, bodegaId = itp.BodegaId, ubicacionId = itp.UbicacionId, cantidad = itp.Cantidad }, transaction);
                    }

                    await connection.ExecuteAsync(@"
                        INSERT INTO inventario.transacciones_inventario (
                            movimiento_id, articulo_id, bodega_id, ubicacion_id, sucursal_id, cantidad, documento_referencia, created_at, anulado
                        ) VALUES (
                            @movDevId, @articuloId, @bodegaId, @ubicacionId, @sucursalId, @cantidad, @numDevolucion, CURRENT_DATE, false
                        )",
                        new { movDevId, articuloId = itp.ArticuloId, bodegaId = itp.BodegaId, ubicacionId = itp.UbicacionId, sucursalId, cantidad = itp.Cantidad, numDevolucion }, transaction);
                }

                // Automatic Receipt in caja.recibos_caja & caja.recibos_caja_detalle
                string descRecibo = esFacturaCredito
                    ? $"Devolución N° {numDevolucion} aplicada a crédito de Factura #{factura.numero}{(esDevolucionTotal ? " (CANCELACIÓN TOTAL DE CXC)" : " (ABONO A DEUDA)")}"
                    : $"Devolución N° {numDevolucion} de Factura #{factura.numero}";

                long reciboId = await connection.QuerySingleAsync<long>(@"
                    INSERT INTO caja.recibos_caja 
                        (serie, numero, fecha, cliente_id, descripcion, importe_total, metodo_pago, sucursal_id, tipo, estado)
                    VALUES 
                        ('DEV', @numDevolucion, CURRENT_DATE, @clienteId, @descRecibo, @totalGeneral, 'NOTA_CREDITO', @sucursalId, 'INGRESO', 'APLICADO')
                    RETURNING id",
                    new { numDevolucion, clienteId, descRecibo, totalGeneral, sucursalId }, transaction);

                await connection.ExecuteAsync(@"
                    INSERT INTO caja.recibos_caja_detalle (recibo_id, factura_id, monto_aplicado, es_parcial)
                    VALUES (@reciboId, @facturaId, @totalGeneral, @esParcial)",
                    new { reciboId, facturaId = dto.FacturaId, totalGeneral, esParcial = !esDevolucionTotal }, transaction);

                var existingNCs = (await connection.QueryAsync<string>(
                    "SELECT numero_nota_credito FROM ventas.notas_credito WHERE numero_nota_credito LIKE @pattern",
                    new { pattern = $"NC-{dateStr}-%" }, transaction)).ToList();

                int ncCounter = existingNCs.Count + 1;
                string numNotaCredito = $"NC-{dateStr}-{ncCounter:D3}";
                while (existingNCs.Contains(numNotaCredito))
                {
                    ncCounter++;
                    numNotaCredito = $"NC-{dateStr}-{ncCounter:D3}";
                }
                long notaCreditoId = await connection.QuerySingleAsync<long>(@"
                    INSERT INTO ventas.notas_credito (
                        numero_nota_credito, devolucion_id, cliente_id, sucursal_id, fecha_emision,
                        monto_subtotal, monto_iva, monto_total, monto_aplicado, monto_saldo,
                        aplicada, estado, recibo_caja_id, factura_aplicada_id, fecha_aplicacion, observacion, created_at
                    ) VALUES (
                        @numNotaCredito, @devolucionId, @clienteId, @sucursalId, CURRENT_DATE,
                        @totalSubtotal, @totalIva, @totalGeneral, @montoAplicadoNC, @montoSaldoNC,
                        @estaAplicadaNC, @estadoNC, @reciboId, @facturaId, @fechaAppNC, @obsNC, NOW()
                    ) RETURNING id",
                    new {
                        numNotaCredito, devolucionId, clienteId, sucursalId,
                        totalSubtotal, totalIva, totalGeneral,
                        montoAplicadoNC = esFacturaCredito ? totalGeneral : 0,
                        montoSaldoNC = esFacturaCredito ? 0 : totalGeneral,
                        estaAplicadaNC = esFacturaCredito,
                        estadoNC = esFacturaCredito ? "APLICADA" : "DISPONIBLE",
                        reciboId,
                        facturaId = dto.FacturaId,
                        fechaAppNC = esFacturaCredito ? (object)DateTime.Now : DBNull.Value,
                        obsNC = esFacturaCredito 
                            ? $"Aplicada automáticamente como crédito a Factura #{factura.numero} (Devolución {numDevolucion})"
                            : (dto.Observacion ?? "")
                    }, transaction);

                await transaction.CommitAsync();

                return Ok(new {
                    Success = true,
                    DevolucionId = devolucionId,
                    NumeroDevolucion = numDevolucion,
                    TipoReintegro = tipoReintegro,
                    NumeroNotaCredito = numNotaCredito,
                    NotaCreditoId = notaCreditoId,
                    EsFacturaCredito = esFacturaCredito,
                    EsDevolucionTotal = esDevolucionTotal,
                    ReciboCajaId = reciboId,
                    Subtotal = totalSubtotal,
                    IVA = totalIva,
                    Total = totalGeneral,
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { Error = ex.Message });
            }
        }

        [HttpGet("devoluciones")]
        public async Task<IActionResult> GetDevoluciones(
            [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate,
            [FromQuery] int? sucursalId, [FromQuery] long? clienteId, [FromQuery] string? tipoReintegro)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var conditions = new List<string>();
            if (startDate.HasValue) conditions.Add("d.fecha >= @startDate");
            if (endDate.HasValue) conditions.Add("d.fecha <= @endDate");
            if (sucursalId.HasValue) conditions.Add("d.sucursal_id = @sucursalId");
            if (clienteId.HasValue) conditions.Add("d.cliente_id = @clienteId");
            if (!string.IsNullOrEmpty(tipoReintegro)) conditions.Add("LOWER(d.tipo_reintegro) = LOWER(@tipoReintegro)");

            var where = conditions.Count > 0 ? "WHERE " + string.Join(" AND ", conditions) : "";

            var query = $@"
                SELECT 
                    d.id, d.numero_devolucion as NumeroDevolucion, d.fecha as Fecha,
                    d.factura_id as FacturaId, f.numero as NumeroFactura,
                    d.sucursal_id as SucursalId, s.nombre as Sucursal,
                    d.cliente_id as ClienteId, c.nombre as Cliente,
                    d.tipo_reintegro as TipoReintegro,
                    d.sub_total as SubTotal, d.iva as IVA, d.total as Total,
                    d.observacion as Observacion, d.estado as Estado,
                    nc.numero_nota_credito as NumeroNotaCredito, nc.estado as EstadoNotaCredito
                FROM ventas.devoluciones d
                JOIN ventas.facturas f ON d.factura_id = f.id
                JOIN public.sucursales s ON d.sucursal_id = s.id
                JOIN ventas.clientes c ON d.cliente_id = c.id
                LEFT JOIN ventas.notas_credito nc ON nc.devolucion_id = d.id
                {where}
                ORDER BY d.fecha DESC, d.id DESC";

            var result = await connection.QueryAsync(query, new { startDate, endDate, sucursalId, clienteId, tipoReintegro });
            return Ok(result);
        }

        [HttpGet("devolucion-detalle/{id}")]
        public async Task<IActionResult> GetDevolucionDetalle(long id)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            var header = await connection.QueryFirstOrDefaultAsync(@"
                SELECT 
                    d.id, d.numero_devolucion as NumeroDevolucion, d.fecha as Fecha,
                    d.factura_id as FacturaId, f.numero as NumeroFactura,
                    d.sucursal_id as SucursalId, s.nombre as Sucursal,
                    d.cliente_id as ClienteId, c.nombre as Cliente, c.identificacion as ClienteRuc,
                    d.tipo_reintegro as TipoReintegro,
                    d.sub_total as SubTotal, d.iva as IVA, d.total as Total,
                    d.observacion as Observacion, d.estado as Estado,
                    nc.id as NotaCreditoId, nc.numero_nota_credito as NumeroNotaCredito
                FROM ventas.devoluciones d
                JOIN ventas.facturas f ON d.factura_id = f.id
                JOIN public.sucursales s ON d.sucursal_id = s.id
                JOIN ventas.clientes c ON d.cliente_id = c.id
                LEFT JOIN ventas.notas_credito nc ON nc.devolucion_id = d.id
                WHERE d.id = @id", new { id });

            if (header == null) return NotFound(new { Error = "Devolución no encontrada." });

            var detalles = await connection.QueryAsync(@"
                SELECT 
                    dd.id, dd.articulo_id as ArticuloId, art.code as ArticuloCodigo,
                    COALESCE(NULLIF(art.description, ''), art.name) as ArticuloNombre,
                    dd.bodega_id as BodegaId, b.descripcion as BodegaNombre,
                    dd.ubicacion_id as UbicacionId, COALESCE(ub.nivel_1, 'N/A') as UbicacionNombre,
                    dd.cantidad as Cantidad, dd.precio_unitario as PrecioUnitario,
                    dd.descuento as Descuento, dd.sub_total as SubTotal,
                    dd.iva as IVA, dd.total as Total
                FROM ventas.devolucion_detalles dd
                JOIN public.articulos art ON dd.articulo_id = art.id
                LEFT JOIN public.bodegas b ON dd.bodega_id = b.id
                LEFT JOIN public.bodega_ubicaciones ub ON dd.ubicacion_id = ub.id
                WHERE dd.devolucion_id = @id
                ORDER BY dd.id ASC", new { id });

            return Ok(new { Header = header, Detalles = detalles });
        }
    }

    public class DevolucionCreateDto
    {
        public long FacturaId { get; set; }
        public string TipoReintegro { get; set; } = "NOTA_CREDITO";
        public string? Observacion { get; set; }
        public List<DevolucionDetalleItemDto> Items { get; set; } = new();
    }

    public class DevolucionDetalleItemDto
    {
        public long FacturaDetalleId { get; set; }
        public long ArticuloId { get; set; }
        public long BodegaId { get; set; }
        public long? UbicacionId { get; set; }
        public decimal CantidadADevolver { get; set; }
    }

    internal class DevolucionDetalleProcessed
    {
        public long FacturaDetalleId { get; set; }
        public long ArticuloId { get; set; }
        public long BodegaId { get; set; }
        public long? UbicacionId { get; set; }
        public decimal Cantidad { get; set; }
        public decimal PrecioUnitario { get; set; }
        public decimal Descuento { get; set; }
        public decimal Subtotal { get; set; }
        public decimal Iva { get; set; }
        public decimal Total { get; set; }
    }

    public class CompraListadoDto
    {
        public long Id { get; set; }
        public string NumeroOrden { get; set; } = "";
        public string NumeroFactura { get; set; } = "";
        public DateTime Fecha { get; set; }
        public string Proveedor { get; set; } = "";
        public string Sucursal { get; set; } = "";
        public string CondicionPago { get; set; } = "";
        public decimal SubTotal { get; set; }
        public decimal Iva { get; set; }
        public decimal Total { get; set; }
        public string Estado { get; set; } = "";
    }

    public class PreformaListadoDto
    {
        public long Id { get; set; }
        public string Documento { get; set; } = "";
        public string? NumeroFactura { get; set; }
        public DateTime Fecha { get; set; }
        public DateTime FechaExpiracion { get; set; }
        public string Cliente { get; set; } = "";
        public string Sucursal { get; set; } = "";
        public decimal Total { get; set; }
        public decimal SubTotal { get; set; }
        public decimal Iva { get; set; }
        public string EstadoVigencia { get; set; } = "";
    }

    public class CargarComprasRequest
    {
        public OrdenCompraDto Cabecera { get; set; } = new();
        public List<OrdenCompraDetalleDto> Detalles { get; set; } = new();
    }

    public class OrdenCompraDto
    {
        public DateTime FechaSolicitud { get; set; }
        public long SucursalId { get; set; }
        public long? SolicitudId { get; set; }
        public long ProveedorId { get; set; }
        public decimal CondicionPago { get; set; }
        public bool AplicarIva { get; set; }
        public decimal PorcentajeDescuento { get; set; }
        public string Observacion { get; set; } = "";
        public long MonedaId { get; set; } = 1;
        public long CreatedBy { get; set; } = 1;
    }

    public class OrdenCompraDetalleDto
    {
        public long ArticuloId { get; set; }
        public decimal Cantidad { get; set; }
        public decimal PrecioCu { get; set; }
    }
}

