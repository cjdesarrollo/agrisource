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

print("--- ventas.facturas columns ---")
cols = con.run("SELECT column_name FROM information_schema.columns WHERE table_schema='ventas' AND table_name='facturas'")
print([c[0] for c in cols])

print("\n--- check relationships between preformas and facturas ---")
# Check if facturas has preforma_id or documento or similar
preforma_cols = con.run("SELECT column_name FROM information_schema.columns WHERE table_schema='ventas' AND table_name='preformas'")
print("Preformas cols:", [c[0] for c in preforma_cols])

# Sample facturas rows
facturas_sample = con.run("SELECT * FROM ventas.facturas ORDER BY id DESC LIMIT 5")
cols_f = [c['name'] for c in con.columns]
print("\nFacturas sample cols:", cols_f)
for r in facturas_sample:
    print(r)
