package com.finance.controller;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.finance.model.Amizade;
import com.finance.model.StatusAmizade;
import com.finance.model.Usuario;
import com.finance.repository.AmizadeRepository;
import com.finance.repository.UsuarioRepository;
import com.finance.security.AuthHelper;

@RestController
@RequestMapping("/api/amigos")
public class AmigoController {

    @Autowired
    private AmizadeRepository amizadeRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    /**
     * Enviar solicitação de amizade
     */
    @PostMapping("/solicitar")
    public ResponseEntity<?> solicitarAmizade(@RequestBody Map<String, Object> dados) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        Long destinatarioId = Long.valueOf(dados.get("usuarioDestinatarioId").toString());

        if (usuarioId.equals(destinatarioId)) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Você não pode adicionar a si mesmo como amigo"));
        }

        // Verifica se o destinatário existe
        if (!usuarioRepository.existsById(destinatarioId)) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Usuário não encontrado"));
        }

        // Verifica se já existe amizade ou pedido pendente
        Optional<Amizade> existente = amizadeRepository.findAmizadeExistente(usuarioId, destinatarioId);
        if (existente.isPresent()) {
            Amizade a = existente.get();
            if (a.getStatus() == StatusAmizade.ACEITA) {
                return ResponseEntity.badRequest().body(Map.of("erro", "Vocês já são amigos"));
            }
            return ResponseEntity.badRequest().body(Map.of("erro", "Já existe uma solicitação pendente"));
        }

        Amizade amizade = new Amizade();
        amizade.setUsuarioSolicitanteId(usuarioId);
        amizade.setUsuarioDestinatarioId(destinatarioId);
        amizadeRepository.save(amizade);

        return ResponseEntity.ok(Map.of("mensagem", "Solicitação de amizade enviada!"));
    }

    /**
     * Listar solicitações pendentes recebidas
     */
    @GetMapping("/pendentes")
    public ResponseEntity<?> listarPendentes() {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        List<Amizade> pendentes = amizadeRepository.findByUsuarioDestinatarioIdAndStatus(usuarioId, StatusAmizade.PENDENTE);

        List<Map<String, Object>> resultado = new ArrayList<>();
        for (Amizade a : pendentes) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", a.getId());
            item.put("dataSolicitacao", a.getDataSolicitacao().toString());

            Optional<Usuario> solicitante = usuarioRepository.findById(a.getUsuarioSolicitanteId());
            if (solicitante.isPresent()) {
                Usuario u = solicitante.get();
                item.put("solicitante", Map.of(
                    "id", u.getId(),
                    "username", u.getUsername(),
                    "nome", u.getNome() != null ? u.getNome() : u.getUsername(),
                    "fotoPerfil", u.getFotoPerfil() != null ? u.getFotoPerfil() : ""
                ));
            }
            resultado.add(item);
        }

        return ResponseEntity.ok(resultado);
    }

    /**
     * Listar solicitações pendentes enviadas
     */
    @GetMapping("/enviados")
    public ResponseEntity<?> listarEnviados() {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        List<Amizade> enviados = amizadeRepository.findByUsuarioSolicitanteIdAndStatus(usuarioId, StatusAmizade.PENDENTE);

        List<Map<String, Object>> resultado = new ArrayList<>();
        for (Amizade a : enviados) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", a.getId());
            item.put("dataSolicitacao", a.getDataSolicitacao().toString());

            Optional<Usuario> dest = usuarioRepository.findById(a.getUsuarioDestinatarioId());
            if (dest.isPresent()) {
                Usuario u = dest.get();
                item.put("destinatario", Map.of(
                    "id", u.getId(),
                    "username", u.getUsername(),
                    "nome", u.getNome() != null ? u.getNome() : u.getUsername(),
                    "fotoPerfil", u.getFotoPerfil() != null ? u.getFotoPerfil() : ""
                ));
            }
            resultado.add(item);
        }

        return ResponseEntity.ok(resultado);
    }

    /**
     * Aceitar solicitação de amizade
     */
    @PutMapping("/{id}/aceitar")
    public ResponseEntity<?> aceitar(@PathVariable Long id) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();

        Amizade amizade = amizadeRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Solicitação não encontrada"));

        if (!amizade.getUsuarioDestinatarioId().equals(usuarioId)) {
            return ResponseEntity.status(403).body(Map.of("erro", "Sem permissão"));
        }

        if (amizade.getStatus() != StatusAmizade.PENDENTE) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Esta solicitação já foi respondida"));
        }

        amizade.setStatus(StatusAmizade.ACEITA);
        amizade.setDataResposta(LocalDateTime.now());
        amizadeRepository.save(amizade);

        return ResponseEntity.ok(Map.of("mensagem", "Amizade aceita!"));
    }

    /**
     * Recusar solicitação de amizade
     */
    @PutMapping("/{id}/recusar")
    public ResponseEntity<?> recusar(@PathVariable Long id) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();

        Amizade amizade = amizadeRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Solicitação não encontrada"));

        if (!amizade.getUsuarioDestinatarioId().equals(usuarioId)) {
            return ResponseEntity.status(403).body(Map.of("erro", "Sem permissão"));
        }

        amizade.setStatus(StatusAmizade.RECUSADA);
        amizade.setDataResposta(LocalDateTime.now());
        amizadeRepository.save(amizade);

        return ResponseEntity.ok(Map.of("mensagem", "Solicitação recusada"));
    }

    /**
     * Listar todos os amigos aceitos
     */
    @GetMapping
    public ResponseEntity<?> listarAmigos() {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        List<Amizade> amizades = amizadeRepository.findAmizadesAceitas(usuarioId);

        List<Map<String, Object>> resultado = new ArrayList<>();
        for (Amizade a : amizades) {
            Long amigoId = a.getUsuarioSolicitanteId().equals(usuarioId)
                ? a.getUsuarioDestinatarioId()
                : a.getUsuarioSolicitanteId();

            Optional<Usuario> amigo = usuarioRepository.findById(amigoId);
            if (amigo.isPresent()) {
                Usuario u = amigo.get();
                Map<String, Object> item = new HashMap<>();
                item.put("amizadeId", a.getId());
                item.put("id", u.getId());
                item.put("username", u.getUsername());
                item.put("nome", u.getNome() != null ? u.getNome() : u.getUsername());
                item.put("fotoPerfil", u.getFotoPerfil() != null ? u.getFotoPerfil() : "");
                item.put("desde", a.getDataResposta() != null ? a.getDataResposta().toString() : a.getDataSolicitacao().toString());
                resultado.add(item);
            }
        }

        return ResponseEntity.ok(resultado);
    }

    /**
     * Remover amizade
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> removerAmizade(@PathVariable Long id) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();

        Amizade amizade = amizadeRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Amizade não encontrada"));

        if (!amizade.getUsuarioSolicitanteId().equals(usuarioId) &&
            !amizade.getUsuarioDestinatarioId().equals(usuarioId)) {
            return ResponseEntity.status(403).body(Map.of("erro", "Sem permissão"));
        }

        amizadeRepository.delete(amizade);

        return ResponseEntity.ok(Map.of("mensagem", "Amizade removida"));
    }

    /**
     * Buscar usuários para adicionar (só retorna quem não é amigo)
     */
    @GetMapping("/buscar")
    public ResponseEntity<?> buscarUsuarios(@RequestParam String query) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        List<Usuario> usuarios = usuarioRepository.findByUsernameContainingIgnoreCase(query);

        List<Map<String, Object>> resultado = new ArrayList<>();
        for (Usuario u : usuarios) {
            if (u.getId().equals(usuarioId)) continue;

            Map<String, Object> item = new HashMap<>();
            item.put("id", u.getId());
            item.put("username", u.getUsername());
            item.put("nome", u.getNome() != null ? u.getNome() : u.getUsername());
            item.put("fotoPerfil", u.getFotoPerfil() != null ? u.getFotoPerfil() : "");

            // Verificar status de amizade
            Optional<Amizade> amizadeExistente = amizadeRepository.findAmizadeExistente(usuarioId, u.getId());
            if (amizadeExistente.isPresent()) {
                item.put("statusAmizade", amizadeExistente.get().getStatus().toString());
            } else {
                item.put("statusAmizade", "NENHUM");
            }

            resultado.add(item);
        }

        return ResponseEntity.ok(resultado);
    }
}
