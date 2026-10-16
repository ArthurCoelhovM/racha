-- Agendamentos diários (precisa da extensão pg_cron, que o Supabase já oferece)
-- 09:00 em Brasília: lembretes de dívida
-- 00:05 em Brasília: lança os gastos recorrentes do dia
create extension if not exists pg_cron;

select cron.schedule('lembretes-de-divida', '0 12 * * *', $$select public.gerar_lembretes()$$);
select cron.schedule('gastos-recorrentes', '5 3 * * *', $$select public.lancar_recorrentes()$$);
