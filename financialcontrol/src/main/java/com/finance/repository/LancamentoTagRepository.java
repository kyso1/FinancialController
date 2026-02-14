package com.finance.repository;

import com.finance.model.LancamentoTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LancamentoTagRepository extends JpaRepository<LancamentoTag, Long> {

    List<LancamentoTag> findByLancamentoId(Long lancamentoId);

    List<LancamentoTag> findByTagId(Long tagId);

    void deleteByLancamentoId(Long lancamentoId);

    @Query("SELECT lt.lancamentoId FROM LancamentoTag lt WHERE lt.tagId = :tagId")
    List<Long> findLancamentoIdsByTagId(@Param("tagId") Long tagId);
}
