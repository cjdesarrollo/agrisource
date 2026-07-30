# Guía de Despliegue de Frontend (Zip Deploy)

Este documento detalla los pasos para realizar la compilación y publicación del frontend en Azure App Service (entorno Linux Node.js) utilizando el método **Zip Deploy**.

---

## Requisitos Previos

1. **Node.js**: Instalado localmente para compilar el proyecto.
2. **Python**: Necesario para ejecutar el script de empaquetado compatible con sistemas de archivos Linux.
3. **cURL**: Herramienta de línea de comandos para enviar peticiones HTTP. (Viene por defecto en Windows 10/11).

---

## Pasos para Publicar

Realiza los siguientes pasos desde la terminal dentro de la carpeta `AgrisourceDashboard.UI`:

### Paso 1: Compilar para Producción
Compila el proyecto React/Vite. Esto generará la carpeta `dist/` usando la configuración de producción del archivo `.env.production` (que apunta al API en Azure).

* En **Windows Powershell** (si hay restricciones de firmas de scripts, se puede omitir usando `.cmd` o levantando la política temporalmente):
  ```powershell
  # Opción A (Usando la versión por lotes .cmd):
  npm.cmd run build

  # Opción B (Ejecutando con bypass de política):
  powershell -ExecutionPolicy Bypass -Command "npm run build"
  ```
* En terminales estándar (**CMD** o **Linux/Bash**):
  ```bash
  npm run build
  ```

### Paso 2: Crear el paquete ZIP compatible con Linux
Azure App Service corre bajo Linux, por lo que las carpetas internas de la solución dentro del ZIP deben usar barras diagonales (`/`) en lugar de barras invertidas (`\`). 

Ejecuta el script de ayuda de Python para empaquetar de forma correcta los archivos necesarios (`dist/`, `package.json`, `package-lock.json`, `server.js`):
```bash
python zip_helper.py
```
*Esto generará un archivo llamado `deploy.zip` en el directorio actual.*

### Paso 3: Desplegar en Azure App Service
Ejecuta la siguiente llamada de cURL utilizando las credenciales y el endpoint de SCM del archivo `.PublishSettings`:

* En **Windows PowerShell / CMD**:
  ```bash
  cmd.exe /c "curl.exe -v -X POST -u \"$agrisource-ui-benno:dPN0xjvYtApyXlPxy1ft5iDpZgQk8v0nAjHyKAc3naem5ufkArbE55L7Yh0R\" -H \"Content-Type: application/zip\" --data-binary @deploy.zip https://agrisource-ui-benno.scm.azurewebsites.net/api/zipdeploy"
  ```

* En **Linux / Bash**:
  ```bash
  curl -v -X POST -u '$agrisource-ui-benno:dPN0xjvYtApyXlPxy1ft5iDpZgQk8v0nAjHyKAc3naem5ufkArbE55L7Yh0R' -H "Content-Type: application/zip" --data-binary @deploy.zip https://agrisource-ui-benno.scm.azurewebsites.net/api/zipdeploy
  ```

### Paso 4: Limpieza
Una vez que el despliegue responda `HTTP/1.1 200 OK`, elimina el archivo temporal `deploy.zip` creado localmente:

* En **PowerShell**:
  ```powershell
  Remove-Item deploy.zip -Force
  ```
* En **CMD o Bash**:
  ```bash
  rm deploy.zip
  ```

---

## Notas de Solución de Problemas

* **¿Por qué usamos `zip_helper.py` en vez de `Compress-Archive`?**
  Las herramientas nativas de compresión en Windows comprimen rutas utilizando `\`, lo que provoca errores de tipo `EINVAL` (argumento inválido) al intentar abrir y extraer los activos estáticos en el sistema de archivos del servidor Linux en Azure. El script de Python corrige este comportamiento de forma automática.
* **Verificar el estado del despliegue**:
  Puedes consultar los logs e historial de despliegues directamente enviando un GET a la API del sitio de administración de Kudu:
  ```bash
  curl -u "$agrisource-ui-benno:dPN0xjvYtApyXlPxy1ft5iDpZgQk8v0nAjHyKAc3naem5ufkArbE55L7Yh0R" https://agrisource-ui-benno.scm.azurewebsites.net/api/deployments
  ```
