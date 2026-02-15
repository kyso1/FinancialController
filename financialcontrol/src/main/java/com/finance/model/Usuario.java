package com.finance.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Data
@Getter()
@NoArgsConstructor()
@AllArgsConstructor()
@EqualsAndHashCode(of = "id")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    @NotBlank(message = "O nome de usuário é obrigatório")
    private String username;

    @Column(nullable = false)
    @NotBlank(message = "A senha é obrigatória")
    private String senha;

    private String nome;

    private String email;

    private String googleId;

    private String resetToken;

    private LocalDateTime resetTokenExpiry;

    @Column(length = 1000)
    private String fotoPerfil;

    @Column(length = 10)
    private String tema;

    private LocalDateTime dataCriacao;

    @PrePersist
    protected void onCreate() {
        dataCriacao = LocalDateTime.now();
    }
}
