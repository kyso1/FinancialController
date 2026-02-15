package com.finance.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.finance.model.Lancamento;

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

    // 4. Verifica duplicata por idTransacao + valor (FITID do OFX pode ser compartilhado entre transações relacionadas)
    boolean existsByIdTransacaoAndUsuarioIdAndValor(String idTransacao, Long usuarioId, java.math.BigDecimal valor);

    // 5. Verifica duplicata exata por descrição + valor + data
    @Query("SELECT COUNT(l) > 0 FROM Lancamento l WHERE l.usuarioId = :usuarioId AND l.descricao = :descricao AND l.valor = :valor AND l.data = :data")
    boolean existeDuplicataExata(@Param("usuarioId") Long usuarioId, @Param("descricao") String descricao, @Param("valor") java.math.BigDecimal valor, @Param("data") LocalDate data);

    // 6. Busca lançamentos por IDs e usuário (para bulk delete seguro)
    List<Lancamento> findAllByIdInAndUsuarioId(List<Long> ids, Long usuarioId);
}