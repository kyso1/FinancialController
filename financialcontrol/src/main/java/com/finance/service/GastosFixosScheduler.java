package com.finance.service;

import com.finance.model.Usuario;
import com.finance.repository.UsuarioRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Tarefa agendada para processar gastos fixos uma vez por dia,
 * em vez de executar a cada requisição de listagem.
 */
@Service
public class GastosFixosScheduler {

    private final LancamentoService lancamentoService;
    private final UsuarioRepository usuarioRepository;

    public GastosFixosScheduler(LancamentoService lancamentoService, UsuarioRepository usuarioRepository) {
        this.lancamentoService = lancamentoService;
        this.usuarioRepository = usuarioRepository;
    }

    /**
     * Roda todos os dias às 00:01.
     */
    @Scheduled(cron = "0 1 0 * * *")
    public void processarGastosFixosDiario() {
        List<Usuario> usuarios = usuarioRepository.findAll();
        for (Usuario usuario : usuarios) {
            try {
                lancamentoService.processarGastosFixosDoMes(usuario.getId());
            } catch (Exception e) {
                System.err.println("Erro ao processar gastos fixos para usuário " + usuario.getId() + ": " + e.getMessage());
            }
        }
        System.out.println("Processamento diário de gastos fixos concluído.");
    }
}
