(function () {
  const carousel = document.querySelector('[data-differentials-carousel]');
  if (!carousel) return;

  const track = carousel.querySelector('[data-differentials-track]');
  const originalCards = Array.from(carousel.querySelectorAll('[data-differential-card]'));
  const prevButton = carousel.querySelector('[data-differential-prev]');
  const nextButton = carousel.querySelector('[data-differential-next]');
  const dotsContainer = carousel.querySelector('[data-differential-dots]');

  if (!track || originalCards.length === 0 || !prevButton || !nextButton || !dotsContainer) return;

  let currentIndex = 0;
  let visibleCount = getVisibleCount();
  let cloneCount = getCloneCount(visibleCount);
  let isAnimatingEdge = false;

  originalCards.forEach((card, index) => {
    card.dataset.originalIndex = String(index);
    card.tabIndex = 0;
    card.addEventListener('click', () => goTo(index));
  });

  function getVisibleCount() {
    return window.matchMedia('(max-width: 980px)').matches ? 1 : 3;
  }

  function getCloneCount(count) {
    return count === 1 ? 1 : count - 1;
  }

  function normalize(index) {
    const total = originalCards.length;
    return ((index % total) + total) % total;
  }

  function getGap() {
    const styles = window.getComputedStyle(track);
    return Number.parseFloat(styles.columnGap || styles.gap || '0') || 0;
  }

  function makeClone(card) {
    const clone = card.cloneNode(true);
    clone.classList.add('is-clone');
    clone.removeAttribute('data-differential-card');
    clone.setAttribute('aria-hidden', 'true');
    clone.tabIndex = -1;
    clone.dataset.originalIndex = card.dataset.originalIndex;
    return clone;
  }

  function buildTrack() {
    visibleCount = getVisibleCount();
    cloneCount = getCloneCount(visibleCount);

    const beforeClones = originalCards.slice(-cloneCount).map(makeClone);
    const afterClones = originalCards.slice(0, cloneCount).map(makeClone);

    track.innerHTML = '';
    beforeClones.forEach((clone) => track.appendChild(clone));
    originalCards.forEach((card) => track.appendChild(card));
    afterClones.forEach((clone) => track.appendChild(clone));

    renderDots();
    jumpTo(currentIndex);
  }

  function renderDots() {
    dotsContainer.innerHTML = '';

    originalCards.forEach((_, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'differential-dot';
      dot.setAttribute('aria-label', `Ver diferencial ${index + 1}`);
      dot.addEventListener('click', () => goTo(index));
      dotsContainer.appendChild(dot);
    });
  }

  function getOffsetIndex(targetIndex) {
    const sideCount = Math.floor(visibleCount / 2);
    return cloneCount - sideCount + targetIndex;
  }

  function applyTransform(targetIndex, animate) {
    const slides = Array.from(track.querySelectorAll('.differential-slide'));
    const referenceCard = slides[cloneCount] || slides[0];
    if (!referenceCard) return;

    const cardWidth = referenceCard.getBoundingClientRect().width;
    const gap = getGap();
    const offset = getOffsetIndex(targetIndex) * (cardWidth + gap);

    track.style.transition = animate ? '' : 'none';
    track.style.transform = `translate3d(${-offset}px, 0, 0)`;
  }

  function updateVisualState(logicalIndex) {
    const normalizedIndex = normalize(logicalIndex);
    const slides = Array.from(track.querySelectorAll('.differential-slide'));

    slides.forEach((slide) => {
      const isActive = Number(slide.dataset.originalIndex) === normalizedIndex;
      slide.classList.toggle('is-active', isActive);
      if (!slide.classList.contains('is-clone')) {
        slide.setAttribute('aria-current', isActive ? 'true' : 'false');
      }
    });

    const dots = Array.from(dotsContainer.querySelectorAll('.differential-dot'));
    dots.forEach((dot, index) => {
      const isActive = index === normalizedIndex;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
  }

  function jumpTo(index) {
    currentIndex = normalize(index);
    updateVisualState(currentIndex);
    applyTransform(currentIndex, false);

    window.requestAnimationFrame(() => {
      track.style.transition = '';
    });
  }

  function goTo(targetIndex) {
    if (isAnimatingEdge) return;

    const total = originalCards.length;
    const normalizedIndex = normalize(targetIndex);
    const isEdgeMove = targetIndex < 0 || targetIndex >= total;

    currentIndex = normalizedIndex;
    updateVisualState(normalizedIndex);
    applyTransform(targetIndex, true);

    if (!isEdgeMove) return;

    isAnimatingEdge = true;

    const handleTransitionEnd = (event) => {
      if (event.propertyName !== 'transform') return;
      track.removeEventListener('transitionend', handleTransitionEnd);
      jumpTo(normalizedIndex);
      isAnimatingEdge = false;
    };

    track.addEventListener('transitionend', handleTransitionEnd);
  }

  prevButton.addEventListener('click', () => goTo(currentIndex - 1));
  nextButton.addEventListener('click', () => goTo(currentIndex + 1));

  window.addEventListener('resize', () => {
    const nextVisibleCount = getVisibleCount();
    if (nextVisibleCount !== visibleCount) {
      buildTrack();
      return;
    }

    jumpTo(currentIndex);
  });

  buildTrack();
})();
