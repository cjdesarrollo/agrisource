import ssl
import pg8000.native

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

con = pg8000.native.Connection(
    user='benno', 
    host='agrisource.postgres.database.azure.com', 
    database='agrisource', 
    password='y9SFgdmw98QYj6L', 
    ssl_context=ctx
)

queryKpis = """
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
"""
kpis = con.run(queryKpis)
print("KPIs:", kpis)

queryDiario = """
    SELECT 
        p.fecha::date as Fecha,
        COUNT(DISTINCT p.id) as PreformasEmitidas,
        COUNT(DISTINCT CASE WHEN f.id IS NOT NULL THEN p.id END) as PreformasFacturadas,
        COALESCE(SUM(p.total), 0) as MontoPreformas,
        COALESCE(SUM(CASE WHEN f.id IS NOT NULL THEN p.total ELSE 0 END), 0) as MontoFacturado
    FROM ventas.preformas p
    LEFT JOIN ventas.facturas f ON f.preforma_id = p.id
    GROUP BY p.fecha::date
    ORDER BY Fecha ASC
    LIMIT 5
"""
diario = con.run(queryDiario)
print("Diario:", diario)

queryListado = """
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
    ORDER BY p.fecha DESC, p.id DESC
    LIMIT 5
"""
listado = con.run(queryListado)
print("Listado:", listado)
