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

print("--- ventas.preformas sample ---")
rows = con.run("SELECT * FROM ventas.preformas ORDER BY id DESC LIMIT 5")
cols = [c['name'] for c in con.columns]
print("Cols:", cols)
for r in rows:
    print(r)

print("\n--- ventas.preforma_detalles sample ---")
rows_det = con.run("SELECT * FROM ventas.preforma_detalles ORDER BY id DESC LIMIT 5")
cols_det = [c['name'] for c in con.columns]
print("Cols:", cols_det)
for r in rows_det:
    print(r)

print("\n--- Summary metrics for preformas ---")
metrics = con.run("""
    SELECT 
        COUNT(*) as total_preformas,
        COALESCE(SUM(total), 0) as monto_total,
        COUNT(DISTINCT cliente_id) as clientes_unicos,
        COUNT(DISTINCT sucursal_id) as sucursales_unicas
    FROM ventas.preformas
""")
print("Preformas summary:", metrics)
