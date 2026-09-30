-- ====================================================================
-- AUTOMATIC REALTIME ACTIVATION FOR SUPABASE POSTGRESQL (PG 15+)
-- Whenever a table is created or modified, Realtime is instantly active
-- ====================================================================

-- 1. Ensure the supabase_realtime publication includes all tables in schema 'public'
-- In PostgreSQL 15+, adding the schema automatically includes all present
-- and all FUTURE tables created in this schema!
ALTER PUBLICATION supabase_realtime ADD TABLES IN SCHEMA public;

-- 2. Create Event Trigger Function to automatically configure REPLICA IDENTITY FULL
-- on newly created or altered tables so UPDATE & DELETE events carry complete rows.
CREATE OR REPLACE FUNCTION public.auto_enable_realtime_for_new_table()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    obj record;
    v_repl text;
BEGIN
    FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() 
               WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'ALTER TABLE') LOOP
        IF obj.schema_name = 'public' THEN
            BEGIN
                -- Check replica identity to prevent recursion
                SELECT c.relreplident INTO v_repl
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = obj.object_identity
                  AND n.nspname = obj.schema_name;

                IF v_repl IS DISTINCT FROM 'f' THEN
                    EXECUTE format('ALTER TABLE %s REPLICA IDENTITY FULL', obj.object_identity);
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- Gracefully handle views, unlogged tables, or foreign tables
            END IF;
        END IF;
    END LOOP;
END;
$$;

-- 3. Install the DDL Event Trigger
DROP EVENT TRIGGER IF EXISTS trg_auto_enable_realtime;
CREATE EVENT TRIGGER trg_auto_enable_realtime
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'ALTER TABLE')
EXECUTE FUNCTION public.auto_enable_realtime_for_new_table();
