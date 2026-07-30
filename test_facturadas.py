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

q = """
    SELECT 
        p.fecha::date as fecha,
        COUNT(DISTINCT p.id) as total_preformas,
        COUNT(DISTINCT CASE WHEN f.id IS NOT NULL THEN p.id END) as preformas_facturadas,
        COALESCE(SUM(p.total), 0) as monto_preformas,
        COALESCE(SUM(CASE WHEN f.id IS NOT NULL THEN p.total ELSE 0 END), 0) as monto_facturado
    FROM ventas.preformas p
    LEFT JOIN ventas.facturas f ON f.preforma_id = p.id
    GROUP BY p.fecha::date
    ORDER BY fecha DESC
    LIMIT 10
"""
res = con.run(q)
print("Fecha | Total Preformas | Preformas Facturadas | Monto Preformas | Monto Facturado")
for r in res:
    print(r)

print("\n--- Preformas listado sample with Factura Numero ---")
q_list = """
    SELECT 
        p.id,
        p.documento,
        p.fecha,
        p.fecha_expiracion,
        c.nombre as cliente,
        s.nombre as sucursal,
        p.total,
        f.numero as numero_factura,
        CASE WHEN f.id IS NOT NULL THEN 'Facturada' ELSE (CASE WHEN p.fecha_expiracion >= CURRENT_DATE THEN 'Vigente' ELSE 'Vencida' END) END as estado
    FROM ventas.preformas p
    LEFT JOIN ventas.clientes c ON p.cliente_id = c.id
    LEFT JOIN public.sucursales s ON p.sucursal_id = s.id
    LEFT JOIN ventas.facturas f ON f.preforma_id = p.id
    ORDER BY p.fecha DESC
    LIMIT 10
"""
res_list = con.run(q_list)
for r in res_list:
    print(r)
