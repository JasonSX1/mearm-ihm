@echo off
cd /d "%~dp0"

echo Verificando dependencias...
if not exist node_modules (
    echo Instalando dependencias (primeira vez, pode demorar)...
    npm install
    if errorlevel 1 (
        echo ERRO: Falha ao instalar dependencias.
        pause
        exit /b 1
    )
)

echo.
echo Iniciando IHM MeArm (servidor + interface web)...
echo.
echo Acesse: http://localhost:5173
echo Para parar: Ctrl+C
echo.
npm run dev
pause
