const API_URL = '/api/lancamentos';
let chartMeses, chartCategoriasDespesas, chartCategoriasReceitas, chartGastosFuturos;
let usuarioId = null;

// ===== AUTH HELPERS =====
function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
}

function authAjax(options) {
    options.headers = Object.assign({}, options.headers || {}, authHeaders());
    const originalError = options.error;
    options.error = function(xhr) {
        if (xhr.status === 401 || xhr.status === 403) {
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
    let saved = localStorage.getItem('theme');
    if (!saved) {
        saved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
        localStorage.setItem('theme', saved);
    }
    applyTheme(saved);

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
        const d = new Date(item.data);
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });

    let saldo = 0, totalReceitas = 0, totalDespesas = 0;
    lancamentosMes.forEach(item => {
        if (item.tipo === 'RECEITA') { saldo += item.valor; totalReceitas += item.valor; }
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

// ===== GRÁFICOS =====
function getChartColors() {
    const isDark = document.documentElement.classList.contains('dark');
    return {
        text: isDark ? '#d1d5db' : '#374151',
        grid: isDark ? '#374151' : '#e5e7eb',
        cardBg: isDark ? '#111827' : '#ffffff'
    };
}

function prepararGraficoMeses(lancamentos) {
    const hoje = new Date();
    const mesesData = [];
    const despesasData = [];
    const receitasData = [];

    for (let i = 1; i >= 0; i--) {
        const mes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        mesesData.push(mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
        let d = 0, r = 0;
        lancamentos.forEach(item => {
            const di = new Date(item.data);
            if (di.getMonth() === mes.getMonth() && di.getFullYear() === mes.getFullYear()) {
                if (item.tipo === 'DESPESA') d += item.valor; else r += item.valor;
            }
        });
        despesasData.push(d);
        receitasData.push(r);
    }

    criarGraficoLinha(mesesData, despesasData, receitasData);
}

function criarGraficoLinha(labels, despesas, receitas) {
    const ctx = document.getElementById('chartMeses');
    if (!ctx) return;
    if (chartMeses) chartMeses.destroy();
    const c = getChartColors();

    chartMeses = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Despesas', data: despesas, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', tension: 0.4, fill: true },
                { label: 'Receitas', data: receitas, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.4, fill: true }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: { legend: { labels: { color: c.text, usePointStyle: true, pointStyle: 'circle' } } },
            scales: {
                y: { beginAtZero: true, ticks: { color: c.text, callback: v => 'R$ ' + v.toLocaleString('pt-BR') }, grid: { color: c.grid } },
                x: { ticks: { color: c.text }, grid: { color: c.grid } }
            }
        }
    });
}

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
    Object.keys(catDespesas).forEach(k => { lD.push(labelsMap[k] || k); dD.push(catDespesas[k]); });

    const lR = [], dR = [];
    Object.keys(catReceitas).forEach(k => { lR.push(labelsMap[k] || k); dR.push(catReceitas[k]); });

    criarGraficoPizza('chartCategoriasDespesas', lD, dD, ['#ef4444','#f97316','#eab308','#14b8a6','#06b6d4','#8b5cf6'], 'chartCategoriasDespesas');
    criarGraficoPizza('chartCategoriasReceitas', lR, dR, ['#10b981','#14b8a6','#06b6d4','#3b82f6'], 'chartCategoriasReceitas');
}

function criarGraficoPizza(canvasId, labels, dados, cores, varName) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (window[varName]) window[varName].destroy();
    const c = getChartColors();

    window[varName] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data: dados, backgroundColor: cores.slice(0, dados.length), borderWidth: 2, borderColor: c.cardBg }]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            cutout: '60%',
            plugins: {
                legend: { position: 'bottom', labels: { color: c.text, usePointStyle: true, pointStyle: 'circle', padding: 15 } },
                tooltip: { callbacks: { label: ctx => `${ctx.label}: ${formatarMoeda(ctx.parsed)}` } }
            }
        }
    });
}

function prepararGraficoGastosFuturos(lancamentos) {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const futuros = lancamentos.filter(i => {
        const d = new Date(i.data);
        return d > hoje && i.totalParcelas && i.parcelaAtual;
    });

    if (futuros.length === 0) {
        criarGraficoBarras([], []);
        return;
    }

    let maxMes = mesAtual + 1;
    futuros.forEach(i => {
        const d = new Date(i.data);
        const diff = (d.getFullYear() - anoAtual) * 12 + (d.getMonth() - mesAtual);
        if (diff > (maxMes - mesAtual - 1)) maxMes = mesAtual + diff + 1;
    });

    const meses = [], dados = [];
    const numMeses = Math.min(12, maxMes - mesAtual);
    for (let i = 1; i <= numMeses; i++) {
        const mes = new Date(anoAtual, mesAtual + i, 1);
        meses.push(mes.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }));
        let g = 0;
        futuros.forEach(item => {
            const d = new Date(item.data);
            if (d.getMonth() === mes.getMonth() && d.getFullYear() === mes.getFullYear() && item.tipo === 'DESPESA') g += item.valor;
        });
        dados.push(g);
    }

    criarGraficoBarras(meses, dados);
}

function criarGraficoBarras(labels, dados) {
    const ctx = document.getElementById('chartGastosFuturos');
    if (!ctx) return;
    if (chartGastosFuturos) chartGastosFuturos.destroy();
    const c = getChartColors();

    if (dados.length === 0 || dados.every(d => d === 0)) {
        const context = ctx.getContext('2d');
        context.font = '14px Inter, system-ui, sans-serif';
        context.fillStyle = c.text;
        context.textAlign = 'center';
        context.fillText('Nenhum gasto futuro parcelado', ctx.width / 2, ctx.height / 2);
        return;
    }

    chartGastosFuturos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Gastos Futuros',
                data: dados,
                backgroundColor: 'rgba(245,158,11,0.5)',
                borderColor: '#f59e0b',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: c.text } },
                tooltip: { callbacks: { label: ctx => 'Gastos: ' + formatarMoeda(ctx.parsed.y) } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { color: c.text, callback: v => 'R$ ' + v.toLocaleString('pt-BR') }, grid: { color: c.grid } },
                x: { ticks: { color: c.text }, grid: { color: c.grid } }
            }
        }
    });
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
        }
    });
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
}

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
