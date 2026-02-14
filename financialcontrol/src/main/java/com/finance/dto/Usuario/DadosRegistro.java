package com.finance.dto.Usuario;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DadosRegistro(
    @NotBlank(message = "O nome de usuario é obrigatório")
    @Size(min = 3, max = 50, message = "O nome de usuario deve ter entre 3 e 50 caracteres")
    String username,
    @NotBlank(message = "A senha é obrigatória")
    @Size(min = 6, max = 100, message = "A senha deve ter entre 6 e 100 caracteres")
    String senha,
    @Email(message = "E-mail inválido")
    String email
) {}
