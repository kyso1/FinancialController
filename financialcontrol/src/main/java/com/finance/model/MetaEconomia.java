package com.finance.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Data
public class MetaEconomia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long usuarioId;

    private String nome; // ex: "Viagem", "Carro Novo"

    private BigDecimal valorObjetivo;

    private BigDecimal valorAcumulado;

    private LocalDate dataLimite;

    private boolean concluida;

    @PrePersist
    protected void onCreate() {
        if (valorAcumulado == null) {
            valorAcumulado = BigDecimal.ZERO;
        }
    }
}
