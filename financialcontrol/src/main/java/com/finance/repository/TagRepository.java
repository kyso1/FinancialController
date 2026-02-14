package com.finance.repository;

import com.finance.model.Tag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TagRepository extends JpaRepository<Tag, Long> {

    List<Tag> findByUsuarioId(Long usuarioId);

    Optional<Tag> findByUsuarioIdAndNomeIgnoreCase(Long usuarioId, String nome);

    List<Tag> findByUsuarioIdAndNomeContainingIgnoreCase(Long usuarioId, String nome);
}
