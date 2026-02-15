package com.finance.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import com.finance.model.Lancamento;
import com.finance.model.Usuario;

import jakarta.mail.internet.MimeMessage;

@Service
public class RelatorioService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Autowired
    private LancamentoService lancamentoService;

    private static final DateTimeFormatter FMT_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public void enviarRelatorioPorEmail(Usuario usuario, LocalDate inicio, LocalDate fim) {
        if (mailSender == null) {
            throw new RuntimeException("Serviço de e-mail não configurado. Configure as credenciais SMTP em application.properties.");
        }

        String email = usuario.getEmail();
        if (email == null || email.isBlank()) {
            throw new RuntimeException("Usuário não possui e-mail cadastrado. Atualize seu perfil.");
        }

        List<Lancamento> lancamentos = lancamentoService.listarPorUsuario(usuario.getId());

        if (inicio != null) {
            final LocalDate startDate = inicio;
            lancamentos = lancamentos.stream().filter(l -> !l.getData().isBefore(startDate)).collect(Collectors.toList());
        }
        if (fim != null) {
            final LocalDate endDate = fim;
            lancamentos = lancamentos.stream().filter(l -> !l.getData().isAfter(endDate)).collect(Collectors.toList());
        }

        String html = gerarHtmlRelatorio(usuario, lancamentos, inicio, fim);

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(email);
            helper.setSubject("Relatório Financeiro - " +
                    (inicio != null ? inicio.format(FMT_BR) : "Início") + " a " +
                    (fim != null ? fim.format(FMT_BR) : "Hoje"));
            helper.setText(html, true);
            mailSender.send(message);
        } catch (Exception e) {
            throw new RuntimeException("Erro ao enviar e-mail: " + e.getMessage());
        }
    }

    private String gerarHtmlRelatorio(Usuario usuario, List<Lancamento> lancamentos, LocalDate inicio, LocalDate fim) {
        BigDecimal totalReceitas = BigDecimal.ZERO;
        BigDecimal totalDespesas = BigDecimal.ZERO;

        for (Lancamento l : lancamentos) {
            if ("RECEITA".equals(l.getTipo().name()) || "SALARIO".equals(l.getTipo().name())) {
                totalReceitas = totalReceitas.add(l.getValor());
            } else {
                totalDespesas = totalDespesas.add(l.getValor());
            }
        }

        BigDecimal saldo = totalReceitas.subtract(totalDespesas);

        // Group by category
        Map<String, BigDecimal> porCategoria = lancamentos.stream()
                .filter(l -> "DESPESA".equals(l.getTipo().name()))
                .collect(Collectors.groupingBy(
                        l -> l.getCategoria() != null ? l.getCategoria().name() : "OUTROS",
                        Collectors.reducing(BigDecimal.ZERO, Lancamento::getValor, BigDecimal::add)
                ));

        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body style='font-family:Inter,Arial,sans-serif;background:#f3f4f6;padding:20px;'>");
        sb.append("<div style='max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);'>");

        // Header
        sb.append("<div style='background:linear-gradient(135deg,#6366f1,#4338ca);padding:24px;text-align:center;'>");
        sb.append("<h1 style='color:#fff;margin:0;font-size:24px;'>Relatório Financeiro</h1>");
        sb.append("<p style='color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;'>").append(usuario.getNome() != null ? usuario.getNome() : usuario.getUsername()).append("</p>");
        sb.append("<p style='color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:12px;'>")
                .append(inicio != null ? inicio.format(FMT_BR) : "").append(" — ")
                .append(fim != null ? fim.format(FMT_BR) : "Hoje").append("</p>");
        sb.append("</div>");

        // Summary cards
        sb.append("<div style='padding:24px;'>");
        sb.append("<table style='width:100%;border-collapse:collapse;'><tr>");
        sb.append("<td style='text-align:center;padding:12px;background:#f0fdf4;border-radius:8px;'><p style='font-size:11px;color:#6b7280;margin:0;'>RECEITAS</p><p style='font-size:20px;font-weight:bold;color:#16a34a;margin:4px 0 0;'>R$ ").append(String.format("%,.2f", totalReceitas)).append("</p></td>");
        sb.append("<td style='width:12px'></td>");
        sb.append("<td style='text-align:center;padding:12px;background:#fef2f2;border-radius:8px;'><p style='font-size:11px;color:#6b7280;margin:0;'>DESPESAS</p><p style='font-size:20px;font-weight:bold;color:#dc2626;margin:4px 0 0;'>R$ ").append(String.format("%,.2f", totalDespesas)).append("</p></td>");
        sb.append("<td style='width:12px'></td>");
        String saldoCor = saldo.compareTo(BigDecimal.ZERO) >= 0 ? "#16a34a" : "#dc2626";
        sb.append("<td style='text-align:center;padding:12px;background:#eef2ff;border-radius:8px;'><p style='font-size:11px;color:#6b7280;margin:0;'>SALDO</p><p style='font-size:20px;font-weight:bold;color:").append(saldoCor).append(";margin:4px 0 0;'>R$ ").append(String.format("%,.2f", saldo)).append("</p></td>");
        sb.append("</tr></table>");

        // Categories breakdown
        if (!porCategoria.isEmpty()) {
            sb.append("<h3 style='margin:24px 0 12px;font-size:14px;color:#374151;'>Despesas por Categoria</h3>");
            sb.append("<table style='width:100%;border-collapse:collapse;'>");
            porCategoria.entrySet().stream()
                    .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
                    .forEach(entry -> {
                        sb.append("<tr style='border-bottom:1px solid #f3f4f6;'>");
                        sb.append("<td style='padding:8px 0;font-size:13px;color:#374151;'>").append(formatCategoria(entry.getKey())).append("</td>");
                        sb.append("<td style='padding:8px 0;font-size:13px;color:#dc2626;text-align:right;font-weight:600;'>R$ ").append(String.format("%,.2f", entry.getValue())).append("</td>");
                        sb.append("</tr>");
                    });
            sb.append("</table>");
        }

        // Recent transactions
        sb.append("<h3 style='margin:24px 0 12px;font-size:14px;color:#374151;'>Últimos Lançamentos</h3>");
        sb.append("<table style='width:100%;border-collapse:collapse;font-size:12px;'>");
        sb.append("<tr style='background:#f9fafb;'><th style='padding:8px;text-align:left;color:#6b7280;'>Data</th><th style='padding:8px;text-align:left;color:#6b7280;'>Descrição</th><th style='padding:8px;text-align:right;color:#6b7280;'>Valor</th></tr>");

        lancamentos.stream().limit(30).forEach(l -> {
            String cor = "DESPESA".equals(l.getTipo().name()) ? "#dc2626" : "#16a34a";
            String sinal = "DESPESA".equals(l.getTipo().name()) ? "- " : "+ ";
            sb.append("<tr style='border-bottom:1px solid #f3f4f6;'>");
            sb.append("<td style='padding:6px 8px;color:#6b7280;'>").append(l.getData().format(FMT_BR)).append("</td>");
            sb.append("<td style='padding:6px 8px;color:#374151;'>").append(l.getDescricao()).append("</td>");
            sb.append("<td style='padding:6px 8px;text-align:right;color:").append(cor).append(";font-weight:600;'>").append(sinal).append("R$ ").append(String.format("%,.2f", l.getValor())).append("</td>");
            sb.append("</tr>");
        });
        sb.append("</table>");

        sb.append("<p style='text-align:center;margin-top:24px;font-size:11px;color:#9ca3af;'>Total de ").append(lancamentos.size()).append(" lançamentos no período</p>");
        sb.append("</div></div></body></html>");

        return sb.toString();
    }

    private String formatCategoria(String cat) {
        return switch (cat) {
            case "LAZER" -> "Lazer";
            case "CASA" -> "Casa";
            case "ALIMENTACAO" -> "Alimentação";
            case "TRANSPORTE" -> "Transporte";
            case "SAÚDE" -> "Saúde";
            case "OUTROS" -> "Outros";
            case "FREELANCE" -> "Freelance";
            case "VENDA" -> "Venda";
            case "INVESTIMENTO" -> "Investimento";
            case "OUTRO_RECEITA" -> "Outro (Receita)";
            case "SALARIO" -> "Salário";
            default -> cat;
        };
    }
}
