package com.finance.controller;

import com.finance.model.Lancamento;
import com.finance.service.LancamentoService; 
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/lancamentos")
@CrossOrigin(origins = "*")
public class LancamentoController {

    @Autowired
    private LancamentoService service;

    @GetMapping
    public List<Lancamento> listar(@RequestParam(required = false) Long usuarioId) {
        if (usuarioId != null) {
            service.processarGastosFixosDoMes(usuarioId);
            return service.listarPorUsuario(usuarioId);
        }

        return service.listarTodos();
    }

    @PostMapping
    public Lancamento salvar(@RequestBody Lancamento lancamento) {
        return service.salvar(lancamento);
    }

    @DeleteMapping("/{id}")
    public void deletar(@PathVariable Long id) {
        service.deletar(id);
    }

    @PutMapping("/{id}")
    public Lancamento atualizar(@PathVariable Long id, @RequestBody Lancamento novosDados) {
        return service.atualizar(id, novosDados);
    }

    @GetMapping("/{id}")
    public Lancamento buscarPorId(@PathVariable Long id) {
        return service.buscarPorId(id);
    }
}