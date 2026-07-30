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

print("--- ventas.clientes columns ---")
cols = con.run("SELECT column_name FROM information_schema.columns WHERE table_schema='ventas' AND table_name='clientes'")
print([c[0] for c in cols])

print("\n--- Test preformas query with clientes and sucursales ---")
q = """
    SELECT 
        p.id,
        p.documento,
        p.fecha,
        p.fecha_expiracion,
        COALESCE(c.nombre, 'Cliente #' || p.cliente_id) as cliente,
        COALESCE(s.nombre, 'Sucursal #' || p.sucursal_id) as sucursal,
        p.total,
        p.sub_total,
        p.iva,
        CASE WHEN p.fecha_expiracion >= CURRENT_DATE THEN 'Vigente' ELSE 'Vencida' END as estado_vigencia
    FROM ventas.preformas p
    LEFT JOIN ventas.clientes c ON p.cliente_id = c.id
    LEFT JOIN public.sucursales s ON p.sucursal_id = s.id
    ORDER BY p.fecha DESC
    LIMIT 5
"""
res = con.run(q)
for r in res:
    print(r)
