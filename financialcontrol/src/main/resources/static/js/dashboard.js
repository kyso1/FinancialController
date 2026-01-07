const API_URL = '/api/lancamentos';

let chartMeses, chartCategoriasDespesas, chartCategoriasReceitas, chartGastosFuturos;
let usuarioId = null;

$(document).ready(function() {
    // Verifica autenticação
    usuarioId = localStorage.getItem('userId');
    if (!usuarioId) {
        window.location.href = 'login.html';
        return;
    }

    // Carrega dados do perfil
    carregarPerfil();

    // Carrega notificações pendentes
    carregarNotificacoesPendentes();

    // Inicializa o tema
    initTheme();

    // Toggle de tema
    $('#themeToggle').click(function() {
        toggleTheme();
    });

    // Logout
    $('#btnLogout').click(function(e) {
        e.preventDefault();
        mostrarConfirmacao('Sair', 'Deseja realmente sair?', function() {
            localStorage.clear();
            window.location.href = 'login.html';
        });
    });

    // Carrega os dados do dashboard
    carregarDashboard();
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

    // Atualiza os gráficos com as cores do novo tema
    atualizarCoresGraficos();
}

function updateThemeIcon(theme) {
    const icon = $('#themeIcon');
    if (theme === 'dark') {
        icon.removeClass('bi-moon-fill').addClass('bi-sun-fill');
    } else {
        icon.removeClass('bi-sun-fill').addClass('bi-moon-fill');
    }
}

// ===== FUNÇÕES DO DASHBOARD =====
function carregarDashboard() {
    $.ajax({
        url: API_URL,
        method: 'GET',
        data: { usuarioId: usuarioId },
        success: function(lancamentos) {
            processarDados(lancamentos);
        },
        error: function(err) {
            console.error("Erro ao carregar dados:", err);
            if (err.status === 401) {
                localStorage.removeItem('userId');
                window.location.href = 'login.html';
            }
        }
    });
}

function processarDados(lancamentos) {
    // Filtra apenas lançamentos do mês atual
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const lancamentosMesAtual = lancamentos.filter(item => {
        const dataItem = new Date(item.data);
        return dataItem.getMonth() === mesAtual && dataItem.getFullYear() === anoAtual;
    });

    // Calcular saldo, receitas e despesas do mês atual
    let saldo = 0;
    let totalReceitas = 0;
    let totalDespesas = 0;

    lancamentosMesAtual.forEach(item => {
        if (item.tipo === 'RECEITA') {
            saldo += item.valor;
            totalReceitas += item.valor;
        } else {
            saldo -= item.valor;
            totalDespesas += item.valor;
        }
    });

    // Atualizar cards
    $('#saldo-atual').text(formatarMoeda(saldo));
    $('#total-receitas').text(formatarMoeda(totalReceitas));
    $('#total-despesas').text(formatarMoeda(totalDespesas));

    // Mudar cor do saldo se negativo
    if (saldo < 0) {
        $('#saldo-atual').removeClass('text-success').addClass('text-danger');
    } else {
        $('#saldo-atual').removeClass('text-danger').addClass('text-success');
    }

    // Preparar dados para os gráficos
    prepararGraficoMeses(lancamentos);
    prepararGraficoCategorias(lancamentos);
    prepararGraficoGastosFuturos(lancamentos);
}

function prepararGraficoMeses(lancamentos) {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    // Mês atual e anterior
    const meses = [];
    const dadosDespesas = [];
    const dadosReceitas = [];

    for (let i = 1; i >= 0; i--) {
        const mes = new Date(anoAtual, mesAtual - i, 1);
        const nomeMes = mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        meses.push(nomeMes);

        let despesasMes = 0;
        let receitasMes = 0;

        lancamentos.forEach(item => {
            const dataItem = new Date(item.data);
            if (dataItem.getMonth() === mes.getMonth() && dataItem.getFullYear() === mes.getFullYear()) {
                if (item.tipo === 'DESPESA') {
                    despesasMes += item.valor;
                } else {
                    receitasMes += item.valor;
                }
            }
        });

        dadosDespesas.push(despesasMes);
        dadosReceitas.push(receitasMes);
    }

    criarGraficoMeses(meses, dadosDespesas, dadosReceitas);
}

function prepararGraficoCategorias(lancamentos) {
    const categoriasDespesas = {};
    const categoriasReceitas = {};

    const labelsCategorias = {
        'LAZER': 'Lazer',
        'CASA': 'Casa',
        'ALIMENTACAO': 'Alimentação',
        'TRANSPORTE': 'Transporte',
        'SAÚDE': 'Saúde',
        'OUTROS': 'Outros',
        'FREELANCE': 'Freelance',
        'VENDA': 'Venda',
        'INVESTIMENTO': 'Investimento',
        'OUTRO_RECEITA': 'Outro',
        'SALARIO': 'Salário'
    };

    lancamentos.forEach(item => {
        if (item.categoria) {
            if (item.tipo === 'DESPESA') {
                categoriasDespesas[item.categoria] = (categoriasDespesas[item.categoria] || 0) + item.valor;
            } else {
                categoriasReceitas[item.categoria] = (categoriasReceitas[item.categoria] || 0) + item.valor;
            }
        }
    });

    // Converter para arrays
    const labelsDespesas = [];
    const dadosDespesas = [];
    Object.keys(categoriasDespesas).forEach(key => {
        labelsDespesas.push(labelsCategorias[key] || key);
        dadosDespesas.push(categoriasDespesas[key]);
    });

    const labelsReceitas = [];
    const dadosReceitas = [];
    Object.keys(categoriasReceitas).forEach(key => {
        labelsReceitas.push(labelsCategorias[key] || key);
        dadosReceitas.push(categoriasReceitas[key]);
    });

    criarGraficoCategoriasDespesas(labelsDespesas, dadosDespesas);
    criarGraficoCategoriasReceitas(labelsReceitas, dadosReceitas);
}

// ===== CRIAÇÃO DOS GRÁFICOS =====
function criarGraficoMeses(labels, dadosDespesas, dadosReceitas) {
    const ctx = document.getElementById('chartMeses').getContext('2d');

    if (chartMeses) {
        chartMeses.destroy();
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e9ecef' : '#212529';
    const gridColor = isDark ? '#495057' : '#dee2e6';

    chartMeses = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Despesas',
                    data: dadosDespesas,
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Receitas',
                    data: dadosReceitas,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        color: textColor
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: textColor,
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    },
                    grid: {
                        color: gridColor
                    }
                },
                x: {
                    ticks: {
                        color: textColor
                    },
                    grid: {
                        color: gridColor
                    }
                }
            }
        }
    });
}

function criarGraficoCategoriasDespesas(labels, dados) {
    const ctx = document.getElementById('chartCategoriasDespesas').getContext('2d');

    if (chartCategoriasDespesas) {
        chartCategoriasDespesas.destroy();
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e9ecef' : '#212529';

    const cores = [
        '#dc3545',
        '#fd7e14',
        '#ffc107',
        '#20c997',
        '#17a2b8',
        '#6f42c1'
    ];

    chartCategoriasDespesas = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: dados,
                backgroundColor: cores.slice(0, dados.length),
                borderWidth: 2,
                borderColor: isDark ? '#2d2d2d' : '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            return label + ': ' + formatarMoeda(value);
                        }
                    }
                }
            }
        }
    });
}

function criarGraficoCategoriasReceitas(labels, dados) {
    const ctx = document.getElementById('chartCategoriasReceitas').getContext('2d');

    if (chartCategoriasReceitas) {
        chartCategoriasReceitas.destroy();
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e9ecef' : '#212529';

    const cores = [
        '#28a745',
        '#20c997',
        '#17a2b8',
        '#007bff'
    ];

    chartCategoriasReceitas = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: dados,
                backgroundColor: cores.slice(0, dados.length),
                borderWidth: 2,
                borderColor: isDark ? '#2d2d2d' : '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            return label + ': ' + formatarMoeda(value);
                        }
                    }
                }
            }
        }
    });
}

function prepararGraficoGastosFuturos(lancamentos) {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    // Filtra apenas lançamentos futuros com parcelamento
    const lancamentosFuturos = lancamentos.filter(item => {
        const dataItem = new Date(item.data);
        // Considera como futuro se for do mês seguinte em diante
        return dataItem > hoje && item.totalParcelas && item.parcelaAtual;
    });

    // Se não tem gastos futuros, não mostra o gráfico
    if (lancamentosFuturos.length === 0) {
        criarGraficoGastosFuturos([], []);
        return;
    }

    // Encontra o maior número de meses futuros (baseado na última data)
    let maiorMes = mesAtual + 1; // pelo menos o próximo mês
    lancamentosFuturos.forEach(item => {
        const dataItem = new Date(item.data);
        const mesesDiferenca = (dataItem.getFullYear() - anoAtual) * 12 + (dataItem.getMonth() - mesAtual);
        if (mesesDiferenca > (maiorMes - mesAtual - 1)) {
            maiorMes = mesAtual + mesesDiferenca + 1;
        }
    });

    // Cria array de meses futuros
    const meses = [];
    const dadosGastos = [];
    const numeroMesesFuturos = Math.min(12, maiorMes - mesAtual); // Máximo 12 meses

    for (let i = 1; i <= numeroMesesFuturos; i++) {
        const mes = new Date(anoAtual, mesAtual + i, 1);
        const nomeMes = mes.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
        meses.push(nomeMes);

        // Soma os gastos deste mês
        let gastosMes = 0;
        lancamentosFuturos.forEach(item => {
            const dataItem = new Date(item.data);
            if (dataItem.getMonth() === mes.getMonth() && dataItem.getFullYear() === mes.getFullYear()) {
                if (item.tipo === 'DESPESA') {
                    gastosMes += item.valor;
                }
            }
        });

        dadosGastos.push(gastosMes);
    }

    criarGraficoGastosFuturos(meses, dadosGastos);
}

function criarGraficoGastosFuturos(labels, dados) {
    const ctx = document.getElementById('chartGastosFuturos').getContext('2d');

    if (chartGastosFuturos) {
        chartGastosFuturos.destroy();
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e9ecef' : '#212529';
    const gridColor = isDark ? '#495057' : '#dee2e6';

    // Se não tem dados, mostra mensagem
    if (dados.length === 0 || dados.every(d => d === 0)) {
        ctx.font = '16px Arial';
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.fillText('Nenhum gasto futuro parcelado encontrado', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    chartGastosFuturos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gastos Futuros',
                data: dados,
                backgroundColor: 'rgba(255, 193, 7, 0.6)',
                borderColor: '#ffc107',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        color: textColor
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Gastos: ' + formatarMoeda(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: textColor,
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    },
                    grid: {
                        color: gridColor
                    }
                },
                x: {
                    ticks: {
                        color: textColor
                    },
                    grid: {
                        color: gridColor
                    }
                }
            }
        }
    });
}

function atualizarCoresGraficos() {
    // Recarrega o dashboard para atualizar as cores dos gráficos
    carregarDashboard();
}

// ===== UTILITÁRIOS =====
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ===== FUNÇÕES DE PERFIL =====
function carregarPerfil() {
    $.ajax({
        url: `/api/auth/perfil/${usuarioId}`,
        method: 'GET',
        success: function(data) {
            const nome = data.nome || data.username;
            const fotoPerfil = data.fotoPerfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(nome)}&background=random`;

            $('#nomeUsuarioNav').text(nome);
            $('#fotoPerfilNav').attr('src', fotoPerfil);
        },
        error: function() {
            console.error('Erro ao carregar perfil');
        }
    });
}

function carregarNotificacoesPendentes() {
    $.ajax({
        url: `/api/compartilhamento/pendentes/${usuarioId}`,
        method: 'GET',
        success: function(pendentes) {
            const badge = $('#badgeNotificacoes');
            if (pendentes.length > 0) {
                badge.text(pendentes.length).removeClass('d-none');
            } else {
                badge.addClass('d-none');
            }
        }
    });
}
// ===== FUNÇÕES DE MODAIS PERSONALIZADOS =====
function mostrarConfirmacao(titulo, mensagem, callback) {
    $('#tituloConfirmacao').text(titulo);
    $('#mensagemConfirmacao').text(mensagem);
    
    // Remove listeners antigos
    $('#btnConfirmarSim').off('click');
    
    // Adiciona novo listener
    $('#btnConfirmarSim').on('click', function() {
        $('#modalConfirmacao').modal('hide');
        callback();
    });
    
    // Mostra modal
    const modal = new bootstrap.Modal(document.getElementById('modalConfirmacao'));
    modal.show();
}

function mostrarAlerta(titulo, mensagem) {
    $('#tituloAlerta').text(titulo);
    $('#mensagemAlerta').text(mensagem);
    
    const modal = new bootstrap.Modal(document.getElementById('modalAlerta'));
    modal.show();
}