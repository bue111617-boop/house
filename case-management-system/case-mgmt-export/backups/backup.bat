@echo off
set PROJECT=D:\case-management-system
set BACKUP=%PROJECT%\backups
set GDRIVE=G:\我的雲端硬碟\案件系統備份
set DATESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%

echo 正在備份資料庫...
copy "%PROJECT%\data.db" "%BACKUP%\data.db.%DATESTAMP%"

echo 複製到 Google Drive...
if not exist "%GDRIVE%" mkdir "%GDRIVE%"
copy "%PROJECT%\data.db" "%GDRIVE%\data.db.%DATESTAMP%"

echo 清除本機 30 天前的舊備份...
forfiles /p "%BACKUP%" /m "data.db.*" /d -30 /c "cmd /c del @path" 2>nul

echo 備份完成！
pause