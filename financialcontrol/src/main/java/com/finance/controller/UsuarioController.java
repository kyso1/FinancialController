package com.finance.controller;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.finance.dto.Usuario.DadosRegistro;
import com.finance.dto.Usuario.DadosTrocaSenha;
import com.finance.model.Usuario;
import com.finance.security.AuthHelper;
import com.finance.security.JwtService;
import com.finance.service.LancamentoService;
import com.finance.service.UsuarioService;
import com.finance.util.SanitizacaoUtil;

import jakarta.validation.Valid;

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
        String refreshToken = jwtService.gerarRefreshToken(newUser.getId(), newUser.getUsername());

        var uri = URI.create("/api/auth/perfil/" + newUser.getId());

        Map<String, Object> response = new HashMap<>();
        response.put("id", newUser.getId());
        response.put("username", newUser.getUsername());
        response.put("token", token);
        response.put("refreshToken", refreshToken);

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
            String refreshToken = jwtService.gerarRefreshToken(u.getId(), u.getUsername());

            Map<String, Object> response = new HashMap<>();
            response.put("id", u.getId());
            response.put("username", u.getUsername());
            response.put("token", token);
            response.put("refreshToken", refreshToken);

            return ResponseEntity.ok(response);
        }

        Map<String, String> erro = new HashMap<>();
        erro.put("erro", "Credenciais inválidas");
        return ResponseEntity.status(401).body(erro);
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@RequestBody Map<String, String> dados) {
        String refreshToken = dados.get("refreshToken");
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Refresh token é obrigatório"));
        }

        try {
            if (!jwtService.isTokenValido(refreshToken) || !jwtService.isRefreshToken(refreshToken)) {
                return ResponseEntity.status(401).body(Map.of("erro", "Refresh token inválido ou expirado"));
            }

            Long userId = jwtService.extrairUserId(refreshToken);
            String username = jwtService.extrairUsername(refreshToken);

            String novoToken = jwtService.gerarToken(userId, username);
            String novoRefreshToken = jwtService.gerarRefreshToken(userId, username);

            Map<String, Object> response = new HashMap<>();
            response.put("token", novoToken);
            response.put("refreshToken", novoRefreshToken);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("erro", "Refresh token inválido"));
        }
    }

    @GetMapping("/verificar")
    public ResponseEntity<?> verificar() {
        Usuario usuario = AuthHelper.getUsuarioAutenticado();
        return ResponseEntity.ok(buildPerfilResponse(usuario));
    }

    @GetMapping("/perfil")
    public ResponseEntity<?> obterPerfil() {
        Usuario usuario = AuthHelper.getUsuarioAutenticado();
        return ResponseEntity.ok(buildPerfilResponse(usuario));
    }

    @PutMapping("/perfil")
    public ResponseEntity<?> atualizarPerfil(
            @RequestParam(value = "nome", required = false) String nome,
            @RequestParam(value = "email", required = false) String email,
            @RequestParam(value = "tema", required = false) String tema,
            @RequestParam(value = "foto", required = false) MultipartFile foto) {

        Usuario usuario = AuthHelper.getUsuarioAutenticado();

        if (nome != null) {
            usuario.setNome(SanitizacaoUtil.sanitizar(nome));
        }

        if (email != null) {
            usuario.setEmail(SanitizacaoUtil.sanitizar(email));
        }

        if (tema != null) {
            String t = tema.toLowerCase().trim();
            if ("dark".equals(t) || "light".equals(t) || "auto".equals(t)) {
                usuario.setTema(t);
            }
        }

        // Upload de foto real
        if (foto != null && !foto.isEmpty()) {
            try {
                Path uploadDir = Paths.get("uploads");
                Files.createDirectories(uploadDir);

                String originalFilename = foto.getOriginalFilename();
                String ext = "";
                if (originalFilename != null && originalFilename.contains(".")) {
                    ext = originalFilename.substring(originalFilename.lastIndexOf("."));
                }
                String filename = UUID.randomUUID().toString() + ext;
                Path filePath = uploadDir.resolve(filename);
                Files.copy(foto.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

                usuario.setFotoPerfil("/uploads/" + filename);
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("erro", "Erro ao salvar imagem: " + e.getMessage()));
            }
        }

        Usuario atualizado = service.atualizar(usuario);
        return ResponseEntity.ok(buildPerfilResponse(atualizado));
    }

    @PutMapping("/alterar-senha")
    public ResponseEntity<?> alterarSenha(@RequestBody @Valid DadosTrocaSenha dados) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        try {
            service.alterarSenha(usuarioId, dados.senhaAtual(), dados.novaSenha());
            return ResponseEntity.ok(Map.of("mensagem", "Senha alterada com sucesso!"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("erro", e.getMessage()));
        }
    }

    private Map<String, Object> buildPerfilResponse(Usuario u) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", u.getId());
        response.put("username", u.getUsername());
        response.put("nome", u.getNome());
        response.put("email", u.getEmail());
        response.put("fotoPerfil", u.getFotoPerfil());
        response.put("tema", u.getTema());
        return response;
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

        if (token == null || novaSenha == null || novaSenha.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Token e nova senha (mín. 8 caracteres, com número, caractere especial e letra maiúscula) são obrigatórios"));
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
            String refreshToken = jwtService.gerarRefreshToken(usuario.getId(), usuario.getUsername());

            Map<String, Object> response = new HashMap<>();
            response.put("id", usuario.getId());
            response.put("username", usuario.getUsername());
            response.put("nome", usuario.getNome());
            response.put("token", token);
            response.put("refreshToken", refreshToken);

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
