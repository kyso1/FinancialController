package com.finance.controller;

import com.finance.dto.Usuario.DadosRegistro;
import com.finance.dto.Usuario.DadosRetorno;
import com.finance.model.Usuario;
import com.finance.security.AuthHelper;
import com.finance.security.JwtService;
import com.finance.service.LancamentoService;
import com.finance.service.UsuarioService;
import com.finance.util.SanitizacaoUtil;

import jakarta.validation.Valid;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.List;

@RestController
@RequestMapping("/api/auth")
public class UsuarioController {

    @Autowired
    private UsuarioService service;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private LancamentoService lancamentoService;

    @Value("${google.client-id:}")
    private String googleClientId;

    @PostMapping("/cadastro")
    public ResponseEntity<?> cadastrar(@RequestBody @Valid DadosRegistro dados) {
        Usuario newUser = service.cadastrar(dados);

        String token = jwtService.gerarToken(newUser.getId(), newUser.getUsername());

        var uri = URI.create("/api/auth/perfil/" + newUser.getId());

        Map<String, Object> response = new HashMap<>();
        response.put("id", newUser.getId());
        response.put("username", newUser.getUsername());
        response.put("token", token);

        return ResponseEntity.created(uri).body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> dados) {
        String username = dados.get("username");
        String senha = dados.get("senha");

        Optional<Usuario> usuario = service.autenticar(username, senha);

        if (usuario.isPresent()) {
            Usuario u = usuario.get();

            // Processa gastos fixos no login
            lancamentoService.processarGastosFixosDoMes(u.getId());

            String token = jwtService.gerarToken(u.getId(), u.getUsername());

            Map<String, Object> response = new HashMap<>();
            response.put("id", u.getId());
            response.put("username", u.getUsername());
            response.put("token", token);

            return ResponseEntity.ok(response);
        }

        Map<String, String> erro = new HashMap<>();
        erro.put("erro", "Credenciais inválidas");
        return ResponseEntity.status(401).body(erro);
    }

    @GetMapping("/verificar")
    public ResponseEntity<?> verificar() {
        Usuario usuario = AuthHelper.getUsuarioAutenticado();

        Map<String, Object> response = new HashMap<>();
        response.put("id", usuario.getId());
        response.put("username", usuario.getUsername());
        response.put("nome", usuario.getNome());
        response.put("fotoPerfil", usuario.getFotoPerfil());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/perfil")
    public ResponseEntity<?> obterPerfil() {
        Usuario usuario = AuthHelper.getUsuarioAutenticado();

        Map<String, Object> response = new HashMap<>();
        response.put("id", usuario.getId());
        response.put("username", usuario.getUsername());
        response.put("nome", usuario.getNome());
        response.put("fotoPerfil", usuario.getFotoPerfil());

        return ResponseEntity.ok(response);
    }

    @PutMapping("/perfil")
    public ResponseEntity<?> atualizarPerfil(@RequestBody Map<String, String> dados) {
        Usuario usuario = AuthHelper.getUsuarioAutenticado();

        if (dados.containsKey("nome")) {
            usuario.setNome(SanitizacaoUtil.sanitizar(dados.get("nome")));
        }

        if (dados.containsKey("fotoPerfil")) {
            usuario.setFotoPerfil(SanitizacaoUtil.sanitizar(dados.get("fotoPerfil")));
        }

        Usuario atualizado = service.atualizar(usuario);

        Map<String, Object> response = new HashMap<>();
        response.put("id", atualizado.getId());
        response.put("username", atualizado.getUsername());
        response.put("nome", atualizado.getNome());
        response.put("fotoPerfil", atualizado.getFotoPerfil());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/buscar")
    public ResponseEntity<?> buscarUsuarios(@RequestParam String query) {
        List<Usuario> usuarios = service.buscarPorUsername(query);

        List<Map<String, Object>> resultado = usuarios.stream()
            .map(u -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", u.getId());
                map.put("username", u.getUsername());
                map.put("nome", u.getNome());
                map.put("fotoPerfil", u.getFotoPerfil());
                return map;
            })
            .toList();

        return ResponseEntity.ok(resultado);
    }

    @GetMapping("/listar")
    public ResponseEntity<?> listarTodos() {
        List<Usuario> usuarios = service.listarTodos();

        List<Map<String, Object>> resultado = usuarios.stream()
            .map(u -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", u.getId());
                map.put("username", u.getUsername());
                map.put("nome", u.getNome());
                map.put("fotoPerfil", u.getFotoPerfil());
                return map;
            })
            .toList();

        return ResponseEntity.ok(resultado);
    }

    // ===== RECUPERAÇÃO DE SENHA =====

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> dados) {
        String emailOuUsername = dados.get("emailOuUsername");
        if (emailOuUsername == null || emailOuUsername.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Informe o e-mail ou nome de usuário"));
        }

        try {
            service.gerarTokenRecuperacao(emailOuUsername);
            return ResponseEntity.ok(Map.of("mensagem", "Se o usuário existir, um link de recuperação foi gerado."));
        } catch (Exception e) {
            // Não revela se o usuário existe ou não
            return ResponseEntity.ok(Map.of("mensagem", "Se o usuário existir, um link de recuperação foi gerado."));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> dados) {
        String token = dados.get("token");
        String novaSenha = dados.get("novaSenha");

        if (token == null || novaSenha == null || novaSenha.length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Token e nova senha (mín. 6 caracteres) são obrigatórios"));
        }

        try {
            service.redefinirSenha(token, novaSenha);
            return ResponseEntity.ok(Map.of("mensagem", "Senha redefinida com sucesso!"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("erro", e.getMessage()));
        }
    }

    // ===== GOOGLE LOGIN =====

    @SuppressWarnings("unchecked")
    @PostMapping("/google")
    public ResponseEntity<?> loginGoogle(@RequestBody Map<String, String> dados) {
        String credential = dados.get("credential");
        if (credential == null) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Token Google não fornecido"));
        }

        try {
            // Verifica o token com Google
            RestTemplate rest = new RestTemplate();
            String url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + credential;
            Map<String, Object> googleUser = rest.getForObject(url, Map.class);

            if (googleUser == null || googleUser.get("sub") == null) {
                return ResponseEntity.status(401).body(Map.of("erro", "Token Google inválido"));
            }

            // Verifica audience se o client-id estiver configurado
            if (googleClientId != null && !googleClientId.isBlank() && !googleClientId.equals("SEU_GOOGLE_CLIENT_ID_AQUI")) {
                String aud = (String) googleUser.get("aud");
                if (!googleClientId.equals(aud)) {
                    return ResponseEntity.status(401).body(Map.of("erro", "Token não pertence a esta aplicação"));
                }
            }

            String googleId = (String) googleUser.get("sub");
            String email = (String) googleUser.get("email");
            String nome = (String) googleUser.get("name");
            String foto = (String) googleUser.get("picture");

            Usuario usuario = service.loginComGoogle(googleId, email, nome, foto);

            lancamentoService.processarGastosFixosDoMes(usuario.getId());

            String token = jwtService.gerarToken(usuario.getId(), usuario.getUsername());

            Map<String, Object> response = new HashMap<>();
            response.put("id", usuario.getId());
            response.put("username", usuario.getUsername());
            response.put("nome", usuario.getNome());
            response.put("token", token);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("erro", "Falha na autenticação Google: " + e.getMessage()));
        }
    }

    // ===== CONFIGURAÇÃO PÚBLICA =====

    @GetMapping("/config/google")
    public ResponseEntity<?> getGoogleConfig() {
        String id = (googleClientId != null && !googleClientId.isBlank() && !googleClientId.equals("SEU_GOOGLE_CLIENT_ID_AQUI"))
                ? googleClientId : "";
        return ResponseEntity.ok(Map.of("clientId", id));
    }
}
