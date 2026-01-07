package com.finance.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

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

    @Column(length = 1000)
    private String fotoPerfil;

    private LocalDateTime dataCriacao;

    @PrePersist
    protected void onCreate() {
        dataCriacao = LocalDateTime.now();
    }
}
