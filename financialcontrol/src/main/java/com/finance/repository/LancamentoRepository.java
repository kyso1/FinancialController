package com.finance.repository;

import com.finance.model.Lancamento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface LancamentoRepository extends JpaRepository<Lancamento, Long> {

    List<Lancamento> findAllByOrderByDataDesc();

    List<Lancamento> findAllByUsuarioIdOrderByDataDesc(Long usuarioId);

    // 1. Busca gastos fixos de um intervalo de datas (ex: mês passado)
    @Query("SELECT l FROM Lancamento l WHERE l.usuarioId = :usuarioId AND l.fixo = true AND l.data BETWEEN :inicio AND :fim")
    List<Lancamento> findFixosNoPeriodo(@Param("usuarioId") Long usuarioId, @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    // 2. Verifica se já existe um lançamento com a mesma descrição neste mês (para não duplicar)
    @Query("SELECT COUNT(l) > 0 FROM Lancamento l WHERE l.usuarioId = :usuarioId AND l.descricao = :descricao AND l.data BETWEEN :inicio AND :fim")
    boolean existeNoPeriodo(@Param("usuarioId") Long usuarioId, @Param("descricao") String descricao, @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    // 3. Verifica se já existe uma parcela específica (para evitar duplicatas de parcelamento)
    @Query("SELECT COUNT(l) > 0 FROM Lancamento l WHERE l.usuarioId = :usuarioId AND l.descricao = :descricao AND l.parcelaAtual = :parcelaAtual AND l.totalParcelas = :totalParcelas")
    boolean existeParcela(@Param("usuarioId") Long usuarioId, @Param("descricao") String descricao, @Param("parcelaAtual") Integer parcelaAtual, @Param("totalParcelas") Integer totalParcelas);
}