/**
 * MDAP Landing Page - Main Entry Point
 * Precision Control Center Theme
 */

import './styles/main.css';
import { createTicketDemo } from './demo/ticket-demo';
import { DEMO_STATS } from './demo/mock-llm';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initParticles();
  initOrbitingParticles();
  initScrollAnimations();
  initStatsAnimation();
  initSmoothScroll();
  initDemo();
});

/**
 * Initialize mobile menu functionality
 */
function initMobileMenu(): void {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  const closeBtn = document.getElementById('mobile-menu-close');
  const menuLinks = menu?.querySelectorAll('a');

  if (!menuBtn || !menu) return;

  // Open menu
  menuBtn.addEventListener('click', () => {
    menu.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  // Close menu
  const closeMenu = (): void => {
    menu.classList.remove('active');
    document.body.style.overflow = '';
  };

  closeBtn?.addEventListener('click', closeMenu);

  // Close on link click
  menuLinks?.forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('active')) {
      closeMenu();
    }
  });
}

/**
 * Initialize floating background particles
 */
function initParticles(): void {
  const container = document.getElementById('particles-container');
  if (!container) return;

  const particleCount = 30;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';

    // Random positioning
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${Math.random() * 100}%`;

    // Random size variation
    const size = 1 + Math.random() * 2;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;

    // Random animation delay and duration
    particle.style.animationDelay = `${Math.random() * 8}s`;
    particle.style.animationDuration = `${6 + Math.random() * 6}s`;

    // Random opacity
    particle.style.opacity = `${0.1 + Math.random() * 0.4}`;

    container.appendChild(particle);
  }
}

/**
 * Initialize orbiting particles in the hero visualization
 */
function initOrbitingParticles(): void {
  const container = document.getElementById('orbit-container');
  if (!container) return;

  const orbits = [
    { radius: 45, particles: 3, speed: 20, color: '#fbbf24' }, // amber
    { radius: 35, particles: 4, speed: 15, color: '#22d3ee' }, // cyan
    { radius: 25, particles: 2, speed: 25, color: '#22c55e' }, // green
  ];

  orbits.forEach((orbit, orbitIndex) => {
    for (let i = 0; i < orbit.particles; i++) {
      const particle = document.createElement('div');
      particle.className = 'absolute w-2 h-2 rounded-full';
      particle.style.backgroundColor = orbit.color;
      particle.style.boxShadow = `0 0 10px ${orbit.color}`;

      // Position on orbit
      const angle = (i / orbit.particles) * Math.PI * 2;
      const startAngle = angle + orbitIndex * 0.5;

      // Animate orbit
      particle.style.animation = `orbit${orbitIndex} ${orbit.speed}s linear infinite`;
      particle.style.animationDelay = `${(i / orbit.particles) * orbit.speed}s`;

      // Calculate initial position
      const x = 50 + orbit.radius * Math.cos(startAngle);
      const y = 50 + orbit.radius * Math.sin(startAngle);
      particle.style.left = `${x}%`;
      particle.style.top = `${y}%`;
      particle.style.transform = 'translate(-50%, -50%)';

      container.appendChild(particle);
    }
  });

  // Add keyframes dynamically
  const style = document.createElement('style');
  style.textContent = `
    @keyframes orbit0 {
      from { transform: translate(-50%, -50%) rotate(0deg) translateX(45%) rotate(0deg); }
      to { transform: translate(-50%, -50%) rotate(360deg) translateX(45%) rotate(-360deg); }
    }
    @keyframes orbit1 {
      from { transform: translate(-50%, -50%) rotate(0deg) translateX(35%) rotate(0deg); }
      to { transform: translate(-50%, -50%) rotate(-360deg) translateX(35%) rotate(360deg); }
    }
    @keyframes orbit2 {
      from { transform: translate(-50%, -50%) rotate(0deg) translateX(25%) rotate(0deg); }
      to { transform: translate(-50%, -50%) rotate(360deg) translateX(25%) rotate(-360deg); }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Initialize scroll-triggered animations
 */
function initScrollAnimations(): void {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px',
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate');
        // Don't unobserve to allow re-animation on scroll up/down
      }
    });
  }, observerOptions);

  // Observe all elements with data-animate attribute
  document.querySelectorAll('[data-animate]').forEach((el) => {
    observer.observe(el);
  });

  // Also add stagger delays to card groups
  document.querySelectorAll('.grid .card').forEach((card, index) => {
    (card as HTMLElement).style.animationDelay = `${index * 100}ms`;
  });
}

/**
 * Initialize stats counter animation
 */
function initStatsAnimation(): void {
  const statsSection = document.getElementById('stats-section');
  if (!statsSection) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateStats();
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  observer.observe(statsSection);
}

/**
 * Animate stat counters
 */
function animateStats(): void {
  const stats = [
    { id: 'stat-accuracy', value: DEMO_STATS.mdapAccuracy * 100, suffix: '%', decimals: 0 },
    { id: 'stat-improvement', value: DEMO_STATS.reliabilityImprovement, suffix: 'x', decimals: 0 },
    { id: 'stat-samples', value: DEMO_STATS.avgSamplesPerCall, suffix: '', decimals: 1 },
    // Cost is now static in HTML - no animation needed
  ];

  stats.forEach(({ id, value, suffix, decimals }) => {
    const el = document.getElementById(id);
    if (el) {
      animateNumber(el, 0, value, 2000, decimals, suffix);
    }
  });
}

/**
 * Animate a number from start to end
 */
function animateNumber(
  el: HTMLElement,
  start: number,
  end: number,
  duration: number,
  decimals: number,
  suffix: string
): void {
  const startTime = performance.now();

  function update(currentTime: number): void {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic for smooth deceleration
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (end - start) * eased;

    el.textContent = current.toFixed(decimals) + suffix;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

/**
 * Initialize smooth scrolling for anchor links
 */
function initSmoothScroll(): void {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const href = anchor.getAttribute('href');
      if (href && href !== '#') {
        const target = document.querySelector(href);
        if (target) {
          // Account for fixed navbar
          const navHeight = 64;
          const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight;

          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth',
          });
        }
      }
    });
  });
}

/**
 * Initialize the interactive demo
 */
function initDemo(): void {
  const demoContainer = document.getElementById('interactive-demo');
  if (demoContainer) {
    // Clear loading state using DOM methods
    while (demoContainer.firstChild) {
      demoContainer.removeChild(demoContainer.firstChild);
    }
    createTicketDemo(demoContainer);
  }
}

// Export for potential external use
export { initParticles, initOrbitingParticles, initScrollAnimations };
