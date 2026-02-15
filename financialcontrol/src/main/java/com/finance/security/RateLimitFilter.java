package com.finance.security;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Filtro de Rate Limiting para proteger endpoints de autenticação
 * contra ataques de força bruta.
 * Limita o número de requisições por IP em um intervalo de tempo.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_REQUESTS_PER_WINDOW = 20;
    private static final long WINDOW_SIZE_MS = 60_000; // 1 minuto

    private final Map<String, RateLimitEntry> requestCounts = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();

        // Aplicar rate limit apenas em endpoints de autenticação
        if (path.startsWith("/api/auth/")) {
            String clientIp = getClientIp(request);
            String key = clientIp + ":" + path;

            RateLimitEntry entry = requestCounts.compute(key, (k, existing) -> {
                long now = System.currentTimeMillis();
                if (existing == null || now - existing.windowStart > WINDOW_SIZE_MS) {
                    return new RateLimitEntry(now, new AtomicInteger(1));
                }
                existing.count.incrementAndGet();
                return existing;
            });

            if (entry.count.get() > MAX_REQUESTS_PER_WINDOW) {
                response.setContentType("application/json");
                response.setStatus(429); // Too Many Requests
                response.setHeader("Retry-After", "60");
                response.getWriter().write("{\"erro\": \"Muitas tentativas. Aguarde 1 minuto.\"}");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) {
            return xff.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isEmpty()) {
            return realIp;
        }
        return request.getRemoteAddr();
    }

    private static class RateLimitEntry {
        final long windowStart;
        final AtomicInteger count;

        RateLimitEntry(long windowStart, AtomicInteger count) {
            this.windowStart = windowStart;
            this.count = count;
        }
    }
}
