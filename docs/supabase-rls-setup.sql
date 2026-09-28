-- =============================================
-- EquiNav: Row Level Security (RLS) Policyer
-- Kör denna SQL i Supabase SQL Editor
-- (Dashboard → SQL Editor → Ny query → Klistra in → Kör)
-- =============================================

-- ============================================
-- 1. VEHICLES-TABELLEN (Endast läsning för alla)
-- ============================================

-- Slå på RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Ta bort eventuella gamla policyer
DROP POLICY IF EXISTS "vehicles_select_all" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_insert_admin" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_update_admin" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_delete_admin" ON public.vehicles;

-- Alla (anon + authenticated) får läsa fordon
CREATE POLICY "vehicles_select_all"
    ON public.vehicles
    FOR SELECT
    USING (true);

-- Ingen (förutom service_role som kringgår RLS) får lägga till, ändra eller radera
-- Om du vill tillåta inloggade admins att redigera, ändra USING-villkoret

-- ============================================
-- 2. HAZARDS-TABELLEN (Läsa + Skapa för alla, radera/ändra begränsat)
-- ============================================

-- Slå på RLS
ALTER TABLE public.hazards ENABLE ROW LEVEL SECURITY;

-- Ta bort eventuella gamla policyer
DROP POLICY IF EXISTS "hazards_select_all" ON public.hazards;
DROP POLICY IF EXISTS "hazards_insert_all" ON public.hazards;
DROP POLICY IF EXISTS "hazards_update_none" ON public.hazards;
DROP POLICY IF EXISTS "hazards_delete_none" ON public.hazards;

-- Alla får läsa hinder (behövs för kartan)
CREATE POLICY "hazards_select_all"
    ON public.hazards
    FOR SELECT
    USING (true);

-- Alla (anon) får rapportera nya hinder
CREATE POLICY "hazards_insert_all"
    ON public.hazards
    FOR INSERT
    WITH CHECK (true);

-- Ingen (förutom service_role) får uppdatera hinder
-- Detta skyddar mot att någon ändrar andras rapporter
CREATE POLICY "hazards_update_none"
    ON public.hazards
    FOR UPDATE
    USING (false);

-- Ingen (förutom service_role) får radera hinder
-- Adminrensning görs via Supabase Dashboard eller service_role
CREATE POLICY "hazards_delete_none"
    ON public.hazards
    FOR DELETE
    USING (false);

-- ============================================
-- 3. VALIDERING: Kontrollera att RLS är aktivt
-- ============================================
-- Kör denna query efter ovanstående för att verifiera:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- Alla tabeller ska visa rowsecurity = true
