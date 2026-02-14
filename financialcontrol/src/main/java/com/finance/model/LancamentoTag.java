package com.finance.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "lancamento_tag")
public class LancamentoTag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long lancamentoId;

    private Long tagId;
}
