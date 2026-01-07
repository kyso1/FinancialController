package com.finance.controller;

import com.finance.dto.Usuario.DadosRegistro;
import com.finance.dto.Usuario.DadosRetorno;
import com.finance.model.Usuario;
import com.finance.service.UsuarioService;

import jakarta.validation.Valid;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.List;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class UsuarioController {

    @Autowired
    private UsuarioService service;

    @PostMapping("/cadastro")
    public ResponseEntity<?> cadastrar(@RequestBody @Valid DadosRegistro dados) {
        try {
            Usuario newUser = service.cadastrar(dados);
            
            var uri = URI.create("/api/auth/perfil/" + newUser.getId());

            return ResponseEntity.created(uri).body(new DadosRetorno(newUser.getId(), newUser.getUsername()));
        } catch (RuntimeException e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> dados) {
        String username = dados.get("username");
        String senha = dados.get("senha");

        Optional<Usuario> usuario = service.autenticar(username, senha);

        if (usuario.isPresent()) {
            Map<String, Object> response = new HashMap<>();
            response.put("id", usuario.get().getId());
            response.put("username", usuario.get().getUsername());

            return ResponseEntity.ok(response);
        }

        Map<String, String> erro = new HashMap<>();
        erro.put("erro", "Credenciais inválidas");
        return ResponseEntity.status(401).body(erro);
    }

    @GetMapping("/verificar")
    public ResponseEntity<?> verificar(@RequestParam Long userId) {
        Usuario usuario = service.buscarPorId(userId);

        if (usuario != null) {
            Map<String, Object> response = new HashMap<>();
            response.put("id", usuario.getId());
            response.put("username", usuario.getUsername());
            response.put("nome", usuario.getNome());
            response.put("fotoPerfil", usuario.getFotoPerfil());
            return ResponseEntity.ok(response);
        }

        return ResponseEntity.status(401).build();
    }

    @GetMapping("/perfil/{userId}")
    public ResponseEntity<?> obterPerfil(@PathVariable Long userId) {
        Usuario usuario = service.buscarPorId(userId);

        if (usuario != null) {
            Map<String, Object> response = new HashMap<>();
            response.put("id", usuario.getId());
            response.put("username", usuario.getUsername());
            response.put("nome", usuario.getNome());
            response.put("fotoPerfil", usuario.getFotoPerfil());
            return ResponseEntity.ok(response);
        }

        return ResponseEntity.status(404).build();
    }

    @PutMapping("/perfil/{userId}")
    public ResponseEntity<?> atualizarPerfil(@PathVariable Long userId, @RequestBody Map<String, String> dados) {
        try {
            Usuario usuario = service.buscarPorId(userId);

            if (usuario == null) {
                return ResponseEntity.status(404).body(Map.of("erro", "Usuário não encontrado"));
            }

            if (dados.containsKey("nome")) {
                usuario.setNome(dados.get("nome"));
            }

            if (dados.containsKey("fotoPerfil")) {
                usuario.setFotoPerfil(dados.get("fotoPerfil"));
            }

            Usuario atualizado = service.atualizar(usuario);

            Map<String, Object> response = new HashMap<>();
            response.put("id", atualizado.getId());
            response.put("username", atualizado.getUsername());
            response.put("nome", atualizado.getNome());
            response.put("fotoPerfil", atualizado.getFotoPerfil());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("erro", e.getMessage()));
        }
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
}
