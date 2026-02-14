$(document).ready(function() {
    // Cria partículas do fundo
    criarParticulas();

    // Verifica se já está logado
    const token = localStorage.getItem('token');
    if (token) verificarLogin(token);

    // Verifica se tem token de reset na URL
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('token');
    if (resetToken) {
        $('#reset-token').val(resetToken);
        mostrarTab('reset');
    }

    // Tabs
    $('.tab-btn').click(function() {
        mostrarTab($(this).data('tab'));
    });

    // Forms
    $('#form-login').submit(function(e) { e.preventDefault(); fazerLogin(); });
    $('#form-cadastro').submit(function(e) { e.preventDefault(); fazerCadastro(); });
    $('#form-forgot').submit(function(e) { e.preventDefault(); enviarRecuperacao(); });
    $('#form-reset').submit(function(e) { e.preventDefault(); redefinirSenha(); });

    // Navegação
    $('#btnForgotPassword').click(function() { mostrarTab('forgot'); });
    $('#btnBackToLogin, #btnBackToLogin2').click(function() { mostrarTab('login'); });

    // Google Sign-In
    inicializarGoogle();
});

// ===== TABS =====
function mostrarTab(tab) {
    // Esconde todos
    $('.tab-content').addClass('hidden');

    // Reseta tabs
    $('.tab-btn').each(function() {
        $(this).removeClass('text-white border-brand-500').addClass('text-white/40 border-transparent');
    });

    // Mostra o selecionado
    $(`#tab-${tab}`).removeClass('hidden');

    // Ativa o botão correspondente
    const btn = $(`.tab-btn[data-tab="${tab}"]`);
    if (btn.length) {
        btn.removeClass('text-white/40 border-transparent').addClass('text-white border-brand-500');
    }
}

// ===== AUTENTICAÇÃO =====
function fazerLogin() {
    const username = $('#login-username').val();
    const senha = $('#login-senha').val();
    const btn = $('#btnLogin');

    btn.prop('disabled', true).html('<i class="bi bi-arrow-repeat animate-spin"></i> Entrando...');

    $.ajax({
        url: '/api/auth/login',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ username, senha }),
        success: function(response) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('userId', response.id);
            localStorage.setItem('username', response.username);
            window.location.href = 'dashboard.html';
        },
        error: function(xhr) {
            btn.prop('disabled', false).html('<i class="bi bi-arrow-right-circle"></i> Entrar');
            const erro = xhr.responseJSON?.erro || 'Erro ao fazer login. Verifique suas credenciais.';
            mostrarToast('Erro no Login', erro, 'error');
        }
    });
}

function fazerCadastro() {
    const username = $('#cadastro-username').val();
    const email = $('#cadastro-email').val();
    const senha = $('#cadastro-senha').val();
    const senhaConfirma = $('#cadastro-senha-confirma').val();

    if (senha !== senhaConfirma) {
        mostrarToast('Senhas diferentes', 'As senhas não coincidem!', 'error');
        return;
    }

    if (senha.length < 6) {
        mostrarToast('Senha fraca', 'A senha deve ter pelo menos 6 caracteres.', 'error');
        return;
    }

    const btn = $('#btnCadastro');
    btn.prop('disabled', true).html('<i class="bi bi-arrow-repeat animate-spin"></i> Criando...');

    const dados = { username, senha };
    if (email) dados.email = email;

    $.ajax({
        url: '/api/auth/cadastro',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(dados),
        success: function(response) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('userId', response.id);
            localStorage.setItem('username', response.username);
            window.location.href = 'dashboard.html';
        },
        error: function(xhr) {
            btn.prop('disabled', false).html('<i class="bi bi-person-check"></i> Criar Minha Conta');
            const erro = xhr.responseJSON?.erro || 'Erro ao criar conta.';
            mostrarToast('Erro no Cadastro', erro, 'error');
        }
    });
}

function verificarLogin(token) {
    $.ajax({
        url: '/api/auth/verificar',
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token },
        success: function() {
            window.location.href = 'dashboard.html';
        },
        error: function() {
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
        }
    });
}

// ===== RECUPERAÇÃO DE SENHA =====
function enviarRecuperacao() {
    const emailOuUsername = $('#forgot-input').val();

    if (!emailOuUsername) {
        mostrarToast('Campo obrigatório', 'Informe seu e-mail ou nome de usuário.', 'error');
        return;
    }

    $.ajax({
        url: '/api/auth/forgot-password',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ emailOuUsername }),
        success: function() {
            $('#form-forgot').addClass('hidden');
            $('#forgot-success').removeClass('hidden');
        },
        error: function() {
            // Mostra sucesso mesmo em erro para não revelar se o usuário existe
            $('#form-forgot').addClass('hidden');
            $('#forgot-success').removeClass('hidden');
        }
    });
}

function redefinirSenha() {
    const token = $('#reset-token').val();
    const novaSenha = $('#reset-senha').val();
    const confirma = $('#reset-senha-confirma').val();

    if (novaSenha !== confirma) {
        mostrarToast('Senhas diferentes', 'As senhas não coincidem!', 'error');
        return;
    }

    if (novaSenha.length < 6) {
        mostrarToast('Senha fraca', 'A senha deve ter pelo menos 6 caracteres.', 'error');
        return;
    }

    $.ajax({
        url: '/api/auth/reset-password',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ token, novaSenha }),
        success: function() {
            mostrarToast('Sucesso!', 'Senha redefinida com sucesso. Faça login.', 'success');
            setTimeout(function() {
                window.location.href = 'login.html';
            }, 2000);
        },
        error: function(xhr) {
            const erro = xhr.responseJSON?.erro || 'Token inválido ou expirado.';
            mostrarToast('Erro', erro, 'error');
        }
    });
}

// ===== GOOGLE SIGN-IN =====
function inicializarGoogle() {
    $.get('/api/auth/config/google', function(config) {
        if (config.clientId && config.clientId !== '') {
            $('#googleBtnContainer').removeClass('hidden');

            // Inicializa Google Identity Services
            if (typeof google !== 'undefined' && google.accounts) {
                google.accounts.id.initialize({
                    client_id: config.clientId,
                    callback: handleGoogleResponse
                });

                google.accounts.id.renderButton(
                    document.getElementById('btnGoogleLogin'),
                    { theme: 'outline', size: 'large', width: '100%', text: 'continue_with', shape: 'pill' }
                );
            } else {
                // GIS não carregou ainda, usa botão customizado
                $('#btnGoogleLogin').click(function() {
                    mostrarToast('Google', 'Biblioteca do Google ainda carregando. Tente novamente.', 'error');
                });
            }
        } else {
            $('#googleDisabledMsg').removeClass('hidden');
        }
    }).fail(function() {
        $('#googleDisabledMsg').removeClass('hidden');
    });
}

function handleGoogleResponse(response) {
    if (!response.credential) {
        mostrarToast('Erro', 'Falha na autenticação Google.', 'error');
        return;
    }

    $.ajax({
        url: '/api/auth/google',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ credential: response.credential }),
        success: function(data) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('userId', data.id);
            localStorage.setItem('username', data.username);
            window.location.href = 'dashboard.html';
        },
        error: function(xhr) {
            const erro = xhr.responseJSON?.erro || 'Erro ao autenticar com Google.';
            mostrarToast('Erro Google', erro, 'error');
        }
    });
}

// Exponha globalmente para callback do Google
window.handleGoogleResponse = handleGoogleResponse;

// ===== TOAST NOTIFICATIONS =====
function mostrarToast(titulo, mensagem, tipo) {
    const toast = $('#toast');
    const body = $('#toastBody');
    const icon = $('#toastIcon');
    const title = $('#toastTitle');
    const msg = $('#toastMsg');

    // Cores por tipo
    const estilos = {
        success: { bg: 'bg-emerald-600 text-white', icon: 'bi-check-circle-fill' },
        error:   { bg: 'bg-red-600 text-white', icon: 'bi-exclamation-circle-fill' },
        info:    { bg: 'bg-blue-600 text-white', icon: 'bi-info-circle-fill' }
    };

    const estilo = estilos[tipo] || estilos.info;

    body.attr('class', `rounded-xl shadow-2xl px-5 py-3 flex items-center gap-3 min-w-[280px] ${estilo.bg}`);
    icon.attr('class', `bi ${estilo.icon} text-xl`);
    title.text(titulo);
    msg.text(mensagem);

    toast.removeClass('hidden translate-x-full').addClass('translate-x-0');

    clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(fecharToast, 4000);
}

function fecharToast() {
    const toast = $('#toast');
    toast.removeClass('translate-x-0').addClass('translate-x-full');
    setTimeout(function() { toast.addClass('hidden'); }, 300);
}
window.fecharToast = fecharToast;

// ===== PARTÍCULAS DE FUNDO =====
function criarParticulas() {
    const container = document.getElementById('particles');
    if (!container) return;

    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const size = Math.random() * 4 + 2;
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDuration = (Math.random() * 15 + 10) + 's';
        p.style.animationDelay = (Math.random() * 10) + 's';
        container.appendChild(p);
    }
}
