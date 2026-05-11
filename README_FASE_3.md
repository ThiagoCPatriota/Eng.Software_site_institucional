# Site de Engenharia de Software - IFPE Campus Belo Jardim

## Entrega: Fase 3 - Formas de Ingresso e Matrícula

Esta entrega dá continuidade ao site institucional do curso de Engenharia de Software do IFPE Campus Belo Jardim, mantendo a proposta de um layout moderno, limpo e institucional, com azul como base visual e verde como apoio de identidade IFPE.

A principal evolução da Fase 3 é a criação da primeira página focada em orientação ao candidato: `ingresso.html`.

---

## Arquivos da entrega

```txt
index.html
sobre.html
ingresso.html
README_FASE_3.md
assets/css/style.css
assets/js/script.js
assets/img/logo-es.svg
```

---

## O que foi implementado

### 1. Nova página `ingresso.html`

A página apresenta:

- Banner interno de ingresso e matrícula.
- Breadcrumb de navegação.
- Aviso sobre editais e informações oficiais.
- Cards com formas de ingresso.
- Passo a passo para o candidato.
- Lista de documentos comuns para matrícula.
- Área de calendário com datas a definir.
- Prévia de FAQ interativo.
- Chamada para a próxima fase: grade curricular.

### 2. Formas de ingresso apresentadas

A página contempla, em formato institucional e genérico:

- SISU / ENEM.
- Vestibular ou seleção própria.
- Transferência.
- Portador de diploma.
- Reingresso.
- Vagas remanescentes.

> Observação: os textos usam linguagem segura, indicando que regras, prazos, documentos e modalidades devem ser confirmados nos editais oficiais da instituição.

### 3. Atualização da navegação

O menu agora direciona o item **Ingresso** para a página própria:

```txt
ingresso.html
```

Também foram atualizados links da home e da página Sobre para evitar que tudo fique concentrado em uma única página.

### 4. Novos estilos no CSS

Foram adicionadas classes para:

- Cards de formas de ingresso.
- Alerta institucional.
- Timeline de etapas.
- Cards de documentos.
- Painel de calendário.
- FAQ interativo.
- Responsividade da página de ingresso.

### 5. Nova interação em JavaScript

Foi implementado um FAQ simples com abertura e fechamento de perguntas usando JavaScript puro.

---

## Como testar

1. Abra o arquivo `index.html` no navegador.
2. Clique no menu **Ingresso**.
3. Confirme se a página `ingresso.html` foi aberta.
4. Teste os botões do banner:
   - `Ver formas de ingresso`.
   - `Ver passo a passo`.
5. Role a página e confira os cards de formas de ingresso.
6. Veja se o bloco de documentos aparece corretamente.
7. Confira o painel de calendário.
8. Abra e feche as perguntas do FAQ.
9. Reduza a tela para testar no modo celular.
10. Abra o menu mobile e teste os links.
11. Clique no botão de voltar ao topo no rodapé.

---

## Próxima fase recomendada

A próxima entrega natural é a **Fase 4 - Grade Curricular**.

Ela deve criar a página:

```txt
grade.html
```

Conteúdos sugeridos:

- Organização por períodos.
- Disciplinas obrigatórias.
- Disciplinas optativas, se houver.
- Carga horária total.
- Estágio.
- TCC.
- Projetos integradores.
- Laboratórios e práticas.

