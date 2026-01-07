package com.finance.service;

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

    public Usuario cadastrar(String username, String senha) {
        if (repository.existsByUsername(username)) {
            throw new RuntimeException("Usuário já existe");
        }

        Usuario usuario = new Usuario();
        usuario.setUsername(username);
        // Em produção, use BCrypt ou similar para hash de senha
        usuario.setSenha(senha);

        return repository.save(usuario);
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
