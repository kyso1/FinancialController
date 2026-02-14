package com.finance.controller;

import com.finance.model.Lancamento;
import com.finance.security.AuthHelper;
import com.finance.service.LancamentoService;
import com.finance.util.SanitizacaoUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/lancamentos")
public class LancamentoController {

    @Autowired
    private LancamentoService service;

    @GetMapping
    public List<Lancamento> listar() {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        return service.listarPorUsuario(usuarioId);
    }

    @PostMapping
    public Lancamento salvar(@RequestBody Lancamento lancamento) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        lancamento.setUsuarioId(usuarioId);
        lancamento.setDescricao(SanitizacaoUtil.sanitizar(lancamento.getDescricao()));
        return service.salvar(lancamento);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(@PathVariable Long id) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        Lancamento lancamento = service.buscarPorId(id);
        if (lancamento == null || !lancamento.getUsuarioId().equals(usuarioId)) {
            return ResponseEntity.notFound().build();
        }
        service.deletar(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}")
    public ResponseEntity<Lancamento> atualizar(@PathVariable Long id, @RequestBody Lancamento novosDados) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        Lancamento existente = service.buscarPorId(id);
        if (existente == null || !existente.getUsuarioId().equals(usuarioId)) {
            return ResponseEntity.notFound().build();
        }
        novosDados.setDescricao(SanitizacaoUtil.sanitizar(novosDados.getDescricao()));
        Lancamento atualizado = service.atualizar(id, novosDados);
        return ResponseEntity.ok(atualizado);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Lancamento> buscarPorId(@PathVariable Long id) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        Lancamento lancamento = service.buscarPorId(id);
        if (lancamento == null || !lancamento.getUsuarioId().equals(usuarioId)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(lancamento);
    }
}