@echo off
 echo %* | findstr /C:"--model gemini-2.5-pro" >nul
 if %errorlevel%==0 (
   echo FALLBACK_OK
   exit /b 0
 )
 >&2 echo RESOURCE_EXHAUSTED
 >&2 echo No capacity available for model gemini-3.1-pro-preview on the server
 exit /b 1
