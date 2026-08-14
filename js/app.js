/* Catálogo Best4You Market — JS puro, sem dependências.
 * Segurança: todo texto vindo do JSON entra no DOM via textContent.
 * Nunca usar innerHTML/insertAdjacentHTML com dados do catálogo. */
(function () {
  'use strict';

  var IMG_RE = /^[0-9a-f]{16}\.webp$/;
  var PLACEHOLDER = 'assets/placeholder.webp';

  var $grid = document.getElementById('grid');
  var $busca = document.getElementById('busca');
  var $categoria = document.getElementById('categoria');
  var $limpar = document.getElementById('limpar');
  var $limparVazio = document.getElementById('limpar-vazio');
  var $contador = document.getElementById('contador');
  var $vazio = document.getElementById('vazio');
  var $erro = document.getElementById('erro');
  var $carregando = document.getElementById('carregando');
  var $atualizado = document.getElementById('atualizado');

  var produtos = [];        // [{nome, preco, categoria, nome_busca, img}]
  var cards = [];           // elementos <div.card>, mesma ordem de `produtos`

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

  function criarCard(p) {
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

    var cat = document.createElement('p');
    cat.className = 'card-categoria';
    cat.textContent = p.categoria;

    var nome = document.createElement('p');
    nome.className = 'card-nome';
    nome.textContent = p.nome;

    var preco = document.createElement('p');
    preco.className = 'card-preco';
    preco.textContent = formatarPreco(p.preco);

    info.appendChild(cat);
    info.appendChild(nome);
    info.appendChild(preco);
    card.appendChild(foto);
    card.appendChild(info);
    return card;
  }

  function montarCategorias() {
    var vistas = Object.create(null);
    var lista = [];
    produtos.forEach(function (p) {
      var c = String(p.categoria || '');
      if (c && !vistas[c]) { vistas[c] = true; lista.push(c); }
    });
    lista.sort(function (a, b) {
      if (a === 'Outros') return 1;
      if (b === 'Outros') return -1;
      return a.localeCompare(b, 'pt-BR');
    });
    lista.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      $categoria.appendChild(opt);
    });
  }

  function aplicarFiltros() {
    var q = normalizar($busca.value);
    var cat = $categoria.value;
    var visiveis = 0;

    produtos.forEach(function (p, i) {
      var ok = true;
      if (cat && p.categoria !== cat) ok = false;
      if (ok && q && p._busca.indexOf(q) === -1) ok = false;
      cards[i].hidden = !ok;
      if (ok) visiveis++;
    });

    var filtrando = !!(q || cat);
    $limpar.hidden = !filtrando;
    if (filtrando) {
      $contador.textContent = visiveis + ' de ' + produtos.length + ' produtos';
    } else {
      $contador.textContent = produtos.length + ' produtos';
    }
    $vazio.hidden = visiveis !== 0;
    $grid.hidden = visiveis === 0;
  }

  function limparFiltros() {
    $busca.value = '';
    $categoria.value = '';
    aplicarFiltros();
    $busca.focus();
  }

  function mostrarAtualizacao(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return;
    var data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    var hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    $atualizado.textContent = 'Atualizado em ' + data + ' às ' + hora;
  }

  function iniciar(dados) {
    var lista = (dados && Array.isArray(dados.produtos)) ? dados.produtos : [];
    produtos = lista.filter(function (p) {
      return p && typeof p.nome === 'string' && isFinite(Number(p.preco));
    });
    produtos.forEach(function (p) {
      p._busca = normalizar(typeof p.nome_busca === 'string' ? p.nome_busca : p.nome);
      if (typeof p.categoria !== 'string' || !p.categoria.trim()) p.categoria = 'Outros';
    });

    if (dados && dados.gerado_em) mostrarAtualizacao(dados.gerado_em);

    if (!produtos.length) {
      $carregando.hidden = true;
      $erro.hidden = false;
      return;
    }

    var frag = document.createDocumentFragment();
    cards = produtos.map(function (p) {
      var el = criarCard(p);
      frag.appendChild(el);
      return el;
    });
    $grid.appendChild(frag);

    montarCategorias();
    $carregando.hidden = true;
    $grid.hidden = false;
    aplicarFiltros();
  }

  function falhar() {
    $carregando.hidden = true;
    $grid.hidden = true;
    $erro.hidden = false;
  }

  $busca.addEventListener('input', aplicarFiltros);
  $categoria.addEventListener('change', aplicarFiltros);
  $limpar.addEventListener('click', limparFiltros);
  $limparVazio.addEventListener('click', limparFiltros);

  fetch('products.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(iniciar)
    .catch(falhar);
})();
