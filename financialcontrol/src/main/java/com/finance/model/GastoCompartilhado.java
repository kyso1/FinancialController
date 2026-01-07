package com.finance.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
public class GastoCompartilhado {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long lancamentoId;

    private Long usuarioOrigemId;

    private Long usuarioDestinoId;

    @Column(length = 500)
    private String descricaoCompartilhamento;

    @Enumerated(EnumType.STRING)
    private TipoCompartilhamento tipoCompartilhamento;

    @Enumerated(EnumType.STRING)
    private StatusCompartilhamento status;

    private LocalDateTime dataCompartilhamento;

    @PrePersist
    protected void onCreate() {
        dataCompartilhamento = LocalDateTime.now();
        if (status == null) {
            status = StatusCompartilhamento.PENDENTE;
        }
    }
}
