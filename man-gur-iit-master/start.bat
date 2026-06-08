@echo off
cd /d "%~dp0"
echo ===================================================
echo     DSR Portal - One Click Start Script
echo ===================================================
echo.

:: Automatically find the downloaded JDK 17 inside the .jdk folder
set "LOCAL_JDK="
if exist "%~dp0.jdk" (
    for /d %%F in ("%~dp0.jdk\*") do (
        if exist "%%~dpnxF\bin\java.exe" set "LOCAL_JDK=%%~dpnxF"
    )
)

if not "%LOCAL_JDK%"=="" (
    echo NOTE: Found Local Java 17! Using it automatically to avoid Java 25 issues.
    set "JAVA_HOME=%LOCAL_JDK%"
    set "PATH=%LOCAL_JDK%\bin;%PATH%"
) else (
    echo NOTE: No local Java 17 found yet. Using system default.
)

echo.
echo NOTE: Starting Docker services (PostgreSQL, Redis, MinIO)...
cd dsr-backend
docker-compose down
docker-compose up -d
cd ..
echo Docker services are running!
echo.

echo [1/2] Starting Spring Boot Backend...
:: This opens a new terminal window for the backend
start "DSR Backend" cmd /k "cd /d ""%~dp0dsr-backend"" && run.bat"

echo [2/2] Building Frontend and Starting Portal Server...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8081" ^| findstr "LISTENING"') do taskkill /PID %%P /F >nul 2>nul
start "DSR Portal Server" cmd /k "cd /d ""%~dp0iit-pro-1-main"" && echo Building latest frontend files... && node build.js && echo Starting Local Portal Server on port 8081... && set DSR_NO_WATCH=1 && node server.js"

echo.
echo Both services have been launched in separate windows!
echo.
echo ===================================================
echo     Service Links
echo ===================================================
echo - Portal:      http://localhost:8081/login.html
echo - Backend API: http://localhost:8080/api-docs (Swagger)
echo - pgAdmin:     http://localhost:5055 (admin@dsr.com / admin)
echo - MinIO Console: http://localhost:9011 (minioadmin / minioadmin)
echo - MinIO API:   http://localhost:9010
echo ===================================================
echo.
pause
