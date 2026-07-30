import ssl
import pg8000.native

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

con = pg8000.native.Connection(
    user='benno', 
    host='agrisource.postgres.database.azure.com', 
    database='agrisource', 
    password='y9SFgdmw98QYj6L', 
    ssl_context=ssl_ctx
)

tables = con.run("SELECT table_name FROM information_schema.tables WHERE table_schema = 'inventario'")
print("Tables in inventario schema:", [t[0] for t in tables])

for t in tables:
    table_name = t[0]
    cols = con.run(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table_name}' AND table_schema = 'inventario'")
    print(f"\nTable inventario.{table_name}:")
    for col in cols:
        print(f"  - {col[0]} ({col[1]})")
