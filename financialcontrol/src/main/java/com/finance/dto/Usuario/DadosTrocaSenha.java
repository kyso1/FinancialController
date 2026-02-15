package com.finance.dto.Usuario;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DadosTrocaSenha(
    @NotBlank(message = "A senha atual é obrigatória")
    String senhaAtual,
    @NotBlank(message = "A nova senha é obrigatória")
    @Size(min = 8, max = 100, message = "A nova senha deve ter no mínimo 8 caracteres")
    @jakarta.validation.constraints.Pattern(regexp = "^(?=.*[0-9])(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':.,?/~`])(?=.*[A-Z]).{8,}$",
             message = "A nova senha deve conter pelo menos um número, um caractere especial e uma letra maiúscula")
    String novaSenha
) {}
