package com.finance.controller;

import com.finance.model.*;
import com.finance.repository.GastoCompartilhadoRepository;
import com.finance.repository.LancamentoRepository;
import com.finance.security.AuthHelper;
import com.finance.service.LancamentoService;
import com.finance.util.SanitizacaoUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/compartilhamento")
public class CompartilhamentoController {

    @Autowired
    private GastoCompartilhadoRepository compartilhamentoRepository;

    @Autowired
    private LancamentoRepository lancamentoRepository;

    @Autowired
    private LancamentoService lancamentoService;

    @PostMapping
    public ResponseEntity<?> compartilhar(@RequestBody Map<String, Object> dados) {
        Long usuarioOrigemId = AuthHelper.getUsuarioIdAutenticado();
        Long lancamentoId = Long.valueOf(dados.get("lancamentoId").toString());
        Long usuarioDestinoId = Long.valueOf(dados.get("usuarioDestinoId").toString());
        String descricao = SanitizacaoUtil.sanitizar(dados.get("descricao").toString());
        String tipoStr = dados.get("tipo").toString();

        GastoCompartilhado compartilhamento = new GastoCompartilhado();
        compartilhamento.setLancamentoId(lancamentoId);
        compartilhamento.setUsuarioOrigemId(usuarioOrigemId);
        compartilhamento.setUsuarioDestinoId(usuarioDestinoId);
        compartilhamento.setDescricaoCompartilhamento(descricao);
        compartilhamento.setTipoCompartilhamento(TipoCompartilhamento.valueOf(tipoStr));

        compartilhamentoRepository.save(compartilhamento);

        return ResponseEntity.ok(Map.of("mensagem", "Gasto compartilhado com sucesso!"));
    }

    @GetMapping("/pendentes")
    public ResponseEntity<?> listarPendentes() {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        List<GastoCompartilhado> pendentes = compartilhamentoRepository.findByUsuarioDestinoIdAndStatus(
            usuarioId, StatusCompartilhamento.PENDENTE
        );

        List<Map<String, Object>> resultado = new ArrayList<>();
        for (GastoCompartilhado comp : pendentes) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", comp.getId());
            item.put("lancamentoId", comp.getLancamentoId());
            item.put("usuarioOrigemId", comp.getUsuarioOrigemId());
            item.put("descricao", comp.getDescricaoCompartilhamento());
            item.put("tipo", comp.getTipoCompartilhamento().toString());
            item.put("dataCompartilhamento", comp.getDataCompartilhamento().toString());

            Optional<Lancamento> lancamento = lancamentoRepository.findById(comp.getLancamentoId());
            if (lancamento.isPresent()) {
                item.put("lancamento", Map.of(
                    "descricao", lancamento.get().getDescricao(),
                    "valor", lancamento.get().getValor(),
                    "data", lancamento.get().getData().toString()
                ));
            }

            resultado.add(item);
        }

        return ResponseEntity.ok(resultado);
    }

    @PutMapping("/{id}/aceitar")
    public ResponseEntity<?> aceitar(@PathVariable Long id) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();

        GastoCompartilhado compartilhamento = compartilhamentoRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Compartilhamento não encontrado"));

        if (!compartilhamento.getUsuarioDestinoId().equals(usuarioId)) {
            return ResponseEntity.status(403).body(Map.of("erro", "Sem permissão"));
        }

        compartilhamento.setStatus(StatusCompartilhamento.ACEITO);
        compartilhamentoRepository.save(compartilhamento);

        Lancamento original = lancamentoRepository.findById(compartilhamento.getLancamentoId())
            .orElseThrow(() -> new RuntimeException("Lançamento não encontrado"));

        Lancamento copia = new Lancamento();
        copia.setUsuarioId(usuarioId);
        copia.setDescricao(original.getDescricao() + " (compartilhado)");
        copia.setValor(original.getValor());
        copia.setTipo(original.getTipo());
        copia.setCategoria(original.getCategoria());
        copia.setFixo(false);
        copia.setData(original.getData());
        copia.setParcelaAtual(original.getParcelaAtual());
        copia.setTotalParcelas(original.getTotalParcelas());

        lancamentoService.salvar(copia);

        return ResponseEntity.ok(Map.of("mensagem", "Compartilhamento aceito!"));
    }

    @PutMapping("/{id}/recusar")
    public ResponseEntity<?> recusar(@PathVariable Long id) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();

        GastoCompartilhado compartilhamento = compartilhamentoRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Compartilhamento não encontrado"));

        if (!compartilhamento.getUsuarioDestinoId().equals(usuarioId)) {
            return ResponseEntity.status(403).body(Map.of("erro", "Sem permissão"));
        }

        compartilhamento.setStatus(StatusCompartilhamento.RECUSADO);
        compartilhamentoRepository.save(compartilhamento);

        return ResponseEntity.ok(Map.of("mensagem", "Compartilhamento recusado"));
    }

    @GetMapping("/enviados")
    public ResponseEntity<?> listarEnviados() {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        List<GastoCompartilhado> enviados = compartilhamentoRepository
            .findByUsuarioOrigemIdOrderByDataCompartilhamentoDesc(usuarioId);

        return ResponseEntity.ok(enviados);
    }
}
