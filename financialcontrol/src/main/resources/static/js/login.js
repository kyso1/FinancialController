$(document).ready(function() {
    // Inicializa o tema
    initTheme();

    // Toggle de tema
    $('#themeToggle').click(function() {
        toggleTheme();
    });

    // Verifica se já está logado
    const userId = localStorage.getItem('userId');
    if (userId) {
        verificarLogin(userId);
    }

    // Form de login
    $('#form-login').submit(function(e) {
        e.preventDefault();
        fazerLogin();
    });

    // Form de cadastro
    $('#form-cadastro').submit(function(e) {
        e.preventDefault();
        fazerCadastro();
    });
});

// ===== FUNÇÕES DE TEMA =====
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = $('#themeIcon');
    if (theme === 'dark') {
        icon.removeClass('bi-moon-fill').addClass('bi-sun-fill');
    } else {
        icon.removeClass('bi-sun-fill').addClass('bi-moon-fill');
    }
}

// ===== FUNÇÕES DE AUTENTICAÇÃO =====
function fazerLogin() {
    const username = $('#login-username').val();
    const senha = $('#login-senha').val();

    $.ajax({
        url: '/api/auth/login',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ username, senha }),
        success: function(response) {
            localStorage.setItem('userId', response.id);
            localStorage.setItem('username', response.username);
            window.location.href = 'dashboard.html';
        },
        error: function(xhr) {
            mostrarAlerta('Erro no Login', 'Erro ao fazer login. Verifique suas credenciais.');
        }
    });
}

function fazerCadastro() {
    const username = $('#cadastro-username').val();
    const senha = $('#cadastro-senha').val();
    const senhaConfirma = $('#cadastro-senha-confirma').val();

    if (senha !== senhaConfirma) {
        mostrarAlerta('Senhas Não Coincidem', 'As senhas não coincidem!');
        return;
    }

    $.ajax({
        url: '/api/auth/cadastro',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ username, senha }),
        success: function(response) {
            localStorage.setItem('userId', response.id);
            localStorage.setItem('username', response.username);
            window.location.href = 'dashboard.html';
        },
        error: function(xhr) {
            const erro = xhr.responseJSON?.erro || 'Erro ao criar conta.';
            mostrarAlerta('Erro no Cadastro', erro);
        }
    });
}

function verificarLogin(userId) {
    $.ajax({
        url: '/api/auth/verificar',
        method: 'GET',
        data: { userId },
        success: function(response) {
            // Já está logado, redireciona
            window.location.href = 'dashboard.html';
        },
        error: function() {
            // Token inválido, limpa storage
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
        }
    });
}
// ===== FUNÇÕES DE MODAIS PERSONALIZADOS =====
function mostrarAlerta(titulo, mensagem) {
    $('#tituloAlerta').text(titulo);
    $('#mensagemAlerta').text(mensagem);
    
    const modal = new bootstrap.Modal(document.getElementById('modalAlerta'));
    modal.show();
}