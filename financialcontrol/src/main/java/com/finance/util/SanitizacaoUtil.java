package com.finance.util;

import java.util.regex.Pattern;

/**
 * Utilitário para sanitização de input contra XSS.
 */
public final class SanitizacaoUtil {

    private static final Pattern SCRIPT_TAG = Pattern.compile("<script[^>]*>.*?</script>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]+>", Pattern.CASE_INSENSITIVE);
    private static final Pattern ON_EVENT = Pattern.compile("\\bon\\w+\\s*=", Pattern.CASE_INSENSITIVE);
    private static final Pattern JAVASCRIPT_PROTOCOL = Pattern.compile("javascript\\s*:", Pattern.CASE_INSENSITIVE);

    private SanitizacaoUtil() {}

    /**
     * Remove tags HTML/Script e atributos de evento de uma string.
     */
    public static String sanitizar(String input) {
        if (input == null) return null;

        String sanitizado = input;
        sanitizado = SCRIPT_TAG.matcher(sanitizado).replaceAll("");
        sanitizado = HTML_TAG.matcher(sanitizado).replaceAll("");
        sanitizado = ON_EVENT.matcher(sanitizado).replaceAll("");
        sanitizado = JAVASCRIPT_PROTOCOL.matcher(sanitizado).replaceAll("");

        return sanitizado.trim();
    }
}
