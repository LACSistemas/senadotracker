PGB="/c/Program Files/PostgreSQL/17/bin"; D=D:/Civica/pgtest_edu4; export PGPASSWORD=postgres
rm -rf /d/Civica/pgtest_edu4; echo postgres > /tmp/pw4.txt
"$PGB/initdb.exe" -D $D -U postgres --pwfile=/tmp/pw4.txt -A scram-sha-256 -E UTF8 --locale=C > /tmp/initdb4.log 2>&1
printf "port=55441\nlc_messages='C'\nmax_wal_size='2GB'\nshared_buffers='512MB'\nfsync=off\nsynchronous_commit=off\n" >> /d/Civica/pgtest_edu4/postgresql.conf
"$PGB/pg_ctl.exe" -D $D -l D:/Civica/pgtest_edu4/log.txt -w -s start > /tmp/pgctl4.log 2>&1
"$PGB/psql.exe" -h localhost -p 55441 -U postgres -c "CREATE DATABASE projetoeleitor_db" 
"$PGB/psql.exe" -h localhost -p 55441 -U postgres -d projetoeleitor_db -c "CREATE ROLE projetoeleitor_user LOGIN SUPERUSER PASSWORD 'x'"
"$PGB/pg_restore.exe" -h localhost -p 55441 -U postgres -d projetoeleitor_db --no-owner -j 4 D:/Civica/backups/pre-educacao-p104-20261025.dump
echo RESTORE-FIM
