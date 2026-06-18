@echo off
set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
cd /d "%~dp0"
echo Iniciando com Java 17...
java -version
C:\maven\apache-maven-3.9.6\bin\mvn.cmd javafx:run
pause
