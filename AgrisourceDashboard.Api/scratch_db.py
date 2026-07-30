import psycopg2
import os

DB_HOST = "localhost"
DB_NAME = "agrisourcedb"
DB_USER = "postgres"
DB_PASS = "admin"

def run_query(query):
    conn = psycopg2.connect(host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS)
    cur = conn.cursor()
    cur.execute(query)
    results = cur.fetchall()
    conn.close()
    return results

print("=== TABLE: caja.sesiones ===")
try:
    print(run_query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'caja' AND table_name = 'sesiones'"))
except Exception as e:
    print("Error:", e)
    
print("=== TABLES IN CAJA SCHEMA ===")
try:
    print(run_query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'caja'"))
except Exception as e:
    print("Error:", e)
