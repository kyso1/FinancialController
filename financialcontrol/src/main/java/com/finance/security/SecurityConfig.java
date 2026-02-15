package com.finance.security;

import java.util.Arrays;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import jakarta.servlet.http.HttpServletResponse;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final RateLimitFilter rateLimitFilter;

    @Value("${cors.allowed-origins:http://localhost:8080}")
    private String allowedOrigins;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter, RateLimitFilter rateLimitFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.rateLimitFilter = rateLimitFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())

                // ===== Headers de Segurança =====
                .headers(headers -> {
                        // Permitir frame apenas para H2 console (dev)
                        headers.frameOptions(frame -> frame.sameOrigin());
                        // Prevenir MIME-type sniffing
                        headers.contentTypeOptions(Customizer.withDefaults());
                        // Referrer Policy
                        headers.referrerPolicy(referrer -> referrer
                                .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN));
                        // Permissions Policy (desabilitar recursos desnecessários)
                        headers.permissionsPolicy(permissions -> permissions
                                .policy("camera=(), microphone=(), geolocation=(), payment=()"));
                        // Content Security Policy
                        headers.contentSecurityPolicy(csp -> csp
                                .policyDirectives(
                                        "default-src 'self'; " +
                                        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://code.jquery.com https://cdn.jsdelivr.net https://accounts.google.com https://apis.google.com; " +
                                        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
                                        "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; " +
                                        "img-src 'self' data: https://ui-avatars.com https://*.googleusercontent.com; " +
                                        "connect-src 'self' https://accounts.google.com; " +
                                        "frame-src 'self' https://accounts.google.com; " +
                                        "object-src 'none'; " +
                                        "base-uri 'self'"
                                ));
                })

                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(new AntPathRequestMatcher("/h2-console/**")).permitAll()
                        .requestMatchers(new AntPathRequestMatcher("/api/auth/**")).permitAll()
                        .requestMatchers(new AntPathRequestMatcher("/swagger-ui/**"), new AntPathRequestMatcher("/swagger-ui.html"), new AntPathRequestMatcher("/v3/api-docs/**")).permitAll()
                        .requestMatchers(new AntPathRequestMatcher("/css/**"), new AntPathRequestMatcher("/js/**"), new AntPathRequestMatcher("/img/**"), new AntPathRequestMatcher("/uploads/**")).permitAll()
                        .requestMatchers(new AntPathRequestMatcher("/login.html"), new AntPathRequestMatcher("/"), new AntPathRequestMatcher("/index.html"), new AntPathRequestMatcher("/dashboard.html"), new AntPathRequestMatcher("/termos.html"), new AntPathRequestMatcher("/privacidade.html")).permitAll()
                        .requestMatchers(new AntPathRequestMatcher("/api/lancamentos/**")).authenticated()
                        .requestMatchers(new AntPathRequestMatcher("/api/compartilhamento/**")).authenticated()
                        .requestMatchers(new AntPathRequestMatcher("/api/amigos/**")).authenticated()
                        .requestMatchers(new AntPathRequestMatcher("/api/orcamentos/**")).authenticated()
                        .requestMatchers(new AntPathRequestMatcher("/api/metas/**")).authenticated()
                        .requestMatchers(new AntPathRequestMatcher("/api/tags/**")).authenticated()
                        .requestMatchers(new AntPathRequestMatcher("/api/exportacao/**")).authenticated()
                        .requestMatchers(new AntPathRequestMatcher("/api/importacao/**")).authenticated()
                        .anyRequest().authenticated())

                .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)

                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setContentType("application/json");
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.getWriter().write("{\"erro\": \"Não autorizado\"}");
                        }));

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        List<String> origins = Arrays.asList(allowedOrigins.split(","));
        config.setAllowedOrigins(origins);
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "X-Requested-With"));
        config.setExposedHeaders(Arrays.asList("Authorization"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
