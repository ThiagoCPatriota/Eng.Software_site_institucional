# README — Fase 7.6

## Objetivo da fase

A Fase 7.6 adiciona uma camada de experiência visual ao site institucional do curso de Engenharia de Software do IFPE Campus Belo Jardim.

A intenção é reduzir a sensação de páginas repetidas com muitos cards estáticos e criar blocos mais dinâmicos, narrativos e interativos, mantendo HTML, CSS e JavaScript puros.

## O que foi feito

### 1. Novo sistema visual de experiência

Foi criado o arquivo:

- `assets/css/components/experience.css`

Ele adiciona componentes reutilizáveis para:

- trilhas horizontais com rolagem;
- cards em formato de capítulos;
- controles de avançar e voltar;
- painéis interativos por escolha;
- bloco de notícias em movimento;
- microanimações leves;
- comportamento responsivo.

O arquivo foi importado em:

- `assets/css/global.css`

### 2. Página Sobre

Arquivo alterado:

- `sobre.html`

Foi adicionada uma seção chamada **Fase 7.6 • Experiência**, transformando a apresentação do curso em uma leitura por capítulos:

1. Problema antes do código
2. Projeto com direção
3. Construção progressiva
4. Qualidade no caminho
5. Impacto acadêmico e regional

Isso deixa a página mais interessante e evita depender apenas de grids tradicionais.

### 3. Página Ingresso

Arquivos alterados:

- `ingresso.html`
- `assets/css/pages/ingresso.css`

Foram adicionados:

- um guia interativo para o candidato escolher sua situação;
- painéis que mudam ao clicar nas opções;
- trilha horizontal para as formas de ingresso;
- botões de avançar e voltar nos cards de ingresso.

A ideia é deixar a página mais leve para o visitante, mostrando as informações aos poucos.

### 4. Página Grade

Arquivo alterado:

- `grade.html`

Foi adicionada uma leitura narrativa da jornada de 4 anos:

1. Entrada e fundamentos
2. Modelagem e desenvolvimento
3. Qualidade e sistemas
4. Síntese profissional

A grade continua com os períodos detalhados, mas agora a página tem uma entrada mais visual antes da matriz.

### 5. Página Mercado

Arquivo alterado:

- `mercado.html`

Foi adicionada uma trilha profissional horizontal:

1. Aprender fazendo
2. Montar portfólio
3. Buscar estágio
4. Escolher foco

Isso ajuda o visitante a entender evolução profissional sem cair direto em listas de cargos.

### 6. Página Projetos

Arquivo alterado:

- `projetos.html`

Foi criado o bloco **Radar do curso**, com uma faixa de acontecimentos em movimento. Por enquanto, o conteúdo é demonstrativo. Futuramente, pode ser alimentado por painel administrativo/backend.

### 7. JavaScript

Arquivo alterado:

- `assets/js/script.js`

Foram adicionadas funções para:

- controlar trilhas horizontais com botões;
- alternar painéis interativos da página de ingresso.

Tudo continua em JavaScript puro.

## Arquivos criados/adicionados

- `assets/css/components/experience.css`
- `README_FASE_7_6.md`

## Arquivos alterados/substituir

- `assets/css/global.css`
- `assets/css/pages/ingresso.css`
- `assets/js/script.js`
- `sobre.html`
- `ingresso.html`
- `grade.html`
- `mercado.html`
- `projetos.html`

## Como aplicar

1. Extraia o ZIP dentro da pasta principal do projeto.
2. Substitua os arquivos quando o sistema perguntar.
3. Garanta que o novo arquivo `assets/css/components/experience.css` foi criado.
4. Abra o site a partir de `index.html`.

## Sequência prática de teste

1. Abrir `index.html`.
2. Ir no menu **Curso > Sobre o curso**.
3. Verificar se aparece a seção de capítulos da formação.
4. Usar as setas da trilha horizontal.
5. Ir em **Curso > Formas de ingresso**.
6. Clicar nas opções do guia interativo: ENEM, transferência, diploma e não sei por onde começar.
7. Testar se os painéis mudam corretamente.
8. Usar as setas da trilha de formas de ingresso.
9. Abrir `grade.html` e conferir a jornada de 4 anos.
10. Abrir `mercado.html` e conferir a trilha profissional.
11. Abrir `projetos.html` e conferir o radar de acontecimentos.
12. Testar no celular.
13. Verificar se o menu mobile continua funcionando.
14. Conferir se não há conteúdo vazando para fora da tela.

## Próximo módulo sugerido

Depois da Fase 7.6, o próximo passo natural continua sendo a **Fase 8 — Contato, Coordenação e FAQ**.

Antes da Fase 8, também podemos fazer uma microfase 7.7 apenas para ajustar detalhes visuais caso algum bloco da Fase 7.6 fique pesado, exagerado ou desalinhado depois do teste no navegador.
