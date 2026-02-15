package com.finance.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import lombok.Data;

@Entity
@Data
public class Amizade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long usuarioSolicitanteId;

    @Column(nullable = false)
    private Long usuarioDestinatarioId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusAmizade status;

    private LocalDateTime dataSolicitacao;

    private LocalDateTime dataResposta;

    @PrePersist
    protected void onCreate() {
        dataSolicitacao = LocalDateTime.now();
        if (status == null) {
            status = StatusAmizade.PENDENTE;
        }
    }
}
