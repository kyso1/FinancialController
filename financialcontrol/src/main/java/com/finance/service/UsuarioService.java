package com.finance.service;

import com.finance.dto.Usuario.DadosRegistro;
import com.finance.model.Usuario;
import com.finance.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.List;

@Service
public class UsuarioService {

    @Autowired
    private UsuarioRepository repository;

    public Usuario cadastrar(DadosRegistro dados) {
        if (repository.existsByUsername(dados.username())) {
            throw new RuntimeException("Usuário já existe");
        }

        var novoUsuario = new Usuario(null, dados.username(), dados.senha(), null, null, null);

        return repository.save(novoUsuario);
    }

    public Optional<Usuario> autenticar(String username, String senha) {
        Optional<Usuario> usuario = repository.findByUsername(username);

        if (usuario.isPresent() && usuario.get().getSenha().equals(senha)) {
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
}
