/* Catálogo Best4You Market — JS puro, sem dependências.
 * Segurança: todo texto vindo do JSON entra no DOM via textContent.
 * Nunca usar innerHTML/insertAdjacentHTML com dados do catálogo. */
(function () {
  'use strict';

  var IMG_RE = /^[0-9a-f]{16}\.webp$/;
  var PLACEHOLDER = 'assets/placeholder.webp';
  var POR_PRATELEIRA = 12;

  var $ = function (id) { return document.getElementById(id); };
  var $busca = $('busca'), $chips = $('chips'), $prateleiras = $('prateleiras');
  var $visaoGrade = $('visao-grade'), $grade = $('grade'), $gradeTitulo = $('grade-titulo');
  var $voltar = $('voltar'), $contador = $('contador'), $vazio = $('vazio');
  var $erro = $('erro'), $carregando = $('carregando'), $atualizado = $('atualizado');
  var $limparBusca = $('limpar-busca'), $limparTudo = $('limpar-tudo');

  var produtos = [];        // [{nome, preco, categoria, nome_busca, img, _busca}]
  var categorias = [];      // ordem de aparição no JSON; "Outros" por último
  var cardsGrade = [];      // um card por produto, anexado só quando visível
  var chipsPorCat = {};     // categoria ('' = Todas) → botão chip
  var estado = { busca: '', categoria: '' };
  var debounceId = 0;

  /* Normaliza texto para busca: minúsculas, sem acentos, espaços colapsados. */
  function normalizar(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function formatarPreco(v) {
    var n = Number(v);
    if (!isFinite(n)) return '';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function criarCard(p, mostrarCategoria) {
    var card = document.createElement('div');
    card.className = 'card';

    var foto = document.createElement('div');
    foto.className = 'card-foto';
    var img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 480;
    img.height = 480;
    img.alt = '';
    var nomeImg = (typeof p.img === 'string') ? p.img : '';
    img.setAttribute('src', IMG_RE.test(nomeImg) ? ('assets/produtos/' + nomeImg) : PLACEHOLDER);
    img.addEventListener('error', function () {
      if (img.getAttribute('src') !== PLACEHOLDER) img.setAttribute('src', PLACEHOLDER);
    });
    foto.appendChild(img);

    var info = document.createElement('div');
    info.className = 'card-info';
    if (mostrarCategoria) {
      var cat = document.createElement('p');
      cat.className = 'card-categoria';
      cat.textContent = p.categoria;
      info.appendChild(cat);
    }
    var nome = document.createElement('p');
    nome.className = 'card-nome';
    nome.textContent = p.nome;
    var preco = document.createElement('p');
    preco.className = 'card-preco';
    preco.textContent = formatarPreco(p.preco);
    info.appendChild(nome);
    info.appendChild(preco);

    card.appendChild(foto);
    card.appendChild(info);
    return card;
  }

  /* ── Prateleiras (tela inicial) ─────────────────────────────────────────── */

  function criarSeta(direcao, trilho) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'seta seta-' + (direcao > 0 ? 'next' : 'prev');
    b.setAttribute('aria-label', direcao > 0 ? 'Avançar produtos' : 'Voltar produtos');
    b.textContent = direcao > 0 ? '›' : '‹';
    b.addEventListener('click', function () {
      trilho.scrollBy({ left: direcao * trilho.clientWidth * 0.9, behavior: 'smooth' });
    });
    return b;
  }

  function construirPrateleiras() {
    var frag = document.createDocumentFragment();
    categorias.forEach(function (cat) {
      var itens = produtos.filter(function (p) { return p.categoria === cat; });

      var secao = document.createElement('section');
      secao.className = 'prateleira';

      var cab = document.createElement('div');
      cab.className = 'prateleira-cab';
      var h2 = document.createElement('h2');
      h2.textContent = cat;
      var qtd = document.createElement('span');
      qtd.className = 'qtd';
      qtd.textContent = itens.length + (itens.length === 1 ? ' produto' : ' produtos');
      var ver = document.createElement('button');
      ver.type = 'button';
      ver.className = 'ver-todos';
      ver.textContent = 'Ver todos';
      ver.setAttribute('aria-label', 'Ver todos os produtos de ' + cat);
      ver.addEventListener('click', function () { irParaCategoria(cat); });
      cab.appendChild(h2);
      cab.appendChild(qtd);
      cab.appendChild(ver);

      var wrap = document.createElement('div');
      wrap.className = 'trilho-wrap';
      var trilho = document.createElement('div');
      trilho.className = 'trilho';
      trilho.tabIndex = 0;
      trilho.setAttribute('role', 'list');
      trilho.setAttribute('aria-label', 'Produtos de ' + cat + ' — role para o lado para ver mais');
      itens.slice(0, POR_PRATELEIRA).forEach(function (p) {
        var c = criarCard(p, false);
        c.setAttribute('role', 'listitem');
        trilho.appendChild(c);
      });
      wrap.appendChild(criarSeta(-1, trilho));
      wrap.appendChild(trilho);
      wrap.appendChild(criarSeta(1, trilho));

      secao.appendChild(cab);
      secao.appendChild(wrap);
      frag.appendChild(secao);
    });
    $prateleiras.appendChild(frag);
  }

  /* ── Chips de categoria ─────────────────────────────────────────────────── */

  function construirChips() {
    var lista = [''].concat(categorias); // '' = Todas
    lista.forEach(function (cat) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = cat === '' ? 'Todas' : cat;
      chip.setAttribute('aria-pressed', cat === estado.categoria ? 'true' : 'false');
      chip.addEventListener('click', function () {
        if (cat === '') { irParaInicio(); } else { irParaCategoria(cat); }
      });
      chipsPorCat[cat] = chip;
      $chips.appendChild(chip);
    });
  }

  function atualizarChips() {
    Object.keys(chipsPorCat).forEach(function (cat) {
      var ativo = cat === estado.categoria;
      chipsPorCat[cat].setAttribute('aria-pressed', ativo ? 'true' : 'false');
      if (ativo) {
        chipsPorCat[cat].scrollIntoView({ inline: 'nearest', block: 'nearest' });
      }
    });
  }

  /* ── Navegação (hash → botão voltar do navegador funciona) ──────────────── */

  function irParaCategoria(cat) {
    if (estado.categoria === cat) { render(); return; }
    location.hash = 'c=' + encodeURIComponent(cat);
  }

  function irParaInicio() {
    estado.busca = '';
    $busca.value = '';
    if (location.hash && location.hash !== '#') {
      location.hash = '';           // dispara hashchange → render
    } else {
      estado.categoria = '';
      render();
    }
  }

  function aplicarHash() {
    var h = location.hash.replace(/^#/, '');
    var cat = '';
    if (h.indexOf('c=') === 0) {
      try { cat = decodeURIComponent(h.slice(2)); } catch (e) { cat = ''; }
      if (categorias.indexOf(cat) === -1) cat = '';
    }
    estado.categoria = cat;
    render();
  }

  /* ── Renderização ───────────────────────────────────────────────────────── */

  function render() {
    var q = normalizar(estado.busca);
    var cat = estado.categoria;
    var inicio = !q && !cat;

    atualizarChips();
    $limparBusca.hidden = $busca.value === '';

    if (inicio) {
      $prateleiras.hidden = false;
      $visaoGrade.hidden = true;
      return;
    }

    $prateleiras.hidden = true;
    $visaoGrade.hidden = false;

    var universo = cat
      ? produtos.filter(function (p) { return p.categoria === cat; })
      : produtos;
    var visiveis = q
      ? universo.filter(function (p) { return p._busca.indexOf(q) !== -1; })
      : universo;

    // anexa somente os resultados (cards pré-criados, um por produto)
    var frag = document.createDocumentFragment();
    visiveis.forEach(function (p) { frag.appendChild(cardsGrade[p._i]); });
    $grade.replaceChildren(frag);

    // categoria pequena no card apenas na busca global (via CSS)
    $grade.classList.toggle('mostra-categoria', !cat);

    $gradeTitulo.textContent = cat || 'Resultados da busca';
    if (q && cat) {
      $contador.textContent = visiveis.length + ' de ' + universo.length + ' em ' + cat;
    } else if (cat) {
      $contador.textContent = universo.length + (universo.length === 1 ? ' produto' : ' produtos');
    } else {
      $contador.textContent = visiveis.length + (visiveis.length === 1 ? ' produto encontrado' : ' produtos encontrados');
    }
    $vazio.hidden = visiveis.length !== 0;
    $grade.hidden = visiveis.length === 0;
  }

  /* ── Inicialização ──────────────────────────────────────────────────────── */

  function mostrarAtualizacao(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return;
    $atualizado.textContent = 'Atualizado em ' +
      d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function iniciar(dados) {
    var lista = (dados && Array.isArray(dados.produtos)) ? dados.produtos : [];
    produtos = lista.filter(function (p) {
      return p && typeof p.nome === 'string' && isFinite(Number(p.preco));
    });

    var vistas = Object.create(null);
    produtos.forEach(function (p, i) {
      p._i = i;
      p._busca = normalizar(typeof p.nome_busca === 'string' ? p.nome_busca : p.nome);
      if (typeof p.categoria !== 'string' || !p.categoria.trim()) p.categoria = 'Outros';
      if (!vistas[p.categoria]) { vistas[p.categoria] = true; categorias.push(p.categoria); }
    });
    // "Outros" sempre por último
    var iOutros = categorias.indexOf('Outros');
    if (iOutros !== -1) { categorias.splice(iOutros, 1); categorias.push('Outros'); }

    if (dados && dados.gerado_em) mostrarAtualizacao(dados.gerado_em);

    if (!produtos.length) {
      $carregando.hidden = true;
      $erro.hidden = false;
      return;
    }

    cardsGrade = produtos.map(function (p) { return criarCard(p, true); });
    construirChips();
    construirPrateleiras();
    $carregando.hidden = true;
    aplicarHash();
  }

  function falhar() {
    $carregando.hidden = true;
    $prateleiras.hidden = true;
    $visaoGrade.hidden = true;
    $erro.hidden = false;
  }

  $busca.addEventListener('input', function () {
    clearTimeout(debounceId);
    debounceId = setTimeout(function () {
      estado.busca = $busca.value;
      render();
    }, 120);
  });
  $limparBusca.addEventListener('click', function () {
    $busca.value = '';
    estado.busca = '';
    render();
    $busca.focus();
  });
  $limparTudo.addEventListener('click', irParaInicio);
  $voltar.addEventListener('click', irParaInicio);
  window.addEventListener('hashchange', aplicarHash);

  fetch('products.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(iniciar)
    .catch(falhar);
})();
