let todosLancamentos = [];
let lancamentosFiltrados = [];
let usuarioId = null;
let ordenacaoAtual = 'data';
let ordenacaoCrescente = false;

// ===== MULTI-SELECT =====
let modoSelecao = false;
let selecionados = new Set();

// ===== SEGURANÇA: Sanitização contra XSS =====
function sanitizeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function sanitizeInput(value) {
    if (!value) return '';
    return value.replace(/[<>\"'&]/g, function(match) {
        const map = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;' };
        return map[match];
    });
}

// ===== AUTH HELPERS =====
function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
}

let _refreshingToken = false;
function authAjax(options) {
    options.headers = Object.assign({}, options.headers || {}, authHeaders());
    const originalError = options.error;
    options.error = function(xhr) {
        if ((xhr.status === 401 || xhr.status === 403) && !_refreshingToken) {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
                _refreshingToken = true;
                $.ajax({
                    url: '/api/auth/refresh', method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ refreshToken }),
                    success: function(data) {
                        localStorage.setItem('token', data.token);
                        localStorage.setItem('refreshToken', data.refreshToken);
                        _refreshingToken = false;
                        // Retry original request
                        options.headers['Authorization'] = 'Bearer ' + data.token;
                        options.error = originalError;
                        $.ajax(options);
                    },
                    error: function() {
                        _refreshingToken = false;
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

// ===== MODAIS CUSTOMIZADOS (substitui Bootstrap) =====
function abrirModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    // Anima entrada
    setTimeout(() => {
        const container = modal.querySelector('.modal-container');
        if (container) {
            container.classList.remove('scale-95', 'opacity-0');
            container.classList.add('scale-100', 'opacity-100');
        }
    }, 10);
}
window.abrirModal = abrirModal;

function fecharModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    const container = modal.querySelector('.modal-container');
    if (container) {
        container.classList.remove('scale-100', 'opacity-100');
        container.classList.add('scale-95', 'opacity-0');
    }
    setTimeout(() => {
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }, 150);
}
window.fecharModal = fecharModal;

// Fecha modal ao clicar no overlay
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        fecharModal(e.target.id);
    }
});

// Fecha dropdowns ao clicar fora
document.addEventListener('click', function(e) {
    document.querySelectorAll('[id$="DropdownMenu"]').forEach(menu => {
        const container = menu.closest('[id$="DropdownContainer"]') || menu.parentElement;
        if (!container.contains(e.target)) {
            menu.classList.add('hidden');
        }
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
    if (!token || !usuarioId) {
        window.location.href = 'login.html';
        return;
    }

    carregarPerfil();
    carregarNotificacoesPendentes();
    initTheme();
    ajustarFormulario();
    preencherFiltroCategorias();
    inicializarFiltroData();

    mostrarSkeletonLancamentos();
    carregarLancamentos();
    initMascaraMoeda();

    $('#btn-salvar').click(salvarLancamento);

    $('#themeToggle').click(toggleTheme);
    $('#btnAplicarFiltros').click(aplicarFiltros);
    $('#btnLimparFiltros').click(limparFiltros);
    $('#filtroTipo').change(preencherFiltroCategorias);
    $('#btnPreviewImport').click(carregarPreview);
    $('#btnExportarExcel').click(function() { exportarRelatorio('excel'); });
    $('#btnExportarCSV').click(function() { exportarRelatorio('csv'); });
    $('#btnEnviarEmail').click(function(e) { e.preventDefault(); enviarRelatorioPorEmail(); });
    $('#btnCicloFatura').click(toggleCicloFatura);
    $('#btnMultiSelect').click(ativarModoSelecao);
    $('#btnCancelarSelecao').click(desativarModoSelecao);
    $('#btnDeletarSelecionados').click(deletarSelecionados);
    $('#btnEditarSelecionados').click(editarSelecionados);
    $('#btnConfirmarEditarMetodo').click(confirmarEditarMetodoLote);
    $('#checkboxTodos').change(toggleSelecionarTodos);

    // Auto-selecionar categoria Investimento quando método é Investimento
    $('#inputMetodoPagamento').change(function() {
        if ($(this).val() === 'INVESTIMENTO') {
            const tipo = $('#inputTipo').val();
            if (tipo === 'RECEITA' || tipo === 'DESPESA') {
                $('#inputTipo').val('RECEITA');
                ajustarFormulario();
            }
            $('#inputCategoria').val('INVESTIMENTO');
        }
    });

    $('#btnLogout').click(function(e) {
        e.preventDefault();
        mostrarConfirmacao('Sair', 'Deseja realmente sair?', function() {
            localStorage.clear();
            window.location.href = 'login.html';
        });
    });

    $('#btnSalvarPerfil').click(salvarPerfil);
    $('#btnSalvarSenha').click(salvarSenha);
    $('#btnSalvarPreferencias').click(salvarPreferencias);

    $('#btnEnviarCompartilhamento').click(enviarCompartilhamento);

    $('#btnOrdenarData').click(function() {
        if (ordenacaoAtual === 'data') { ordenacaoCrescente = !ordenacaoCrescente; }
        else { ordenacaoAtual = 'data'; ordenacaoCrescente = false; }
        atualizarBotoesOrdenacao(); aplicarOrdenacao();
    });

    $('#btnOrdenarValor').click(function() {
        if (ordenacaoAtual === 'valor') { ordenacaoCrescente = !ordenacaoCrescente; }
        else { ordenacaoAtual = 'valor'; ordenacaoCrescente = false; }
        atualizarBotoesOrdenacao(); aplicarOrdenacao();
    });

    $('#btnSalvarOrcamento').click(salvarOrcamento);
    $('#btnSalvarMeta').click(salvarMeta);
    $('#btnCriarTag').click(criarTag);
});

// ===== MÁSCARA DE MOEDA =====
function initMascaraMoeda() {
    const inputValor = document.getElementById('inputValor');
    if (!inputValor) return;
    inputValor.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value === '') { e.target.value = ''; return; }
        let numericValue = parseInt(value) / 100;
        e.target.value = numericValue.toLocaleString('pt-BR', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });
    });
}

function getValorNumerico() {
    const raw = $('#inputValor').val();
    if (!raw) return 0;
    return parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
}

// ===== SKELETON SCREENS =====
function mostrarSkeletonLancamentos() {
    const lista = $('#lista-lancamentos');
    lista.empty();
    for (let i = 0; i < 5; i++) {
        lista.append(`
            <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 animate-pulse">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
                        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                    </div>
                    <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                </div>
            </div>
        `);
    }
}

// ===== TEMA =====
function initTheme() {
    // Tenta carregar tema salvo do backend (usuário logado)
    authAjax({
        url: '/api/auth/perfil', method: 'GET',
        success: function(data) {
            const temaBanco = data.tema; // 'light', 'dark', 'auto' ou null
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
                // Sem preferência no banco, usa localStorage ou sistema
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
            // Fallback: usa localStorage
            let saved = localStorage.getItem('theme') || 'light';
            applyTheme(saved);
        }
    });

    // Listener para mudança de tema do sistema (modo auto)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        if (!localStorage.getItem('themeManual')) {
            const t = e.matches ? 'dark' : 'light';
            localStorage.setItem('theme', t);
            applyTheme(t);
        }
    });
}

function toggleTheme() {
    const current = localStorage.getItem('theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    localStorage.setItem('themeManual', 'true');
    applyTheme(next);
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
    const icon = $('#themeIcon');
    if (theme === 'dark') {
        icon.removeClass('bi-moon-fill').addClass('bi-sun-fill');
    } else {
        icon.removeClass('bi-sun-fill').addClass('bi-moon-fill');
    }
}

const API_URL = '/api/lancamentos';

// ===== CATEGORIAS =====
const categoriasPorTipo = {
    'DESPESA': [
        { value: 'LAZER', label: 'Lazer' },
        { value: 'CASA', label: 'Casa' },
        { value: 'ALIMENTACAO', label: 'Alimentação' },
        { value: 'TRANSPORTE', label: 'Transporte' },
        { value: 'SAÚDE', label: 'Saúde' },
        { value: 'OUTROS', label: 'Outros' }
    ],
    'RECEITA': [
        { value: 'FREELANCE', label: 'Freelance' },
        { value: 'VENDA', label: 'Venda' },
        { value: 'INVESTIMENTO', label: 'Investimento' },
        { value: 'OUTRO_RECEITA', label: 'Outro' }
    ],
    'SALARIO': [
        { value: 'SALARIO', label: 'Salário' }
    ]
};

function ajustarFormulario() {
    const tipo = $('#inputTipo').val();
    atualizarCategorias(tipo);
    if (tipo === 'SALARIO') {
        $('#inputDescricao').val('Salário Mensal');
        $('#inputFixo').prop('checked', true);
        $('#inputCategoria').val('SALARIO');
    } else if ($('#inputDescricao').val() === 'Salário Mensal') {
        $('#inputDescricao').val('');
        $('#inputFixo').prop('checked', false);
    }
}
window.ajustarFormulario = ajustarFormulario;

function atualizarCategorias(tipo) {
    const sel = $('#inputCategoria');
    sel.empty().append('<option value="">Selecione uma categoria</option>');
    (categoriasPorTipo[tipo] || []).forEach(c => sel.append(`<option value="${c.value}">${c.label}</option>`));
}

// ===== LANÇAMENTOS =====
function carregarLancamentos() {
    authAjax({
        url: API_URL, method: 'GET',
        success: function(data) { todosLancamentos = data; aplicarFiltros(); },
        error: function() { console.error('Erro ao carregar lançamentos'); }
    });
}

function atualizarTela(lancamentos) {
    const lista = $('#lista-lancamentos');
    lista.empty();
    let saldo = 0;

    if (lancamentos.length === 0) {
        lista.html(`
            <div class="text-center py-12 text-gray-400">
                <i class="bi bi-inbox text-4xl"></i>
                <p class="mt-3 text-sm">Nenhum lançamento encontrado</p>
                <p class="text-xs mt-1">Clique no botão + para adicionar</p>
            </div>
        `);
        $('#saldo-total').text('R$ 0,00');
        return;
    }

    lancamentos.forEach(item => {
        if (item.tipo === 'RECEITA') saldo += item.valor;
        else saldo -= item.valor;

        const isReceita = item.tipo === 'RECEITA';
        const corValor = isReceita ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
        const sinal = isReceita ? '+' : '-';
        const bgIndicator = isReceita ? 'bg-emerald-500' : 'bg-red-500';
        const iconeFixo = item.fixo ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-medium rounded-md"><i class="bi bi-arrow-repeat"></i>Fixo</span>' : '';
        const badgeParcela = (item.parcelaAtual && item.totalParcelas)
            ? `<span class="inline-flex items-center px-1.5 py-0.5 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-medium rounded-md">${item.parcelaAtual}/${item.totalParcelas}</span>` : '';
        const dataFormatada = formatarDataLocal(item.data);
        const isChecked = selecionados.has(item.id);
        const selectedClass = isChecked ? 'lancamento-card-selected' : '';
        const checkboxHtml = modoSelecao
            ? `<input type="checkbox" class="lancamento-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}>`
            : '';

        const metodosLabels = {
            'CARTAO_CREDITO': { icon: 'bi-credit-card', label: 'Crédito', color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10' },
            'CARTAO_DEBITO': { icon: 'bi-credit-card-2-front', label: 'Débito', color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10' },
            'PIX': { icon: 'bi-lightning-charge', label: 'PIX', color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10' },
            'BOLETO': { icon: 'bi-upc-scan', label: 'Boleto', color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10' },
            'TED': { icon: 'bi-bank', label: 'TED', color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10' },
            'INVESTIMENTO': { icon: 'bi-graph-up-arrow', label: 'Investimento', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' }
        };
        const metodoInfo = item.metodoPagamento ? metodosLabels[item.metodoPagamento] : null;
        const badgeMetodo = metodoInfo
            ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 ${metodoInfo.color} text-[10px] font-medium rounded-md"><i class="bi ${metodoInfo.icon}"></i>${metodoInfo.label}</span>`
            : '';

        lista.append(`
            <div class="swipe-container mb-2" data-lancamento-id="${item.id}">
                <div class="swipe-delete-bg">
                    <i class="bi bi-trash text-xl mr-2"></i> Apagar
                </div>
                <div class="swipe-content">
                    <div class="lancamento-card group bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800 transition-all ${selectedClass}" data-id="${item.id}">
                        <div class="flex items-center gap-3">
                            ${checkboxHtml}
                            <div class="w-1 h-10 ${bgIndicator} rounded-full flex-shrink-0"></div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="font-semibold text-sm truncate">${sanitizeHTML(item.descricao)}</span>
                                    ${iconeFixo} ${badgeParcela} ${badgeMetodo}
                                </div>
                                <span class="text-xs text-gray-400 dark:text-gray-500">${dataFormatada}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-sm ${corValor} whitespace-nowrap">
                                    ${sinal} ${formatarMoeda(item.valor)}
                                </span>
                                <div class="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${modoSelecao ? '!hidden' : ''}">
                                    <button onclick="abrirModalCompartilhar(${item.id})" class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-brand-500 transition-colors" title="Compartilhar">
                                        <i class="bi bi-share text-sm"></i>
                                    </button>
                                    <button onclick="editarLancamento(${item.id})" class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-500 transition-colors" title="Editar">
                                        <i class="bi bi-pencil text-sm"></i>
                                    </button>
                                    <button onclick="deletarLancamento(${item.id})" class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-colors" title="Apagar">
                                        <i class="bi bi-trash text-sm"></i>
                                    </button>
                                </div>
                                <!-- Mobile: menu dropdown -->
                                <div class="sm:hidden relative ${modoSelecao ? '!hidden' : ''}" id="mobileMenu${item.id}">
                                    <button onclick="toggleDropdown('mobileDropdown${item.id}')" class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                                        <i class="bi bi-three-dots-vertical text-sm"></i>
                                    </button>
                                    <div id="mobileDropdown${item.id}" class="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 hidden py-1 z-50">
                                        <a href="#" onclick="abrirModalCompartilhar(${item.id}); return false;" class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50"><i class="bi bi-share"></i> Compartilhar</a>
                                        <a href="#" onclick="editarLancamento(${item.id}); return false;" class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50"><i class="bi bi-pencil"></i> Editar</a>
                                        <a href="#" onclick="deletarLancamento(${item.id}); return false;" class="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><i class="bi bi-trash"></i> Apagar</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);
    });

    // Inicializa swipe-to-delete em todos os cards
    initSwipeToDelete();

    // Inicializa handlers de checkbox
    if (modoSelecao) initCheckboxHandlers();

    // Atualiza gráfico de métodos de pagamento
    renderizarGraficoMetodosPagamento(lancamentos);

    $('#saldo-total').text(formatarMoeda(saldo));
    if (saldo < 0) {
        $('#saldo-total').removeClass('text-white').addClass('text-amber-300');
    } else {
        $('#saldo-total').removeClass('text-amber-300');
    }
}

function salvarLancamento() {
    let tipoSelecionado = $('#inputTipo').val();
    const categoriaOriginal = $('#inputCategoria').val();
    if (tipoSelecionado === 'SALARIO') tipoSelecionado = 'RECEITA';

    const lancamento = {
        descricao: $('#inputDescricao').val(),
        valor: getValorNumerico(),
        tipo: tipoSelecionado,
        categoria: categoriaOriginal,
        fixo: $('#inputFixo').is(':checked'),
        data: $('#inputData').val(),
        metodoPagamento: $('#inputMetodoPagamento').val() || null
    };

    const id = $('#inputId').val();
    let metodo = 'POST';
    let url = API_URL;
    if (id) { metodo = 'PUT'; url = API_URL + '/' + id; }

    if (!lancamento.descricao || !lancamento.valor || !lancamento.categoria || !lancamento.data) {
        mostrarAlerta('Campos Obrigatórios', 'Preencha todos os campos obrigatórios!');
        return;
    }

    authAjax({
        url, method: metodo,
        contentType: 'application/json',
        data: JSON.stringify(lancamento),
        success: function() {
            fecharModal('modalLancamento');
            resetFormLancamento();
            carregarLancamentos();
        },
        error: function() {
            mostrarAlerta('Erro', 'Erro ao salvar! Verifique os campos.');
        }
    });
}

function resetFormLancamento() {
    $('#form-lancamento')[0].reset();
    $('#inputId').val('');
    $('#inputTipo').val('DESPESA');
    const hoje = new Date().toISOString().split('T')[0];
    $('#inputData').val(hoje);
    ajustarFormulario();
    $('#inputValor').val('');
    $('#inputMetodoPagamento').val('');
}

window.deletarLancamento = function(id) {
    mostrarConfirmacao('Apagar Lançamento', 'Tem certeza que deseja apagar este item?', function() {
        authAjax({
            url: API_URL + '/' + id, method: 'DELETE',
            success: carregarLancamentos,
            error: function() { mostrarAlerta('Erro', 'Erro ao deletar!'); }
        });
    });
};

window.editarLancamento = function(id) {
    authAjax({
        url: API_URL + '/' + id, method: 'GET',
        success: function(item) {
            $('#inputId').val(item.id);
            $('#inputDescricao').val(item.descricao);
            if (item.valor != null) {
                $('#inputValor').val(item.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
            }
            $('#inputFixo').prop('checked', item.fixo);
            if (item.data) {
                $('#inputData').val(item.data);
            }
            if (item.tipo === 'RECEITA' && item.categoria === 'SALARIO') {
                $('#inputTipo').val('SALARIO');
            } else {
                $('#inputTipo').val(item.tipo);
            }
            ajustarFormulario();
            if (item.categoria) $('#inputCategoria').val(item.categoria);
            $('#inputMetodoPagamento').val(item.metodoPagamento || '');
            abrirModal('modalLancamento');
        }
    });
};

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Formata data ISO "2026-02-13" para "13/02/2026" sem problema de timezone
function formatarDataLocal(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
    return dateStr;
}

// Parseia data ISO para Date local (sem problema de timezone UTC)
function parseDataLocal(dateStr) {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return new Date(dateStr);
}

// ===== FILTROS =====
function preencherFiltroCategorias() {
    const tipo = $('#filtroTipo').val();
    const sel = $('#filtroCategoria');
    sel.empty().append('<option value="">Todas</option>');
    let cats = [];
    if (tipo === 'DESPESA') cats = categoriasPorTipo['DESPESA'];
    else if (tipo === 'RECEITA') cats = [...categoriasPorTipo['RECEITA'], ...categoriasPorTipo['SALARIO']];
    else cats = [...categoriasPorTipo['DESPESA'], ...categoriasPorTipo['RECEITA'], ...categoriasPorTipo['SALARIO']];
    cats.forEach(c => sel.append(`<option value="${c.value}">${c.label}</option>`));
}

function aplicarFiltros() {
    const tipo = $('#filtroTipo').val();
    const cat = $('#filtroCategoria').val();
    const di = $('#filtroDataInicio').val();
    const df = $('#filtroDataFim').val();

    lancamentosFiltrados = todosLancamentos.filter(item => {
        if (tipo && item.tipo !== tipo) return false;
        if (cat && item.categoria !== cat) return false;
        if (di && item.data < di) return false;
        if (df && item.data > df) return false;
        return true;
    });
    aplicarOrdenacao();
}

function limparFiltros() {
    $('#filtroTipo, #filtroCategoria, #filtroDataInicio, #filtroDataFim').val('');
    preencherFiltroCategorias();
    // Desativar ciclo fatura se ativo
    if ($('#btnCicloFatura').hasClass('bg-amber-100')) {
        $('#btnCicloFatura').removeClass('bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-600')
            .addClass('text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700');
        $('#cicloFaturaConfig').addClass('hidden');
    }
    inicializarFiltroData();
    lancamentosFiltrados = todosLancamentos;
    aplicarFiltros();
}

// ===== CICLO DE FATURA (CARTÃO DE CRÉDITO) =====
let cicloFaturaAtivo = false;

function toggleCicloFatura() {
    cicloFaturaAtivo = !cicloFaturaAtivo;
    const btn = $('#btnCicloFatura');
    const config = $('#cicloFaturaConfig');

    if (cicloFaturaAtivo) {
        btn.removeClass('text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700')
           .addClass('bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-600');
        config.removeClass('hidden');
        aplicarCicloFatura();
    } else {
        btn.removeClass('bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-600')
           .addClass('text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700');
        config.addClass('hidden');
        inicializarFiltroData();
        aplicarFiltros();
    }
}

/**
 * Calcula o período do ciclo de fatura atual.
 * Ex: Fechamento dia 2 → ciclo vai de dia 3 do mês anterior até dia 2 do mês atual.
 * Se hoje está antes do fechamento, mostra o ciclo anterior.
 */
function aplicarCicloFatura() {
    const diaFechamento = parseInt($('#diaFechamento').val()) || 2;
    const hoje = new Date();
    let mesRef = hoje.getMonth();
    let anoRef = hoje.getFullYear();

    // Se hoje é antes ou no dia de fechamento, o ciclo atual ainda não fechou → mostra ciclo que fechou
    if (hoje.getDate() <= diaFechamento) {
        // Ciclo que FECHOU mais recentemente: do mês retrasado+1 ao mês passado
        mesRef = mesRef; // o ciclo "corrente fechado" = fecha neste mês
    } else {
        // Ciclo que fechará no próximo mês
        mesRef = mesRef + 1;
    }

    // Início do ciclo: dia (fechamento+1) do mês anterior ao fechamento
    const inicioDate = new Date(anoRef, mesRef - 1, diaFechamento + 1);
    // Fim do ciclo: dia fechamento do mês de referência
    const fimDate = new Date(anoRef, mesRef, diaFechamento);

    const inicioStr = inicioDate.toISOString().split('T')[0];
    const fimStr = fimDate.toISOString().split('T')[0];

    $('#filtroDataInicio').val(inicioStr);
    $('#filtroDataFim').val(fimStr);

    aplicarFiltros();
}

// Reatualizar quando mudam os dias de fechamento/vencimento
$(document).on('change', '#diaFechamento, #diaVencimento', function() {
    if (cicloFaturaAtivo) aplicarCicloFatura();
});

function inicializarFiltroData() {
    const hoje = new Date();
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    $('#filtroDataInicio').val(primeiro.toISOString().split('T')[0]);
    $('#filtroDataFim').val(ultimo.toISOString().split('T')[0]);
}

function aplicarOrdenacao() {
    lancamentosFiltrados.sort((a, b) => {
        let diff;
        if (ordenacaoAtual === 'data') diff = (b.data || '').localeCompare(a.data || '');
        else diff = b.valor - a.valor;
        return ordenacaoCrescente ? -diff : diff;
    });
    atualizarTela(lancamentosFiltrados);
}

function atualizarBotoesOrdenacao() {
    const icone = ordenacaoCrescente ? 'bi-arrow-up' : 'bi-arrow-down';
    if (ordenacaoAtual === 'data') {
        $('#btnOrdenarData').addClass('bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400')
            .html(`<i class="bi bi-calendar mr-1"></i>Data <i class="bi ${icone}"></i>`);
        $('#btnOrdenarValor').removeClass('bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400')
            .addClass('text-gray-500 dark:text-gray-400')
            .html('<i class="bi bi-currency-dollar mr-1"></i>Valor');
    } else {
        $('#btnOrdenarValor').addClass('bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400')
            .html(`<i class="bi bi-currency-dollar mr-1"></i>Valor <i class="bi ${icone}"></i>`);
        $('#btnOrdenarData').removeClass('bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400')
            .addClass('text-gray-500 dark:text-gray-400')
            .html('<i class="bi bi-calendar mr-1"></i>Data');
    }
}

// ===== IMPORTAÇÃO COM PREVIEW =====
let previewData = [];
let previewArquivo = null;
let previewTipoImportacao = 'CARTAO';

function fecharModalImportacao() {
    fecharModal('modalImportacao');
    resetImportacao();
}
window.fecharModalImportacao = fecharModalImportacao;

function resetImportacao() {
    previewData = [];
    previewArquivo = null;
    $('#importEtapa1').removeClass('hidden');
    $('#importEtapa2').addClass('hidden');
    $('#btnPreviewImport').removeClass('hidden');
    $('#btnConfirmarImport, #btnVoltarImport').addClass('hidden');
    $('#progressoImportacao').addClass('hidden');
    $('#btnPreviewImport').prop('disabled', false);
    $('#arquivoImportacao').val('');
    $('#previewTabelaBody').empty();
}

function voltarEtapaImport() {
    $('#importEtapa2').addClass('hidden');
    $('#importEtapa1').removeClass('hidden');
    $('#btnPreviewImport').removeClass('hidden');
    $('#btnConfirmarImport, #btnVoltarImport').addClass('hidden');
}
window.voltarEtapaImport = voltarEtapaImport;

function carregarPreview() {
    const arquivo = $('#arquivoImportacao')[0].files[0];
    if (!arquivo) { mostrarAlerta('Arquivo Necessário', 'Selecione um arquivo!'); return; }
    previewTipoImportacao = $('input[name="tipoImportacao"]:checked').val() || 'CARTAO';

    const formData = new FormData();
    formData.append('arquivo', arquivo);
    formData.append('tipoImportacao', previewTipoImportacao);
    previewArquivo = arquivo;

    $('#progressoImportacao').removeClass('hidden');
    $('#btnPreviewImport').prop('disabled', true);

    $.ajax({
        url: '/api/importacao/preview', method: 'POST',
        headers: authHeaders(), data: formData, processData: false, contentType: false,
        success: function(data) {
            $('#progressoImportacao').addClass('hidden');
            $('#btnPreviewImport').prop('disabled', false);
            previewData = data;
            renderizarPreview(data);
            // Mostra etapa 2
            $('#importEtapa1').addClass('hidden');
            $('#importEtapa2').removeClass('hidden');
            $('#btnPreviewImport').addClass('hidden');
            $('#btnConfirmarImport, #btnVoltarImport').removeClass('hidden');
        },
        error: function(xhr) {
            $('#progressoImportacao').addClass('hidden');
            $('#btnPreviewImport').prop('disabled', false);
            mostrarAlerta('Erro', xhr.responseJSON?.erro || 'Erro ao processar arquivo.');
        }
    });
}
window.carregarPreview = carregarPreview;

function renderizarPreview(items) {
    const tbody = $('#previewTabelaBody');
    tbody.empty();

    let duplicatas = 0;
    items.forEach((item, i) => {
        if (item.duplicata) duplicatas++;

        const isReceita = item.tipo === 'RECEITA';
        const corValor = isReceita ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
        const sinal = isReceita ? '+' : '-';
        const tipoLabel = isReceita ? 'Receita' : 'Despesa';
        const tipoCor = isReceita
            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400';
        const dataFormatada = item.data ? formatarDataLocal(item.data) : '-';
        const parcelaInfo = (item.parcelaAtual && item.totalParcelas)
            ? `<span class="inline-flex items-center px-1.5 py-0.5 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-medium rounded-md">${item.parcelaAtual}/${item.totalParcelas}</span>`
            : '';

        let statusHtml;
        if (item.duplicata) {
            statusHtml = '<span class="inline-flex items-center px-1.5 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-medium rounded-md"><i class="bi bi-exclamation-triangle mr-1"></i>Duplicata</span>';
        } else {
            statusHtml = '<span class="inline-flex items-center px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium rounded-md"><i class="bi bi-check-circle mr-1"></i>Novo</span>';
        }

        const rowClass = item.duplicata ? 'opacity-50' : '';
        const checked = item.duplicata ? '' : 'checked';

        tbody.append(`
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${rowClass}" data-index="${item.index}">
                <td class="px-3 py-2.5"><input type="checkbox" class="preview-check accent-brand-600" data-index="${item.index}" ${checked} onchange="atualizarResumoPreview()"></td>
                <td class="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">${dataFormatada}</td>
                <td class="px-3 py-2.5 font-medium text-sm truncate max-w-[250px]" title="${sanitizeHTML(item.descricao || '')}">${sanitizeHTML(item.descricao) || '-'}</td>
                <td class="px-3 py-2.5 text-right font-semibold text-sm ${corValor} whitespace-nowrap">${sinal} ${formatarMoeda(item.valor)}</td>
                <td class="px-3 py-2.5 text-center"><span class="inline-flex items-center px-1.5 py-0.5 ${tipoCor} text-[10px] font-medium rounded-md">${tipoLabel}</span></td>
                <td class="px-3 py-2.5 text-center">${parcelaInfo}</td>
                <td class="px-3 py-2.5 text-center">${statusHtml}</td>
            </tr>
        `);
    });

    // Atualiza contadores
    $('#previewContador').text(items.length);
    if (duplicatas > 0) {
        $('#previewDuplicatas').removeClass('hidden');
        $('#previewDuplicatasCount').text(duplicatas);
    } else {
        $('#previewDuplicatas').addClass('hidden');
    }

    atualizarResumoPreview();
}

function atualizarResumoPreview() {
    const checkboxes = $('.preview-check');
    let selecionados = 0, receitas = 0, despesas = 0;
    checkboxes.each(function() {
        if ($(this).is(':checked')) {
            const idx = parseInt($(this).data('index'));
            const item = previewData.find(i => i.index === idx);
            if (item) {
                selecionados++;
                if (item.tipo === 'RECEITA') receitas += item.valor;
                else despesas += item.valor;
            }
        }
    });
    $('#previewSelecionadosCount').text(selecionados);
    $('#previewTotalReceitas').text(formatarMoeda(receitas));
    $('#previewTotalDespesas').text(formatarMoeda(despesas));

    // Atualiza checkbox "todos"
    const todos = checkboxes.length;
    const marcados = checkboxes.filter(':checked').length;
    $('#previewCheckAll').prop('checked', marcados === todos).prop('indeterminate', marcados > 0 && marcados < todos);
}
window.atualizarResumoPreview = atualizarResumoPreview;

function previewToggleTodos(checked) {
    $('.preview-check').prop('checked', checked);
    atualizarResumoPreview();
}
window.previewToggleTodos = previewToggleTodos;

function previewSelecionarTodos() {
    $('.preview-check').prop('checked', true);
    atualizarResumoPreview();
}
window.previewSelecionarTodos = previewSelecionarTodos;

function previewDesmarcarTodos() {
    $('.preview-check').prop('checked', false);
    atualizarResumoPreview();
}
window.previewDesmarcarTodos = previewDesmarcarTodos;

function previewInverterSelecao() {
    $('.preview-check').each(function() { $(this).prop('checked', !$(this).is(':checked')); });
    atualizarResumoPreview();
}
window.previewInverterSelecao = previewInverterSelecao;

function confirmarImportacao() {
    const selecionados = [];
    $('.preview-check:checked').each(function() {
        selecionados.push($(this).data('index'));
    });

    if (selecionados.length === 0) {
        mostrarAlerta('Nenhum Selecionado', 'Selecione pelo menos um lançamento para importar.');
        return;
    }

    const formData = new FormData();
    formData.append('arquivo', previewArquivo);
    formData.append('tipoImportacao', previewTipoImportacao);
    formData.append('indices', selecionados.join(','));

    $('#btnConfirmarImport').prop('disabled', true).html('<i class="bi bi-hourglass-split mr-1 animate-spin"></i> Importando...');

    $.ajax({
        url: '/api/importacao/upload', method: 'POST',
        headers: authHeaders(), data: formData, processData: false, contentType: false,
        success: function(response) {
            $('#btnConfirmarImport').prop('disabled', false).html('<i class="bi bi-check-lg mr-1"></i> Importar Selecionados');
            fecharModalImportacao();
            let msg = `${response.totalComParcelas} lançamentos importados.`;
            if (response.duplicatas > 0) msg += ` ${response.duplicatas} duplicata(s) ignorada(s).`;
            mostrarAlerta('Importação Concluída', msg);
            carregarLancamentos();
        },
        error: function(xhr) {
            $('#btnConfirmarImport').prop('disabled', false).html('<i class="bi bi-check-lg mr-1"></i> Importar Selecionados');
            mostrarAlerta('Erro na Importação', xhr.responseJSON?.erro || 'Erro ao importar arquivo.');
        }
    });
}
window.confirmarImportacao = confirmarImportacao;

// ===== EXPORTAÇÃO =====
function exportarRelatorio(formato) {
    const di = $('#filtroDataInicio').val();
    const df = $('#filtroDataFim').val();
    let url = `/api/exportacao/${formato}?`;
    if (di) url += `dataInicio=${di}&`;
    if (df) url += `dataFim=${df}&`;

    fetch(url, { headers: authHeaders() })
        .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
        .then(blob => {
            const ext = formato === 'excel' ? 'xlsx' : 'csv';
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `lancamentos.${ext}`;
            a.click();
            URL.revokeObjectURL(a.href);
        })
        .catch(() => mostrarAlerta('Erro', 'Erro ao exportar relatório'));
}

function enviarRelatorioPorEmail() {
    const di = $('#filtroDataInicio').val();
    const df = $('#filtroDataFim').val();
    let url = '/api/exportacao/enviar-email?';
    if (di) url += `dataInicio=${di}&`;
    if (df) url += `dataFim=${df}&`;

    authAjax({
        url: url, method: 'POST',
        success: function(data) {
            mostrarAlerta('Sucesso', data.mensagem || 'Relatório enviado por e-mail!');
        },
        error: function(xhr) {
            const erro = xhr.responseJSON?.erro || 'Erro ao enviar relatório por e-mail.';
            mostrarAlerta('Erro', erro);
        }
    });
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

            // Marca o radio do tema salvo
            const temaSalvo = data.tema || 'auto';
            $(`input[name="temaPerfil"][value="${temaSalvo}"]`).prop('checked', true);
        }
    });
}

function salvarPerfil() {
    const formData = new FormData();
    formData.append('nome', $('#inputNomePerfil').val());
    formData.append('email', $('#inputEmailPerfil').val());

    const fotoInput = document.getElementById('inputFotoArquivo');
    if (fotoInput && fotoInput.files.length > 0) {
        formData.append('foto', fotoInput.files[0]);
    }

    $.ajax({
        url: '/api/auth/perfil',
        method: 'PUT',
        headers: authHeaders(),
        data: formData,
        processData: false,
        contentType: false,
        success: function() {
            fecharModal('modalPerfil');
            carregarPerfil();
            mostrarAlerta('Sucesso', 'Perfil atualizado!');
        },
        error: function(xhr) {
            if (xhr.status === 401 || xhr.status === 403) {
                const refreshToken = localStorage.getItem('refreshToken');
                if (refreshToken) {
                    $.ajax({
                        url: '/api/auth/refresh', method: 'POST',
                        contentType: 'application/json',
                        data: JSON.stringify({ refreshToken }),
                        success: function(data) {
                            localStorage.setItem('token', data.token);
                            localStorage.setItem('refreshToken', data.refreshToken);
                            salvarPerfil();
                        },
                        error: function() { localStorage.clear(); window.location.href = 'login.html'; }
                    });
                    return;
                }
                localStorage.clear(); window.location.href = 'login.html';
                return;
            }
            const erro = xhr.responseJSON?.erro || 'Erro ao atualizar perfil';
            mostrarAlerta('Erro', erro);
        }
    });
}

function salvarSenha() {
    const senhaAtual = $('#inputSenhaAtual').val();
    const novaSenha = $('#inputNovaSenha').val();
    const confirmar = $('#inputConfirmarSenha').val();

    if (!senhaAtual || !novaSenha || !confirmar) {
        mostrarAlerta('Atenção', 'Preencha todos os campos de senha.');
        return;
    }
    if (novaSenha.length < 6) {
        mostrarAlerta('Atenção', 'A nova senha deve ter no mínimo 6 caracteres.');
        return;
    }
    if (novaSenha !== confirmar) {
        mostrarAlerta('Atenção', 'A nova senha e a confirmação não conferem.');
        return;
    }

    authAjax({
        url: '/api/auth/alterar-senha', method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({ senhaAtual, novaSenha }),
        success: function() {
            $('#inputSenhaAtual').val('');
            $('#inputNovaSenha').val('');
            $('#inputConfirmarSenha').val('');
            mostrarAlerta('Sucesso', 'Senha alterada com sucesso!');
        },
        error: function(xhr) {
            const erro = xhr.responseJSON?.erro || 'Erro ao alterar senha';
            mostrarAlerta('Erro', erro);
        }
    });
}

function salvarPreferencias() {
    const tema = $('input[name="temaPerfil"]:checked').val() || 'auto';

    const formData = new FormData();
    formData.append('tema', tema);

    $.ajax({
        url: '/api/auth/perfil',
        method: 'PUT',
        headers: authHeaders(),
        data: formData,
        processData: false,
        contentType: false,
        success: function() {
            // Aplica tema imediatamente
            if (tema === 'auto') {
                localStorage.removeItem('themeManual');
                const t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
                localStorage.setItem('theme', t);
                applyTheme(t);
            } else {
                localStorage.setItem('theme', tema);
                localStorage.setItem('themeManual', 'true');
                applyTheme(tema);
            }
            mostrarAlerta('Sucesso', 'Preferências salvas!');
        },
        error: function(xhr) {
            const erro = xhr.responseJSON?.erro || 'Erro ao salvar preferências';
            mostrarAlerta('Erro', erro);
        }
    });
}

// ===== PERFIL: HELPERS =====
function trocarAbaPerfil(aba) {
    // Esconde todos os painéis
    document.querySelectorAll('.aba-perfil-painel').forEach(p => p.classList.add('hidden'));
    // Remove estilo ativo de todas as tabs
    document.querySelectorAll('.tab-perfil-btn').forEach(t => {
        t.classList.remove('border-brand-500', 'text-brand-600', 'dark:text-brand-400');
        t.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
    });

    // Mostra o painel selecionado
    const painelId = 'painel' + aba.charAt(0).toUpperCase() + aba.slice(1);
    const tabId = 'tab' + aba.charAt(0).toUpperCase() + aba.slice(1);
    const painel = document.getElementById(painelId);
    const tab = document.getElementById(tabId);
    if (painel) painel.classList.remove('hidden');
    if (tab) {
        tab.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
        tab.classList.add('border-brand-500', 'text-brand-600', 'dark:text-brand-400');
    }
}
window.trocarAbaPerfil = trocarAbaPerfil;

function previewFotoSelecionada(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            $('#previewFotoPerfil').attr('src', e.target.result);
        };
        reader.readAsDataURL(input.files[0]);
    }
}
window.previewFotoSelecionada = previewFotoSelecionada;

function toggleSenhaVisivel(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
    }
}
window.toggleSenhaVisivel = toggleSenhaVisivel;

// ===== COMPARTILHAMENTO =====
function abrirModalCompartilhar(lancamentoId) {
    $('#lancamentoCompartilharId').val(lancamentoId);
    $('#inputDescricaoCompartilhamento').val('');
    carregarListaUsuariosCompartilhamento();
    abrirModal('modalCompartilhar');
}
window.abrirModalCompartilhar = abrirModalCompartilhar;

function carregarListaUsuariosCompartilhamento() {
    const sel = $('#selectUsuarioCompartilhamento');
    sel.html('<option value="">Carregando...</option>');
    authAjax({
        url: '/api/amigos', method: 'GET',
        success: function(amigos) {
            sel.empty();
            if (amigos.length === 0) {
                sel.append('<option value="">Nenhum amigo adicionado</option>');
            } else {
                sel.append('<option value="">Selecione um amigo...</option>');
                amigos.forEach(u => {
                    sel.append(`<option value="${u.id}">${sanitizeHTML(u.nome || u.username)} (@${sanitizeHTML(u.username)})</option>`);
                });
            }
        },
        error: function() { sel.html('<option value="">Erro ao carregar amigos</option>'); }
    });
}

function enviarCompartilhamento() {
    const lid = $('#lancamentoCompartilharId').val();
    const desc = $('#inputDescricaoCompartilhamento').val();
    const tipo = $('#selectTipoCompartilhamento').val();
    const uid = $('#selectUsuarioCompartilhamento').val();
    if (!uid) { mostrarAlerta('Seleção', 'Selecione um usuário'); return; }
    if (!desc) { mostrarAlerta('Descrição', 'Adicione uma descrição'); return; }

    authAjax({
        url: '/api/compartilhamento', method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ lancamentoId: lid, usuarioDestinoId: uid, descricao: desc, tipo }),
        success: function() { fecharModal('modalCompartilhar'); mostrarAlerta('Sucesso', 'Gasto compartilhado!'); },
        error: function() { mostrarAlerta('Erro', 'Erro ao compartilhar'); }
    });
}

function carregarNotificacoesPendentes() {
    authAjax({
        url: '/api/compartilhamento/pendentes', method: 'GET',
        success: function(pendentes) {
            const badge = $('#badgeNotificacoes');
            if (pendentes.length > 0) { badge.text(pendentes.length).removeClass('hidden'); }
            else { badge.addClass('hidden'); }

            const container = $('#listaNotificacoes');
            if (!container.length) return;
            container.empty();

            if (pendentes.length === 0) {
                container.html('<p class="text-center text-gray-400 py-6"><i class="bi bi-bell-slash text-2xl block mb-2"></i>Nenhum compartilhamento pendente</p>');
                return;
            }

            const tipoLabels = { 'DIVISAO': 'Dividir custo', 'EMPRESTIMO': 'Empréstimo', 'REEMBOLSO': 'Reembolso', 'INFORMATIVO': 'Informativo' };

            pendentes.forEach(item => {
                const l = item.lancamento;
                container.append(`
                    <div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-3">
                        <div class="flex justify-between items-start">
                            <div>
                                <h4 class="font-semibold text-sm">${l.descricao}</h4>
                                <p class="text-sm mt-1"><strong>Valor:</strong> ${formatarMoeda(l.valor)}</p>
                                <span class="inline-block px-2 py-0.5 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 text-xs font-medium rounded-md mt-1">${tipoLabels[item.tipo]}</span>
                                <p class="text-xs text-gray-400 mt-2">${item.descricao}</p>
                            </div>
                        </div>
                        <div class="flex gap-2 mt-3">
                            <button class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors" onclick="aceitarCompartilhamento(${item.id})">
                                <i class="bi bi-check-circle mr-1"></i>Aceitar
                            </button>
                            <button class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors" onclick="recusarCompartilhamento(${item.id})">
                                <i class="bi bi-x-circle mr-1"></i>Recusar
                            </button>
                        </div>
                    </div>
                `);
            });
        }
    });
}

window.aceitarCompartilhamento = function(id) {
    authAjax({
        url: `/api/compartilhamento/${id}/aceitar`, method: 'PUT',
        contentType: 'application/json', data: JSON.stringify({}),
        success: function() { mostrarAlerta('Sucesso', 'Compartilhamento aceito!'); carregarNotificacoesPendentes(); carregarLancamentos(); },
        error: function() { mostrarAlerta('Erro', 'Erro ao aceitar'); }
    });
};

window.recusarCompartilhamento = function(id) {
    authAjax({
        url: `/api/compartilhamento/${id}/recusar`, method: 'PUT',
        success: function() { mostrarAlerta('Recusado', 'Compartilhamento recusado'); carregarNotificacoesPendentes(); },
        error: function() { mostrarAlerta('Erro', 'Erro ao recusar'); }
    });
};

// ===== ORÇAMENTO, METAS, TAGS =====
function salvarOrcamento() {
    const cat = $('#inputOrcamentoCategoria').val();
    const lim = $('#inputOrcamentoLimite').val();
    if (!cat || !lim) { mostrarAlerta('Campos Obrigatórios', 'Preencha categoria e limite!'); return; }
    authAjax({
        url: '/api/orcamentos', method: 'POST',
        contentType: 'application/json', data: JSON.stringify({ categoria: cat, limite: lim }),
        success: function() { fecharModal('modalOrcamento'); mostrarAlerta('Sucesso', 'Orçamento salvo!'); },
        error: function() { mostrarAlerta('Erro', 'Erro ao salvar orçamento'); }
    });
}

function salvarMeta() {
    const nome = $('#inputMetaNome').val();
    const valor = $('#inputMetaValor').val();
    const data = $('#inputMetaData').val();
    if (!nome || !valor) { mostrarAlerta('Campos Obrigatórios', 'Preencha nome e valor!'); return; }
    authAjax({
        url: '/api/metas', method: 'POST',
        contentType: 'application/json', data: JSON.stringify({ nome, valorObjetivo: valor, dataLimite: data || null }),
        success: function() { fecharModal('modalMeta'); mostrarAlerta('Sucesso', 'Meta criada!'); },
        error: function() { mostrarAlerta('Erro', 'Erro ao criar meta'); }
    });
}

function criarTag() {
    const nome = $('#inputTagNome').val();
    if (!nome) { mostrarAlerta('Campo Obrigatório', 'Digite um nome para a tag!'); return; }
    authAjax({
        url: '/api/tags', method: 'POST',
        contentType: 'application/json', data: JSON.stringify({ nome }),
        success: function(r) { $('#inputTagNome').val(''); mostrarAlerta('Sucesso', `Tag #${r.nome} criada!`); },
        error: function() { mostrarAlerta('Erro', 'Erro ao criar tag'); }
    });
}

// ===== MODAIS PERSONALIZADOS =====
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

// ===== MULTI-SELECT =====
function ativarModoSelecao() {
    modoSelecao = true;
    selecionados.clear();
    $('#barraSelecao').removeClass('hidden');
    $('#btnMultiSelect').addClass('bg-brand-100 dark:bg-brand-900 text-brand-600');
    atualizarContadorSelecao();
    carregarLancamentos();
}

function desativarModoSelecao() {
    modoSelecao = false;
    selecionados.clear();
    $('#barraSelecao').addClass('hidden');
    $('#btnMultiSelect').removeClass('bg-brand-100 dark:bg-brand-900 text-brand-600');
    $('#checkboxTodos').prop('checked', false);
    carregarLancamentos();
}

function toggleSelecionarTodos() {
    const checked = $('#checkboxTodos').is(':checked');
    if (checked) {
        $('.lancamento-checkbox').each(function() {
            const id = parseInt($(this).data('id'));
            selecionados.add(id);
            $(this).prop('checked', true);
            $(this).closest('.lancamento-card').addClass('lancamento-card-selected');
        });
    } else {
        selecionados.clear();
        $('.lancamento-checkbox').prop('checked', false);
        $('.lancamento-card').removeClass('lancamento-card-selected');
    }
    atualizarContadorSelecao();
}

function initCheckboxHandlers() {
    $('.lancamento-checkbox').off('change').on('change', function(e) {
        e.stopPropagation();
        const id = parseInt($(this).data('id'));
        if ($(this).is(':checked')) {
            selecionados.add(id);
            $(this).closest('.lancamento-card').addClass('lancamento-card-selected');
        } else {
            selecionados.delete(id);
            $(this).closest('.lancamento-card').removeClass('lancamento-card-selected');
        }
        atualizarContadorSelecao();
    });

    // Clique no card inteiro para selecionar/desselecionar no modo seleção
    $('.lancamento-card').off('click.selecao').on('click.selecao', function(e) {
        if (!modoSelecao) return;
        if ($(e.target).is('button, a, i, input')) return;
        const checkbox = $(this).find('.lancamento-checkbox');
        checkbox.prop('checked', !checkbox.prop('checked')).trigger('change');
    });
}

function atualizarContadorSelecao() {
    const count = selecionados.size;
    $('#contadorSelecionados').text(`${count} selecionado(s)`);
    $('#qtdDeletar').text(count);
    $('#qtdEditar').text(count);
    $('#btnDeletarSelecionados').prop('disabled', count === 0);
    $('#btnEditarSelecionados').prop('disabled', count === 0);
    if (count === 0) {
        $('#btnDeletarSelecionados, #btnEditarSelecionados').addClass('opacity-50 cursor-not-allowed');
    } else {
        $('#btnDeletarSelecionados, #btnEditarSelecionados').removeClass('opacity-50 cursor-not-allowed');
    }
}

function deletarSelecionados() {
    if (selecionados.size === 0) return;
    mostrarConfirmacao(
        'Apagar Selecionados',
        `Deseja apagar ${selecionados.size} lançamento(s)? Essa ação não pode ser desfeita.`,
        function() {
            authAjax({
                url: '/api/lancamentos/bulk',
                method: 'DELETE',
                contentType: 'application/json',
                data: JSON.stringify({ ids: Array.from(selecionados) }),
                success: function(response) {
                    mostrarAlerta('Sucesso', `${response.deletados} lançamento(s) apagado(s)!`);
                    desativarModoSelecao();
                },
                error: function() {
                    mostrarAlerta('Erro', 'Erro ao apagar lançamentos selecionados');
                }
            });
        }
    );
}

function editarSelecionados() {
    if (selecionados.size === 0) return;
    $('#qtdEditarModal').text(selecionados.size);
    $('#inputMetodoLote').val('');
    abrirModal('modalEditarMetodo');
}

function confirmarEditarMetodoLote() {
    const metodo = $('#inputMetodoLote').val();
    if (!metodo) {
        mostrarAlerta('Campo Obrigatório', 'Selecione um método de pagamento!');
        return;
    }
    authAjax({
        url: '/api/lancamentos/bulk',
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({ ids: Array.from(selecionados), metodoPagamento: metodo }),
        success: function(response) {
            fecharModal('modalEditarMetodo');
            mostrarAlerta('Sucesso', `${response.atualizados} lançamento(s) atualizado(s)!`);
            desativarModoSelecao();
        },
        error: function() {
            mostrarAlerta('Erro', 'Erro ao atualizar lançamentos');
        }
    });
}

// ===== SWIPE-TO-DELETE =====
function initSwipeToDelete() {
    if (modoSelecao) return; // Desativar swipe no modo seleção

    const containers = document.querySelectorAll('.swipe-container');
    containers.forEach(container => {
        const content = container.querySelector('.swipe-content');
        let startX = 0, currentX = 0, isDragging = false;
        const THRESHOLD = 100;

        // Touch events
        content.addEventListener('touchstart', function(e) {
            startX = e.touches[0].clientX;
            isDragging = true;
            content.classList.add('swiping');
        }, { passive: true });

        content.addEventListener('touchmove', function(e) {
            if (!isDragging) return;
            currentX = e.touches[0].clientX;
            const diff = currentX - startX;
            if (diff < 0) { // Apenas para esquerda
                content.style.transform = `translateX(${diff}px)`;
            }
        }, { passive: true });

        content.addEventListener('touchend', function() {
            isDragging = false;
            content.classList.remove('swiping');
            const diff = currentX - startX;
            if (diff < -THRESHOLD) {
                swipeDelete(container);
            } else {
                content.style.transform = '';
            }
            startX = 0;
            currentX = 0;
        });

        // Mouse events (desktop)
        content.addEventListener('mousedown', function(e) {
            if (e.target.closest('button, a, input')) return;
            startX = e.clientX;
            isDragging = true;
            content.classList.add('swiping');
            e.preventDefault();
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            currentX = e.clientX;
            const diff = currentX - startX;
            if (diff < 0) {
                content.style.transform = `translateX(${diff}px)`;
            }
        });

        document.addEventListener('mouseup', function() {
            if (!isDragging) return;
            isDragging = false;
            content.classList.remove('swiping');
            const diff = currentX - startX;
            if (diff < -THRESHOLD) {
                swipeDelete(container);
            } else {
                content.style.transform = '';
            }
            startX = 0;
            currentX = 0;
        });
    });
}

function swipeDelete(container) {
    const id = container.dataset.lancamentoId;
    const content = container.querySelector('.swipe-content');
    content.style.transform = 'translateX(-100%)';
    container.classList.add('removing');

    setTimeout(() => {
        authAjax({
            url: `/api/lancamentos/${id}`,
            method: 'DELETE',
            success: function() {
                container.style.height = container.offsetHeight + 'px';
                requestAnimationFrame(() => {
                    container.style.height = '0';
                    container.style.marginBottom = '0';
                    container.style.overflow = 'hidden';
                    container.style.transition = 'height 0.3s ease, margin 0.3s ease';
                    setTimeout(() => {
                        container.remove();
                        carregarLancamentos();
                    }, 300);
                });
            },
            error: function() {
                content.style.transform = '';
                container.classList.remove('removing');
                mostrarAlerta('Erro', 'Erro ao apagar lançamento');
            }
        });
    }, 300);
}

// ===== GRÁFICO: MÉTODOS DE PAGAMENTO (PIZZA) =====
let chartMetodosPagamento = null;

function renderizarGraficoMetodosPagamento(lancamentos) {
    const el = document.getElementById('chartMetodosPagamento');
    if (!el || typeof ApexCharts === 'undefined') return;

    // Destruir gráfico anterior
    if (chartMetodosPagamento) {
        chartMetodosPagamento.destroy();
        chartMetodosPagamento = null;
    }

    // Agrupa valores por método
    const metodoTotais = {};
    const metodoConfig = {
        'CARTAO_CREDITO': { label: 'Cartão de Crédito', color: '#8b5cf6' },
        'CARTAO_DEBITO': { label: 'Cartão de Débito', color: '#06b6d4' },
        'PIX': { label: 'PIX', color: '#14b8a6' },
        'BOLETO': { label: 'Boleto', color: '#f97316' },
        'TED': { label: 'TED', color: '#6366f1' },
        'INVESTIMENTO': { label: 'Investimento', color: '#10b981' }
    };

    lancamentos.forEach(item => {
        if (item.metodoPagamento && item.tipo === 'DESPESA') {
            metodoTotais[item.metodoPagamento] = (metodoTotais[item.metodoPagamento] || 0) + item.valor;
        }
    });

    const metodos = Object.keys(metodoTotais);
    if (metodos.length === 0) {
        el.innerHTML = '<p class="text-center text-gray-400 py-12"><i class="bi bi-pie-chart text-3xl block mb-2"></i>Nenhum método de pagamento registrado nas despesas</p>';
        return;
    }

    const labels = metodos.map(m => metodoConfig[m]?.label || m);
    const dados = metodos.map(m => metodoTotais[m]);
    const cores = metodos.map(m => metodoConfig[m]?.color || '#9ca3af');

    const isDark = document.documentElement.classList.contains('dark');

    const options = {
        series: dados,
        chart: {
            type: 'donut',
            height: 300,
            background: 'transparent',
            fontFamily: 'Inter, system-ui, sans-serif'
        },
        labels: labels,
        colors: cores,
        plotOptions: {
            pie: {
                donut: {
                    size: '60%',
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Total',
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
            labels: { colors: isDark ? '#9ca3af' : '#6b7280' },
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
        stroke: { width: 2, colors: [isDark ? '#111827' : '#ffffff'] },
        theme: { mode: isDark ? 'dark' : 'light' }
    };

    chartMetodosPagamento = new ApexCharts(el, options);
    chartMetodosPagamento.render();
}

// ===== SISTEMA DE AMIGOS =====
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

    // Também carregar pendentes para o badge
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
    // Recebidos
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

    // Enviados
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
            buscarUsuariosAmigo(); // Atualiza resultado
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

// Iniciar busca ao digitar
$(document).on('input', '#inputBuscarAmigo', buscarUsuariosAmigo);
