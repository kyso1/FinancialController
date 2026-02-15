$(document).ready(function() {
    // Cria partículas do fundo
    criarParticulas();

    // Verifica se já está logado
    const token = localStorage.getItem('token');
    if (token) verificarLogin(token);

    // Verifica se tem token de reset na URL (sanitizar para evitar XSS)
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('token');
    if (resetToken && /^[a-zA-Z0-9\-_.]+$/.test(resetToken)) {
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

    // Validação de senha em tempo real
    $('#cadastro-senha').on('input', validarRequisitos);
    $('#cadastro-senha-confirma').on('input', validarRequisitos);
    $('#cadastro-termos').on('change', validarRequisitos);
    $('#cadastro-username').on('input', validarRequisitos);
    $('#cadastro-email').on('input', validarRequisitos);

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

// ===== VALIDAÇÃO DE SENHA =====
function validarRequisitos() {
    const senha = $('#cadastro-senha').val();
    const senhaConfirma = $('#cadastro-senha-confirma').val();
    const termos = $('#cadastro-termos').is(':checked');
    const username = $('#cadastro-username').val();
    const email = $('#cadastro-email').val();

    const temTamanho = senha.length >= 8;
    const temNumero = /\d/.test(senha);
    const temEspecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(senha);
    const temMaiuscula = /[A-Z]/.test(senha);

    atualizarRequisito('req-tamanho', temTamanho);
    atualizarRequisito('req-numero', temNumero);
    atualizarRequisito('req-especial', temEspecial);
    atualizarRequisito('req-maiuscula', temMaiuscula);

    // Barra de força
    let forca = 0;
    if (temTamanho) forca++;
    if (temNumero) forca++;
    if (temEspecial) forca++;
    if (temMaiuscula) forca++;
    if (senha.length >= 12) forca++;

    const barra = $('#senha-forca-barra');
    const texto = $('#senha-forca-texto');
    const pct = Math.min(forca * 20, 100);
    barra.css('width', pct + '%');

    if (forca <= 1) { barra.css('background', '#ef4444'); texto.text('Muito fraca').css('color', '#ef4444'); }
    else if (forca === 2) { barra.css('background', '#f97316'); texto.text('Fraca').css('color', '#f97316'); }
    else if (forca === 3) { barra.css('background', '#eab308'); texto.text('Razoável').css('color', '#eab308'); }
    else if (forca === 4) { barra.css('background', '#22c55e'); texto.text('Forte').css('color', '#22c55e'); }
    else { barra.css('background', '#10b981'); texto.text('Muito forte').css('color', '#10b981'); }

    if (!senha) { texto.text(''); barra.css('width', '0%'); }

    // Confirmação de senha
    const matchDiv = $('#senha-match');
    if (senhaConfirma) {
        matchDiv.removeClass('hidden');
        if (senha === senhaConfirma) {
            matchDiv.find('span').text('✓ As senhas coincidem').css('color', '#22c55e');
        } else {
            matchDiv.find('span').text('✗ As senhas não coincidem').css('color', '#ef4444');
        }
    } else {
        matchDiv.addClass('hidden');
    }

    // Habilitar/desabilitar botão
    const senhaValida = temTamanho && temNumero && temEspecial && temMaiuscula;
    const senhasIguais = senha === senhaConfirma && senhaConfirma.length > 0;
    const usernameOk = username.length >= 3;
    const emailOk = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const podeRegistrar = senhaValida && senhasIguais && termos && usernameOk && emailOk;
    $('#btnCadastro').prop('disabled', !podeRegistrar);
}

function atualizarRequisito(id, ok) {
    const el = $(`#${id}`);
    const icon = el.find('i');
    const span = el.find('span');
    if (ok) {
        icon.attr('class', 'bi bi-check-circle-fill text-emerald-400 text-xs');
        span.css('color', 'rgba(52,211,153,0.9)');
    } else {
        icon.attr('class', 'bi bi-x-circle-fill text-white/20 text-xs');
        span.css('color', 'rgba(255,255,255,0.3)');
    }
}

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
            localStorage.setItem('refreshToken', response.refreshToken);
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

    if (senha.length < 8) {
        mostrarToast('Senha fraca', 'A senha deve ter pelo menos 8 caracteres.', 'error');
        return;
    }

    if (!/\d/.test(senha)) {
        mostrarToast('Senha fraca', 'A senha deve conter pelo menos um número.', 'error');
        return;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(senha)) {
        mostrarToast('Senha fraca', 'A senha deve conter pelo menos um caractere especial.', 'error');
        return;
    }

    if (!/[A-Z]/.test(senha)) {
        mostrarToast('Senha fraca', 'A senha deve conter pelo menos uma letra maiúscula.', 'error');
        return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        mostrarToast('E-mail obrigatório', 'Informe um e-mail válido.', 'error');
        return;
    }

    if (!$('#cadastro-termos').is(':checked')) {
        mostrarToast('Termos obrigatórios', 'Você deve aceitar os Termos de Serviço e a Política de Privacidade.', 'error');
        return;
    }

    const btn = $('#btnCadastro');
    btn.prop('disabled', true).html('<i class="bi bi-arrow-repeat animate-spin"></i> Criando...');

    const dados = { username, senha, email };

    $.ajax({
        url: '/api/auth/cadastro',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(dados),
        success: function(response) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('refreshToken', response.refreshToken);
            localStorage.setItem('userId', response.id);
            localStorage.setItem('username', response.username);
            window.location.href = 'dashboard.html';
        },
        error: function(xhr) {
            btn.prop('disabled', false).html('<i class="bi bi-person-check"></i> Criar Minha Conta');
            validarRequisitos(); // Re-check button state
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

            // Aguarda a biblioteca do Google carregar
            aguardarGoogleCarregar(config.clientId);
        } else {
            $('#googleDisabledMsg').removeClass('hidden');
        }
    }).fail(function() {
        $('#googleDisabledMsg').removeClass('hidden');
    });
}

// Aguarda o carregamento da biblioteca Google Identity Services
function aguardarGoogleCarregar(clientId, tentativas = 0, maxTentativas = 50) {
    // Verifica se a biblioteca está carregada
    if (typeof google !== 'undefined' && google.accounts) {
        // Biblioteca carregada, inicializa
        google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleResponse
        });

        google.accounts.id.renderButton(
            document.getElementById('btnGoogleLogin'),
            { theme: 'outline', size: 'large', width: '100%', text: 'continue_with', shape: 'pill' }
        );
    } else if (tentativas < maxTentativas) {
        // Ainda não carregou, tenta novamente em 100ms
        setTimeout(function() {
            aguardarGoogleCarregar(clientId, tentativas + 1, maxTentativas);
        }, 100);
    } else {
        // Timeout: biblioteca não carregou após 5 segundos
        console.warn('Biblioteca do Google não carregou após ' + (maxTentativas * 100) + 'ms');
        // Configura botão customizado com mensagem de erro
        $('#btnGoogleLogin').click(function() {
            mostrarToast('Erro', 'Não foi possível carregar a autenticação Google. Verifique sua conexão.', 'error');
        });
    }
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
            localStorage.setItem('refreshToken', data.refreshToken);
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
