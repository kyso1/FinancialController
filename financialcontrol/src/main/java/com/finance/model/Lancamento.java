package com.finance.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Data
public class Lancamento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id")
    private Long usuarioId;

    private String descricao;

    private BigDecimal valor;

    @Enumerated(EnumType.STRING)
    private TipoLancamento tipo;

    @Enumerated(EnumType.STRING)
    private CategoriaLancamento categoria;

    private boolean fixo;

    private LocalDate data;

    private Integer parcelaAtual;

    private Integer totalParcelas;

    /** FITID do OFX — identificador único da transação para evitar duplicatas */
    @Column(name = "id_transacao")
    private String idTransacao;

    @Enumerated(EnumType.STRING)
    private MetodoPagamento metodoPagamento;
}