let todosLancamentos = [];
let lancamentosFiltrados = [];
let usuarioId = null;
let ordenacaoAtual = 'data';
let ordenacaoCrescente = false;

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
    $('#btnImportar').click(importarArquivo);
    $('#btnExportarExcel').click(function() { exportarRelatorio('excel'); });
    $('#btnExportarCSV').click(function() { exportarRelatorio('csv'); });

    $('#btnLogout').click(function(e) {
        e.preventDefault();
        mostrarConfirmacao('Sair', 'Deseja realmente sair?', function() {
            localStorage.clear();
            window.location.href = 'login.html';
        });
    });

    $('#btnSalvarPerfil').click(salvarPerfil);
    $('#inputFotoPerfil').on('input', function() {
        const url = $(this).val();
        if (url) $('#previewFotoPerfil').attr('src', url);
    });

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
        const dataFormatada = new Date(item.data).toLocaleDateString('pt-BR');

        lista.append(`
            <div class="group bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800 transition-all">
                <div class="flex items-center gap-3">
                    <div class="w-1 h-10 ${bgIndicator} rounded-full flex-shrink-0"></div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-semibold text-sm truncate">${item.descricao}</span>
                            ${iconeFixo} ${badgeParcela}
                        </div>
                        <span class="text-xs text-gray-400 dark:text-gray-500">${dataFormatada}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-sm ${corValor} whitespace-nowrap">
                            ${sinal} ${formatarMoeda(item.valor)}
                        </span>
                        <div class="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        <div class="sm:hidden relative" id="mobileMenu${item.id}">
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
        `);
    });

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
        data: $('#inputData').val()
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
                const df = new Date(item.data).toISOString().split('T')[0];
                $('#inputData').val(df);
            }
            if (item.tipo === 'RECEITA' && item.categoria === 'SALARIO') {
                $('#inputTipo').val('SALARIO');
            } else {
                $('#inputTipo').val(item.tipo);
            }
            ajustarFormulario();
            if (item.categoria) $('#inputCategoria').val(item.categoria);
            abrirModal('modalLancamento');
        }
    });
};

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
        if (di && new Date(item.data) < new Date(di)) return false;
        if (df && new Date(item.data) > new Date(df)) return false;
        return true;
    });
    aplicarOrdenacao();
}

function limparFiltros() {
    $('#filtroTipo, #filtroCategoria, #filtroDataInicio, #filtroDataFim').val('');
    preencherFiltroCategorias();
    lancamentosFiltrados = todosLancamentos;
    atualizarTela(lancamentosFiltrados);
}

function inicializarFiltroData() {
    const hoje = new Date();
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoProx = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0);
    $('#filtroDataInicio').val(primeiro.toISOString().split('T')[0]);
    $('#filtroDataFim').val(ultimoProx.toISOString().split('T')[0]);
}

function aplicarOrdenacao() {
    lancamentosFiltrados.sort((a, b) => {
        let diff;
        if (ordenacaoAtual === 'data') diff = new Date(b.data) - new Date(a.data);
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

// ===== IMPORTAÇÃO =====
function importarArquivo() {
    const arquivo = $('#arquivoImportacao')[0].files[0];
    if (!arquivo) { mostrarAlerta('Arquivo Necessário', 'Selecione um arquivo!'); return; }
    const formData = new FormData();
    formData.append('arquivo', arquivo);
    $('#progressoImportacao').removeClass('hidden');
    $('#btnImportar').prop('disabled', true);

    $.ajax({
        url: '/api/importacao/upload', method: 'POST',
        headers: authHeaders(), data: formData, processData: false, contentType: false,
        success: function(response) {
            $('#progressoImportacao').addClass('hidden');
            $('#btnImportar').prop('disabled', false);
            fecharModal('modalImportacao');
            mostrarAlerta('Sucesso', `Importação concluída! ${response.total} lançamentos importados.`);
            carregarLancamentos();
        },
        error: function(xhr) {
            $('#progressoImportacao').addClass('hidden');
            $('#btnImportar').prop('disabled', false);
            mostrarAlerta('Erro na Importação', xhr.responseJSON?.erro || 'Erro ao importar arquivo.');
        }
    });
}

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
            $('#inputFotoPerfil').val(data.fotoPerfil || '');
            $('#previewFotoPerfil').attr('src', foto);
        }
    });
}

function salvarPerfil() {
    authAjax({
        url: '/api/auth/perfil', method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({ nome: $('#inputNomePerfil').val(), fotoPerfil: $('#inputFotoPerfil').val() }),
        success: function() {
            fecharModal('modalPerfil');
            carregarPerfil();
            mostrarAlerta('Sucesso', 'Perfil atualizado!');
        },
        error: function() { mostrarAlerta('Erro', 'Erro ao atualizar perfil'); }
    });
}

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
        url: '/api/auth/listar', method: 'GET',
        success: function(users) {
            sel.empty().append('<option value="">Selecione um usuário...</option>');
            users.forEach(u => {
                if (u.id === parseInt(usuarioId)) return;
                sel.append(`<option value="${u.id}">${u.nome || u.username} (@${u.username})</option>`);
            });
        },
        error: function() { sel.html('<option value="">Erro ao carregar</option>'); }
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
