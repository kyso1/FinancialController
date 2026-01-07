let todosLancamentos = [];
let lancamentosFiltrados = [];
let usuarioId = null;
let ordenacaoAtual = 'data'; // 'data' ou 'valor'
let ordenacaoCrescente = false; // false = decrescente, true = crescente

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

    // Inicializa as categorias com o tipo padrão (DESPESA)
    ajustarFormulario();
    preencherFiltroCategorias();

    // Inicializa filtro de data automático (1 mês)
    inicializarFiltroData();

    carregarLancamentos();

    $('#btn-salvar').click(function() {
        salvarLancamento();
    });

    // Limpa o modal quando ele é fechado (para não ficar dados de edição anterior)
    $('#modalLancamento').on('hidden.bs.modal', function () {
        $('#form-lancamento')[0].reset();
        $('#inputId').val(''); // Limpa o ID
        $('#inputTipo').val('DESPESA');
        // Define a data atual como padrão
        const hoje = new Date().toISOString().split('T')[0];
        $('#inputData').val(hoje);
        ajustarFormulario(); // Reseta visual e categorias
    });

    // Toggle de tema
    $('#themeToggle').click(function() {
        toggleTheme();
    });

    // Filtros
    $('#btnAplicarFiltros').click(function() {
        aplicarFiltros();
    });

    $('#btnLimparFiltros').click(function() {
        limparFiltros();
    });

    $('#filtroTipo').change(function() {
        preencherFiltroCategorias();
    });

    // Importação
    $('#btnImportar').click(function() {
        importarArquivo();
    });

    // Logout
    $('#btnLogout').click(function(e) {
        e.preventDefault();
        mostrarConfirmacao('Sair', 'Deseja realmente sair?', function() {
            localStorage.clear();
            window.location.href = 'login.html';
        });
    });

    // Perfil
    $('#btnSalvarPerfil').click(function() {
        salvarPerfil();
    });

    $('#inputFotoPerfil').on('input', function() {
        const url = $(this).val();
        if (url) {
            $('#previewFotoPerfil').attr('src', url);
        }
    });

    // Compartilhamento
    $('#btnEnviarCompartilhamento').click(function() {
        enviarCompartilhamento();
    });

    // Ordenação
    $('#btnOrdenarData').click(function() {
        if (ordenacaoAtual === 'data') {
            // Toggle crescente/decrescente
            ordenacaoCrescente = !ordenacaoCrescente;
        } else {
            ordenacaoAtual = 'data';
            ordenacaoCrescente = false; // Decrescente por padrão (mais recente primeiro)
        }
        atualizarBotoesOrdenacao();
        aplicarOrdenacao();
    });

    $('#btnOrdenarValor').click(function() {
        if (ordenacaoAtual === 'valor') {
            // Toggle crescente/decrescente
            ordenacaoCrescente = !ordenacaoCrescente;
        } else {
            ordenacaoAtual = 'valor';
            ordenacaoCrescente = false; // Decrescente por padrão (maior valor primeiro)
        }
        atualizarBotoesOrdenacao();
        aplicarOrdenacao();
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

const API_URL = '/api/lancamentos';

// Categorias por tipo
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

// Função para mudar comportamento visual se selecionar SALÁRIO
function ajustarFormulario() {
    const tipo = $('#inputTipo').val();

    // Atualiza as categorias disponíveis
    atualizarCategorias(tipo);

    if (tipo === 'SALARIO') {
        $('#inputDescricao').val('Salário Mensal'); // Preenche auto
        $('#inputFixo').prop('checked', true); // Geralmente salário é fixo
        $('#inputCategoria').val('SALARIO');
    } else if ($('#inputDescricao').val() === 'Salário Mensal') {
        $('#inputDescricao').val(''); // Limpa se mudou de ideia
        $('#inputFixo').prop('checked', false);
    }
}

// Função para atualizar as opções de categoria baseado no tipo
function atualizarCategorias(tipo) {
    const selectCategoria = $('#inputCategoria');
    selectCategoria.empty();
    selectCategoria.append('<option value="">Selecione uma categoria</option>');

    const categorias = categoriasPorTipo[tipo] || [];
    categorias.forEach(cat => {
        selectCategoria.append(`<option value="${cat.value}">${cat.label}</option>`);
    });
}

function carregarLancamentos() {
    $.ajax({
        url: API_URL,
        method: 'GET',
        data: { usuarioId: usuarioId },
        success: function(data) {
            todosLancamentos = data;
            // Aplica filtro automaticamente
            aplicarFiltros();
        },
        error: function(err) {
            console.error("Erro", err);
            if (err.status === 401) {
                localStorage.removeItem('userId');
                window.location.href = 'login.html';
            }
        }
    });
}

function atualizarTela(lancamentos) {
    const lista = $('#lista-lancamentos');
    lista.empty();

    let saldo = 0;

    lancamentos.forEach(item => {
        // Lógica: Salário também é RECEITA para o cálculo
        if (item.tipo === 'RECEITA') {
            saldo += item.valor;
        } else {
            saldo -= item.valor;
        }

        const corValor = item.tipo === 'RECEITA' ? 'text-success' : 'text-danger';
        const sinal = item.tipo === 'RECEITA' ? '+' : '-';
        const iconeFixo = item.fixo ? '<i class="bi bi-arrow-repeat text-primary" title="Fixo"></i>' : '';
        const badgeParcela = (item.parcelaAtual && item.totalParcelas)
            ? `<span class="badge bg-info text-dark ms-1" title="Parcelamento">${item.parcelaAtual}/${item.totalParcelas}</span>`
            : '';
        const dataFormatada = new Date(item.data).toLocaleDateString('pt-BR');

        const htmlItem = `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div class="ms-2 me-auto">
                    <div class="fw-bold">${item.descricao} ${iconeFixo} ${badgeParcela}</div>
                    <small class="text-muted">${dataFormatada}</small>
                </div>
                
                <div class="d-flex align-items-center">
                    <span class="fw-bold ${corValor} me-3">
                        ${sinal} ${formatarMoeda(item.valor)}
                    </span>

                    <button class="btn btn-sm btn-outline-info me-1" onclick="abrirModalCompartilhar(${item.id})" title="Compartilhar">
                        <i class="bi bi-share"></i>
                    </button>

                    <button class="btn btn-sm btn-outline-secondary me-1" onclick="editarLancamento(${item.id})">
                        <i class="bi bi-pencil"></i>
                    </button>

                    <button class="btn btn-sm btn-outline-danger" onclick="deletarLancamento(${item.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `;
        lista.append(htmlItem);
    });

    $('#saldo-total').text(formatarMoeda(saldo));
    
    // Muda a cor do saldo se estiver negativo
    if(saldo < 0) {
        $('#saldo-total').removeClass('text-white').addClass('text-warning');
    } else {
        $('#saldo-total').removeClass('text-warning').addClass('text-white');
    }
}

function salvarLancamento() {
    let tipoSelecionado = $('#inputTipo').val();
    const categoriaOriginal = $('#inputCategoria').val();

    // Se for SALARIO, no backend salvamos como RECEITA
    if (tipoSelecionado === 'SALARIO') {
        tipoSelecionado = 'RECEITA';
    }

    const lancamento = {
        usuarioId: usuarioId,
        descricao: $('#inputDescricao').val(),
        valor: parseFloat($('#inputValor').val()),
        tipo: tipoSelecionado,
        categoria: categoriaOriginal,
        fixo: $('#inputFixo').is(':checked'),
        data: $('#inputData').val()
    };

    const id = $('#inputId').val(); // Verifica se tem ID escondido

    let metodo = 'POST';
    let url = API_URL;

    // Se tem ID, é EDIÇÃO (PUT)
    if (id) {
        metodo = 'PUT';
        url = API_URL + '/' + id;
    }

    if (!lancamento.descricao || !lancamento.valor || !lancamento.categoria || !lancamento.data) {
        mostrarAlerta('Campos Obrigatórios', 'Preencha todos os campos obrigatórios!');
        return;
    }

    $.ajax({
        url: url,
        method: metodo,
        contentType: 'application/json',
        data: JSON.stringify(lancamento),
        success: function() {
            $('#modalLancamento').modal('hide');
            carregarLancamentos();
        },
        error: function(xhr) {
            console.error("Erro ao salvar:", xhr);
            mostrarAlerta('Erro', 'Erro ao salvar! Verifique o console para mais detalhes.');
        }
    });
}

// Chamada globalmente pelos botões da lista
window.deletarLancamento = function(id) {
    mostrarConfirmacao('Apagar Lançamento', 'Tem certeza que deseja apagar este item?', function() {
        $.ajax({
            url: API_URL + '/' + id,
            method: 'DELETE',
            success: function() {
                carregarLancamentos();
            },
            error: function() {
                mostrarAlerta('Erro', 'Erro ao deletar!');
            }
        });
    });
};

window.editarLancamento = function(id) {
    // Busca os dados atuais do item
    $.ajax({
        url: API_URL + '/' + id,
        method: 'GET',
        success: function(item) {
            // Preenche o modal
            $('#inputId').val(item.id);
            $('#inputDescricao').val(item.descricao);
            $('#inputValor').val(item.valor);
            $('#inputFixo').prop('checked', item.fixo);
            
            // Formata a data para o formato esperado pelo input type="date"
            if (item.data) {
                const dataFormatada = new Date(item.data).toISOString().split('T')[0];
                $('#inputData').val(dataFormatada);
            }

            // Lógica para selecionar o tipo correto
            if (item.tipo === 'RECEITA' && item.categoria === 'SALARIO') {
                 $('#inputTipo').val('SALARIO');
            } else {
                 $('#inputTipo').val(item.tipo);
            }

            // Atualiza as categorias e seleciona a categoria correta
            ajustarFormulario();
            if (item.categoria) {
                $('#inputCategoria').val(item.categoria);
            }

            // Abre o modal
            const modal = new bootstrap.Modal(document.getElementById('modalLancamento'));
            modal.show();
        }
    });
};

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ===== FUNÇÕES DE FILTROS =====
function preencherFiltroCategorias() {
    const tipo = $('#filtroTipo').val();
    const selectCategoria = $('#filtroCategoria');

    selectCategoria.empty();
    selectCategoria.append('<option value="">Todas</option>');

    let categorias = [];
    if (tipo === 'DESPESA') {
        categorias = categoriasPorTipo['DESPESA'];
    } else if (tipo === 'RECEITA') {
        categorias = [...categoriasPorTipo['RECEITA'], ...categoriasPorTipo['SALARIO']];
    } else {
        // Todas as categorias
        categorias = [
            ...categoriasPorTipo['DESPESA'],
            ...categoriasPorTipo['RECEITA'],
            ...categoriasPorTipo['SALARIO']
        ];
    }

    categorias.forEach(cat => {
        selectCategoria.append(`<option value="${cat.value}">${cat.label}</option>`);
    });
}

function aplicarFiltros() {
    const tipo = $('#filtroTipo').val();
    const categoria = $('#filtroCategoria').val();
    const dataInicio = $('#filtroDataInicio').val();
    const dataFim = $('#filtroDataFim').val();

    lancamentosFiltrados = todosLancamentos.filter(item => {
        // Filtro por tipo
        if (tipo && item.tipo !== tipo) {
            return false;
        }

        // Filtro por categoria
        if (categoria && item.categoria !== categoria) {
            return false;
        }

        // Filtro por data inicial
        if (dataInicio) {
            const dataItem = new Date(item.data);
            const dataInicioFiltro = new Date(dataInicio);
            if (dataItem < dataInicioFiltro) {
                return false;
            }
        }

        // Filtro por data final
        if (dataFim) {
            const dataItem = new Date(item.data);
            const dataFimFiltro = new Date(dataFim);
            if (dataItem > dataFimFiltro) {
                return false;
            }
        }

        return true;
    });

    atualizarTela(lancamentosFiltrados);
}

function limparFiltros() {
    $('#filtroTipo').val('');
    $('#filtroCategoria').val('');
    $('#filtroDataInicio').val('');
    $('#filtroDataFim').val('');

    preencherFiltroCategorias();
    lancamentosFiltrados = todosLancamentos;
    atualizarTela(lancamentosFiltrados);
}

// ===== FUNÇÕES DE IMPORTAÇÃO =====
function importarArquivo() {
    const arquivo = $('#arquivoImportacao')[0].files[0];

    if (!arquivo) {
        mostrarAlerta('Arquivo Necessário', 'Selecione um arquivo para importar!');
        return;
    }

    const formData = new FormData();
    formData.append('arquivo', arquivo);
    formData.append('usuarioId', usuarioId);

    $('#progressoImportacao').removeClass('d-none');
    $('#btnImportar').prop('disabled', true);

    $.ajax({
        url: '/api/importacao/upload',
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            $('#progressoImportacao').addClass('d-none');
            $('#btnImportar').prop('disabled', false);
            $('#modalImportacao').modal('hide');

            mostrarAlerta('Sucesso', `Importação concluída! ${response.total} lançamentos importados.`);
            carregarLancamentos();
        },
        error: function(xhr) {
            $('#progressoImportacao').addClass('d-none');
            $('#btnImportar').prop('disabled', false);

            const erro = xhr.responseJSON?.erro || 'Erro ao importar arquivo.';
            mostrarAlerta('Erro na Importação', erro);
        }
    });
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

            // Preenche modal de perfil
            $('#inputNomePerfil').val(data.nome || '');
            $('#inputFotoPerfil').val(data.fotoPerfil || '');
            $('#previewFotoPerfil').attr('src', fotoPerfil);
        },
        error: function() {
            console.error('Erro ao carregar perfil');
        }
    });
}

function salvarPerfil() {
    const nome = $('#inputNomePerfil').val();
    const fotoPerfil = $('#inputFotoPerfil').val();

    $.ajax({
        url: `/api/auth/perfil/${usuarioId}`,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({ nome, fotoPerfil }),
        success: function() {
            $('#modalPerfil').modal('hide');
            carregarPerfil();
            mostrarAlerta('Sucesso', 'Perfil atualizado com sucesso!');
        },
        error: function() {
            mostrarAlerta('Erro', 'Erro ao atualizar perfil');
        }
    });
}

// ===== FUNÇÕES DE COMPARTILHAMENTO =====
function abrirModalCompartilhar(lancamentoId) {
    $('#lancamentoCompartilharId').val(lancamentoId);
    $('#inputDescricaoCompartilhamento').val('');
    
    // Carrega a lista de usuários
    carregarListaUsuariosCompartilhamento();

    const modal = new bootstrap.Modal(document.getElementById('modalCompartilhar'));
    modal.show();
}

function carregarListaUsuariosCompartilhamento() {
    const select = $('#selectUsuarioCompartilhamento');
    select.html('<option value="">Carregando...</option>');

    $.ajax({
        url: '/api/auth/listar',
        method: 'GET',
        success: function(usuarios) {
            select.empty();
            select.append('<option value="">Selecione um usuário...</option>');

            if (usuarios.length === 0) {
                return;
            }

            usuarios.forEach(user => {
                if (user.id === parseInt(usuarioId)) return; // Não mostrar a si mesmo

                const nome = user.nome || user.username;
                select.append(`<option value="${user.id}">${nome} (@${user.username})</option>`);
            });
        },
        error: function() {
            select.html('<option value="">Erro ao carregar usuários</option>');
        }
    });
}

function enviarCompartilhamento() {
    const lancamentoId = $('#lancamentoCompartilharId').val();
    const descricao = $('#inputDescricaoCompartilhamento').val();
    const tipo = $('#selectTipoCompartilhamento').val();
    const usuarioDestinoId = $('#selectUsuarioCompartilhamento').val();

    if (!usuarioDestinoId) {
        mostrarAlerta('Usuário Necessário', 'Selecione um usuário');
        return;
    }

    if (!descricao) {
        mostrarAlerta('Descrição Necessária', 'Adicione uma descrição');
        return;
    }

    $.ajax({
        url: '/api/compartilhamento',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            lancamentoId,
            usuarioOrigemId: usuarioId,
            usuarioDestinoId: usuarioDestinoId,
            descricao,
            tipo
        }),
        success: function() {
            $('#modalCompartilhar').modal('hide');
            mostrarAlerta('Sucesso', 'Gasto compartilhado com sucesso!');
        },
        error: function() {
            mostrarAlerta('Erro', 'Erro ao compartilhar gasto');
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

            // Preenche modal de notificações
            const container = $('#listaNotificacoes');
            container.empty();

            if (pendentes.length === 0) {
                container.html('<p class="text-center text-muted p-3">Nenhum compartilhamento pendente</p>');
                return;
            }

            pendentes.forEach(item => {
                const lancamento = item.lancamento;
                const tipoLabels = {
                    'DIVISAO': 'Dividir custo',
                    'EMPRESTIMO': 'Empréstimo',
                    'REEMBOLSO': 'Reembolso',
                    'INFORMATIVO': 'Informativo'
                };

                const card = $(`
                    <div class="card mb-2">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <h6 class="mb-1">${lancamento.descricao}</h6>
                                    <p class="mb-1"><strong>Valor:</strong> ${formatarMoeda(lancamento.valor)}</p>
                                    <p class="mb-1"><strong>Tipo:</strong> <span class="badge bg-info">${tipoLabels[item.tipo]}</span></p>
                                    <p class="mb-2 text-muted small">${item.descricao}</p>
                                </div>
                            </div>
                            <div class="d-flex gap-2">
                                <button class="btn btn-sm btn-success btn-aceitar" data-id="${item.id}">
                                    <i class="bi bi-check-circle"></i> Aceitar
                                </button>
                                <button class="btn btn-sm btn-danger btn-recusar" data-id="${item.id}">
                                    <i class="bi bi-x-circle"></i> Recusar
                                </button>
                            </div>
                        </div>
                    </div>
                `);

                card.find('.btn-aceitar').click(function() {
                    aceitarCompartilhamento($(this).data('id'));
                });

                card.find('.btn-recusar').click(function() {
                    recusarCompartilhamento($(this).data('id'));
                });

                container.append(card);
            });
        }
    });
}

function aceitarCompartilhamento(id) {
    $.ajax({
        url: `/api/compartilhamento/${id}/aceitar`,
        method: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({}),
        success: function() {
            mostrarAlerta('Sucesso', 'Compartilhamento aceito!');
            carregarNotificacoesPendentes();
            carregarLancamentos();
        },
        error: function() {
            mostrarAlerta('Erro', 'Erro ao aceitar compartilhamento');
        }
    });
}

function recusarCompartilhamento(id) {
    $.ajax({
        url: `/api/compartilhamento/${id}/recusar`,
        method: 'PUT',
        success: function() {
            mostrarAlerta('Recusado', 'Compartilhamento recusado');
            carregarNotificacoesPendentes();
        },
        error: function() {
            mostrarAlerta('Erro', 'Erro ao recusar compartilhamento');
        }
    });
}

// ===== FUNÇÕES DE FILTRO E ORDENAÇÃO =====
function inicializarFiltroData() {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDiaProximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0);

    $('#filtroDataInicio').val(primeiroDia.toISOString().split('T')[0]);
    $('#filtroDataFim').val(ultimoDiaProximoMes.toISOString().split('T')[0]);
}

function aplicarOrdenacao() {
    lancamentosFiltrados.sort((a, b) => {
        if (ordenacaoAtual === 'data') {
            const diff = new Date(b.data) - new Date(a.data);
            return ordenacaoCrescente ? -diff : diff;
        } else {
            const diff = b.valor - a.valor;
            return ordenacaoCrescente ? -diff : diff;
        }
    });
    atualizarTela(lancamentosFiltrados);
}

function atualizarBotoesOrdenacao() {
    const iconeOrdem = ordenacaoCrescente ? '<i class="bi bi-arrow-up"></i>' : '<i class="bi bi-arrow-down"></i>';

    if (ordenacaoAtual === 'data') {
        $('#btnOrdenarData').addClass('active').html(`<i class="bi bi-calendar"></i> Data ${iconeOrdem}`);
        $('#btnOrdenarValor').removeClass('active').html('<i class="bi bi-currency-dollar"></i> Valor');
    } else {
        $('#btnOrdenarValor').addClass('active').html(`<i class="bi bi-currency-dollar"></i> Valor ${iconeOrdem}`);
        $('#btnOrdenarData').removeClass('active').html('<i class="bi bi-calendar"></i> Data');
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
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