package io.github.mury237.contador;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Carga la app web publicada en GitHub Pages dentro de un WebView.
 * Las actualizaciones de la app llegan desde la web (Ajustes → Buscar actualizaciones),
 * así que este APK casi nunca necesita cambiar.
 */
public class MainActivity extends Activity {

    private static final String URL_APP = "https://mury237.github.io/Contador-de-dinero/";
    private static final int PEDIR_ARCHIVO = 1;

    private static final String PAGINA_SIN_CONEXION =
            "<!doctype html><html lang='es'><head><meta charset='utf-8'>"
            + "<meta name='viewport' content='width=device-width, initial-scale=1'>"
            + "<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;"
            + "justify-content:center;gap:16px;padding:24px;box-sizing:border-box;text-align:center;"
            + "font:18px system-ui,sans-serif;background:#0f766e;color:#fff}"
            + "a{padding:14px 24px;border-radius:12px;background:#fff;color:#0f766e;font-weight:600;"
            + "text-decoration:none}</style></head><body>"
            + "<p>Sin conexión.<br>La primera vez que abras la app necesitas Internet.</p>"
            + "<a href='" + URL_APP + "'>Reintentar</a></body></html>";

    private WebView web;
    private ValueCallback<Uri[]> callbackArchivo;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        web = new WebView(this);
        setContentView(web);

        WebSettings ajustes = web.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);

        web.addJavascriptInterface(new Puente(), "AndroidApp");
        web.setWebViewClient(new ClienteWeb());
        web.setWebChromeClient(new ClienteChrome());

        if (estado == null || web.restoreState(estado) == null) {
            web.loadUrl(URL_APP);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle salida) {
        super.onSaveInstanceState(salida);
        web.saveState(salida);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int codigo, int resultado, Intent datos) {
        if (codigo == PEDIR_ARCHIVO && callbackArchivo != null) {
            callbackArchivo.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultado, datos));
            callbackArchivo = null;
            return;
        }
        super.onActivityResult(codigo, resultado, datos);
    }

    /** Enlaces de la app dentro del WebView; cualquier otro, en el navegador. */
    private class ClienteWeb extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView vista, WebResourceRequest peticion) {
            Uri url = peticion.getUrl();
            if (url.toString().startsWith(URL_APP)) return false;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url));
            } catch (ActivityNotFoundException ignorada) {
                // Sin app para abrir el enlace: no se hace nada
            }
            return true;
        }

        @Override
        public void onReceivedError(WebView vista, WebResourceRequest peticion, WebResourceError error) {
            if (peticion.isForMainFrame()) {
                vista.loadDataWithBaseURL(null, PAGINA_SIN_CONEXION, "text/html", "utf-8", null);
            }
        }
    }

    /** Diálogos de confirmación y selector de archivos (restaurar copia). */
    private class ClienteChrome extends WebChromeClient {
        @Override
        public boolean onJsConfirm(WebView vista, String url, String mensaje, JsResult resultado) {
            new AlertDialog.Builder(MainActivity.this)
                    .setMessage(mensaje)
                    .setPositiveButton(android.R.string.ok, (d, b) -> resultado.confirm())
                    .setNegativeButton(android.R.string.cancel, (d, b) -> resultado.cancel())
                    .setOnCancelListener(d -> resultado.cancel())
                    .show();
            return true;
        }

        @Override
        @SuppressWarnings("deprecation")
        public boolean onShowFileChooser(WebView vista, ValueCallback<Uri[]> callback, FileChooserParams parametros) {
            if (callbackArchivo != null) callbackArchivo.onReceiveValue(null);
            callbackArchivo = callback;
            Intent intent = new Intent(Intent.ACTION_GET_CONTENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("*/*");
            try {
                startActivityForResult(intent, PEDIR_ARCHIVO);
            } catch (ActivityNotFoundException e) {
                callbackArchivo = null;
                return false;
            }
            return true;
        }
    }

    /** Funciones nativas que usa app.js dentro del APK (window.AndroidApp). */
    private class Puente {
        /** Guarda un archivo en la carpeta Descargas. Devuelve true si se ha guardado. */
        @JavascriptInterface
        public boolean guardarArchivo(String nombre, String contenido, String tipo) {
            ContentResolver resolver = getContentResolver();
            ContentValues valores = new ContentValues();
            valores.put(MediaStore.Downloads.DISPLAY_NAME, nombre);
            valores.put(MediaStore.Downloads.MIME_TYPE, tipo.split(";")[0].trim());
            valores.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, valores);
            if (uri == null) return false;
            try (OutputStream salida = resolver.openOutputStream(uri)) {
                if (salida == null) throw new IOException("Sin flujo de salida");
                salida.write(contenido.getBytes(StandardCharsets.UTF_8));
            } catch (IOException e) {
                resolver.delete(uri, null, null);
                return false;
            }
            valores.clear();
            valores.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, valores, null, null);
            return true;
        }
    }
}
