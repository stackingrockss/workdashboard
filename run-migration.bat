@echo off
echo Running SEC cache migration...
echo.

psql "postgresql://neondb_owner:npg_fLCbNhYl49qO@ep-polished-art-af8y9fux-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require" -f migrations/manual-add-sec-cache.sql

echo.
echo Migration complete!
pause
