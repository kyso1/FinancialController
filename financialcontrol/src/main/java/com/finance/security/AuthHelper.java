package com.finance.security;

import com.finance.model.Usuario;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Helper para extrair o usuário autenticado do SecurityContext (JWT).
 */
public final class AuthHelper {

    private AuthHelper() {}

    /**
     * Retorna o usuário autenticado via JWT.
     * @throws RuntimeException se não houver usuário autenticado
     */
    public static Usuario getUsuarioAutenticado() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Usuario)) {
            throw new RuntimeException("Usuário não autenticado");
        }
        return (Usuario) auth.getPrincipal();
    }

    /**
     * Retorna o ID do usuário autenticado via JWT.
     */
    public static Long getUsuarioIdAutenticado() {
        return getUsuarioAutenticado().getId();
    }
}
