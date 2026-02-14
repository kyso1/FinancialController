package com.finance.controller;

import com.finance.model.CategoriaLancamento;
import com.finance.model.Lancamento;
import com.finance.model.Orcamento;
import com.finance.repository.LancamentoRepository;
import com.finance.repository.OrcamentoRepository;
import com.finance.security.AuthHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@RestController
@RequestMapping("/api/orcamentos")
public class OrcamentoController {

    @Autowired
    private OrcamentoRepository orcamentoRepository;

    @Autowired
    private LancamentoRepository lancamentoRepository;

    @GetMapping
    public ResponseEntity<?> listar(@RequestParam(required = false) Integer mes,
                                     @RequestParam(required = false) Integer ano) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();

        if (mes == null) mes = LocalDate.now().getMonthValue();
        if (ano == null) ano = LocalDate.now().getYear();

        List<Orcamento> orcamentos = orcamentoRepository.findByUsuarioIdAndMesAndAno(usuarioId, mes, ano);

        // Calcula gastos por categoria no mês
        LocalDate inicio = LocalDate.of(ano, mes, 1);
        LocalDate fim = inicio.with(TemporalAdjusters.lastDayOfMonth());

        List<Map<String, Object>> resultado = new ArrayList<>();
        for (Orcamento orc : orcamentos) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", orc.getId());
            item.put("categoria", orc.getCategoria().toString());
            item.put("limite", orc.getLimite());
            item.put("mes", orc.getMes());
            item.put("ano", orc.getAno());

            // Calcula gasto atual da categoria
            List<Lancamento> lancamentos = lancamentoRepository.findAllByUsuarioIdOrderByDataDesc(usuarioId);
            BigDecimal gastoAtual = lancamentos.stream()
                    .filter(l -> l.getCategoria() == orc.getCategoria()
                            && l.getTipo().name().equals("DESPESA")
                            && !l.getData().isBefore(inicio)
                            && !l.getData().isAfter(fim))
                    .map(Lancamento::getValor)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            item.put("gastoAtual", gastoAtual);
            item.put("percentual", orc.getLimite().compareTo(BigDecimal.ZERO) > 0
                    ? gastoAtual.multiply(BigDecimal.valueOf(100)).divide(orc.getLimite(), 2, java.math.RoundingMode.HALF_UP)
                    : BigDecimal.ZERO);

            resultado.add(item);
        }

        return ResponseEntity.ok(resultado);
    }

    @PostMapping
    public ResponseEntity<?> criar(@RequestBody Map<String, Object> dados) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();

        CategoriaLancamento categoria = CategoriaLancamento.valueOf(dados.get("categoria").toString());
        BigDecimal limite = new BigDecimal(dados.get("limite").toString());
        Integer mes = dados.get("mes") != null ? Integer.parseInt(dados.get("mes").toString()) : LocalDate.now().getMonthValue();
        Integer ano = dados.get("ano") != null ? Integer.parseInt(dados.get("ano").toString()) : LocalDate.now().getYear();

        // Verifica se já existe para essa categoria/mês
        Optional<Orcamento> existente = orcamentoRepository.findByUsuarioIdAndCategoriaAndMesAndAno(usuarioId, categoria, mes, ano);
        if (existente.isPresent()) {
            Orcamento orc = existente.get();
            orc.setLimite(limite);
            orcamentoRepository.save(orc);
            return ResponseEntity.ok(Map.of("mensagem", "Orçamento atualizado!", "id", orc.getId()));
        }

        Orcamento orcamento = new Orcamento();
        orcamento.setUsuarioId(usuarioId);
        orcamento.setCategoria(categoria);
        orcamento.setLimite(limite);
        orcamento.setMes(mes);
        orcamento.setAno(ano);

        orcamentoRepository.save(orcamento);
        return ResponseEntity.ok(Map.of("mensagem", "Orçamento criado!", "id", orcamento.getId()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(@PathVariable Long id) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        Orcamento orc = orcamentoRepository.findById(id).orElse(null);
        if (orc == null || !orc.getUsuarioId().equals(usuarioId)) {
            return ResponseEntity.notFound().build();
        }
        orcamentoRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
