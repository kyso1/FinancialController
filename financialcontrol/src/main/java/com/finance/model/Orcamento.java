package com.finance.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;

@Entity
@Data
public class Orcamento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long usuarioId;

    @Enumerated(EnumType.STRING)
    private CategoriaLancamento categoria;

    private BigDecimal limite;

    /** Mês (1-12) */
    private Integer mes;

    /** Ano (ex: 2026) */
    private Integer ano;
}
