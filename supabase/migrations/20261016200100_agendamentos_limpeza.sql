-- Limpeza mensal de avisos antigos e tentativas (precisa do pg_cron, como os outros agendamentos)
select cron.schedule('limpeza-mensal', '0 7 1 * *', $$select public.limpar_dados_antigos()$$);
