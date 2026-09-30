# Backup e restauração

Produção requer plano Supabase com backup/PITR e política de retenção aprovada; confirmar termos e capacidade contratada antes do lançamento. Backups de Postgres não substituem cópia dos objetos privados em Storage. Agendar backup versionado dos dois, cifrado fora do projeto, e testar restauração trimestral em projeto isolado. Registrar data, operador, checksums, amostras de documentos, integridade referencial, RPO/RTO medidos e eliminação segura do ambiente de teste. Não restaurar dados reais em development.
