package com.finance.controller;

import com.finance.model.Lancamento;
import com.finance.security.AuthHelper;
import com.finance.service.LancamentoService;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/exportacao")
public class ExportacaoController {

    @Autowired
    private LancamentoService lancamentoService;

    @GetMapping("/excel")
    public ResponseEntity<byte[]> exportarExcel(
            @RequestParam(required = false) String dataInicio,
            @RequestParam(required = false) String dataFim) throws Exception {

        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        List<Lancamento> lancamentos = lancamentoService.listarPorUsuario(usuarioId);

        // Filtra por datas se fornecidas
        if (dataInicio != null) {
            LocalDate inicio = LocalDate.parse(dataInicio);
            lancamentos = lancamentos.stream()
                    .filter(l -> !l.getData().isBefore(inicio))
                    .toList();
        }
        if (dataFim != null) {
            LocalDate fim = LocalDate.parse(dataFim);
            lancamentos = lancamentos.stream()
                    .filter(l -> !l.getData().isAfter(fim))
                    .toList();
        }

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Lançamentos");

            // Estilo do cabeçalho
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.LIGHT_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // Cabeçalho
            Row header = sheet.createRow(0);
            String[] colunas = {"Data", "Descrição", "Valor", "Tipo", "Categoria", "Fixo", "Parcela"};
            for (int i = 0; i < colunas.length; i++) {
                Cell cell = header.createCell(i);
                cell.setCellValue(colunas[i]);
                cell.setCellStyle(headerStyle);
            }

            // Dados
            CellStyle dateStyle = workbook.createCellStyle();
            dateStyle.setDataFormat(workbook.createDataFormat().getFormat("dd/MM/yyyy"));

            CellStyle moneyStyle = workbook.createCellStyle();
            moneyStyle.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));

            int rowNum = 1;
            for (Lancamento l : lancamentos) {
                Row row = sheet.createRow(rowNum++);

                Cell cellData = row.createCell(0);
                cellData.setCellValue(l.getData().toString());

                row.createCell(1).setCellValue(l.getDescricao());

                Cell cellValor = row.createCell(2);
                cellValor.setCellValue(l.getValor().doubleValue());
                cellValor.setCellStyle(moneyStyle);

                row.createCell(3).setCellValue(l.getTipo().toString());
                row.createCell(4).setCellValue(l.getCategoria() != null ? l.getCategoria().toString() : "");
                row.createCell(5).setCellValue(l.isFixo() ? "Sim" : "Não");

                String parcela = "";
                if (l.getParcelaAtual() != null && l.getTotalParcelas() != null) {
                    parcela = l.getParcelaAtual() + "/" + l.getTotalParcelas();
                }
                row.createCell(6).setCellValue(parcela);
            }

            // Auto-ajusta colunas
            for (int i = 0; i < colunas.length; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            workbook.write(baos);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment", "lancamentos.xlsx");

            return ResponseEntity.ok().headers(headers).body(baos.toByteArray());
        }
    }

    @GetMapping("/csv")
    public ResponseEntity<byte[]> exportarCSV(
            @RequestParam(required = false) String dataInicio,
            @RequestParam(required = false) String dataFim) {

        Long usuarioId = AuthHelper.getUsuarioIdAutenticado();
        List<Lancamento> lancamentos = lancamentoService.listarPorUsuario(usuarioId);

        if (dataInicio != null) {
            LocalDate inicio = LocalDate.parse(dataInicio);
            lancamentos = lancamentos.stream()
                    .filter(l -> !l.getData().isBefore(inicio))
                    .toList();
        }
        if (dataFim != null) {
            LocalDate fim = LocalDate.parse(dataFim);
            lancamentos = lancamentos.stream()
                    .filter(l -> !l.getData().isAfter(fim))
                    .toList();
        }

        StringBuilder csv = new StringBuilder();
        csv.append("Data,Descrição,Valor,Tipo,Categoria,Fixo,Parcela\n");

        for (Lancamento l : lancamentos) {
            String parcela = "";
            if (l.getParcelaAtual() != null && l.getTotalParcelas() != null) {
                parcela = l.getParcelaAtual() + "/" + l.getTotalParcelas();
            }
            csv.append(String.format("%s,\"%s\",%.2f,%s,%s,%s,%s\n",
                    l.getData(),
                    l.getDescricao().replace("\"", "\"\""),
                    l.getValor(),
                    l.getTipo(),
                    l.getCategoria() != null ? l.getCategoria() : "",
                    l.isFixo() ? "Sim" : "Não",
                    parcela));
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", "lancamentos.csv");

        return ResponseEntity.ok().headers(headers).body(csv.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
