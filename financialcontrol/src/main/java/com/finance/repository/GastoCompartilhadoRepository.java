package com.finance.repository;

import com.finance.model.GastoCompartilhado;
import com.finance.model.StatusCompartilhamento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GastoCompartilhadoRepository extends JpaRepository<GastoCompartilhado, Long> {

    List<GastoCompartilhado> findByUsuarioDestinoIdAndStatus(Long usuarioDestinoId, StatusCompartilhamento status);

    List<GastoCompartilhado> findByUsuarioOrigemIdOrderByDataCompartilhamentoDesc(Long usuarioOrigemId);

    List<GastoCompartilhado> findByUsuarioDestinoIdOrderByDataCompartilhamentoDesc(Long usuarioDestinoId);
}
