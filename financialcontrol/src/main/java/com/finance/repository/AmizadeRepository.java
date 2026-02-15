package com.finance.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.finance.model.Amizade;
import com.finance.model.StatusAmizade;

@Repository
public interface AmizadeRepository extends JpaRepository<Amizade, Long> {

    // Pedidos pendentes recebidos
    List<Amizade> findByUsuarioDestinatarioIdAndStatus(Long usuarioDestinatarioId, StatusAmizade status);

    // Pedidos pendentes enviados
    List<Amizade> findByUsuarioSolicitanteIdAndStatus(Long usuarioSolicitanteId, StatusAmizade status);

    // Todas as amizades aceitas (em ambas as direções)
    @Query("SELECT a FROM Amizade a WHERE (a.usuarioSolicitanteId = :userId OR a.usuarioDestinatarioId = :userId) AND a.status = 'ACEITA'")
    List<Amizade> findAmizadesAceitas(@Param("userId") Long userId);

    // Verifica se já existe uma amizade (em qualquer direção)
    @Query("SELECT a FROM Amizade a WHERE " +
           "((a.usuarioSolicitanteId = :u1 AND a.usuarioDestinatarioId = :u2) OR " +
           "(a.usuarioSolicitanteId = :u2 AND a.usuarioDestinatarioId = :u1)) " +
           "AND a.status IN ('PENDENTE', 'ACEITA')")
    Optional<Amizade> findAmizadeExistente(@Param("u1") Long u1, @Param("u2") Long u2);

    // Verifica se dois usuários são amigos
    @Query("SELECT COUNT(a) > 0 FROM Amizade a WHERE " +
           "((a.usuarioSolicitanteId = :u1 AND a.usuarioDestinatarioId = :u2) OR " +
           "(a.usuarioSolicitanteId = :u2 AND a.usuarioDestinatarioId = :u1)) " +
           "AND a.status = 'ACEITA'")
    boolean saoAmigos(@Param("u1") Long u1, @Param("u2") Long u2);
}
