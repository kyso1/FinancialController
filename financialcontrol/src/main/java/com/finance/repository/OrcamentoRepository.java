package com.finance.repository;

import com.finance.model.CategoriaLancamento;
import com.finance.model.Orcamento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrcamentoRepository extends JpaRepository<Orcamento, Long> {

    List<Orcamento> findByUsuarioIdAndMesAndAno(Long usuarioId, Integer mes, Integer ano);

    Optional<Orcamento> findByUsuarioIdAndCategoriaAndMesAndAno(Long usuarioId, CategoriaLancamento categoria, Integer mes, Integer ano);

    List<Orcamento> findByUsuarioId(Long usuarioId);
}
