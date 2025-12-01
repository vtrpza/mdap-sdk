/**
 * MDAP Landing Page - Main Entry Point
 */

import './styles/main.css';
import { createTicketDemo } from './demo/ticket-demo';
import { DEMO_STATS } from './demo/mock-llm';

// Initialize the interactive demo
document.addEventListener('DOMContentLoaded', () => {
  const demoContainer = document.getElementById('interactive-demo');
  if (demoContainer) {
    createTicketDemo(demoContainer);
  }

  // Animate stats on scroll
  const statsSection = document.getElementById('stats-section');
  if (statsSection) {
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

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const href = anchor.getAttribute('href');
      if (href) {
        const target = document.querySelector(href);
        target?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});

function animateStats() {
  const stats = [
    { id: 'stat-accuracy', value: DEMO_STATS.mdapAccuracy * 100, suffix: '%', decimals: 1 },
    { id: 'stat-improvement', value: DEMO_STATS.reliabilityImprovement, suffix: 'x', decimals: 0 },
    { id: 'stat-samples', value: DEMO_STATS.avgSamplesPerCall, suffix: '', decimals: 1 },
    { id: 'stat-cost', value: DEMO_STATS.costPerClassification * 1000, suffix: '', decimals: 1, prefix: '$0.00' },
  ];

  stats.forEach(({ id, value, suffix, decimals, prefix }) => {
    const el = document.getElementById(id);
    if (el) {
      animateNumber(el, 0, value, 1500, decimals, suffix, prefix);
    }
  });
}

function animateNumber(
  el: HTMLElement,
  start: number,
  end: number,
  duration: number,
  decimals: number,
  suffix: string,
  prefix?: string
) {
  const startTime = performance.now();

  function update(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
    const current = start + (end - start) * eased;

    if (prefix) {
      el.textContent = prefix + current.toFixed(decimals).slice(-1) + suffix;
    } else {
      el.textContent = current.toFixed(decimals) + suffix;
    }

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}
