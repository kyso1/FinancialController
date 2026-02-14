package com.finance.repository;

import com.finance.model.MetaEconomia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MetaEconomiaRepository extends JpaRepository<MetaEconomia, Long> {

    List<MetaEconomia> findByUsuarioIdOrderByDataLimiteAsc(Long usuarioId);

    List<MetaEconomia> findByUsuarioIdAndConcluidaFalse(Long usuarioId);
}
