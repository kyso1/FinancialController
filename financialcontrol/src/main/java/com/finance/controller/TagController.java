package com.finance.controller;

import com.finance.model.LancamentoTag;
import com.finance.model.Tag;
import com.finance.repository.LancamentoTagRepository;
import com.finance.repository.TagRepository;
import com.finance.security.AuthHelper;
import com.finance.util.SanitizacaoUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/tags")
public class TagController {

    @Autowired
    private TagRepository tagRepository;

    @Autowired
    private LancamentoTagRepository lancamentoTagRepository;

    @GetMapping
    public ResponseEntity<?> listar() {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        List<Tag> tags = tagRepository.findByUsuarioId(usuarioId);
        return ResponseEntity.ok(tags);
    }

    @PostMapping
    public ResponseEntity<?> criar(@RequestBody Map<String, String> dados) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        String nome = SanitizacaoUtil.sanitizar(dados.get("nome")).toLowerCase().replaceAll("\\s+", "_");

        // Verifica se já existe
        Optional<Tag> existente = tagRepository.findByUsuarioIdAndNomeIgnoreCase(usuarioId, nome);
        if (existente.isPresent()) {
            return ResponseEntity.ok(Map.of("mensagem", "Tag já existe", "id", existente.get().getId()));
        }

        Tag tag = new Tag();
        tag.setUsuarioId(usuarioId);
        tag.setNome(nome);
        tagRepository.save(tag);

        return ResponseEntity.ok(Map.of("mensagem", "Tag criada!", "id", tag.getId(), "nome", tag.getNome()));
    }

    @PostMapping("/lancamento/{lancamentoId}")
    public ResponseEntity<?> vincularTag(@PathVariable Long lancamentoId, @RequestBody Map<String, Object> dados) {
        Long tagId = Long.valueOf(dados.get("tagId").toString());

        LancamentoTag lt = new LancamentoTag();
        lt.setLancamentoId(lancamentoId);
        lt.setTagId(tagId);
        lancamentoTagRepository.save(lt);

        return ResponseEntity.ok(Map.of("mensagem", "Tag vinculada ao lançamento!"));
    }

    @GetMapping("/lancamento/{lancamentoId}")
    public ResponseEntity<?> listarTagsDoLancamento(@PathVariable Long lancamentoId) {
        List<LancamentoTag> vinculos = lancamentoTagRepository.findByLancamentoId(lancamentoId);
        List<Map<String, Object>> resultado = new ArrayList<>();

        for (LancamentoTag lt : vinculos) {
            tagRepository.findById(lt.getTagId()).ifPresent(tag -> {
                Map<String, Object> item = new HashMap<>();
                item.put("id", tag.getId());
                item.put("nome", tag.getNome());
                resultado.add(item);
            });
        }

        return ResponseEntity.ok(resultado);
    }

    @GetMapping("/filtrar/{tagId}")
    public ResponseEntity<?> lancamentosPorTag(@PathVariable Long tagId) {
        List<Long> lancamentoIds = lancamentoTagRepository.findLancamentoIdsByTagId(tagId);
        return ResponseEntity.ok(Map.of("lancamentoIds", lancamentoIds));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deletar(@PathVariable Long id) {
        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        Tag tag = tagRepository.findById(id).orElse(null);
        if (tag == null || !tag.getUsuarioId().equals(usuarioId)) {
            return ResponseEntity.notFound().build();
        }
        tagRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
