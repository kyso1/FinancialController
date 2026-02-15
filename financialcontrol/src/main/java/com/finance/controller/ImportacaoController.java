package com.finance.controller;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.Charset;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.finance.model.CategoriaLancamento;
import com.finance.model.Lancamento;
import com.finance.model.MetodoPagamento;
import com.finance.model.TipoLancamento;
import com.finance.security.AuthHelper;
import com.finance.service.LancamentoService;
import com.finance.util.SanitizacaoUtil;
import com.opencsv.CSVReader;
import com.opencsv.CSVReaderBuilder;

@RestController
@RequestMapping("/api/importacao")
public class ImportacaoController {

    @Autowired
    private LancamentoService lancamentoService;

    @Autowired
    private com.finance.repository.LancamentoRepository lancamentoRepository;

    /**
     * Preview: parseia o arquivo e retorna os lançamentos para o usuário revisar antes de importar.
     * Marca duplicatas mas não salva nada.
     */
    @PostMapping("/preview")
    public ResponseEntity<?> previewArquivo(
            @RequestParam("arquivo") MultipartFile arquivo,
            @RequestParam(value = "tipoImportacao", defaultValue = "CARTAO") String tipoImportacao) {

        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        String nomeArquivo = arquivo.getOriginalFilename();
        List<Lancamento> lancamentos = new ArrayList<>();

        try {
            if (nomeArquivo != null && nomeArquivo.toLowerCase().endsWith(".ofx")) {
                lancamentos = processarOFX(arquivo, usuarioId, tipoImportacao);
            } else if (nomeArquivo != null && nomeArquivo.toLowerCase().endsWith(".csv")) {
                lancamentos = processarCSV(arquivo, usuarioId);
            } else {
                return ResponseEntity.badRequest().body(Map.of("erro", "Formato de arquivo não suportado. Use OFX ou CSV."));
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Erro ao processar arquivo: " + e.getMessage()));
        }

        // Monta lista de preview com flag de duplicata (verifica por FITID + valor)
        List<Map<String, Object>> preview = new ArrayList<>();
        for (int idx = 0; idx < lancamentos.size(); idx++) {
            Lancamento l = lancamentos.get(idx);
            boolean duplicata = false;
            if (l.getIdTransacao() != null && !l.getIdTransacao().isBlank()) {
                duplicata = lancamentoRepository.existsByIdTransacaoAndUsuarioIdAndValor(
                    l.getIdTransacao(), usuarioId, l.getValor());
            }
            Map<String, Object> item = new HashMap<>();
            item.put("index", idx);
            item.put("descricao", l.getDescricao());
            item.put("valor", l.getValor());
            item.put("data", l.getData() != null ? l.getData().toString() : null);
            item.put("tipo", l.getTipo() != null ? l.getTipo().name() : null);
            item.put("categoria", l.getCategoria() != null ? l.getCategoria().name() : null);
            item.put("metodoPagamento", l.getMetodoPagamento() != null ? l.getMetodoPagamento().name() : null);
            item.put("parcelaAtual", l.getParcelaAtual());
            item.put("totalParcelas", l.getTotalParcelas());
            item.put("idTransacao", l.getIdTransacao());
            item.put("duplicata", duplicata);
            preview.add(item);
        }

        return ResponseEntity.ok(preview);
    }

    /**
     * Importação real: recebe os índices selecionados pelo usuário no preview.
     */
    @PostMapping("/upload")
    public ResponseEntity<?> uploadArquivo(
            @RequestParam("arquivo") MultipartFile arquivo,
            @RequestParam(value = "tipoImportacao", defaultValue = "CARTAO") String tipoImportacao,
            @RequestParam(value = "indices", required = false) String indices) {

        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        String nomeArquivo = arquivo.getOriginalFilename();
        List<Lancamento> lancamentos = new ArrayList<>();

        try {
            if (nomeArquivo != null && nomeArquivo.toLowerCase().endsWith(".ofx")) {
                lancamentos = processarOFX(arquivo, usuarioId, tipoImportacao);
            } else if (nomeArquivo != null && nomeArquivo.toLowerCase().endsWith(".csv")) {
                lancamentos = processarCSV(arquivo, usuarioId);
            } else {
                return ResponseEntity.badRequest().body(Map.of("erro", "Formato de arquivo não suportado. Use OFX ou CSV."));
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Erro ao processar arquivo: " + e.getMessage()));
        }

        // Filtra apenas os índices selecionados pelo usuário (se fornecidos)
        if (indices != null && !indices.isBlank()) {
            java.util.Set<Integer> selecionados = new java.util.HashSet<>();
            for (String s : indices.split(",")) {
                try { selecionados.add(Integer.parseInt(s.trim())); } catch (NumberFormatException ignored) {}
            }
            List<Lancamento> filtrados = new ArrayList<>();
            for (int i = 0; i < lancamentos.size(); i++) {
                if (selecionados.contains(i)) filtrados.add(lancamentos.get(i));
            }
            lancamentos = filtrados;
        }

        // Processar parcelamentos e criar lançamentos futuros
        List<Lancamento> todosLancamentos = new ArrayList<>();

        for (Lancamento lancamento : lancamentos) {
            todosLancamentos.add(lancamento);

            // Cria parcelas futuras se for parcelado
            if (lancamento.getParcelaAtual() != null && lancamento.getTotalParcelas() != null) {
                int parcelasRestantes = lancamento.getTotalParcelas() - lancamento.getParcelaAtual();
                if (parcelasRestantes > 0) {
                    todosLancamentos.addAll(criarLancamentosFuturos(lancamento, parcelasRestantes));
                }
            }
        }

        for (Lancamento lancamento : todosLancamentos) {
            lancamentoService.salvar(lancamento);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("mensagem", "Arquivo importado com sucesso!");
        response.put("total", lancamentos.size());
        response.put("totalComParcelas", todosLancamentos.size());

        return ResponseEntity.ok(response);
    }

    // ======================== OFX PARSER (robusto) ========================

    /**
     * Parser OFX robusto que:
     * - Lê com charset Cp1252 (Windows-1252) para acentos corretos
     * - Suporta tags multilinha (ex: MEMO quebrado em várias linhas)
     * - Extrai FITID para campo idTransacao
     * - Detecta parcelamentos no MEMO
     * - Filtra pagamentos de fatura quando tipo = CONTA
     * - Define MetodoPagamento conforme tipoImportacao
     */
    private List<Lancamento> processarOFX(MultipartFile arquivo, Long usuarioId, String tipoImportacao) throws Exception {
        List<Lancamento> lancamentos = new ArrayList<>();

        // Charset Cp1252 — padrão de arquivos OFX brasileiros (Nubank, Itaú, etc.)
        Charset charset;
        try {
            charset = Charset.forName("Cp1252");
        } catch (Exception e) {
            charset = Charset.forName("ISO-8859-1");
        }

        // Lê todas as linhas do arquivo de uma vez para facilitar o parsing multilinha
        List<String> linhas = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(arquivo.getInputStream(), charset))) {
            String l;
            while ((l = reader.readLine()) != null) {
                linhas.add(l);
            }
        }

        boolean dentroTransacao = false;
        Lancamento lancamentoAtual = null;

        for (int i = 0; i < linhas.size(); i++) {
            String linha = linhas.get(i).trim();

            // === Início de transação ===
            if (linha.contains("<STMTTRN>")) {
                dentroTransacao = true;
                lancamentoAtual = new Lancamento();
                lancamentoAtual.setUsuarioId(usuarioId);
                lancamentoAtual.setFixo(false);
                continue;
            }

            // === Fim de transação ===
            if (linha.contains("</STMTTRN>") && lancamentoAtual != null) {
                dentroTransacao = false;

                // Categoria padrão se não definida
                if (lancamentoAtual.getCategoria() == null) {
                    lancamentoAtual.setCategoria(CategoriaLancamento.OUTROS);
                }

                // Define MetodoPagamento conforme tipo de importação
                if ("CARTAO".equalsIgnoreCase(tipoImportacao)) {
                    lancamentoAtual.setMetodoPagamento(MetodoPagamento.CARTAO_CREDITO);
                }
                // Para CONTA, não define MetodoPagamento (fica null / pode ser PIX, TED, etc.)

                // Filtra pagamentos de fatura (apenas no extrato de conta)
                if ("CONTA".equalsIgnoreCase(tipoImportacao) && isPagamentoFatura(lancamentoAtual.getDescricao())) {
                    lancamentoAtual = null;
                    continue;
                }

                lancamentos.add(lancamentoAtual);
                lancamentoAtual = null;
                continue;
            }

            if (!dentroTransacao || lancamentoAtual == null) continue;

            // === TRNTYPE ===
            if (linha.contains("<TRNTYPE>")) {
                String tipo = extrairValorTag(linha, "TRNTYPE");
                if ("DEBIT".equalsIgnoreCase(tipo) || "PAYMENT".equalsIgnoreCase(tipo)) {
                    lancamentoAtual.setTipo(TipoLancamento.DESPESA);
                    lancamentoAtual.setCategoria(CategoriaLancamento.OUTROS);
                } else {
                    lancamentoAtual.setTipo(TipoLancamento.RECEITA);
                    lancamentoAtual.setCategoria(CategoriaLancamento.OUTRO_RECEITA);
                }
            }

            // === FITID → idTransacao ===
            if (linha.contains("<FITID>")) {
                String fitId = extrairValorTag(linha, "FITID");
                if (fitId != null && !fitId.isBlank()) {
                    lancamentoAtual.setIdTransacao(fitId);
                }
            }

            // === DTPOSTED ===
            if (linha.contains("<DTPOSTED>")) {
                String dataStr = extrairValorTag(linha, "DTPOSTED");
                if (dataStr != null && dataStr.length() >= 8) {
                    try {
                        int ano = Integer.parseInt(dataStr.substring(0, 4));
                        int mes = Integer.parseInt(dataStr.substring(4, 6));
                        int dia = Integer.parseInt(dataStr.substring(6, 8));
                        lancamentoAtual.setData(LocalDate.of(ano, mes, dia));
                    } catch (Exception ignored) {}
                }
            }

            // === TRNAMT ===
            if (linha.contains("<TRNAMT>")) {
                String valorStr = extrairValorTag(linha, "TRNAMT");
                if (valorStr != null) {
                    try {
                        BigDecimal valor = new BigDecimal(valorStr.trim()).abs();
                        lancamentoAtual.setValor(valor);
                    } catch (Exception ignored) {}
                }
            }

            // === MEMO (multilinha) ===
            if (linha.contains("<MEMO>")) {
                String descricao = extrairTagMultilinha(linhas, i, "MEMO");
                descricao = SanitizacaoUtil.sanitizar(descricao);
                lancamentoAtual.setDescricao(descricao);
                detectarParcelamento(lancamentoAtual, descricao);
            }

            // === NAME (fallback de descrição se MEMO não existir) ===
            if (linha.contains("<NAME>") && (lancamentoAtual.getDescricao() == null || lancamentoAtual.getDescricao().isBlank())) {
                String nome = extrairTagMultilinha(linhas, i, "NAME");
                nome = SanitizacaoUtil.sanitizar(nome);
                lancamentoAtual.setDescricao(nome);
                detectarParcelamento(lancamentoAtual, nome);
            }
        }

        return lancamentos;
    }

    /**
     * Extrai o valor de uma tag OFX de uma única linha.
     * Ex: "<TRNAMT>-16.73" → "-16.73"
     * Ex: "<FITID>abc123</FITID>" → "abc123"
     */
    private String extrairValorTag(String linha, String tagName) {
        String openTag = "<" + tagName + ">";
        int inicio = linha.indexOf(openTag);
        if (inicio == -1) return null;
        inicio += openTag.length();

        String closeTag = "</" + tagName + ">";
        int fim = linha.indexOf(closeTag, inicio);
        if (fim == -1) {
            // Tag sem fechamento — valor vai até o fim da linha ou próxima tag <
            int nextTag = linha.indexOf("<", inicio);
            if (nextTag == -1) return linha.substring(inicio).trim();
            return linha.substring(inicio, nextTag).trim();
        }
        return linha.substring(inicio, fim).trim();
    }

    /**
     * Extrai conteúdo de uma tag que pode estar quebrada em múltiplas linhas.
     * Concatena linhas subsequentes até encontrar a tag de fechamento ou uma nova tag de abertura.
     * Ex:
     *   <MEMO>KaBuM!
     *   - NuPay - Parcela 1/10</MEMO>
     * → "KaBuM! - NuPay - Parcela 1/10"
     */
    private String extrairTagMultilinha(List<String> linhas, int linhaInicial, String tagName) {
        String openTag = "<" + tagName + ">";
        String closeTag = "</" + tagName + ">";
        String primeiraLinha = linhas.get(linhaInicial).trim();

        int inicioConteudo = primeiraLinha.indexOf(openTag);
        if (inicioConteudo == -1) return "";
        inicioConteudo += openTag.length();

        // Verifica se a tag fecha na mesma linha
        int fimNaLinha = primeiraLinha.indexOf(closeTag, inicioConteudo);
        if (fimNaLinha != -1) {
            return primeiraLinha.substring(inicioConteudo, fimNaLinha).trim();
        }

        // Verifica se tem outra tag na mesma linha (sem tag de fechamento explícita)
        int nextTag = primeiraLinha.indexOf("<", inicioConteudo);
        if (nextTag != -1) {
            return primeiraLinha.substring(inicioConteudo, nextTag).trim();
        }

        // Conteúdo multilinha: acumula linhas até encontrar fechamento ou nova tag
        StringBuilder sb = new StringBuilder(primeiraLinha.substring(inicioConteudo).trim());

        for (int j = linhaInicial + 1; j < linhas.size(); j++) {
            String proxima = linhas.get(j).trim();

            // Se encontra o fechamento da tag, pega o conteúdo antes dele
            int fimTag = proxima.indexOf(closeTag);
            if (fimTag != -1) {
                String parcial = proxima.substring(0, fimTag).trim();
                if (!parcial.isEmpty()) {
                    sb.append(" - ").append(parcial);
                }
                break;
            }

            // Se encontra uma nova tag de abertura, para de acumular
            if (proxima.startsWith("<") && !proxima.startsWith("</")) {
                break;
            }

            // Linha de continuação: acumula
            if (!proxima.isEmpty()) {
                sb.append(" - ").append(proxima);
            }
        }

        return sb.toString().trim();
    }

    // ======================== CSV PARSER ========================

    private List<Lancamento> processarCSV(MultipartFile arquivo, Long usuarioId) throws Exception {
        List<Lancamento> lancamentos = new ArrayList<>();

        try (CSVReader reader = new CSVReaderBuilder(new InputStreamReader(arquivo.getInputStream()))
                .withSkipLines(1)
                .build()) {

            String[] campos;
            while ((campos = reader.readNext()) != null) {
                if (campos.length >= 3) {
                    Lancamento lancamento = new Lancamento();
                    lancamento.setUsuarioId(usuarioId);
                    lancamento.setFixo(false);

                    // Data
                    try {
                        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");
                        lancamento.setData(LocalDate.parse(campos[0].trim(), formatter));
                    } catch (Exception e) {
                        try {
                            java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd");
                            lancamento.setData(LocalDate.parse(campos[0].trim(), formatter));
                        } catch (Exception e2) {
                            lancamento.setData(LocalDate.now());
                        }
                    }

                    // Descrição
                    String descricao = SanitizacaoUtil.sanitizar(campos[1].trim());
                    lancamento.setDescricao(descricao);
                    detectarParcelamento(lancamento, descricao);

                    // Valor
                    BigDecimal valor = parseValor(campos[2].trim());
                    lancamento.setValor(valor);

                    // Tipo
                    if (campos.length >= 4) {
                        String tipo = campos[3].trim().toUpperCase();
                        if (tipo.contains("ENTRADA") || tipo.contains("RECEITA") || tipo.contains("CREDITO")) {
                            lancamento.setTipo(TipoLancamento.RECEITA);
                            lancamento.setCategoria(CategoriaLancamento.OUTRO_RECEITA);
                        } else {
                            lancamento.setTipo(TipoLancamento.DESPESA);
                            lancamento.setCategoria(CategoriaLancamento.OUTROS);
                        }
                    } else {
                        lancamento.setTipo(TipoLancamento.DESPESA);
                        lancamento.setCategoria(CategoriaLancamento.OUTROS);
                    }

                    lancamentos.add(lancamento);
                }
            }
        }
        return lancamentos;
    }

    // ======================== UTILITÁRIOS ========================

    private BigDecimal parseValor(String valorStr) {
        valorStr = valorStr.replace("R$", "").replace("$", "").trim();
        if (valorStr.isEmpty()) return BigDecimal.ZERO;

        boolean formatoBR = valorStr.contains(",") &&
                (!valorStr.contains(".") || valorStr.lastIndexOf(".") < valorStr.lastIndexOf(","));

        if (formatoBR) {
            valorStr = valorStr.replace(".", "").replace(",", ".");
        } else {
            valorStr = valorStr.replace(",", "");
        }
        return new BigDecimal(valorStr).abs();
    }

    /**
     * Detecta padrão de parcelamento (ex: "Compra Netflix - 11/12", "Parcela 1/10")
     */
    private void detectarParcelamento(Lancamento lancamento, String descricao) {
        Pattern pattern = Pattern.compile("(?:(?:Parc(?:ela)?\\s*)|(?:-\\s*)|(?:\\s))(\\d{1,2})/(\\d{1,2})\\s*$", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(descricao);

        if (matcher.find()) {
            try {
                int parcelaAtual = Integer.parseInt(matcher.group(1));
                int totalParcelas = Integer.parseInt(matcher.group(2));
                if (parcelaAtual > 0 && parcelaAtual <= totalParcelas && totalParcelas <= 99) {
                    lancamento.setParcelaAtual(parcelaAtual);
                    lancamento.setTotalParcelas(totalParcelas);
                }
            } catch (NumberFormatException ignored) {}
        }
    }

    /**
     * Detecta transações de pagamento de fatura de cartão (para filtrar no extrato de conta).
     */
    private boolean isPagamentoFatura(String descricao) {
        if (descricao == null) return false;
        String desc = descricao.toUpperCase().trim();
        String[] padroes = {
            "PAGTO FATURA", "PGTO FATURA", "PAGAMENTO FATURA",
            "PAGAMENTO DE FATURA", "PAG FATURA", "PGTO DE FATURA",
            "PAGTO CARTAO", "PGTO CARTAO", "PAGAMENTO CARTAO",
            "PAGTO FAT CARTAO", "PGTO FAT", "PAG FAT",
            "PAGTO DE CARTAO", "PAGAMENTO DE CARTAO",
            "DEBITO AUTOMATICO FATURA", "FATURA CARTAO",
            "CREDITO FATURA", "PAGTO FAT CART",
            "PAGT FATURA", "PAGAR FATURA"
        };
        for (String padrao : padroes) {
            if (desc.contains(padrao)) return true;
        }
        return false;
    }

    /**
     * Cria lançamentos futuros para parcelas restantes.
     * Atualiza o número da parcela na descrição (ex: "Parcela 1/10" → "Parcela 2/10").
     * Parcelas futuras NÃO herdam o idTransacao do original.
     */
    private List<Lancamento> criarLancamentosFuturos(Lancamento original, int parcelasRestantes) {
        List<Lancamento> futuros = new ArrayList<>();

        for (int i = 1; i <= parcelasRestantes; i++) {
            int proximaParcela = original.getParcelaAtual() + i;

            // Atualiza a descrição com o número correto da parcela
            String descricaoAtualizada = original.getDescricao().replaceAll(
                "(\\d{1,2})/(\\d{1,2})\\s*$",
                proximaParcela + "/" + original.getTotalParcelas()
            );

            boolean jaExiste = lancamentoRepository.existeParcela(
                original.getUsuarioId(),
                descricaoAtualizada,
                proximaParcela,
                original.getTotalParcelas()
            );

            if (!jaExiste) {
                Lancamento futuro = new Lancamento();
                futuro.setUsuarioId(original.getUsuarioId());
                futuro.setDescricao(descricaoAtualizada);
                futuro.setValor(original.getValor());
                futuro.setTipo(original.getTipo());
                futuro.setCategoria(original.getCategoria());
                futuro.setFixo(false);
                futuro.setData(original.getData().plusMonths(i));
                futuro.setParcelaAtual(proximaParcela);
                futuro.setTotalParcelas(original.getTotalParcelas());
                futuro.setMetodoPagamento(original.getMetodoPagamento());
                // idTransacao NÃO é copiado - parcelas futuras não têm idTransacao
                futuros.add(futuro);
            }
        }
        return futuros;
    }
}
