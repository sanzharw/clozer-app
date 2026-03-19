import os
import sys
import psycopg2

def setup_db(password: str):
    conn_str = f"postgresql://postgres:{password}@db.khiekgjggugsxsffycxd.supabase.co:5432/postgres"
    print("Connecting to Supabase Database...")
    try:
        conn = psycopg2.connect(conn_str)
        cursor = conn.cursor()
        
        sql = """
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE IF NOT EXISTS calls (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            customer_name TEXT,
            start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            end_time TIMESTAMP WITH TIME ZONE,
            duration INTEGER,
            sentiment TEXT,
            status TEXT DEFAULT 'active'
        );

        CREATE TABLE IF NOT EXISTS transcripts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
            speaker TEXT,
            text TEXT NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS suggestions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
            suggestion TEXT NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS summaries (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            call_id UUID REFERENCES calls(id) ON DELETE CASCADE UNIQUE,
            summary TEXT,
            objections JSONB,
            next_steps JSONB,
            sentiment TEXT
        );
        """
        cursor.execute(sql)
        conn.commit()
        cursor.close()
        conn.close()
        print("Done! Database tables created successfully.")
    except Exception as e:
        print("Error creating tables:", e)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python setup_db.py <your_db_password>")
        sys.exit(1)
    setup_db(sys.argv[1])
