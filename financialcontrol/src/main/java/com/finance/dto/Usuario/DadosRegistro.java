package com.finance.dto.Usuario;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record DadosRegistro(
    @NotBlank(message = "O nome de usuario é obrigatório")
    @Size(min = 3, max = 50, message = "O nome de usuario deve ter entre 3 e 50 caracteres")
    String username,
    @NotBlank(message = "A senha é obrigatória")
    @Size(min = 8, max = 100, message = "A senha deve ter no mínimo 8 caracteres")
    @Pattern(regexp = "^(?=.*[0-9])(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':.,?/~`])(?=.*[A-Z]).{8,}$",
             message = "A senha deve conter pelo menos um número, um caractere especial e uma letra maiúscula")
    String senha,
    @NotBlank(message = "O e-mail é obrigatório")
    @Email(message = "E-mail inválido")
    String email
) {}
