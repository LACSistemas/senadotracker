@echo off
cd /d C:\Projetos\senadotracker
node --import tsx scripts/exec/pncp-finish.ts >> D:\Civica\logs\collectors\pncp-finish.out 2>&1

