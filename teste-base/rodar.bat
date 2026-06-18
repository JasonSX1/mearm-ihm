@echo off
set JAVA="C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot\bin\java.exe"
set JAVAC="C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot\bin\javac.exe"

echo Compilando...
%JAVAC% TesteBase.java
if errorlevel 1 (
    echo Erro na compilacao!
    pause
    exit /b 1
)

echo Rodando...
%JAVA% TesteBase
pause
