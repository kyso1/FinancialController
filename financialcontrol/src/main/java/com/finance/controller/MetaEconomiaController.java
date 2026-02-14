package com.finance.controller;

import com.finance.model.MetaEconomia;
import com.finance.repository.MetaEconomiaRepository;
import com.finance.security.AuthHelper;
import com.finance.util.SanitizacaoUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@RestController
@RequestMapping("/api/metas")
public class MetaEconomiaController {

    @Autowired
    private MetaEconomiaRepository metaRepository;

    @GetMapping
    public ResponseEntity<?> listar() {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        List<MetaEconomia> metas = metaRepository.findByUsuarioIdOrderByDataLimiteAsc(usuarioId);

        List<Map<String, Object>> resultado = new ArrayList<>();
        for (MetaEconomia meta : metas) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", meta.getId());
            item.put("nome", meta.getNome());
            item.put("valorObjetivo", meta.getValorObjetivo());
            item.put("valorAcumulado", meta.getValorAcumulado());
            item.put("dataLimite", meta.getDataLimite() != null ? meta.getDataLimite().toString() : null);
            item.put("concluida", meta.isConcluida());

            // Calcula percentual
            BigDecimal percentual = meta.getValorObjetivo().compareTo(BigDecimal.ZERO) > 0
                    ? meta.getValorAcumulado().multiply(BigDecimal.valueOf(100)).divide(meta.getValorObjetivo(), 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            item.put("percentual", percentual);

            // Sugestão de valor mensal
            if (meta.getDataLimite() != null && !meta.isConcluida()) {
                long mesesRestantes = ChronoUnit.MONTHS.between(LocalDate.now(), meta.getDataLimite());
                if (mesesRestantes > 0) {
                    BigDecimal falta = meta.getValorObjetivo().subtract(meta.getValorAcumulado());
                    BigDecimal porMes = falta.divide(BigDecimal.valueOf(mesesRestantes), 2, RoundingMode.HALF_UP);
                    item.put("sugestaoMensal", porMes);
                    item.put("mesesRestantes", mesesRestantes);
                }
            }

            resultado.add(item);
        }

        return ResponseEntity.ok(resultado);
    }

    @PostMapping
    public ResponseEntity<?> criar(@RequestBody Map<String, Object> dados) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();

        MetaEconomia meta = new MetaEconomia();
        meta.setUsuarioId(usuarioId);
        meta.setNome(SanitizacaoUtil.sanitizar(dados.get("nome").toString()));
        meta.setValorObjetivo(new BigDecimal(dados.get("valorObjetivo").toString()));
        meta.setValorAcumulado(BigDecimal.ZERO);

        if (dados.get("dataLimite") != null) {
            meta.setDataLimite(LocalDate.parse(dados.get("dataLimite").toString()));
        }

        metaRepository.save(meta);
        return ResponseEntity.ok(Map.of("mensagem", "Meta criada!", "id", meta.getId()));
    }

    @PutMapping("/{id}/depositar")
    public ResponseEntity<?> depositar(@PathVariable Long id, @RequestBody Map<String, Object> dados) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();

        MetaEconomia meta = metaRepository.findById(id).orElse(null);
        if (meta == null || !meta.getUsuarioId().equals(usuarioId)) {
            return ResponseEntity.notFound().build();
        }

        BigDecimal valor = new BigDecimal(dados.get("valor").toString());
        meta.setValorAcumulado(meta.getValorAcumulado().add(valor));

        if (meta.getValorAcumulado().compareTo(meta.getValorObjetivo()) >= 0) {
            meta.setConcluida(true);
        }

        metaRepository.save(meta);
        return ResponseEntity.ok(Map.of("mensagem", "Depósito realizado!", "novoAcumulado", meta.getValorAcumulado()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(@PathVariable Long id) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        MetaEconomia meta = metaRepository.findById(id).orElse(null);
        if (meta == null || !meta.getUsuarioId().equals(usuarioId)) {
            return ResponseEntity.notFound().build();
        }
        metaRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
