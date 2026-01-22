# SalvadoreX POS - Windows Desktop

Aplicación de escritorio para Windows con WebView2.

## Requisitos

- Windows 10/11
- .NET 8.0 Runtime
- Microsoft Edge WebView2 Runtime (incluido en Windows 11)

## Compilación

```powershell
# Compilar Release
dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true

# El ejecutable estará en:
# bin/Release/net8.0-windows/win-x64/publish/SalvadoreXPOS.exe
```

## Generar Instalador

1. Instalar [Inno Setup](https://jrsoftware.org/isinfo.php)
2. Abrir `Installer/setup.iss`
3. Compilar (Ctrl+F9)
4. El instalador: `Output/SalvadoreXPOS_Setup.exe`

## Estructura

```
├── WebApp/           # Interfaz web embebida
│   ├── index.html
│   ├── app.js
│   └── version.txt
├── Services/         # Servicios nativos C#
│   ├── DatabaseService.cs
│   ├── SyncService.cs
│   ├── UpdateService.cs
│   ├── LicensingService.cs
│   └── NativeBridge.cs
├── Installer/        # Scripts Inno Setup
├── MainForm.cs       # Formulario WebView2
└── Program.cs        # Punto de entrada
```

## Actualizar WebApp

Para actualizar la interfaz desde el repositorio web principal:

1. Descargar `index.html` y `app.js` actualizados
2. Reemplazar en la carpeta `WebApp/`
3. Recompilar

## Características

- Offline-first con SQLite local
- Sincronización automática con Supabase
- Licenciamiento por hardware
- Auto-actualizaciones desde GitHub

## Licencia

Copyright © 2025 SalvadoreX
