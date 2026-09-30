# Contador de dinero

App web para el móvil (PWA) que lleva la cuenta del dinero ganado: por día, por mes y por persona.
Se instala en la pantalla de inicio como una app, funciona sin conexión y se actualiza desde la propia app.

## Funciones

- Contador de lo ganado **hoy** y en **el mes actual**.
- Añadir un cobro en dos toques: nombre de la persona (con autocompletado y botones de personas frecuentes) e importe (con botones de importes rápidos).
- Fecha y nota opcionales, para apuntar cobros de otros días.
- Editar y borrar cobros.
- Resumen mensual: total, número de cobros, días trabajados, media por día, **total por persona** y detalle por día.
- Exportar un mes a CSV (se abre en Excel).
- Copia de seguridad en JSON y restauración.
- Botón **Buscar actualizaciones** y aviso automático cuando hay una versión nueva.

Los datos se guardan **solo en el móvil** (`localStorage` del navegador). Nunca se suben a GitHub.

## Estructura

| Archivo | Uso |
|---|---|
| `index.html` | Interfaz (pestañas Hoy, Mes y Ajustes) |
| `styles.css` | Estilos, modo claro y oscuro |
| `app.js` | Lógica: cobros, resúmenes, copias y actualizaciones |
| `sw.js` | Service worker: modo sin conexión y control de versiones |
| `manifest.webmanifest` | Nombre, icono y modo app al instalar |
| `.github/workflows/pages.yml` | Publica la app en GitHub Pages en cada push a `main` |
| `android/` | App Android (WebView) que se compila como APK |
| `.github/workflows/apk.yml` | Compila el APK y lo publica en Releases |

## Publicar la app (una sola vez)

1. En GitHub, abre **Settings → Pages**.
2. En **Build and deployment → Source**, elige **GitHub Actions**.
3. Haz merge a `main`. El workflow *Publicar en GitHub Pages* publica la app en:
   `https://mury237.github.io/Contador-de-dinero/`

GitHub Pages gratis necesita que el repositorio sea público. El repositorio solo contiene el código, no tus datos.

## Instalar en el móvil

1. **Android (Chrome):** abre la URL, menú **⋮ → Instalar aplicación** (o *Añadir a pantalla de inicio*).
2. **iPhone (Safari):** abre la URL, botón **Compartir → Añadir a pantalla de inicio**.

## App para Android (APK)

La carpeta `android/` contiene una app nativa mínima: un WebView que abre la app publicada en GitHub Pages.

- El workflow *Compilar APK* la compila en cada cambio de `android/` en `main` y la publica en Releases:
  `https://github.com/MURY237/Contador-de-dinero/releases/download/apk/ContadorDeDinero.apk`
- La web también tiene el enlace en **Ajustes → App para Android**.
- Instalar: descarga el APK en el móvil, ábrelo y permite *Instalar apps desconocidas* si Android lo pide.
- Las copias de seguridad y los CSV se guardan en la carpeta **Descargas**.
- La app se actualiza igual que la web (**Ajustes → Buscar actualizaciones**). Solo hace falta reinstalar el APK si cambia el código de `android/`.
- El APK se firma con `android/app/contador.keystore`. La clave es pública (está en el repositorio): sirve para que un APK nuevo se instale encima sin perder datos. No uses esta clave para apps de Google Play.
- La primera vez que abras la app necesitas Internet. Después funciona sin conexión.

## Publicar una actualización

1. Cambia el código y súbelo a `main` (push o merge de un PR).
2. El workflow marca `sw.js` con el commit, así cada publicación es una versión nueva.
3. En el móvil: **Ajustes → Buscar actualizaciones → Actualizar**. La app también avisa sola al abrirla.

Para cambiar el número de versión visible, edita `VERSION` en `sw.js` (por ejemplo `1.1.0`).
Si añades archivos nuevos, añádelos también a `ARCHIVOS` en `sw.js` y a la copia del workflow.

Las actualizaciones no borran los datos: la app sigue en la misma dirección y usa el mismo almacenamiento.

## Probar en local

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000`. El service worker funciona en `localhost` y en HTTPS.
