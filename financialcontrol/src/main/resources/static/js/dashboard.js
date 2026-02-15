const API_URL = '/api/lancamentos';
let chartMeses, chartCategoriasDespesas, chartCategoriasReceitas, chartGastosFuturos;
let usuarioId = null;

// Parseia data ISO para Date local (sem problema de timezone UTC)
function parseDataLocal(dateStr) {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return new Date(dateStr);
}

// ===== AUTH HELPERS =====
function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
}

function authAjax(options) {
    options.headers = Object.assign({}, options.headers || {}, authHeaders());
    const originalError = options.error;
    options.error = function(xhr) {
        if ((xhr.status === 401 || xhr.status === 403) && !window._refreshingDash) {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
                window._refreshingDash = true;
                $.ajax({
                    url: '/api/auth/refresh', method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ refreshToken }),
                    success: function(data) {
                        localStorage.setItem('token', data.token);
                        localStorage.setItem('refreshToken', data.refreshToken);
                        window._refreshingDash = false;
                        options.headers['Authorization'] = 'Bearer ' + data.token;
                        options.error = originalError;
                        $.ajax(options);
                    },
                    error: function() {
                        window._refreshingDash = false;
                        localStorage.clear();
                        window.location.href = 'login.html';
                    }
                });
                return;
            }
            localStorage.clear();
            window.location.href = 'login.html';
            return;
        }
        if (originalError) originalError(xhr);
    };
    return $.ajax(options);
}

// ===== MODAIS =====
function abrirModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    setTimeout(() => {
        const c = modal.querySelector('.modal-container');
        if (c) { c.classList.remove('scale-95', 'opacity-0'); c.classList.add('scale-100', 'opacity-100'); }
    }, 10);
}
window.abrirModal = abrirModal;

function fecharModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    const c = modal.querySelector('.modal-container');
    if (c) { c.classList.remove('scale-100', 'opacity-100'); c.classList.add('scale-95', 'opacity-0'); }
    setTimeout(() => { modal.classList.add('hidden'); document.body.classList.remove('overflow-hidden'); }, 150);
}
window.fecharModal = fecharModal;

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) fecharModal(e.target.id);
});

document.addEventListener('click', function(e) {
    document.querySelectorAll('[id$="DropdownMenu"]').forEach(menu => {
        const container = menu.closest('[id$="DropdownContainer"]') || menu.parentElement;
        if (!container.contains(e.target)) menu.classList.add('hidden');
    });
});

function toggleDropdown(id) {
    const menu = document.getElementById(id);
    if (menu) menu.classList.toggle('hidden');
}
window.toggleDropdown = toggleDropdown;

// ===== INIT =====
$(document).ready(function() {
    const token = localStorage.getItem('token');
    usuarioId = localStorage.getItem('userId');
    if (!token || !usuarioId) { window.location.href = 'login.html'; return; }

    carregarPerfil();
    carregarNotificacoesPendentes();
    initTheme();

    $('#themeToggle').click(toggleTheme);
    $('#btnSalvarPerfil').click(salvarPerfilDash);
    $('#btnSalvarSenha').click(salvarSenhaDash);
    $('#btnSalvarPreferencias').click(salvarPreferenciasDash);

    $('#btnLogout').click(function(e) {
        e.preventDefault();
        mostrarConfirmacao('Sair', 'Deseja realmente sair?', function() {
            localStorage.clear();
            window.location.href = 'login.html';
        });
    });

    carregarDashboard();
});

// ===== TEMA =====
function initTheme() {
    authAjax({
        url: '/api/auth/perfil', method: 'GET',
        success: function(data) {
            const temaBanco = data.tema;
            let themeToApply;
            if (temaBanco && temaBanco !== 'auto') {
                themeToApply = temaBanco;
                localStorage.setItem('theme', temaBanco);
                localStorage.setItem('themeManual', 'true');
            } else if (temaBanco === 'auto') {
                localStorage.removeItem('themeManual');
                themeToApply = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
                localStorage.setItem('theme', themeToApply);
            } else {
                let saved = localStorage.getItem('theme');
                if (!saved) {
                    saved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
                    localStorage.setItem('theme', saved);
                }
                themeToApply = saved;
            }
            applyTheme(themeToApply);
        },
        error: function() {
            let saved = localStorage.getItem('theme') || 'light';
            applyTheme(saved);
        }
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        if (!localStorage.getItem('themeManual')) {
            const t = e.matches ? 'dark' : 'light';
            localStorage.setItem('theme', t);
            applyTheme(t);
            atualizarCoresGraficos();
        }
    });
}

function toggleTheme() {
    const current = localStorage.getItem('theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    localStorage.setItem('themeManual', 'true');
    applyTheme(next);
    atualizarCoresGraficos();
}

function applyTheme(theme) {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
    const icon = $('#themeIcon');
    if (theme === 'dark') icon.removeClass('bi-moon-fill').addClass('bi-sun-fill');
    else icon.removeClass('bi-sun-fill').addClass('bi-moon-fill');
}

// ===== DASHBOARD =====
function carregarDashboard() {
    authAjax({
        url: API_URL, method: 'GET',
        success: function(lancamentos) { processarDados(lancamentos); },
        error: function() { console.error('Erro ao carregar dados'); }
    });
}

function processarDados(lancamentos) {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const lancamentosMes = lancamentos.filter(item => {
        const d = parseDataLocal(item.data);
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });

    let saldo = 0, totalReceitas = 0, totalDespesas = 0;
    lancamentosMes.forEach(item => {
        if (item.tipo === 'RECEITA' || item.tipo === 'SALARIO') { saldo += item.valor; totalReceitas += item.valor; }
        else { saldo -= item.valor; totalDespesas += item.valor; }
    });

    $('#saldo-atual').text(formatarMoeda(saldo));
    $('#total-receitas').text(formatarMoeda(totalReceitas));
    $('#total-despesas').text(formatarMoeda(totalDespesas));

    if (saldo < 0) {
        $('#saldo-atual').removeClass('text-emerald-600 dark:text-emerald-400').addClass('text-red-600 dark:text-red-400');
    } else {
        $('#saldo-atual').removeClass('text-red-600 dark:text-red-400').addClass('text-emerald-600 dark:text-emerald-400');
    }

    prepararGraficoMeses(lancamentos);
    prepararGraficoCategorias(lancamentos);
    prepararGraficoGastosFuturos(lancamentos);
}

// ===== APEXCHARTS HELPERS =====
function getApexTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    return {
        mode: isDark ? 'dark' : 'light',
        text: isDark ? '#d1d5db' : '#374151',
        grid: isDark ? '#374151' : '#e5e7eb',
        bg: isDark ? '#111827' : '#ffffff',
        tooltipTheme: isDark ? 'dark' : 'light'
    };
}

// ===== GRÁFICO ÁREA: RECEITAS vs DESPESAS =====
function prepararGraficoMeses(lancamentos) {
    const hoje = new Date();
    const mesesData = [];
    const despesasData = [];
    const receitasData = [];

    for (let i = 5; i >= 0; i--) {
        const mes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        mesesData.push(mes.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
        let d = 0, r = 0;
        lancamentos.forEach(item => {
            const di = parseDataLocal(item.data);
            if (di.getMonth() === mes.getMonth() && di.getFullYear() === mes.getFullYear()) {
                if (item.tipo === 'DESPESA') d += item.valor;
                else r += item.valor;
            }
        });
        despesasData.push(parseFloat(d.toFixed(2)));
        receitasData.push(parseFloat(r.toFixed(2)));
    }

    criarGraficoArea(mesesData, despesasData, receitasData);
}

function criarGraficoArea(labels, despesas, receitas) {
    const el = document.getElementById('chartMeses');
    if (!el) return;
    if (chartMeses) chartMeses.destroy();
    const t = getApexTheme();

    const options = {
        series: [
            { name: 'Receitas', data: receitas },
            { name: 'Despesas', data: despesas }
        ],
        chart: {
            type: 'area', height: 350,
            background: 'transparent',
            toolbar: { show: true, tools: { download: true, selection: false, zoom: false, pan: false, reset: false } },
            fontFamily: 'Inter, system-ui, sans-serif'
        },
        colors: ['#10b981', '#ef4444'],
        fill: {
            type: 'gradient',
            gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 95, 100] }
        },
        stroke: { curve: 'smooth', width: 3 },
        dataLabels: { enabled: false },
        xaxis: {
            categories: labels,
            labels: { style: { colors: t.text, fontSize: '12px' } },
            axisBorder: { show: false }, axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: { colors: t.text, fontSize: '12px' },
                formatter: v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })
            }
        },
        grid: { borderColor: t.grid, strokeDashArray: 4 },
        tooltip: {
            theme: t.tooltipTheme,
            y: { formatter: v => formatarMoeda(v) }
        },
        legend: {
            labels: { colors: t.text },
            markers: { radius: 12 },
            position: 'top'
        },
        theme: { mode: t.mode }
    };

    chartMeses = new ApexCharts(el, options);
    chartMeses.render();
}

// ===== GRÁFICOS DONUT: CATEGORIAS =====
function prepararGraficoCategorias(lancamentos) {
    const catDespesas = {}, catReceitas = {};
    const labelsMap = {
        'LAZER':'Lazer','CASA':'Casa','ALIMENTACAO':'Alimentação','TRANSPORTE':'Transporte',
        'SAÚDE':'Saúde','OUTROS':'Outros','FREELANCE':'Freelance','VENDA':'Venda',
        'INVESTIMENTO':'Investimento','OUTRO_RECEITA':'Outro','SALARIO':'Salário'
    };

    lancamentos.forEach(item => {
        if (!item.categoria) return;
        if (item.tipo === 'DESPESA') catDespesas[item.categoria] = (catDespesas[item.categoria] || 0) + item.valor;
        else catReceitas[item.categoria] = (catReceitas[item.categoria] || 0) + item.valor;
    });

    const lD = [], dD = [];
    Object.keys(catDespesas).forEach(k => { lD.push(labelsMap[k] || k); dD.push(parseFloat(catDespesas[k].toFixed(2))); });

    const lR = [], dR = [];
    Object.keys(catReceitas).forEach(k => { lR.push(labelsMap[k] || k); dR.push(parseFloat(catReceitas[k].toFixed(2))); });

    criarGraficoDonut('chartCategoriasDespesas', lD, dD, ['#ef4444','#f97316','#eab308','#14b8a6','#06b6d4','#8b5cf6','#ec4899']);
    criarGraficoDonut('chartCategoriasReceitas', lR, dR, ['#10b981','#14b8a6','#06b6d4','#3b82f6','#8b5cf6']);
}

function criarGraficoDonut(elementId, labels, dados, cores) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (elementId === 'chartCategoriasDespesas' && chartCategoriasDespesas) chartCategoriasDespesas.destroy();
    if (elementId === 'chartCategoriasReceitas' && chartCategoriasReceitas) chartCategoriasReceitas.destroy();
    const t = getApexTheme();

    if (dados.length === 0) {
        el.innerHTML = '<p class="text-center text-gray-400 py-12"><i class="bi bi-pie-chart text-3xl block mb-2"></i>Sem dados</p>';
        return;
    }

    const options = {
        series: dados,
        chart: {
            type: 'donut', height: 300,
            background: 'transparent',
            fontFamily: 'Inter, system-ui, sans-serif'
        },
        labels: labels,
        colors: cores.slice(0, dados.length),
        plotOptions: {
            pie: {
                donut: {
                    size: '60%',
                    labels: {
                        show: true,
                        total: {
                            show: true, label: 'Total',
                            formatter: function(w) {
                                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                return formatarMoeda(total);
                            }
                        }
                    }
                }
            }
        },
        legend: {
            position: 'bottom',
            labels: { colors: t.text },
            markers: { radius: 4 }
        },
        dataLabels: {
            enabled: true,
            formatter: function(val) { return val.toFixed(1) + '%'; },
            dropShadow: { enabled: false }
        },
        tooltip: {
            y: { formatter: v => formatarMoeda(v) }
        },
        stroke: { width: 2, colors: [t.bg] },
        theme: { mode: t.mode }
    };

    const chart = new ApexCharts(el, options);
    chart.render();

    if (elementId === 'chartCategoriasDespesas') chartCategoriasDespesas = chart;
    else chartCategoriasReceitas = chart;
}

// ===== GRÁFICO BARRAS: GASTOS FUTUROS =====
function prepararGraficoGastosFuturos(lancamentos) {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const futuros = lancamentos.filter(i => {
        const d = parseDataLocal(i.data);
        return d > hoje && i.totalParcelas && i.parcelaAtual;
    });

    if (futuros.length === 0) {
        criarGraficoBarras([], []);
        return;
    }

    let maxMes = mesAtual + 1;
    futuros.forEach(i => {
        const d = parseDataLocal(i.data);
        const diff = (d.getFullYear() - anoAtual) * 12 + (d.getMonth() - mesAtual);
        if (diff > (maxMes - mesAtual - 1)) maxMes = mesAtual + diff + 1;
    });

    const meses = [], dados = [];
    const numMeses = Math.min(12, maxMes - mesAtual);
    for (let i = 1; i <= numMeses; i++) {
        const mes = new Date(anoAtual, mesAtual + i, 1);
        meses.push(mes.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
        let g = 0;
        futuros.forEach(item => {
            const d = parseDataLocal(item.data);
            if (d.getMonth() === mes.getMonth() && d.getFullYear() === mes.getFullYear() && item.tipo === 'DESPESA') g += item.valor;
        });
        dados.push(parseFloat(g.toFixed(2)));
    }

    criarGraficoBarras(meses, dados);
}

function criarGraficoBarras(labels, dados) {
    const el = document.getElementById('chartGastosFuturos');
    if (!el) return;
    if (chartGastosFuturos) chartGastosFuturos.destroy();
    const t = getApexTheme();

    if (dados.length === 0 || dados.every(d => d === 0)) {
        el.innerHTML = '<p class="text-center text-gray-400 py-12"><i class="bi bi-calendar-check text-3xl block mb-2"></i>Nenhum gasto futuro parcelado</p>';
        return;
    }

    const options = {
        series: [{ name: 'Gastos Futuros', data: dados }],
        chart: {
            type: 'bar', height: 350,
            background: 'transparent',
            toolbar: { show: true, tools: { download: true, selection: false, zoom: false, pan: false, reset: false } },
            fontFamily: 'Inter, system-ui, sans-serif'
        },
        colors: ['#f59e0b'],
        plotOptions: {
            bar: {
                borderRadius: 8,
                columnWidth: '60%',
                dataLabels: { position: 'top' }
            }
        },
        fill: {
            type: 'gradient',
            gradient: { shade: 'light', type: 'vertical', shadeIntensity: 0.3, opacityFrom: 1, opacityTo: 0.85 }
        },
        dataLabels: {
            enabled: true, offsetY: -20,
            style: { fontSize: '11px', colors: [t.text] },
            formatter: v => v > 0 ? 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) : ''
        },
        xaxis: {
            categories: labels,
            labels: { style: { colors: t.text, fontSize: '12px' } },
            axisBorder: { show: false }, axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: { colors: t.text, fontSize: '12px' },
                formatter: v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })
            }
        },
        grid: { borderColor: t.grid, strokeDashArray: 4 },
        tooltip: {
            theme: t.tooltipTheme,
            y: { formatter: v => formatarMoeda(v) }
        },
        theme: { mode: t.mode }
    };

    chartGastosFuturos = new ApexCharts(el, options);
    chartGastosFuturos.render();
}

function atualizarCoresGraficos() { carregarDashboard(); }

// ===== UTILS =====
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ===== PERFIL =====
function carregarPerfil() {
    authAjax({
        url: '/api/auth/perfil', method: 'GET',
        success: function(data) {
            const nome = data.nome || data.username;
            const foto = data.fotoPerfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(nome)}&background=6366f1&color=fff`;
            $('#nomeUsuarioNav').text(nome);
            $('#fotoPerfilNav').attr('src', foto);
            $('#inputNomePerfil').val(data.nome || '');
            $('#inputEmailPerfil').val(data.email || '');
            $('#previewFotoPerfil').attr('src', foto);
            const temaSalvo = data.tema || 'auto';
            $(`input[name="temaPerfil"][value="${temaSalvo}"]`).prop('checked', true);
        }
    });
}

function salvarPerfilDash() {
    const formData = new FormData();
    formData.append('nome', $('#inputNomePerfil').val());
    formData.append('email', $('#inputEmailPerfil').val());
    const fotoInput = document.getElementById('inputFotoArquivo');
    if (fotoInput && fotoInput.files.length > 0) formData.append('foto', fotoInput.files[0]);
    $.ajax({
        url: '/api/auth/perfil', method: 'PUT', headers: authHeaders(),
        data: formData, processData: false, contentType: false,
        success: function() { fecharModal('modalPerfil'); carregarPerfil(); mostrarAlerta('Sucesso', 'Perfil atualizado!'); },
        error: function(xhr) {
            if ((xhr.status === 401 || xhr.status === 403)) {
                const rt = localStorage.getItem('refreshToken');
                if (rt) { $.ajax({ url: '/api/auth/refresh', method: 'POST', contentType: 'application/json', data: JSON.stringify({refreshToken: rt}), success: function(d) { localStorage.setItem('token', d.token); localStorage.setItem('refreshToken', d.refreshToken); salvarPerfilDash(); }, error: function() { localStorage.clear(); window.location.href = 'login.html'; }}); return; }
                localStorage.clear(); window.location.href = 'login.html'; return;
            }
            mostrarAlerta('Erro', xhr.responseJSON?.erro || 'Erro ao atualizar perfil');
        }
    });
}

function salvarSenhaDash() {
    const senhaAtual = $('#inputSenhaAtual').val();
    const novaSenha = $('#inputNovaSenha').val();
    const confirmar = $('#inputConfirmarSenha').val();
    if (!senhaAtual || !novaSenha || !confirmar) { mostrarAlerta('Atenção', 'Preencha todos os campos.'); return; }
    if (novaSenha.length < 6) { mostrarAlerta('Atenção', 'Mínimo 6 caracteres.'); return; }
    if (novaSenha !== confirmar) { mostrarAlerta('Atenção', 'Senhas não conferem.'); return; }
    authAjax({
        url: '/api/auth/alterar-senha', method: 'PUT', contentType: 'application/json',
        data: JSON.stringify({ senhaAtual, novaSenha }),
        success: function() { $('#inputSenhaAtual, #inputNovaSenha, #inputConfirmarSenha').val(''); mostrarAlerta('Sucesso', 'Senha alterada!'); },
        error: function(xhr) { mostrarAlerta('Erro', xhr.responseJSON?.erro || 'Erro ao alterar senha'); }
    });
}

function salvarPreferenciasDash() {
    const tema = $('input[name="temaPerfil"]:checked').val() || 'auto';
    const formData = new FormData();
    formData.append('tema', tema);
    $.ajax({
        url: '/api/auth/perfil', method: 'PUT', headers: authHeaders(),
        data: formData, processData: false, contentType: false,
        success: function() {
            if (tema === 'auto') { localStorage.removeItem('themeManual'); const t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'; localStorage.setItem('theme', t); applyTheme(t); }
            else { localStorage.setItem('theme', tema); localStorage.setItem('themeManual', 'true'); applyTheme(tema); }
            atualizarCoresGraficos();
            mostrarAlerta('Sucesso', 'Preferências salvas!');
        },
        error: function(xhr) { mostrarAlerta('Erro', xhr.responseJSON?.erro || 'Erro ao salvar'); }
    });
}

// ===== PERFIL: HELPERS =====
function trocarAbaPerfil(aba) {
    document.querySelectorAll('.aba-perfil-painel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.tab-perfil-btn').forEach(t => {
        t.classList.remove('border-brand-500', 'text-brand-600', 'dark:text-brand-400');
        t.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
    });
    const painelId = 'painel' + aba.charAt(0).toUpperCase() + aba.slice(1);
    const tabId = 'tab' + aba.charAt(0).toUpperCase() + aba.slice(1);
    const painel = document.getElementById(painelId);
    const tab = document.getElementById(tabId);
    if (painel) painel.classList.remove('hidden');
    if (tab) { tab.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400'); tab.classList.add('border-brand-500', 'text-brand-600', 'dark:text-brand-400'); }
}
window.trocarAbaPerfil = trocarAbaPerfil;

function previewFotoSelecionada(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) { $('#previewFotoPerfil').attr('src', e.target.result); };
        reader.readAsDataURL(input.files[0]);
    }
}
window.previewFotoSelecionada = previewFotoSelecionada;

function toggleSenhaVisivel(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = btn.querySelector('i');
    if (input.type === 'password') { input.type = 'text'; icon.classList.remove('bi-eye'); icon.classList.add('bi-eye-slash'); }
    else { input.type = 'password'; icon.classList.remove('bi-eye-slash'); icon.classList.add('bi-eye'); }
}
window.toggleSenhaVisivel = toggleSenhaVisivel;

function mostrarAlerta(titulo, mensagem) {
    $('#tituloAlerta').text(titulo);
    $('#mensagemAlerta').text(mensagem);
    abrirModal('modalAlerta');
}

function carregarNotificacoesPendentes() {
    authAjax({
        url: '/api/compartilhamento/pendentes', method: 'GET',
        success: function(pendentes) {
            const badge = $('#badgeNotificacoes');
            if (pendentes.length > 0) badge.text(pendentes.length).removeClass('hidden');
            else badge.addClass('hidden');
        }
    });
    // Carregar badge de amigos pendentes
    carregarBadgePendentes();
}

// ===== SISTEMA DE AMIGOS =====
function sanitizeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function trocarAbaAmigos(aba) {
    $('.aba-amigo-painel').addClass('hidden');
    $('.tab-amigo-btn').each(function() {
        $(this).removeClass('border-brand-500 text-brand-600 dark:text-brand-400').addClass('border-transparent text-gray-500 dark:text-gray-400');
    });

    $(`#painelAmigos${aba.charAt(0).toUpperCase() + aba.slice(1)}`).removeClass('hidden');
    const tabId = `tabAmigos${aba.charAt(0).toUpperCase() + aba.slice(1)}`;
    $(`#${tabId}`).removeClass('border-transparent text-gray-500 dark:text-gray-400').addClass('border-brand-500 text-brand-600 dark:text-brand-400');

    if (aba === 'lista') carregarAmigos();
    else if (aba === 'pendentes') carregarPendentesAmizade();
    else if (aba === 'adicionar') { $('#inputBuscarAmigo').val(''); $('#resultadoBuscarAmigo').html('<p class="text-center text-gray-400 py-4 text-sm">Digite para buscar usuários</p>'); }
}
window.trocarAbaAmigos = trocarAbaAmigos;

function carregarAmigos() {
    const container = $('#listaAmigos');
    container.html('<p class="text-center text-gray-400 py-6 text-sm">Carregando...</p>');

    authAjax({
        url: '/api/amigos', method: 'GET',
        success: function(amigos) {
            container.empty();
            if (amigos.length === 0) {
                container.html(`
                    <div class="text-center py-8">
                        <i class="bi bi-people text-4xl text-gray-300 dark:text-gray-600"></i>
                        <p class="text-gray-400 mt-3 text-sm">Nenhum amigo adicionado ainda</p>
                        <button onclick="trocarAbaAmigos('adicionar')" class="mt-3 text-sm text-brand-500 hover:text-brand-400 font-medium transition-colors">
                            <i class="bi bi-person-plus mr-1"></i> Adicionar amigos
                        </button>
                    </div>
                `);
                return;
            }

            amigos.forEach(amigo => {
                const foto = amigo.fotoPerfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(amigo.nome || amigo.username)}&background=6366f1&color=fff`;
                container.append(`
                    <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
                        <img src="${sanitizeHTML(foto)}" class="w-10 h-10 rounded-full ring-2 ring-brand-500/20 object-cover" alt="">
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium truncate">${sanitizeHTML(amigo.nome || amigo.username)}</p>
                            <p class="text-xs text-gray-400 truncate">@${sanitizeHTML(amigo.username)}</p>
                        </div>
                        <button onclick="removerAmigo(${amigo.amizadeId}, '${sanitizeHTML(amigo.nome || amigo.username)}')" class="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Remover amigo">
                            <i class="bi bi-person-dash"></i>
                        </button>
                    </div>
                `);
            });
        },
        error: function() { container.html('<p class="text-center text-red-400 py-4 text-sm">Erro ao carregar amigos</p>'); }
    });

    carregarBadgePendentes();
}
window.carregarAmigos = carregarAmigos;

function carregarBadgePendentes() {
    authAjax({
        url: '/api/amigos/pendentes', method: 'GET',
        success: function(pendentes) {
            const badge = $('#badgeAmigosPendentes');
            const badgeTab = $('#badgePendentesTab');
            if (pendentes.length > 0) {
                badge.text(pendentes.length).removeClass('hidden');
                badgeTab.text(pendentes.length).removeClass('hidden');
            } else {
                badge.addClass('hidden');
                badgeTab.addClass('hidden');
            }
        }
    });
}

function carregarPendentesAmizade() {
    authAjax({
        url: '/api/amigos/pendentes', method: 'GET',
        success: function(pendentes) {
            const container = $('#listaPendentesRecebidos');
            container.empty();
            if (pendentes.length === 0) {
                container.html('<p class="text-center text-gray-400 py-4 text-sm">Nenhuma solicitação pendente</p>');
            } else {
                pendentes.forEach(p => {
                    const s = p.solicitante;
                    const foto = s.fotoPerfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.nome || s.username)}&background=6366f1&color=fff`;
                    container.append(`
                        <div class="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-500/5 border border-orange-200 dark:border-orange-500/20 rounded-xl">
                            <img src="${sanitizeHTML(foto)}" class="w-10 h-10 rounded-full ring-2 ring-orange-500/20 object-cover" alt="">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium truncate">${sanitizeHTML(s.nome || s.username)}</p>
                                <p class="text-xs text-gray-400 truncate">@${sanitizeHTML(s.username)}</p>
                            </div>
                            <div class="flex gap-1">
                                <button onclick="aceitarAmizade(${p.id})" class="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors" title="Aceitar">
                                    <i class="bi bi-check-lg"></i>
                                </button>
                                <button onclick="recusarAmizade(${p.id})" class="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Recusar">
                                    <i class="bi bi-x-lg"></i>
                                </button>
                            </div>
                        </div>
                    `);
                });
            }
        }
    });

    authAjax({
        url: '/api/amigos/enviados', method: 'GET',
        success: function(enviados) {
            const container = $('#listaPendentesEnviados');
            container.empty();
            if (enviados.length === 0) {
                container.html('<p class="text-center text-gray-400 py-4 text-sm">Nenhuma solicitação enviada</p>');
            } else {
                enviados.forEach(e => {
                    const d = e.destinatario;
                    const foto = d.fotoPerfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(d.nome || d.username)}&background=6366f1&color=fff`;
                    container.append(`
                        <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                            <img src="${sanitizeHTML(foto)}" class="w-10 h-10 rounded-full ring-2 ring-gray-300/20 object-cover" alt="">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium truncate">${sanitizeHTML(d.nome || d.username)}</p>
                                <p class="text-xs text-gray-400 truncate">@${sanitizeHTML(d.username)}</p>
                            </div>
                            <span class="text-xs text-amber-500 font-medium"><i class="bi bi-clock mr-1"></i>Aguardando</span>
                        </div>
                    `);
                });
            }
        }
    });
}

let _buscaAmigoTimeout;
function buscarUsuariosAmigo() {
    const query = $('#inputBuscarAmigo').val().trim();
    if (query.length < 2) {
        $('#resultadoBuscarAmigo').html('<p class="text-center text-gray-400 py-4 text-sm">Digite pelo menos 2 caracteres</p>');
        return;
    }

    clearTimeout(_buscaAmigoTimeout);
    _buscaAmigoTimeout = setTimeout(function() {
        authAjax({
            url: '/api/amigos/buscar?query=' + encodeURIComponent(query), method: 'GET',
            success: function(usuarios) {
                const container = $('#resultadoBuscarAmigo');
                container.empty();
                if (usuarios.length === 0) {
                    container.html('<p class="text-center text-gray-400 py-4 text-sm">Nenhum usuário encontrado</p>');
                    return;
                }

                usuarios.forEach(u => {
                    const foto = u.fotoPerfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nome || u.username)}&background=6366f1&color=fff`;
                    let botao = '';
                    if (u.statusAmizade === 'ACEITA') {
                        botao = '<span class="text-xs text-emerald-500 font-medium"><i class="bi bi-check-circle mr-1"></i>Amigos</span>';
                    } else if (u.statusAmizade === 'PENDENTE') {
                        botao = '<span class="text-xs text-amber-500 font-medium"><i class="bi bi-clock mr-1"></i>Pendente</span>';
                    } else {
                        botao = `<button onclick="solicitarAmizade(${u.id})" class="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-lg transition-colors"><i class="bi bi-person-plus mr-1"></i>Adicionar</button>`;
                    }

                    container.append(`
                        <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                            <img src="${sanitizeHTML(foto)}" class="w-10 h-10 rounded-full ring-2 ring-brand-500/20 object-cover" alt="">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium truncate">${sanitizeHTML(u.nome || u.username)}</p>
                                <p class="text-xs text-gray-400 truncate">@${sanitizeHTML(u.username)}</p>
                            </div>
                            ${botao}
                        </div>
                    `);
                });
            },
            error: function() { $('#resultadoBuscarAmigo').html('<p class="text-center text-red-400 py-4 text-sm">Erro ao buscar</p>'); }
        });
    }, 400);
}

window.solicitarAmizade = function(userId) {
    authAjax({
        url: '/api/amigos/solicitar', method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ usuarioDestinatarioId: userId }),
        success: function() {
            mostrarAlerta('Enviado!', 'Solicitação de amizade enviada com sucesso!');
            buscarUsuariosAmigo();
        },
        error: function(xhr) {
            const erro = xhr.responseJSON?.erro || 'Erro ao enviar solicitação';
            mostrarAlerta('Erro', erro);
        }
    });
};

window.aceitarAmizade = function(id) {
    authAjax({
        url: `/api/amigos/${id}/aceitar`, method: 'PUT',
        contentType: 'application/json', data: JSON.stringify({}),
        success: function() {
            mostrarAlerta('Aceito!', 'Amizade aceita!');
            carregarPendentesAmizade();
            carregarBadgePendentes();
        },
        error: function() { mostrarAlerta('Erro', 'Erro ao aceitar solicitação'); }
    });
};

window.recusarAmizade = function(id) {
    authAjax({
        url: `/api/amigos/${id}/recusar`, method: 'PUT',
        contentType: 'application/json', data: JSON.stringify({}),
        success: function() {
            mostrarAlerta('Recusado', 'Solicitação recusada');
            carregarPendentesAmizade();
            carregarBadgePendentes();
        },
        error: function() { mostrarAlerta('Erro', 'Erro ao recusar solicitação'); }
    });
};

window.removerAmigo = function(amizadeId, nome) {
    mostrarConfirmacao('Remover Amigo', `Deseja remover "${nome}" da sua lista de amigos?`, function() {
        authAjax({
            url: `/api/amigos/${amizadeId}`, method: 'DELETE',
            success: function() {
                mostrarAlerta('Removido', 'Amigo removido');
                carregarAmigos();
            },
            error: function() { mostrarAlerta('Erro', 'Erro ao remover amigo'); }
        });
    });
};

$(document).on('input', '#inputBuscarAmigo', buscarUsuariosAmigo);

// ===== MODAIS REUTILIZÁVEIS =====
function mostrarConfirmacao(titulo, mensagem, callback) {
    $('#tituloConfirmacao').text(titulo);
    $('#mensagemConfirmacao').text(mensagem);
    $('#btnConfirmarSim').off('click').on('click', function() {
        fecharModal('modalConfirmacao');
        callback();
    });
    abrirModal('modalConfirmacao');
}

function mostrarAlerta(titulo, mensagem) {
    $('#tituloAlerta').text(titulo);
    $('#mensagemAlerta').text(mensagem);
    abrirModal('modalAlerta');
}
