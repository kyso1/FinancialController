package com.finance.controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.finance.model.Lancamento;
import com.finance.security.AuthHelper;
import com.finance.service.LancamentoService;
import com.finance.util.SanitizacaoUtil;

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

    @DeleteMapping("/bulk")
    public ResponseEntity<?> deletarVarios(@RequestBody Map<String, List<Long>> body) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        List<Long> ids = body.get("ids");
        if (ids == null || ids.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Nenhum ID informado"));
        }
        int deletados = service.deletarVarios(ids, usuarioId);
        return ResponseEntity.ok(Map.of("deletados", deletados));
    }

    @PutMapping("/bulk")
    public ResponseEntity<?> atualizarVarios(@RequestBody Map<String, Object> body) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        @SuppressWarnings("unchecked")
        List<Integer> idsRaw = (List<Integer>) body.get("ids");
        String metodoStr = (String) body.get("metodoPagamento");
        if (idsRaw == null || idsRaw.isEmpty() || metodoStr == null) {
            return ResponseEntity.badRequest().body(Map.of("erro", "IDs e métodoPagamento obrigatórios"));
        }
        List<Long> ids = idsRaw.stream().map(Integer::longValue).toList();
        com.finance.model.MetodoPagamento metodo = com.finance.model.MetodoPagamento.valueOf(metodoStr);
        int atualizados = service.atualizarMetodoPagamentoEmLote(ids, usuarioId, metodo);
        return ResponseEntity.ok(Map.of("atualizados", atualizados));
    }
}