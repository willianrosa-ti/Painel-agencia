package br.com.millin.painelagencia;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppOverlay")
public class AppOverlayPlugin extends Plugin {
    private WindowManager windowManager;
    private View overlayView;
    private WindowManager.LayoutParams overlayParams;
    private int initialX;
    private int initialY;
    private float initialTouchX;
    private float initialTouchY;

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject resposta = new JSObject();
        resposta.put("isSupported", Build.VERSION.SDK_INT >= Build.VERSION_CODES.M);
        call.resolve(resposta);
    }

    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject resposta = new JSObject();
        resposta.put("granted", temPermissaoSobreposicao());
        call.resolve(resposta);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || temPermissaoSobreposicao()) {
            JSObject resposta = new JSObject();
            resposta.put("granted", true);
            call.resolve(resposta);
            return;
        }

        Intent intent = new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + getContext().getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);

        JSObject resposta = new JSObject();
        resposta.put("openedSettings", true);
        call.resolve(resposta);
    }

    @PluginMethod
    public void showOverlay(PluginCall call) {
        if (!temPermissaoSobreposicao()) {
            call.reject("Permissao de sobreposicao nao concedida.");
            return;
        }

        String label = call.getString("label", "MIL-LIN");

        getActivity().runOnUiThread(() -> {
            esconderOverlay();
            criarOverlay(label);
        });

        call.resolve();
    }

    @PluginMethod
    public void hideOverlay(PluginCall call) {
        getActivity().runOnUiThread(this::esconderOverlay);
        call.resolve();
    }

    private boolean temPermissaoSobreposicao() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(getContext());
    }

    private void criarOverlay(String label) {
        windowManager = (WindowManager) getContext().getSystemService(Context.WINDOW_SERVICE);

        LinearLayout sobreposicao = new LinearLayout(getContext());
        sobreposicao.setOrientation(LinearLayout.HORIZONTAL);
        sobreposicao.setGravity(Gravity.CENTER);
        sobreposicao.setElevation(12);

        GradientDrawable fundo = new GradientDrawable();
        fundo.setColor(Color.parseColor("#111827"));
        fundo.setCornerRadius(18);
        sobreposicao.setBackground(fundo);

        TextView titulo = new TextView(getContext());
        titulo.setText(label.length() > 10 ? "MIL-LIN" : label);
        titulo.setTextColor(Color.WHITE);
        titulo.setTextSize(13);
        titulo.setGravity(Gravity.CENTER);
        titulo.setTypeface(null, android.graphics.Typeface.BOLD);
        titulo.setPadding(20, 12, 10, 12);

        TextView fechar = new TextView(getContext());
        fechar.setText("x");
        fechar.setTextColor(Color.WHITE);
        fechar.setTextSize(16);
        fechar.setGravity(Gravity.CENTER);
        fechar.setTypeface(null, android.graphics.Typeface.BOLD);
        fechar.setPadding(10, 8, 16, 8);
        fechar.setOnClickListener((view) -> esconderOverlay());

        titulo.setOnTouchListener(this::moverOuAbrirApp);
        sobreposicao.addView(titulo);
        sobreposicao.addView(fechar);

        int tipoJanela = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        overlayParams = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            tipoJanela,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );
        overlayParams.gravity = Gravity.TOP | Gravity.START;
        overlayParams.x = 24;
        overlayParams.y = 180;

        overlayView = sobreposicao;
        windowManager.addView(overlayView, overlayParams);
    }

    private boolean moverOuAbrirApp(View view, MotionEvent event) {
        switch (event.getAction()) {
            case MotionEvent.ACTION_DOWN:
                initialX = overlayParams.x;
                initialY = overlayParams.y;
                initialTouchX = event.getRawX();
                initialTouchY = event.getRawY();
                return true;
            case MotionEvent.ACTION_MOVE:
                overlayParams.x = initialX + (int) (event.getRawX() - initialTouchX);
                overlayParams.y = initialY + (int) (event.getRawY() - initialTouchY);
                windowManager.updateViewLayout(overlayView, overlayParams);
                return true;
            case MotionEvent.ACTION_UP:
                float deslocamentoX = Math.abs(event.getRawX() - initialTouchX);
                float deslocamentoY = Math.abs(event.getRawY() - initialTouchY);
                if (deslocamentoX < 10 && deslocamentoY < 10) {
                    abrirApp();
                }
                return true;
            default:
                return false;
        }
    }

    private void abrirApp() {
        Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(getContext().getPackageName());
        if (intent == null) return;

        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        getContext().startActivity(intent);
    }

    private void esconderOverlay() {
        if (windowManager != null && overlayView != null) {
            windowManager.removeView(overlayView);
            overlayView = null;
        }
    }
}
