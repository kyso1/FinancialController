package com.finance.controller;

import com.finance.model.Lancamento;
import com.finance.model.TipoLancamento;
import com.finance.model.CategoriaLancamento;
import com.finance.service.LancamentoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/importacao")
@CrossOrigin(origins = "*")
public class ImportacaoController {

    @Autowired
    private LancamentoService lancamentoService;

    @Autowired
    private com.finance.repository.LancamentoRepository lancamentoRepository;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadArquivo(@RequestParam("arquivo") MultipartFile arquivo,
                                            @RequestParam("usuarioId") Long usuarioId) {
        try {
            String nomeArquivo = arquivo.getOriginalFilename();
            List<Lancamento> lancamentos = new ArrayList<>();

            if (nomeArquivo != null && nomeArquivo.toLowerCase().endsWith(".ofx")) {
                lancamentos = processarOFX(arquivo, usuarioId);
            } else if (nomeArquivo != null && nomeArquivo.toLowerCase().endsWith(".csv")) {
                lancamentos = processarCSV(arquivo, usuarioId);
            } else {
                Map<String, String> erro = new HashMap<>();
                erro.put("erro", "Formato de arquivo não suportado. Use OFX ou CSV.");
                return ResponseEntity.badRequest().body(erro);
            }

            // Processar parcelamentos e criar lançamentos futuros
            List<Lancamento> todosLancamentos = new ArrayList<>();
            for (Lancamento lancamento : lancamentos) {
                // Verifica se já existe antes de adicionar
                if (!verificarDuplicata(lancamento)) {
                    todosLancamentos.add(lancamento);

                    // Se tem parcelas futuras, criar os lançamentos
                    if (lancamento.getParcelaAtual() != null && lancamento.getTotalParcelas() != null) {
                        int parcelasRestantes = lancamento.getTotalParcelas() - lancamento.getParcelaAtual();
                        if (parcelasRestantes > 0) {
                            List<Lancamento> futuros = criarLancamentosFuturos(lancamento, parcelasRestantes);
                            todosLancamentos.addAll(futuros);
                        }
                    }
                }
            }

            // Salvar todos os lançamentos (incluindo futuros)
            for (Lancamento lancamento : todosLancamentos) {
                lancamentoService.salvar(lancamento);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("mensagem", "Arquivo importado com sucesso!");
            response.put("total", lancamentos.size());
            response.put("totalComParcelas", todosLancamentos.size());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            Map<String, String> erro = new HashMap<>();
            erro.put("erro", "Erro ao processar arquivo: " + e.getMessage());
            return ResponseEntity.badRequest().body(erro);
        }
    }

    private List<Lancamento> processarOFX(MultipartFile arquivo, Long usuarioId) throws Exception {
        List<Lancamento> lancamentos = new ArrayList<>();
        BufferedReader reader = new BufferedReader(new InputStreamReader(arquivo.getInputStream()));

        String linha;
        Lancamento lancamentoAtual = null;

        while ((linha = reader.readLine()) != null) {
            linha = linha.trim();

            if (linha.contains("<STMTTRN>")) {
                lancamentoAtual = new Lancamento();
                lancamentoAtual.setUsuarioId(usuarioId);
                lancamentoAtual.setFixo(false);
            } else if (linha.contains("</STMTTRN>") && lancamentoAtual != null) {
                if (lancamentoAtual.getCategoria() == null) {
                    lancamentoAtual.setCategoria(CategoriaLancamento.OUTROS);
                }
                lancamentos.add(lancamentoAtual);
                lancamentoAtual = null;
            }

            if (lancamentoAtual != null) {
                // Extrai tipo (DEBIT ou CREDIT)
                if (linha.contains("<TRNTYPE>")) {
                    String tipo = extrairValor(linha, "<TRNTYPE>", "<");
                    if ("DEBIT".equals(tipo) || "PAYMENT".equals(tipo)) {
                        lancamentoAtual.setTipo(TipoLancamento.DESPESA);
                        lancamentoAtual.setCategoria(CategoriaLancamento.OUTROS);
                    } else {
                        lancamentoAtual.setTipo(TipoLancamento.RECEITA);
                        lancamentoAtual.setCategoria(CategoriaLancamento.OUTRO_RECEITA);
                    }
                }

                // Extrai data
                if (linha.contains("<DTPOSTED>")) {
                    String dataStr = extrairValor(linha, "<DTPOSTED>", "<");
                    if (dataStr.length() >= 8) {
                        String ano = dataStr.substring(0, 4);
                        String mes = dataStr.substring(4, 6);
                        String dia = dataStr.substring(6, 8);
                        lancamentoAtual.setData(LocalDate.of(Integer.parseInt(ano), Integer.parseInt(mes), Integer.parseInt(dia)));
                    }
                }

                // Extrai valor
                if (linha.contains("<TRNAMT>")) {
                    String valorStr = extrairValor(linha, "<TRNAMT>", "<");
                    BigDecimal valor = new BigDecimal(valorStr).abs();
                    lancamentoAtual.setValor(valor);
                }

                // Extrai descrição
                if (linha.contains("<MEMO>")) {
                    String descricao = extrairValor(linha, "<MEMO>", "<");
                    lancamentoAtual.setDescricao(descricao);

                    // Detecta parcelamento na descrição
                    detectarParcelamento(lancamentoAtual, descricao);
                }
            }
        }

        reader.close();
        return lancamentos;
    }

    private List<Lancamento> processarCSV(MultipartFile arquivo, Long usuarioId) throws Exception {
        List<Lancamento> lancamentos = new ArrayList<>();
        BufferedReader reader = new BufferedReader(new InputStreamReader(arquivo.getInputStream()));

        String linha;
        boolean primeiraLinha = true;

        while ((linha = reader.readLine()) != null) {
            // Pula o cabeçalho
            if (primeiraLinha) {
                primeiraLinha = false;
                continue;
            }

            String[] campos = linha.split(",");

            if (campos.length >= 3) {
                Lancamento lancamento = new Lancamento();
                lancamento.setUsuarioId(usuarioId);
                lancamento.setFixo(false);

                // Formato esperado: Data,Descrição,Valor[,Tipo]
                // Data
                try {
                    DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy");
                    lancamento.setData(LocalDate.parse(campos[0].trim(), formatter));
                } catch (Exception e) {
                    // Tenta outro formato
                    try {
                        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
                        lancamento.setData(LocalDate.parse(campos[0].trim(), formatter));
                    } catch (Exception e2) {
                        lancamento.setData(LocalDate.now());
                    }
                }

                // Descrição
                String descricao = campos[1].trim();
                lancamento.setDescricao(descricao);

                // Detecta parcelamento na descrição
                detectarParcelamento(lancamento, descricao);

                // Valor - usa método inteligente que detecta formato
                BigDecimal valor = parseValor(campos[2].trim());
                lancamento.setValor(valor);

                // Tipo (se fornecido)
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
                    // Assume despesa se não especificado
                    lancamento.setTipo(TipoLancamento.DESPESA);
                    lancamento.setCategoria(CategoriaLancamento.OUTROS);
                }

                lancamentos.add(lancamento);
            }
        }

        reader.close();
        return lancamentos;
    }

    private String extrairValor(String linha, String inicio, String fim) {
        int indexInicio = linha.indexOf(inicio) + inicio.length();
        int indexFim = linha.indexOf(fim, indexInicio);
        if (indexFim == -1) {
            return linha.substring(indexInicio).trim();
        }
        return linha.substring(indexInicio, indexFim).trim();
    }

    /**
     * Parse inteligente de valores monetários que detecta o formato automaticamente
     * Suporta:
     * - Formato BR: 1.234,56 (ponto como separador de milhar, vírgula como decimal)
     * - Formato US: 1,234.56 ou 23.36 (vírgula como separador de milhar, ponto como decimal)
     */
    private BigDecimal parseValor(String valorStr) {
        // Remove símbolos de moeda e espaços
        valorStr = valorStr.replace("R$", "").replace("$", "").trim();

        // Se está vazio, retorna zero
        if (valorStr.isEmpty()) {
            return BigDecimal.ZERO;
        }

        // Detecta se usa vírgula como decimal (formato BR) ou ponto como decimal (formato US)
        // Formato BR: tem vírgula E (não tem ponto OU o ponto vem antes da vírgula)
        // Exemplos BR: "1.234,56" ou "1234,56" ou ",56"
        boolean formatoBR = valorStr.contains(",") &&
                           (!valorStr.contains(".") || valorStr.lastIndexOf(".") < valorStr.lastIndexOf(","));

        if (formatoBR) {
            // Formato brasileiro: remove pontos (separador de milhar) e troca vírgula por ponto
            valorStr = valorStr.replace(".", "").replace(",", ".");
        } else {
            // Formato americano: remove vírgulas (separador de milhar)
            valorStr = valorStr.replace(",", "");
        }

        return new BigDecimal(valorStr).abs();
    }

    /**
     * Detecta padrão de parcelamento no título (ex: "Compra Netflix - 11/12")
     * Padrões suportados: "11/12", "1/2", etc.
     */
    private void detectarParcelamento(Lancamento lancamento, String descricao) {
        // Padrão: busca por "número/número" isolado ou precedido por hífen, espaço, etc.
        Pattern pattern = Pattern.compile("(\\d{1,2})/(\\d{1,2})(?:\\s|$)");
        Matcher matcher = pattern.matcher(descricao);

        if (matcher.find()) {
            try {
                int parcelaAtual = Integer.parseInt(matcher.group(1));
                int totalParcelas = Integer.parseInt(matcher.group(2));

                // Validação básica: parcela atual não pode ser maior que total
                if (parcelaAtual > 0 && parcelaAtual <= totalParcelas && totalParcelas <= 99) {
                    lancamento.setParcelaAtual(parcelaAtual);
                    lancamento.setTotalParcelas(totalParcelas);
                }
            } catch (NumberFormatException e) {
                // Ignora se não conseguir parsear
            }
        }
    }

    /**
     * Verifica se um lançamento é duplicata baseado em:
     * - Se tem parcelamento: verifica pela descrição + parcela específica
     * - Se não tem parcelamento: verifica pela descrição + data próxima
     */
    private boolean verificarDuplicata(Lancamento lancamento) {
        if (lancamento.getParcelaAtual() != null && lancamento.getTotalParcelas() != null) {
            // Verifica se já existe essa parcela específica
            return lancamentoRepository.existeParcela(
                lancamento.getUsuarioId(),
                lancamento.getDescricao(),
                lancamento.getParcelaAtual(),
                lancamento.getTotalParcelas()
            );
        } else {
            // Para lançamentos sem parcelamento, verifica se existe no mesmo mês
            LocalDate inicioMes = lancamento.getData().withDayOfMonth(1);
            LocalDate fimMes = lancamento.getData().withDayOfMonth(lancamento.getData().lengthOfMonth());
            return lancamentoRepository.existeNoPeriodo(
                lancamento.getUsuarioId(),
                lancamento.getDescricao(),
                inicioMes,
                fimMes
            );
        }
    }

    /**
     * Cria lançamentos futuros para as parcelas restantes
     * Apenas cria parcelas que ainda não existem no banco
     */
    private List<Lancamento> criarLancamentosFuturos(Lancamento original, int parcelasRestantes) {
        List<Lancamento> futuros = new ArrayList<>();

        for (int i = 1; i <= parcelasRestantes; i++) {
            int proximaParcela = original.getParcelaAtual() + i;

            // Verifica se essa parcela já existe antes de criar
            boolean jaExiste = lancamentoRepository.existeParcela(
                original.getUsuarioId(),
                original.getDescricao(),
                proximaParcela,
                original.getTotalParcelas()
            );

            if (!jaExiste) {
                Lancamento futuro = new Lancamento();
                futuro.setUsuarioId(original.getUsuarioId());
                futuro.setDescricao(original.getDescricao());
                futuro.setValor(original.getValor());
                futuro.setTipo(original.getTipo());
                futuro.setCategoria(original.getCategoria());
                futuro.setFixo(false);

                // Data: adiciona i meses à data original
                futuro.setData(original.getData().plusMonths(i));

                // Atualiza número da parcela
                futuro.setParcelaAtual(proximaParcela);
                futuro.setTotalParcelas(original.getTotalParcelas());

                futuros.add(futuro);
            }
        }

        return futuros;
    }
}
