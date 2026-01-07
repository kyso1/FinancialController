package com.finance.service;

import com.finance.model.Lancamento;
import com.finance.repository.LancamentoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Optional;

@Service
public class LancamentoService {

    @Autowired
    private LancamentoRepository repository;

    // Método que roda toda vez que listar os gastos
    @Transactional
    public void processarGastosFixosDoMes(Long usuarioId) {
        LocalDate hoje = LocalDate.now();
        LocalDate inicioMesAtual = hoje.with(TemporalAdjusters.firstDayOfMonth());
        LocalDate fimMesAtual = hoje.with(TemporalAdjusters.lastDayOfMonth());

        // Datas do mês passado
        LocalDate inicioMesPassado = inicioMesAtual.minusMonths(1);
        LocalDate fimMesPassado = fimMesAtual.minusMonths(1);

        // Pega tudo que foi fixo no mês passado
        List<Lancamento> fixosMesPassado = repository.findFixosNoPeriodo(usuarioId, inicioMesPassado, fimMesPassado);

        // Para cada gasto fixo do mês passado...
        for (Lancamento gastoAntigo : fixosMesPassado) {
            // ...verifica se ele já existe neste mês atual
            boolean jaExiste = repository.existeNoPeriodo(usuarioId, gastoAntigo.getDescricao(), inicioMesAtual, fimMesAtual);

            // Se não existe, cria uma cópia para hoje
            if (!jaExiste) {
                Lancamento novoGasto = new Lancamento();
                novoGasto.setUsuarioId(usuarioId);
                novoGasto.setDescricao(gastoAntigo.getDescricao());
                novoGasto.setValor(gastoAntigo.getValor());
                novoGasto.setTipo(gastoAntigo.getTipo());
                novoGasto.setCategoria(gastoAntigo.getCategoria());
                novoGasto.setFixo(true); // Continua sendo fixo para o próximo mês
                novoGasto.setData(hoje); // Data de hoje

                repository.save(novoGasto);
                System.out.println("Gasto fixo gerado automaticamente: " + novoGasto.getDescricao());
            }
        }
    }

    public Lancamento atualizar(Long id, Lancamento novosDados){
        return repository.findById(id).map(lancamentoExistente ->{
            lancamentoExistente.setDescricao(novosDados.getDescricao());
            lancamentoExistente.setValor(novosDados.getValor());
            lancamentoExistente.setData(novosDados.getData());
            lancamentoExistente.setTipo(novosDados.getTipo());
            lancamentoExistente.setCategoria(novosDados.getCategoria());
            lancamentoExistente.setFixo(novosDados.isFixo());
            //lancamentoExistente.setData(novosDados.getData()); comentado pra evitar de alterar a ordem ao atualizar.
            return repository.save(lancamentoExistente);
        }).orElse(null);
    }
    public Lancamento buscarPorId(Long id){
        return repository.findById(id).orElse(null);
    }

    public List<Lancamento> listarTodos() {
        return repository.findAllByOrderByDataDesc();
    }

    public List<Lancamento> listarPorUsuario(Long usuarioId) {
        return repository.findAllByUsuarioIdOrderByDataDesc(usuarioId);
    }
    
    public Lancamento salvar(Lancamento l) {
        if (l.getData() == null) l.setData(LocalDate.now());
        return repository.save(l);
    }
    
    public void deletar(Long id) {
        repository.deleteById(id);
    }
}