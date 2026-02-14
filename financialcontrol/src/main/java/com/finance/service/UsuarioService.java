package com.finance.service;

import com.finance.dto.Usuario.DadosRegistro;
import com.finance.model.Usuario;
import com.finance.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.List;
import java.util.UUID;

@Service
public class UsuarioService {

    @Autowired
    private UsuarioRepository repository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${app.base-url:http://localhost:8080}")
    private String baseUrl;

    public Usuario cadastrar(DadosRegistro dados) {
        if (repository.existsByUsername(dados.username())) {
            throw new RuntimeException("Usuário já existe");
        }

        String senhaCriptografada = passwordEncoder.encode(dados.senha());
        Usuario novoUsuario = new Usuario();
        novoUsuario.setUsername(dados.username());
        novoUsuario.setSenha(senhaCriptografada);
        if (dados.email() != null && !dados.email().isBlank()) {
            novoUsuario.setEmail(dados.email());
        }

        return repository.save(novoUsuario);
    }

    public Optional<Usuario> autenticar(String username, String senha) {
        Optional<Usuario> usuario = repository.findByUsername(username);

        if (usuario.isPresent() && passwordEncoder.matches(senha, usuario.get().getSenha())) {
            return usuario;
        }

        return Optional.empty();
    }

    public Usuario buscarPorId(Long id) {
        return repository.findById(id).orElse(null);
    }

    public Usuario atualizar(Usuario usuario) {
        return repository.save(usuario);
    }

    public List<Usuario> buscarPorUsername(String query) {
        return repository.findByUsernameContainingIgnoreCase(query);
    }

    public List<Usuario> listarTodos() {
        return repository.findAll();
    }

    // ===== RECUPERAÇÃO DE SENHA =====

    public String gerarTokenRecuperacao(String emailOuUsername) {
        Optional<Usuario> usuario = repository.findByEmail(emailOuUsername);
        if (usuario.isEmpty()) {
            usuario = repository.findByUsername(emailOuUsername);
        }
        if (usuario.isEmpty()) {
            throw new RuntimeException("Usuário não encontrado");
        }

        Usuario u = usuario.get();
        String token = UUID.randomUUID().toString();
        u.setResetToken(token);
        u.setResetTokenExpiry(LocalDateTime.now().plusHours(1));
        repository.save(u);

        // Tenta enviar email, se estiver configurado
        if (mailSender != null && u.getEmail() != null && !u.getEmail().isBlank()) {
            try {
                SimpleMailMessage msg = new SimpleMailMessage();
                msg.setTo(u.getEmail());
                msg.setSubject("Recuperação de Senha - Controle Financeiro");
                msg.setText("Use este link para redefinir sua senha:\n\n"
                        + baseUrl + "/login.html?resetToken=" + token
                        + "\n\nEste link expira em 1 hora.");
                mailSender.send(msg);
            } catch (Exception e) {
                // Falha silenciosa — token ainda funciona via console
                System.out.println("⚠ Não foi possível enviar e-mail. Token de recuperação: " + token);
            }
        } else {
            System.out.println("📧 Token de recuperação para " + u.getUsername() + ": " + token);
        }

        return token;
    }

    public void redefinirSenha(String token, String novaSenha) {
        Usuario usuario = repository.findByResetToken(token)
                .orElseThrow(() -> new RuntimeException("Token inválido"));

        if (usuario.getResetTokenExpiry().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Token expirado");
        }

        usuario.setSenha(passwordEncoder.encode(novaSenha));
        usuario.setResetToken(null);
        usuario.setResetTokenExpiry(null);
        repository.save(usuario);
    }

    // ===== GOOGLE LOGIN =====

    public Usuario loginComGoogle(String googleId, String email, String nome, String fotoPerfil) {
        // Procura por googleId
        Optional<Usuario> porGoogle = repository.findByGoogleId(googleId);
        if (porGoogle.isPresent()) {
            return porGoogle.get();
        }

        // Procura por email
        Optional<Usuario> porEmail = repository.findByEmail(email);
        if (porEmail.isPresent()) {
            Usuario u = porEmail.get();
            u.setGoogleId(googleId);
            if (u.getNome() == null) u.setNome(nome);
            if (u.getFotoPerfil() == null) u.setFotoPerfil(fotoPerfil);
            return repository.save(u);
        }

        // Cria novo usuário
        Usuario novo = new Usuario();
        novo.setUsername(email.split("@")[0] + "_g");
        novo.setSenha(passwordEncoder.encode(UUID.randomUUID().toString()));
        novo.setEmail(email);
        novo.setGoogleId(googleId);
        novo.setNome(nome);
        novo.setFotoPerfil(fotoPerfil);
        return repository.save(novo);
    }
}
