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

cols = con.run("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'recibos_caja' AND table_schema = 'caja'")
for col in cols:
    print(f"{col[0]} ({col[1]})")
