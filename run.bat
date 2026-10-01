@echo off
REM Abre o Sistema Solar no Windows. Duplo clique funciona.
REM O `pause` no fim de cada erro existe para a janela nao sumir antes de a pessoa ler.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel%==0 goto :temnode

if exist "dist\" (
  where python >nul 2>nul
  if %errorlevel%==0 (
    echo Node nao encontrado. Usando o servidor de reserva em Python.
    python ferramentas\servidor.py %*
    goto :fim
  )
)
echo.
echo Nao foi possivel abrir o programa.
echo Falta o Node: https://nodejs.org
echo.
pause
exit /b 1

:temnode
if not exist "node_modules\" if not exist "dist\" (
  echo Primeira execucao: instalando as bibliotecas. Isto leva um ou dois minutos.
  call npm install || goto :erro
)
if not exist "dist\" (
  echo Construindo o programa.
  call npm run build || goto :erro
)
node servidor.mjs %*
goto :fim

:erro
echo.
echo Alguma coisa deu errado acima.
echo.
pause
exit /b 1

:fim
endlocal
