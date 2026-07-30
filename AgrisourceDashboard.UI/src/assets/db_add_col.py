import psycopg2

def run():
    try:
        conn = psycopg2.connect("host=agrisource.postgres.database.azure.com dbname=agrisource user=benno password=y9SFgdmw98QYj6L sslmode=require")
        cur = conn.cursor()
        cur.execute("ALTER TABLE caja.recibos_caja ADD COLUMN IF NOT EXISTS nombre_recibe VARCHAR(150);")
        conn.commit()
        print("Column nombre_recibe added successfully to caja.recibos_caja")
        cur.close()
        conn.close()
    except Exception as e:
        print("Error:", e)

if __name__ == '__main__':
    run()
