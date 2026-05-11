# Fase 4 - Grade Curricular + Ajuste de Arquitetura CSS

Projeto: Site Institucional do Curso de Engenharia de Software  
Instituição: IFPE Campus Belo Jardim  
Tecnologias: HTML, CSS e JavaScript puros

## O que esta versão entrega

Esta versão mantém a Fase 4, com a página `grade.html`, e adiciona uma reorganização importante na arquitetura visual do projeto.

A partir desta entrega, o CSS não fica mais concentrado em um único arquivo. A estrutura foi separada entre estilos globais, componentes compartilhados e estilos específicos de cada página.

## Ajuste institucional da grade

A página de grade curricular foi atualizada para refletir a informação do curso:

- Duração: 4 anos.
- Organização: 8 períodos.
- A matriz visual ainda é demonstrativa até a chegada da matriz oficial do PPC ou documento institucional.

## Arquitetura CSS atual

```txt
assets/css/
├── global.css
├── components/
│   ├── base.css
│   ├── header.css
│   ├── buttons.css
│   ├── shared.css
│   ├── page-hero.css
│   ├── footer.css
│   └── responsive.css
└── pages/
    ├── home.css
    ├── sobre.css
    ├── ingresso.css
    └── grade.css
```

## Como funciona agora

Cada página importa o CSS global e depois importa somente seu CSS específico.

Exemplo da página inicial:

```html
<link rel="stylesheet" href="assets/css/global.css" />
<link rel="stylesheet" href="assets/css/pages/home.css" />
```

Exemplo da página de grade:

```html
<link rel="stylesheet" href="assets/css/global.css" />
<link rel="stylesheet" href="assets/css/pages/grade.css" />
```

## O que fica no CSS global

- Variáveis de cores, tamanhos e espaçamentos.
- Reset básico.
- Tipografia base.
- Container e seções.
- Cabeçalho.
- Menu principal.
- Botões compartilhados.
- Cards e elementos reutilizáveis.
- Banner interno de páginas.
- Rodapé.
- Responsividade global.

## O que fica no CSS de cada página

- Layout específico da home.
- Layout específico da página Sobre.
- Layout específico da página Ingresso.
- Layout específico da página Grade.

Assim, quando for necessário mudar uma tela específica, a alteração tende a ficar no arquivo daquela página, sem bagunçar o restante do site.

## Arquivos principais

- `index.html`
- `sobre.html`
- `ingresso.html`
- `grade.html`
- `assets/css/global.css`
- `assets/css/components/`
- `assets/css/pages/`
- `assets/js/script.js`
- `assets/img/logo-es.svg`

## Sequência prática de teste

1. Abrir `index.html` no navegador.
2. Conferir se a home mantém o mesmo visual institucional.
3. Verificar se o card de duração mostra `4 anos`.
4. Clicar em `Grade` no menu principal.
5. Confirmar se `grade.html` abriu corretamente.
6. Conferir se a página informa 8 períodos e 4 anos.
7. Clicar nos botões dos períodos de 1º até 8º.
8. Verificar se os blocos de disciplinas mudam sem recarregar a página.
9. Testar `Sobre` e `Ingresso` para garantir que os estilos foram carregados.
10. Reduzir a largura da tela e testar o menu mobile.
11. Clicar em `Voltar ao topo` no rodapé.

## Próxima fase sugerida

Fase 5 - Mercado de Trabalho e Estágio

Essa fase deve criar uma página própria para apresentar:

- Áreas de atuação.
- Possíveis cargos.
- Empresas e setores que contratam.
- Estágio supervisionado.
- Oportunidades de projetos reais.
- Empreendedorismo e inovação.
- Tendências da Engenharia de Software.
