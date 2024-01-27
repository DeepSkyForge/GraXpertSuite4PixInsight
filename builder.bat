@echo off
SET mypath=%~dp0
cd %mypath\
python builder.py %*
