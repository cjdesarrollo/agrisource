import ssl
import sys
import subprocess
try:
    import pg8000.native
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pg8000", "--quiet"])
    import pg8000.native

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

def check_db(dbname):
    try:
        print(f"Trying to connect to {dbname}...")
        con = pg8000.native.Connection(
            user='benno', 
            host='agrisource.postgres.database.azure.com', 
            database=dbname, 
            password='y9SFgdmw98QYj6L', 
            ssl_context=ssl_ctx
        )
        tables = con.run("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        print(f"DB: {dbname} - Tables: {[t[0] for t in tables]}")
        if tables:
            for t in tables:
                table_name = t[0]
                cols = con.run(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table_name}' AND table_schema = 'public'")
                print(f"  Table {table_name}:")
                for col in cols:
                    print(f"    - {col[0]} ({col[1]})")
                
                # Fetch first 3 rows as sample
                try:
                    rows = con.run(f"SELECT * FROM \"{table_name}\" LIMIT 3")
                    print(f"    Sample data: {rows}")
                except Exception as e:
                    print(f"    Could not fetch sample data: {e}")
    except Exception as e:
        print(f"DB: {dbname} - Error: {e}")

check_db('postgres')
check_db('agrisource')
check_db('benno')
