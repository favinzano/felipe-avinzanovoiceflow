# Firma Authenticode Para Windows

NextStepAI Voice usa firma Authenticode con un certificado de firma de codigo `.pfx`, SHA-256 y timestamp RFC 3161.

## Configuracion Del Certificado

El certificado y su contrasena no deben almacenarse dentro del repositorio.

Para una compilacion local:

- `SIGNING_PFX_PATH`: ruta absoluta al certificado `.pfx`.
- `SIGNING_PFX_PASSWORD`: contrasena del certificado.
- `SIGNING_TIMESTAMP_URL`: servidor RFC 3161 opcional; por defecto se usa DigiCert.

Para GitHub Actions:

- `SIGNING_PFX_BASE64`: secreto que contiene el `.pfx` codificado en Base64.
- `SIGNING_PFX_PASSWORD`: secreto con la contrasena del certificado.

## Construccion Firmada

```powershell
$env:SIGNING_PFX_PATH = "C:\ruta\certificado.pfx"
$env:SIGNING_PFX_PASSWORD = "contrasena"
npm run release:signed
```

El script encuentra el `signtool.exe` x64 del Windows SDK mas reciente. Antes
de compilar valida que el PFX incluya clave privada, declare el uso extendido
Code Signing y no expire durante los siguientes 30 dias. Electron Builder firma
la aplicacion, el helper de pegado, el desinstalador y el instalador usando
SHA-256 y timestamp RFC 3161 antes de generar el blockmap.

En GitHub Actions, ejecuta manualmente el workflow `Signed Windows Release`.
El workflow y el script local se detienen antes de firmar si
`npm run release:verify-acceptance` no aprueba la matriz humana.

## Verificacion Independiente

```powershell
npm run release:verify-signature
```

No publiques un release estable mientras esta comprobacion falle.
